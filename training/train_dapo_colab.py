#!/usr/bin/env python3
"""Train a browser automation model with verified-data SFT warmup and TRL DAPO."""

import json
import os
import re
from pathlib import Path

import torch
from datasets import Dataset
from unsloth import FastLanguageModel
from trl import GRPOConfig, GRPOTrainer, SFTConfig, SFTTrainer

SYSTEM_PROMPT = (
    "You are a Playwright browser automation agent. Return <thought>...</thought>"
    " followed by <code>...</code> containing JavaScript statements using the page object."
)
MAX_SEQ_LEN = int(os.environ.get("MAX_SEQ_LEN", "3072"))
MODEL_NAME = os.environ.get("BASE_MODEL", "unsloth/Qwen2.5-Coder-3B-Instruct-bnb-4bit")
LOCAL_DIR = Path(os.environ.get("DATA_DIR", "./data"))
DRIVE_DIR = Path("/content/drive/MyDrive/AI_Factory")


def dataset_dir() -> Path:
    """Mount Drive in Colab when available; otherwise use the local data folder."""
    if os.environ.get("USE_GOOGLE_DRIVE", "1") == "1" and Path("/content").exists():
        try:
            from google.colab import drive  # type: ignore
            drive.mount("/content/drive", force_remount=False)
        except ImportError:
            pass
        except Exception as exc:
            print(f"[Trainer] Google Drive mount unavailable: {exc}")
        if DRIVE_DIR.exists():
            return DRIVE_DIR
    return LOCAL_DIR


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"[Trainer] Ignoring malformed {path}:{line_number}: {exc}")
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows


def make_messages(tokenizer, dom: str, task: str, answer: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Visible DOM:\n{dom}\n\nTask: {task}"},
        {"role": "assistant", "content": answer},
    ]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)


def build_sft_dataset(rows: list[dict], failures: list[dict], tokenizer) -> Dataset | None:
    records = []
    for row in failures:
        answer = row.get("verified_recovery_completion", "")
        if answer:
            records.append({"text": make_messages(
                tokenizer,
                row.get("dom_at_failure") or row.get("initial_dom", ""),
                row.get("task", ""), answer,
            )})
    for row in rows:
        candidates = row.get("candidate_completions") or []
        rewards = row.get("verifier_rewards") or []
        if not candidates or not rewards:
            continue
        best = max(range(min(len(candidates), len(rewards))), key=lambda index: float(rewards[index]))
        if float(rewards[best]) >= 2.5:
            records.append({"text": make_messages(
                tokenizer, row.get("dom_context", ""), row.get("task_prompt", ""), candidates[best]
            )})
    return Dataset.from_list(records) if records else None


def build_rl_dataset(rows: list[dict]) -> Dataset:
    records = []
    for row in rows:
        if not row.get("task_prompt") or not row.get("dom_context"):
            continue
        records.append({
            "prompt": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Visible DOM:\n{row['dom_context']}\n\nTask: {row['task_prompt']}"},
            ],
            "verified_selector": str(row.get("verified_selector", "")),
        })
    return Dataset.from_list(records)


def completion_text(completion) -> str:
    if isinstance(completion, str):
        return completion
    if isinstance(completion, dict):
        return str(completion.get("content", ""))
    if isinstance(completion, list):
        return "\n".join(str(item.get("content", "")) for item in completion if isinstance(item, dict))
    return str(completion)


def format_reward(completions, **kwargs) -> list[float]:
    pattern = re.compile(r"^\s*<thought>[\s\S]+?</thought>\s*<code>[\s\S]+?</code>\s*$", re.I)
    return [1.0 if pattern.match(completion_text(item)) else -1.0 for item in completions]


def selector_reward(completions, verified_selector=None, **kwargs) -> list[float]:
    if verified_selector is None:
        verified_selector = [""] * len(completions)
    rewards = []
    for item, selector in zip(completions, verified_selector):
        text = completion_text(item)
        code_match = re.search(r"<code>([\s\S]*?)</code>", text, re.I)
        code = code_match.group(1) if code_match else ""
        score = 0.0
        if re.search(r"page\.(?:locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\s*\(", code):
            score += 0.5
        if "waitForTimeout(" in code:
            score -= 0.5
        if selector and selector in code:
            score += 1.0
        if re.search(r"\.(?:isVisible|isEnabled|count|textContent|inputValue|waitFor)\s*\(", code):
            score += 0.25
        rewards.append(score)
    if len(rewards) < len(completions):
        rewards.extend([0.0] * (len(completions) - len(rewards)))
    return rewards


def main() -> None:
    active = dataset_dir()
    rollout_rows = read_jsonl(active / "dapo_rollouts.jsonl")
    if active != LOCAL_DIR and not rollout_rows:
        rollout_rows = read_jsonl(LOCAL_DIR / "dapo_rollouts.jsonl")
    failure_rows = read_jsonl(active / "browser_failures.jsonl")
    if not rollout_rows:
        raise FileNotFoundError(f"No rollout rows found under {active}; run the harvester or local worker first.")

    output_dir = active / "checkpoints"
    export_dir = active / "exported_gguf"
    output_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Trainer] {len(rollout_rows)} rollout groups, {len(failure_rows)} verified recoveries")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
        fast_inference=False,
    )
    model = FastLanguageModel.get_peft_model(
        model, r=16, target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16, lora_dropout=0, bias="none", use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    sft = build_sft_dataset(rollout_rows, failure_rows, tokenizer)
    if sft is not None and len(sft) >= 2:
        print(f"[Trainer] SFT warmup: {len(sft)} examples")
        SFTTrainer(
            model=model,
            processing_class=tokenizer,
            train_dataset=sft,
            args=SFTConfig(
                output_dir=str(output_dir / "sft"), dataset_text_field="text", max_length=MAX_SEQ_LEN,
                per_device_train_batch_size=1, gradient_accumulation_steps=4,
                num_train_epochs=1, learning_rate=1e-4, logging_steps=5,
                bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
                report_to="none",
            ),
        ).train()

    rl_data = build_rl_dataset(rollout_rows)
    if len(rl_data) < 2:
        raise ValueError("Need at least two usable rollout prompts for grouped DAPO training.")
    generations = min(4, max(2, len(rl_data)))
    effective_batch = generations
    print(f"[Trainer] DAPO RLVR: {len(rl_data)} prompts, {generations} generations per prompt")
    trainer = GRPOTrainer(
        model=model,
        processing_class=tokenizer,
        reward_funcs=[format_reward, selector_reward],
        args=GRPOConfig(
            output_dir=str(output_dir / "dapo"), loss_type="dapo", epsilon=0.2, epsilon_high=0.28,
            mask_truncated_completions=True, scale_rewards="group", num_generations=generations,
            per_device_train_batch_size=effective_batch, gradient_accumulation_steps=1,
            max_completion_length=768, max_steps=max(1, min(100, len(rl_data) * 2)),
            learning_rate=5e-6, logging_steps=1, save_steps=25,
            bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
            fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
            remove_unused_columns=False, report_to="none",
        ),
        train_dataset=rl_data,
    )
    trainer.train()
    print(f"[Trainer] Exporting GGUF to {export_dir}")
    model.save_pretrained_gguf(str(export_dir), tokenizer, quantization_method="q4_k_m")
    (export_dir / "Modelfile").write_text(
        'FROM ./unsloth.Q4_K_M.gguf\nPARAMETER temperature 0.4\nPARAMETER top_p 0.9\nPARAMETER num_ctx 4096\n',
        encoding="utf-8",
    )
    print("[Trainer] Training and export finished.")


if __name__ == "__main__":
    main()
