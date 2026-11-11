# Zero-OCI Autonomous Browser Factory

The repository contains a browser automation learning loop with four parts: a scheduled GitHub Actions harvester, a local Ollama worker, model training scripts, and a local dashboard.

## Setup

1. Install Node.js 20 or newer and run `npm install`.
2. Install the Playwright Chromium browser with `npx playwright install chromium`.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` for Gemini harvesting. The Node scripts load `.env` automatically; set `OLLAMA_HOST`, `LOCAL_MODEL`, and `GDRIVE_FACTORY_DIR` there if you want different local defaults.
4. For GitHub Actions, add `GEMINI_API_KEY` under repository **Settings → Secrets and variables → Actions**. The workflow can also be started manually from the Actions page.

To use the local worker, install and start Ollama, then pull the configured model (by default, `ollama pull qwen2.5-coder:3b`). The worker expects Ollama's local HTTP API at `http://127.0.0.1:11434` unless `OLLAMA_HOST` is changed.

## Run the components

- `npm run harvest:ci` — synthesize, verify, and record browser candidates through Gemini.
- `npm run worker:m1` — generate and verify local Ollama candidates, then optionally mirror rollout data to Google Drive.
- `npm run dashboard` — open the local control panel at `http://127.0.0.1:3333`.
- `npm run train:m1` — prepare verified examples and fine-tune/fuse an MLX-LM adapter on Apple Silicon.
- `python training/train_dapo_colab.py` — train using TRL DAPO in a GPU notebook environment. Install compatible PyTorch, Unsloth, TRL, and datasets packages in that environment first. In Colab, the script attempts to mount Google Drive; set `USE_GOOGLE_DRIVE=0` to use `./data` instead.

The harvester and local worker write `data/dapo_rollouts.jsonl`; verified repairs are written to `data/browser_failures.jsonl`; reusable skills are indexed in `verified_skills/skill_index.json`. See [IMPLEMENTATION_STATE.md](IMPLEMENTATION_STATE.md) for the component ledger and data contracts.

## Notes

- Browser candidate code is dynamically evaluated for Playwright interactions. The verifier rejects common Node-level capability names, but this is a guard against accidental misuse, not a hardened security boundary. Run the worker only on pages and environments you trust.
- TRL DAPO training is provided in the Colab script. The local MLX-LM command performs supervised LoRA/QLoRA fine-tuning; the upstream MLX-LM CLI does not provide DAPO training.
- Generated model checkpoints and fused model files are local artifacts and are excluded from version control.
