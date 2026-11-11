#!/usr/bin/env bash
# Prepare verified trajectories and fine-tune an adapter with Apple's MLX-LM.
# MLX-LM exposes supervised LoRA/QLoRA training; DAPO remains in the Colab/TRL path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-${ROOT}/data}"
DATASET_DIR="${DATA_DIR}/mlx_dataset"
MODEL="${MLX_MODEL:-mlx-community/Qwen2.5-Coder-3B-Instruct-4bit}"
ADAPTER_DIR="${ADAPTER_DIR:-${ROOT}/models/m1_lora_adapters}"
FUSED_DIR="${FUSED_DIR:-${ROOT}/models/qwen_browser_m1_fused}"
ITERS="${ITERS:-150}"
NUM_LAYERS="${NUM_LAYERS:-8}"

mkdir -p "${DATASET_DIR}" "${ADAPTER_DIR}"
python3 - "${DATA_DIR}" "${DATASET_DIR}" <<'PY'
import json
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:])
system = "You are a Playwright browser automation agent. Return <thought>...</thought><code>JavaScript using page</code>."
records = []

def add(dom, task, answer):
    if not answer:
        return
    records.append({"messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Visible DOM:\n{dom}\n\nTask: {task}"},
        {"role": "assistant", "content": answer},
    ]})

failures = source / "browser_failures.jsonl"
if failures.exists():
    for line in failures.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            add(row.get("dom_at_failure") or row.get("initial_dom", ""), row.get("task", ""), row.get("verified_recovery_completion", ""))

rollouts = source / "dapo_rollouts.jsonl"
if rollouts.exists():
    for line in rollouts.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        answers, rewards = row.get("candidate_completions", []), row.get("verifier_rewards", [])
        usable = min(len(answers), len(rewards))
        if usable:
            best = max(range(usable), key=lambda i: float(rewards[i]))
            if float(rewards[best]) >= 2.5:
                add(row.get("dom_context", ""), row.get("task_prompt", ""), answers[best])

if not records:
    raise SystemExit(f"No verified training examples found under {source}")

valid_count = max(1, round(len(records) * 0.1)) if len(records) > 1 else 0
train = records[:-valid_count] if valid_count else records
valid = records[-valid_count:] if valid_count else []
for name, rows in (("train.jsonl", train), ("valid.jsonl", valid)):
    with (target / name).open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"Prepared {len(train)} training and {len(valid)} validation examples in {target}")
PY

if ! command -v mlx_lm.lora >/dev/null 2>&1; then
  python3 -m pip install --upgrade 'mlx-lm[train]'
fi

mlx_lm.lora \
  --model "${MODEL}" \
  --train \
  --data "${DATASET_DIR}" \
  --iters "${ITERS}" \
  --num-layers "${NUM_LAYERS}" \
  --batch-size 1 \
  --grad-checkpoint \
  --adapter-path "${ADAPTER_DIR}"

mlx_lm.fuse --model "${MODEL}" --adapter-path "${ADAPTER_DIR}" --save-path "${FUSED_DIR}"
echo "Fused model saved to ${FUSED_DIR}"
