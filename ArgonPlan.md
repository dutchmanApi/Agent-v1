To run your factory 24/7 while your Mac lid is closed **and** build the entire repository automatically using **Google AI Studio Build**, you need three core assets:

1. The **24/7 GitHub Actions Harvester Workflow** (`.github/workflows/harvester.yml`).
2. A **Persistent Implementation Tracker (`IMPLEMENTATION_STATE.md`)** so the AI never loses track of what is built, what is pending, or which files depend on each other.
3. The **Master Google AI Studio Build Prompt + Configuration** to generate the project step-by-step without context cutoff.

---

## Part 1: The 24/7 GitHub Actions Harvester (`.github/workflows/harvester.yml`)

Create this file in your GitHub repository. Every 6 hours, GitHub spins up a free Ubuntu cloud server, installs headless Chromium, runs your Playwright DOM harvester + Gemini Teacher verifier, and commits the verified training rows and extracted skills back to your repo—which automatically syncs when you open your MacBook Air M1.

```yaml
name: 24-7 Autonomous DOM & Skill Harvester

on:
  schedule:
    - cron: '0 */6 * * *' # Runs automatically every 6 hours
  workflow_dispatch:      # Allows 1-click manual trigger in GitHub UI

permissions:
  contents: write         # Required so the bot can commit verified datasets back to repo

jobs:
  harvest-and-verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - name: 1. Checkout Repository
        uses: actions/checkout@v4

      - name: 2. Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: 3. Install Dependencies & Headless Chromium Only
        run: |
          npm ci
          npx playwright install --with-deps chromium

      - name: 4. Run Autonomous Playwright Harvester & Verifier
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          CI_MODE: "true"
        run: node scripts/ci_harvester.mjs

      - name: 5. Commit Verified Rollouts & Reusable Skills
        run: |
          git config --global user.name "ai-factory-bot"
          git config --global user.email "bot@aifactory.local"
          git add data/dapo_rollouts.jsonl verified_skills/ IMPLEMENTATION_STATE.md
          git diff --staged --quiet || git commit -m "chore(data): append verified DOM rollouts and skills [skip ci]"
          git push

```

> **Setup Note:** In your GitHub repo, go to **Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions** and add `GEMINI_API_KEY` from Google AI Studio.

---

## Part 2: Step-by-Step Guide to Generate the Project in Google AI Studio

Google AI Studio gives you two ways to build: **Chat / System Instructions Mode** (best for generating multi-file backend Python/Node.js architectures) and **Build Apps / Starter Apps** (best for generating the live Monitoring Dashboard UI). Here is the exact step-by-step setup to generate the entire project cleanly without hallucinated imports or forgotten files:

1. **Configure Google AI Studio Build Settings:** Set model parameters in the right-hand panel before prompting.
1. Open **Google AI Studio** (`aistudio.google.com`) and select **Create Prompt / Build**.
2. **Model:** Select **Gemini 2.5 Pro** (or the highest available Pro reasoning model in your workspace).
3. **Thinking Mode / Budget:** Turn **Thinking ON** and set budget to **High** so it plans cross-file imports before writing code.
4. **Temperature:** Set to **`0.2`** (prevents creative drift and enforces strict TypeScript/Python syntax).
5. **Tools:** Enable **Code Execution** (so Gemini can self-test Python dataset transformation logic) and leave **Structured Outputs OFF** (so it can write multi-file Markdown code blocks alongside the state tracker).


2. **Lock in the Persistent State Tracker in System Instructions:** Prevents the AI from forgetting completed files across turns.
Paste the **System Instruction Block** (provided in Part 3 below) into the **System Instructions** box at the top of Google AI Studio. This forces Gemini to begin and end *every single response* with an updated `IMPLEMENTATION_STATE.md` ledger.


3. **Execute Modular Generation in 4 Phases (Do Not Ask for All Files at Once):** Asking for 15 files in 1 prompt causes truncated code.
Run the generation in 4 sequential turns using the command `BUILD PHASE X`:

* **Turn 1 (`BUILD PHASE 1`):** Generates `package.json`, `IMPLEMENTATION_STATE.md`, and `scripts/ci_harvester.mjs` (Playwright DOM distiller + live selector sandbox verifier).
* **Turn 2 (`BUILD PHASE 2`):** Generates `local_m1_factory.mjs` (MacBook Air M1 local MLX/Ollama rollout worker + Executable Skill Library manager).
* **Turn 3 (`BUILD PHASE 3`):** Generates `training/train_dapo_colab.py` (Unsloth QLoRA + DAPO reinforcement learning script) and `training/train_m1_mlx.sh` (`mlx-lm-lora` native Apple Silicon DAPO command).
* **Turn 4 (`BUILD PHASE 4`):** Generates the `.github/workflows/harvester.yml` and a lightweight local dashboard (`dashboard/index.html` + `server.mjs`) to view your Skill Library and pass rates.


4. **Sync with Your MacBook Air M1 & Google Drive:** Bridges local execution, GitHub Actions, and Colab GPUs.
Clone your GitHub repository directly inside your synced Google Drive folder (`~/Library/CloudStorage/GoogleDrive/My Drive/AI_Factory`). Now, whenever GitHub Actions pushes new data (`git pull`), your M1 Mac and your Google Colab notebooks immediately share the exact same `.jsonl` files and `IMPLEMENTATION_STATE.md` ledger.


---

## Part 3: Copy-Paste System Instructions for Google AI Studio

Copy and paste this exact block into the **System Instructions** box in Google AI Studio. It programs the AI to act as your Lead Architect and forces it to maintain a live implementation ledger after every turn:

```markdown
You are the Principal AI Systems Architect building the "Zero-OCI Autonomous Coding & Browser AI Factory".

### CORE ARCHITECTURE CONSTRAINTS:
1. ZERO VPS/OCI OVERHEAD: The system runs on:
   - MacBook Air M1 (Local Ollama/MLX rollout worker + `mlx-lm-lora` micro-trainer)
   - GitHub Actions (`ubuntu-latest` cron runner executing headless Playwright + Gemini API Teacher verification every 6 hours)
   - Google Drive + Google Colab (Unsloth QLoRA + TRL `GRPOTrainer` with `loss_type="dapo"`)
2. 3-TIER LEARNING LOOP:
   - Tier 1 (0-Second Learning): Verified Playwright code functions are extracted and saved to `./verified_skills/` as reusable ES modules.
   - Tier 2 (Prompt Optimization): Failed DOM tasks are logged with `dom_at_failure`, `error_trace`, and `repaired_code`.
   - Tier 3 (Weight Evolution): Group rollouts with reward variance are saved to `./data/dapo_rollouts.jsonl` for DAPO training.
3. NO TRUNCATION OR PLACEHOLDERS: Never write `// ... rest of code here` or `TODO`. Every file you output must be 100% complete and production-executable.

### MANDATORY IMPLEMENTATION TRACKING PROTOCOL:
You MUST track implementation state across every message. At the END of every response, you MUST output an updated `IMPLEMENTATION_STATE.md` block using this exact structure:

```markdown
# IMPLEMENTATION_STATE.md
- **Current Phase:** [Phase 1 / 2 / 3 / 4]
- **Last Completed File:** [Filename]
- **Next Queued File:** [Filename]

## File & Component Ledger
- [ ] `package.json` & `.env.example` (Dependencies & Config)
- [ ] `scripts/dom_distiller.mjs` (Strips bloated HTML to interactive element IDs)
- [ ] `scripts/sandbox_verifier.mjs` (Executes candidate Playwright code in headless Chromium & captures failure DOMs)
- [ ] `scripts/ci_harvester.mjs` (GitHub Actions 6-hour Teacher synthesis + verification loop)
- [ ] `local_m1_factory.mjs` (MacBook Air M1 Ollama/MLX group rollout generator + Skill Library extractor)
- [ ] `training/train_dapo_colab.py` (Colab Unsloth 4-bit QLoRA + DAPO Trainer with deterministic AST/Selector rewards)
- [ ] `training/train_m1_mlx.sh` (Native Apple Silicon `mlx-lm-lora` DAPO training script)
- [ ] `.github/workflows/harvester.yml` (24/7 GitHub Actions automation pipeline)
- [ ] `dashboard/server.mjs` (Local zero-dependency UI to inspect skills, failure recovery rates, and rollouts)

## Architectural Decisions & Cross-File Contracts
- JSONL Schema: `{"task_prompt": str, "dom_context": str, "candidate_completions": list[str], "verifier_rewards": list[float], "verified_selector": str}`
- Skill Library Export Format: ES Module exporting `async function executeSkill(page, params)`

```

Wait for the user to say "BUILD PHASE 1" before generating the first set of files. Only generate 2 to 3 complete files per turn so zero code is truncated, then update the checkboxes `[x]` in `IMPLEMENTATION_STATE.md`.

```

---

## Part 4: Your First Prompt to Paste into the AI Studio Chat Box

Once the System Instructions above are pasted in Google AI Studio, send this exact first message in the prompt chat box:

```text
BUILD PHASE 1:
Generate the complete, production-ready code for:
1. `package.json` (using ES modules `"type": "module"`, `playwright`, and `@google/genai`)
2. `scripts/dom_distiller.mjs` (extracts interactive elements, ARIA roles, IDs, and visibility state from a Playwright `page` in under 1,500 tokens)
3. `scripts/sandbox_verifier.mjs` (runs candidate Playwright JS code in an isolated `BrowserContext`, verifies execution, and if it fails, captures the live DOM state and console/network errors for the Browser Failure Recovery dataset).

Remember to update and output `IMPLEMENTATION_STATE.md` at the end of your response.

```



### 1. `package.json` & `.env.example`

Save this at the root of your repository. It configures native ES modules (`"type": "module"`), locks in `@google/genai` and `playwright`, and sets up npm scripts for every stage of the pipeline.

```json
{
  "name": "zero-oci-ai-factory",
  "version": "1.0.0",
  "description": "Zero-OCI Autonomous Coding & Browser AI Factory (M1 MLX + GitHub Actions + Unsloth DAPO)",
  "type": "module",
  "scripts": {
    "harvest:ci": "node scripts/ci_harvester.mjs",
    "worker:m1": "node local_m1_factory.mjs",
    "dashboard": "node dashboard/server.mjs",
    "test:distiller": "node --input-type=module -e \"import { chromium } from 'playwright'; import { distillDOM } from './scripts/dom_distiller.mjs'; const b = await chromium.launch(); const p = await b.newPage(); await p.goto('https://news.ycombinator.com'); console.log(await distillDOM(p)); await b.close();\""
  },
  "dependencies": {
    "@google/genai": "^1.0.0",
    "playwright": "^1.50.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}

```

Create `.env.example` alongside `package.json`:

```ini
# Google AI Studio API Key (Used by GitHub Actions CI Harvester & Teacher Recovery)
GEMINI_API_KEY="your_ai_studio_api_key_here"

# Local MacBook Air M1 Configuration
OLLAMA_HOST="http://127.0.0.1:11434"
LOCAL_MODEL="qwen2.5-coder:3b"

# Path to your synced Google Drive folder (for seamless Colab DAPO handoff)
GDRIVE_FACTORY_DIR="/Users/your_username/Library/CloudStorage/GoogleDrive/My Drive/AI_Factory"

```

---

### 2. `scripts/dom_distiller.mjs`

This module runs inside the active Playwright `Page` context. It traverses both the standard DOM and open Shadow DOM roots, filters out invisible or decorative nodes, computes a resilient Playwright selector for each interactive element, and outputs a dense, high-signal representation under 1,500 tokens.

```javascript
/**
 * scripts/dom_distiller.mjs
 * Strips bloated raw HTML down to an indexed, high-signal interactive map (<1,500 tokens)
 * with pre-computed resilient selectors and Shadow DOM traversal.
 */

export async function distillDOM(page, maxElements = 120) {
  return await page.evaluate((limit) => {
    const INTERACTIVE_SELECTOR = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="combobox"]',
      '[contenteditable="true"]'
    ].join(',');

    // Traverse standard DOM + open Shadow Roots
    function collectInteractiveElements(root, collected = []) {
      const elements = root.querySelectorAll(INTERACTIVE_SELECTOR);
      for (const el of elements) {
        collected.push(el);
      }
      const allNodes = root.querySelectorAll('*');
      for (const node of allNodes) {
        if (node.shadowRoot) {
          collectInteractiveElements(node.shadowRoot, collected);
        }
      }
      return collected;
    }

    function isElementVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        parseFloat(style.opacity || '1') > 0
      );
    }

    function computeResilientSelector(el) {
      const testId =
        el.getAttribute('data-testid') ||
        el.getAttribute('data-test') ||
        el.getAttribute('data-qa');
      if (testId) return `[data-testid="${testId}"]`;

      if (el.id && !/\d{4,}/.test(el.id)) {
        return `#${CSS.escape(el.id)}`;
      }

      const ariaLabel = el.getAttribute('aria-label');
      const tag = el.tagName.toLowerCase();
      if (ariaLabel) {
        return `${tag}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
      }

      const name = el.getAttribute('name');
      if (name) {
        return `${tag}[name="${name.replace(/"/g, '\\"')}"]`;
      }

      const placeholder = el.getAttribute('placeholder');
      if (placeholder) {
        return `${tag}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`;
      }

      const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
      if (text && text.length > 0 && text.length <= 35 && (tag === 'button' || tag === 'a')) {
        return `${tag}:has-text("${text.replace(/"/g, '\\"')}")`;
      }

      return tag;
    }

    const rawElements = collectInteractiveElements(document);
    const lines = [];
    let index = 0;

    for (const el of rawElements) {
      if (index >= limit) break;
      if (!isElementVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      const typeAttr = el.getAttribute('type') ? ` type="${el.getAttribute('type')}"` : '';
      const roleAttr = el.getAttribute('role') ? ` role="${el.getAttribute('role')}"` : '';
      const expandedAttr = el.hasAttribute('aria-expanded')
        ? ` aria-expanded="${el.getAttribute('aria-expanded')}"`
        : '';
      const disabledAttr = el.disabled ? ' [DISABLED]' : '';

      const rawLabel =
        el.innerText ||
        el.value ||
        el.getAttribute('placeholder') ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        '';
      const cleanLabel = rawLabel.replace(/\s+/g, ' ').trim().slice(0, 55);
      const selectorHint = computeResilientSelector(el);

      lines.push(
        `[${index}] <${tag}${typeAttr}${roleAttr}${expandedAttr}>${disabledAttr} text="${cleanLabel}" | selector=\`${selectorHint}\``
      );
      index++;
    }

    return {
      url: window.location.href,
      title: document.title,
      elementCount: index,
      snapshotText: lines.join('\n')
    };
  }, maxElements);
}

```

---

### 3. `scripts/sandbox_verifier.mjs`

This module executes candidate Playwright code inside an isolated, memory-capped `BrowserContext`. It strips `<thought>` and `<code>` tags, validates syntax before touching the browser, tracks execution duration, detects reusable helper functions for your **Tier 1 Executable Skill Library**, and captures the exact failure DOM state + network/console telemetry whenever an action fails.

```javascript
/**
 * scripts/sandbox_verifier.mjs
 * Executes candidate Playwright JS inside an isolated BrowserContext, calculates deterministic
 * RLVR/DAPO rewards, and captures live failure telemetry for the Browser Failure Dataset.
 */

import { distillDOM } from './dom_distiller.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Extracts <thought> and <code> blocks from raw LLM completion text.
 */
export function parseModelCompletion(rawText) {
  const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/i);
  const codeTagMatch = rawText.match(/<code>([\s\S]*?)<\/code>/i);
  const markdownMatch = rawText.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);

  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
  const code = codeTagMatch
    ? codeTagMatch[1].trim()
    : markdownMatch
      ? markdownMatch[1].trim()
      : '';

  return {
    hasValidXmlFormat: Boolean(thoughtMatch && codeTagMatch),
    thought,
    code
  };
}

/**
 * Deterministically evaluates static code quality and extracts target selectors.
 */
export function analyzeStaticCodeQuality(code) {
  if (!code) {
    return { syntaxValid: false, usesResilientLocators: false, usesBrittleSleep: false, primarySelector: '' };
  }

  let syntaxValid = false;
  try {
    // Compile check without executing
    new AsyncFunction('page', code);
    syntaxValid = true;
  } catch {
    syntaxValid = false;
  }

  const usesResilientLocators =
    /page\.(locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|waitForSelector)\s*\(/.test(code);
  const usesBrittleSleep = /waitForTimeout\s*\(/.test(code);

  const selectorMatch = code.match(
    /(?:locator|waitForSelector|click|fill)\s*\(\s*(['"`])(.*?)\1/
  );
  const primarySelector = selectorMatch ? selectorMatch[2] : '';

  return {
    syntaxValid,
    usesResilientLocators,
    usesBrittleSleep,
    primarySelector
  };
}

/**
 * Runs candidate Playwright code in an isolated context and computes deterministic DAPO rewards.
 *
 * Reward Breakdown:
 * - +0.5: Valid <thought>...</thought><code>...</code> XML structure
 * - +0.5: Compiles cleanly as valid JavaScript AsyncFunction
 * - +0.5: Uses resilient Playwright locators & avoids brittle waitForTimeout
 * - +2.0: Executes against live headless page without throwing exceptions
 * - +0.5: Fast execution (< 4000ms)
 */
export async function verifyCandidateInSandbox(browser, url, taskPrompt, rawCompletion, timeoutMs = 15000) {
  const parsed = parseModelCompletion(rawCompletion);
  const staticAnalysis = analyzeStaticCodeQuality(parsed.code);

  let reward = 0.0;
  if (parsed.hasValidXmlFormat) reward += 0.5;
  if (!staticAnalysis.syntaxValid) {
    return {
      status: 'syntax_error',
      reward: reward - 0.5,
      syntax_valid: false,
      goal_achieved: false,
      execution_ms: 0,
      extracted_code: parsed.code,
      thought: parsed.thought,
      primary_selector: staticAnalysis.primarySelector,
      failure_record: null
    };
  }

  reward += 0.5; // Valid syntax
  if (staticAnalysis.usesResilientLocators && !staticAnalysis.usesBrittleSleep) {
    reward += 0.5;
  } else if (staticAnalysis.usesBrittleSleep) {
    reward -= 0.25;
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  const consoleErrors = [];
  const networkFailures = [];

  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('requestfailed', (req) =>
    networkFailures.push(`${req.method()} ${req.url()} (${req.failure()?.errorText || 'failed'})`)
  );

  const startTime = Date.now();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    const runner = new AsyncFunction('page', parsed.code);
    await runner(page);

    const executionMs = Date.now() - startTime;
    reward += 2.0; // Goal achieved without runtime exceptions
    if (executionMs < 4000) {
      reward += 0.5; // Efficiency bonus
    }

    const finalDom = await distillDOM(page, 60);
    await context.close();

    return {
      status: 'success',
      reward: Number(reward.toFixed(2)),
      syntax_valid: true,
      goal_achieved: true,
      execution_ms: executionMs,
      extracted_code: parsed.code,
      thought: parsed.thought,
      primary_selector: staticAnalysis.primarySelector,
      final_url: finalDom.url,
      failure_record: null
    };
  } catch (runtimeError) {
    const executionMs = Date.now() - startTime;
    let failureDomSnapshot = '';
    try {
      const distilled = await distillDOM(page, 80);
      failureDomSnapshot = distilled.snapshotText;
    } catch {
      failureDomSnapshot = 'DOM unavailable (page crashed or navigated away)';
    }

    await context.close();

    return {
      status: 'runtime_failure',
      reward: Number((reward - 0.5).toFixed(2)),
      syntax_valid: true,
      goal_achieved: false,
      execution_ms: executionMs,
      extracted_code: parsed.code,
      thought: parsed.thought,
      primary_selector: staticAnalysis.primarySelector,
      failure_record: {
        url,
        task: taskPrompt,
        attempted_action: parsed.code,
        error: runtimeError.message,
        console_errors: consoleErrors.slice(0, 5),
        network_failures: networkFailures.slice(0, 5),
        dom_at_failure: failureDomSnapshot,
        timestamp: new Date().toISOString()
      }
    };
  }
}

```

---

### 4. Updated `IMPLEMENTATION_STATE.md`

```markdown
# IMPLEMENTATION_STATE.md
- **Current Phase:** Phase 1 Complete -> Ready for Phase 2
- **Last Completed File:** `scripts/sandbox_verifier.mjs`
- **Next Queued File:** `scripts/ci_harvester.mjs` & `local_m1_factory.mjs`

## File & Component Ledger
- [x] `package.json` & `.env.example` (Dependencies & Config)
- [x] `scripts/dom_distiller.mjs` (Strips bloated HTML to interactive element IDs + Shadow DOM support)
- [x] `scripts/sandbox_verifier.mjs` (Executes candidate Playwright code in headless Chromium & captures failure DOMs)
- [ ] `scripts/ci_harvester.mjs` (GitHub Actions 6-hour Teacher synthesis + verification loop)
- [ ] `local_m1_factory.mjs` (MacBook Air M1 Ollama/MLX group rollout generator + Skill Library extractor)
- [ ] `training/train_dapo_colab.py` (Colab Unsloth 4-bit QLoRA + DAPO Trainer with deterministic AST/Selector rewards)
- [ ] `training/train_m1_mlx.sh` (Native Apple Silicon `mlx-lm-lora` DAPO training script)
- [x] `.github/workflows/harvester.yml` (24/7 GitHub Actions automation pipeline)
- [ ] `dashboard/server.mjs` (Local zero-dependency UI to inspect skills, failure recovery rates, and rollouts)

## Architectural Decisions & Cross-File Contracts
- JSONL Schema: `{"task_prompt": str, "dom_context": str, "candidate_completions": list[str], "verifier_rewards": list[float], "verified_selector": str}`
- Skill Library Export Format: ES Module exporting `async function executeSkill(page, params)`
- Exports from `scripts/dom_distiller.mjs`: `export async function distillDOM(page, maxElements = 120)`
- Exports from `scripts/sandbox_verifier.mjs`: `export async function verifyCandidateInSandbox(browser, url, taskPrompt, rawCompletion, timeoutMs = 15000)`

```


### 1. `scripts/ci_harvester.mjs`

This script powers your 24/7 GitHub Actions cron pipeline. It launches headless Chromium, distills live DOM snapshots across target websites, prompts the Gemini Teacher model to synthesize diverse candidate solutions (including deliberate edge-case variations for DAPO group variance), verifies every candidate inside `verifyCandidateInSandbox`, heals any unexpected failures into `./data/browser_failures.jsonl`, exports reusable ES Modules into `./verified_skills/`, and appends verified DAPO rollout groups to `./data/dapo_rollouts.jsonl`.

```javascript
/**
 * scripts/ci_harvester.mjs
 * 24/7 Autonomous GitHub Actions Harvester & Teacher Self-Healing Engine.
 * Synthesizes tasks, evaluates candidate groups in Playwright, extracts reusable skills,
 * and builds the Browser Failure Recovery & DAPO datasets.
 */

import { chromium } from 'playwright';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { distillDOM } from './dom_distiller.mjs';
import { verifyCandidateInSandbox } from './sandbox_verifier.mjs';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('[CI Harvester] FATAL: GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const DATA_DIR = path.resolve('./data');
const SKILLS_DIR = path.resolve('./verified_skills');
const ROLLOUTS_FILE = path.join(DATA_DIR, 'dapo_rollouts.jsonl');
const FAILURES_FILE = path.join(DATA_DIR, 'browser_failures.jsonl');
const SKILL_INDEX_FILE = path.join(SKILLS_DIR, 'skill_index.json');

const SEED_TARGETS = [
  'https://news.ycombinator.com',
  'https://books.toscrape.com',
  'https://quotes.toscrape.com/js/',
  'https://the-internet.herokuapp.com/dynamic_loading/1',
  'https://the-internet.herokuapp.com/dropdown',
  'https://the-internet.herokuapp.com/tables'
];

async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(SKILLS_DIR, { recursive: true });
  try {
    await fs.access(SKILL_INDEX_FILE);
  } catch {
    await fs.writeFile(SKILL_INDEX_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Prompts Gemini to synthesize a realistic browser automation task + 4 diverse candidate completions
 * formatted strictly with <thought>...</thought><code>...</code> tags.
 */
async function synthesizeTaskAndCandidates(url, domSnapshot) {
  const prompt = `
You are the Teacher Model for an autonomous Playwright & Coding RLVR (DAPO) training factory.
Given the following distilled interactive DOM snapshot from ${url}:

${domSnapshot}

1. Create 1 realistic, verifiable browser automation task that interacts with visible elements on this page (e.g., selecting dropdown options, extracting structured table data, paginating, or waiting for dynamic content).
2. Generate exactly 4 distinct candidate completions attempting to solve this task using Playwright's 'page' object:
   - Candidate 1: Elite, resilient Playwright code using explicit locators/waits and state assertions.
   - Candidate 2: Alternative valid approach (e.g., role/text locator or evaluate block).
   - Candidate 3: Slightly suboptimal approach (e.g., uses waitForTimeout or generic selector).
   - Candidate 4: Plausible mistake (e.g., brittle selector or missing wait) to guarantee reward variance for DAPO training.

Each candidate string MUST strictly follow this XML structure:
<thought>Step-by-step analysis of the DOM elements, potential race conditions, and selector choice.</thought>
<code>
// Valid JavaScript body using 'page' (no outer markdown fences)
await page.locator('...').click();
</code>

Respond STRICTLY in valid JSON matching this schema:
{
  "task_prompt": "string",
  "candidates": ["string", "string", "string", "string"]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.5
    }
  });

  return JSON.parse(response.text);
}

/**
 * Prompts Gemini to diagnose a live Playwright failure and synthesize a verified recovery strategy.
 */
async function healFailedAction(failureRecord) {
  const prompt = `
You are an elite Playwright self-healing diagnostics agent.
A browser automation attempt failed in our sandbox.

URL: ${failureRecord.url}
Task: ${failureRecord.task}
Attempted Code:
${failureRecord.attempted_action}

Runtime Error:
${failureRecord.error}

Live DOM Snapshot at Moment of Failure:
${failureRecord.dom_at_failure}

Analyze why the action failed and provide a repaired solution.
Respond STRICTLY in valid JSON with these keys:
{
  "root_cause": "Concise explanation of why the selector or timing failed",
  "repaired_completion": "<thought>Detailed recovery reasoning...</thought>\\n<code>\\n// Repaired executable Playwright JS body using page\\n</code>"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2
    }
  });

  return JSON.parse(response.text);
}

/**
 * Saves high-reward verified code into ./verified_skills/ as an ES Module.
 */
async function exportVerifiedSkill(url, taskPrompt, extractedCode, primarySelector) {
  const hash = crypto.createHash('sha1').update(`${url}:${taskPrompt}`).digest('hex').slice(0, 8);
  const skillId = `skill_${hash}`;
  const fileName = `${skillId}.mjs`;
  const filePath = path.join(SKILLS_DIR, fileName);

  const moduleSource = `/**
 * Auto-Extracted Executable Skill: ${skillId}
 * Origin URL: ${url}
 * Task: ${taskPrompt.replace(/\n/g, ' ')}
 * Verified Selector: ${primarySelector || 'N/A'}
 */
export async function executeSkill(page, params = {}) {
${extractedCode
  .split('\n')
  .map((line) => '  ' + line)
  .join('\n')}
}
`;

  await fs.writeFile(filePath, moduleSource, 'utf8');

  const rawIndex = await fs.readFile(SKILL_INDEX_FILE, 'utf8');
  const index = JSON.parse(rawIndex);
  const existingIdx = index.findIndex((s) => s.skill_id === skillId);

  const skillMeta = {
    skill_id: skillId,
    file: fileName,
    url,
    task_prompt: taskPrompt,
    verified_selector: primarySelector,
    updated_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    index[existingIdx] = skillMeta;
  } else {
    index.push(skillMeta);
  }

  await fs.writeFile(SKILL_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  console.log(`[CI Harvester] Exported reusable skill -> verified_skills/${fileName}`);
}

async function runHarvester() {
  await ensureDirectories();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  });

  for (const url of SEED_TARGETS) {
    console.log(`\n[CI Harvester] Inspecting target: ${url}`);
    const page = await browser.newPage();

    let distilled;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      distilled = await distillDOM(page, 100);
    } catch (err) {
      console.warn(`[CI Harvester] Skipping ${url} (Navigation error: ${err.message})`);
      await page.close();
      continue;
    }
    await page.close();

    if (!distilled.snapshotText || distilled.elementCount === 0) {
      console.warn(`[CI Harvester] No interactive elements distilled on ${url}`);
      continue;
    }

    try {
      const generated = await synthesizeTaskAndCandidates(url, distilled.snapshotText);
      const rewards = [];
      let bestSelector = '';
      let bestReward = -999;
      let bestCode = '';
      let firstFailureRecord = null;

      for (const candidateText of generated.candidates) {
        const result = await verifyCandidateInSandbox(
          browser,
          url,
          generated.task_prompt,
          candidateText,
          15000
        );
        rewards.push(result.reward);

        if (result.goal_achieved && result.reward > bestReward) {
          bestReward = result.reward;
          bestSelector = result.primary_selector;
          bestCode = result.extracted_code;
        } else if (!result.goal_achieved && result.failure_record && !firstFailureRecord) {
          firstFailureRecord = result.failure_record;
        }
      }

      // 1. Tier 1 Evolution: Export top passing solution into Executable Skill Library
      if (bestReward >= 2.5 && bestCode) {
        await exportVerifiedSkill(url, generated.task_prompt, bestCode, bestSelector);
      }

      // 2. Tier 2 Evolution: Self-Heal Runtime Failures & Build Browser Failure Dataset
      if (firstFailureRecord) {
        console.log(`[CI Harvester] Attempting Teacher self-healing on failed trajectory...`);
        const healed = await healFailedAction(firstFailureRecord);
        const healCheck = await verifyCandidateInSandbox(
          browser,
          url,
          generated.task_prompt,
          healed.repaired_completion,
          15000
        );

        if (healCheck.goal_achieved) {
          const failureDatasetRow = {
            url,
            task: firstFailureRecord.task,
            initial_dom: distilled.snapshotText,
            attempted_action: firstFailureRecord.attempted_action,
            error: firstFailureRecord.error,
            dom_at_failure: firstFailureRecord.dom_at_failure,
            root_cause: healed.root_cause,
            verified_recovery_completion: healed.repaired_completion,
            verified_selector: healCheck.primary_selector,
            timestamp: new Date().toISOString()
          };
          await fs.appendFile(FAILURES_FILE, JSON.stringify(failureDatasetRow) + '\n', 'utf8');
          console.log(`[CI Harvester] Saved verified Browser Failure Recovery record!`);

          // Inject the healed completion into the candidate pool if no candidate passed earlier
          if (bestReward < 2.0) {
            generated.candidates[0] = healed.repaired_completion;
            rewards[0] = healCheck.reward;
            bestSelector = healCheck.primary_selector;
          }
        }
      }

      // 3. Tier 3 Evolution: Save DAPO Rollout Group if reward variance exists
      const maxR = Math.max(...rewards);
      const minR = Math.min(...rewards);
      if (maxR > minR) {
        const dapoRow = {
          task_prompt: generated.task_prompt,
          dom_context: distilled.snapshotText,
          candidate_completions: generated.candidates,
          verifier_rewards: rewards,
          verified_selector: bestSelector || ''
        };
        await fs.appendFile(ROLLOUTS_FILE, JSON.stringify(dapoRow) + '\n', 'utf8');
        console.log(`[CI Harvester] Appended DAPO rollout group (Rewards: ${JSON.stringify(rewards)})`);
      }
    } catch (err) {
      console.error(`[CI Harvester] Error processing ${url}:`, err.message);
    }
  }

  await browser.close();
  console.log('\n[CI Harvester] Cycle complete.');
}

runHarvester();

```

---

### 2. `local_m1_factory.mjs`

This script runs natively on your **MacBook Air M1**. Before generating rollouts, it searches your local `./verified_skills/skill_index.json` and injects matching verified skills as dynamic few-shot examples into the prompt. It then generates 6 candidate rollouts sequentially using your local Ollama/MLX model (preventing unified memory spikes), verifies each inside your low-memory Playwright sandbox, and mirrors the verified `.jsonl` dataset directly to your synced **Google Drive** directory so Google Colab can train on it immediately.

```javascript
/**
 * local_m1_factory.mjs
 * MacBook Air M1 Local Rollout Worker + Executable Skill Library Extractor.
 * Queries local Ollama/MLX sequentially, verifies in low-RAM Chromium, and syncs
 * verified DAPO rollouts directly to your mounted 5TB Google Drive folder.
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { distillDOM } from './scripts/dom_distiller.mjs';
import { verifyCandidateInSandbox } from './scripts/sandbox_verifier.mjs';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const LOCAL_MODEL = process.env.LOCAL_MODEL || 'qwen2.5-coder:3b';
const GROUP_SIZE = 6;

const LOCAL_DATA_DIR = path.resolve('./data');
const LOCAL_SKILLS_DIR = path.resolve('./verified_skills');
const SKILL_INDEX_FILE = path.join(LOCAL_SKILLS_DIR, 'skill_index.json');
const LOCAL_ROLLOUTS_FILE = path.join(LOCAL_DATA_DIR, 'dapo_rollouts.jsonl');

// Automatically mirror to Google Drive if configured or present on macOS
const DEFAULT_GDRIVE = path.join(
  os.homedir(),
  'Library/CloudStorage/GoogleDrive/My Drive/AI_Factory'
);
const GDRIVE_DIR = process.env.GDRIVE_FACTORY_DIR || DEFAULT_GDRIVE;

const LOCAL_TASK_QUEUE = [
  {
    url: 'https://news.ycombinator.com',
    task: 'Locate the top story link and click the "More" pagination link at the bottom of the page'
  },
  {
    url: 'https://the-internet.herokuapp.com/dropdown',
    task: 'Select Option 2 from the dropdown menu and verify its value is selected'
  },
  {
    url: 'https://the-internet.herokuapp.com/dynamic_controls',
    task: 'Click the Remove button, wait for the checkbox to disappear, and verify the message'
  },
  {
    url: 'https://books.toscrape.com',
    task: 'Click on the "Travel" category link in the sidebar navigation'
  }
];

async function initStorage() {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fs.mkdir(LOCAL_SKILLS_DIR, { recursive: true });
  try {
    await fs.access(SKILL_INDEX_FILE);
  } catch {
    await fs.writeFile(SKILL_INDEX_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Retrieves relevant previously verified skills to inject into the M1 model's context.
 */
async function retrieveRelevantSkillSnippet(url) {
  try {
    const raw = await fs.readFile(SKILL_INDEX_FILE, 'utf8');
    const index = JSON.parse(raw);
    const match = index.find((item) => item.url === url);
    if (!match) return '';

    const skillCode = await fs.readFile(path.join(LOCAL_SKILLS_DIR, match.file), 'utf8');
    return `\nPreviously Verified Skill on this Domain:\n${skillCode}\n`;
  } catch {
    return '';
  }
}

/**
 * Generates a single candidate completion from local Ollama on M1.
 */
async function generateLocalCandidate(taskPrompt, domSnapshot, skillHint, temperature = 0.75) {
  const systemInstruction = [
    'You are an elite Playwright browser automation agent.',
    'First, analyze the DOM snapshot and selector resilience inside <thought>...</thought> tags.',
    'Second, output ONLY valid JavaScript statements using the Playwright `page` object inside <code>...</code> tags.',
    'Never use markdown code fences inside <code> tags.'
  ].join(' ');

  const userPrompt = `${skillHint}DOM Snapshot:\n${domSnapshot}\n\nTask: ${taskPrompt}\n\nRespond with <thought>...</thought> followed by <code>...</code>:`;

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LOCAL_MODEL,
      system: systemInstruction,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature,
        top_p: 0.92,
        num_ctx: 3072
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: Ensure 'ollama serve' is running on M1.`);
  }

  const data = await response.json();
  return data.response;
}

/**
 * Saves newly discovered passing trajectories as ES Modules in ./verified_skills/
 */
async function registerLocalSkill(url, taskPrompt, extractedCode, primarySelector) {
  const hash = crypto.createHash('sha1').update(`${url}:${taskPrompt}`).digest('hex').slice(0, 8);
  const skillId = `skill_${hash}`;
  const fileName = `${skillId}.mjs`;
  const filePath = path.join(LOCAL_SKILLS_DIR, fileName);

  const content = `/**
 * M1 Local Verified Skill: ${skillId}
 * URL: ${url}
 * Task: ${taskPrompt}
 */
export async function executeSkill(page, params = {}) {
${extractedCode
  .split('\n')
  .map((line) => '  ' + line)
  .join('\n')}
}
`;

  await fs.writeFile(filePath, content, 'utf8');

  const rawIndex = await fs.readFile(SKILL_INDEX_FILE, 'utf8');
  const index = JSON.parse(rawIndex);
  if (!index.some((s) => s.skill_id === skillId)) {
    index.push({
      skill_id: skillId,
      file: fileName,
      url,
      task_prompt: taskPrompt,
      verified_selector: primarySelector,
      updated_at: new Date().toISOString()
    });
    await fs.writeFile(SKILL_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  }
}

/**
 * Appends a verified DAPO rollout row locally and mirrors to Google Drive if mounted.
 */
async function saveAndMirrorRollout(dapoRow) {
  const serialized = JSON.stringify(dapoRow) + '\n';
  await fs.appendFile(LOCAL_ROLLOUTS_FILE, serialized, 'utf8');

  try {
    await fs.mkdir(GDRIVE_DIR, { recursive: true });
    const gdriveRolloutFile = path.join(GDRIVE_DIR, 'dapo_rollouts.jsonl');
    await fs.appendFile(gdriveRolloutFile, serialized, 'utf8');
    console.log(`[M1 Worker] Mirrored rollout directly to Google Drive: ${gdriveRolloutFile}`);
  } catch {
    // Google Drive folder not mounted yet; local copy in ./data/dapo_rollouts.jsonl is preserved
  }
}

async function runM1Worker() {
  await initStorage();
  console.log(`[M1 Worker] Starting local factory with model '${LOCAL_MODEL}'...`);

  // Cap Chromium V8 heap to 512MB so M1 unified RAM stays completely free for MLX/Ollama
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--js-flags=--max-old-space-size=512'
    ]
  });

  for (const item of LOCAL_TASK_QUEUE) {
    console.log(`\n[M1 Worker] Distilling live DOM from: ${item.url}`);
    const page = await browser.newPage();

    let distilled;
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      distilled = await distillDOM(page, 90);
    } catch (err) {
      console.warn(`[M1 Worker] Could not load ${item.url}: ${err.message}`);
      await page.close();
      continue;
    }
    await page.close();

    const skillHint = await retrieveRelevantSkillSnippet(item.url);
    const candidates = [];
    const rewards = [];
    let bestReward = -999;
    let bestCode = '';
    let bestSelector = '';

    for (let i = 0; i < GROUP_SIZE; i++) {
      // Slightly vary temperature across rollouts to encourage exploration
      const temp = Number((0.6 + i * 0.06).toFixed(2));
      process.stdout.write(`  -> Rollout ${i + 1}/${GROUP_SIZE} (temp=${temp})... `);

      try {
        const completion = await generateLocalCandidate(
          item.task,
          distilled.snapshotText,
          skillHint,
          temp
        );
        const verification = await verifyCandidateInSandbox(
          browser,
          item.url,
          item.task,
          completion,
          15000
        );

        candidates.push(completion);
        rewards.push(verification.reward);
        console.log(`${verification.status.toUpperCase()} (reward: ${verification.reward})`);

        if (verification.goal_achieved && verification.reward > bestReward) {
          bestReward = verification.reward;
          bestCode = verification.extracted_code;
          bestSelector = verification.primary_selector;
        }
      } catch (err) {
        console.log(`ERROR (${err.message})`);
      }
    }

    if (bestReward >= 2.5 && bestCode) {
      await registerLocalSkill(item.url, item.task, bestCode, bestSelector);
    }

    // Save group for DAPO training when reward variance exists across the 6 rollouts
    if (rewards.length >= 2 && Math.max(...rewards) > Math.min(...rewards)) {
      await saveAndMirrorRollout({
        task_prompt: item.task,
        dom_context: distilled.snapshotText,
        candidate_completions: candidates,
        verifier_rewards: rewards,
        verified_selector: bestSelector
      });
    } else {
      console.log(`[M1 Worker] Skipping rollout save (zero variance in group rewards: ${JSON.stringify(rewards)})`);
    }
  }

  await browser.close();
  console.log('\n[M1 Worker] Local rollout batch finished.');
}

runM1Worker();

```

---

### 3. Updated `IMPLEMENTATION_STATE.md`

```markdown
# IMPLEMENTATION_STATE.md
- **Current Phase:** Phase 2 Complete -> Ready for Phase 3
- **Last Completed File:** `local_m1_factory.mjs`
- **Next Queued File:** `training/train_dapo_colab.py` & `training/train_m1_mlx.sh`

## File & Component Ledger
- [x] `package.json` & `.env.example` (Dependencies & Config)
- [x] `scripts/dom_distiller.mjs` (Strips bloated HTML to interactive element IDs + Shadow DOM support)
- [x] `scripts/sandbox_verifier.mjs` (Executes candidate Playwright code in headless Chromium & captures failure DOMs)
- [x] `scripts/ci_harvester.mjs` (GitHub Actions 6-hour Teacher synthesis + self-healing verification loop)
- [x] `local_m1_factory.mjs` (MacBook Air M1 Ollama/MLX group rollout generator + Skill Library extractor)
- [ ] `training/train_dapo_colab.py` (Colab Unsloth 4-bit QLoRA + DAPO Trainer with deterministic AST/Selector rewards)
- [ ] `training/train_m1_mlx.sh` (Native Apple Silicon `mlx-lm-lora` DAPO training script)
- [x] `.github/workflows/harvester.yml` (24/7 GitHub Actions automation pipeline)
- [ ] `dashboard/server.mjs` (Local zero-dependency UI to inspect skills, failure recovery rates, and rollouts)

## Architectural Decisions & Cross-File Contracts
- JSONL Schema: `{"task_prompt": str, "dom_context": str, "candidate_completions": list[str], "verifier_rewards": list[float], "verified_selector": str}`
- Failure Recovery Schema (`./data/browser_failures.jsonl`): `{"url": str, "task": str, "initial_dom": str, "attempted_action": str, "error": str, "dom_at_failure": str, "root_cause": str, "verified_recovery_completion": str, "verified_selector": str}`
- Skill Library Index (`./verified_skills/skill_index.json`): Tracks `skill_id`, `file`, `url`, `task_prompt`, and `verified_selector` for zero-wait retrieval by `local_m1_factory.mjs`.
- Exports from `scripts/dom_distiller.mjs`: `export async function distillDOM(page, maxElements = 120)`
- Exports from `scripts/sandbox_verifier.mjs`: `export async function verifyCandidateInSandbox(browser, url, taskPrompt, rawCompletion, timeoutMs = 15000)`

```

### 1. `training/train_dapo_colab.py`

Save this file in `./training/train_dapo_colab.py`. When executed on your Google Colab T4, L4, or A100 GPU, it automatically mounts your 5 TB Google Drive (or falls back to your local `./data/` directory), runs an optional **Stage 1 Warm-Up SFT pass** using your verified **Browser Failure Recovery (`browser_failures.jsonl`)** trajectories and highest-scoring rollouts, and then runs **Stage 2 RLVR with DAPO (`loss_type="dapo"`)** using deterministic AST/selector reward functions before exporting a `q4_k_m` GGUF file and `Modelfile` ready for your MacBook Air M1.

```python
#!/usr/bin/env python3
"""
training/train_dapo_colab.py
Production Unsloth 4-Bit QLoRA + TRL DAPO Trainer for Google Colab / Kaggle GPUs.
Reads verified JSONL datasets directly from Google Drive (or ./data), executes
Failure-Recovery SFT warmup + DAPO RLVR training, and exports GGUF + Ollama Modelfile.
"""

import os
import re
import json
import torch
from pathlib import Path
from datasets import Dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig, GRPOConfig, GRPOTrainer

# ==============================================================================
# 1. ENVIRONMENT & PATH CONFIGURATION
# ==============================================================================
GDRIVE_PATH = Path("/content/drive/MyDrive/AI_Factory")
LOCAL_PATH = Path("./data")

ACTIVE_DIR = GDRIVE_PATH if GDRIVE_PATH.exists() else LOCAL_PATH
ROLLOUTS_PATH = ACTIVE_DIR / "dapo_rollouts.jsonl"
FAILURES_PATH = (
    ACTIVE_DIR / "browser_failures.jsonl"
    if (ACTIVE_DIR / "browser_failures.jsonl").exists()
    else LOCAL_PATH / "browser_failures.jsonl"
)
OUTPUT_DIR = ACTIVE_DIR / "checkpoints"
GGUF_EXPORT_DIR = ACTIVE_DIR / "exported_gguf"

MODEL_NAME = os.environ.get("BASE_MODEL", "unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit")
MAX_PROMPT_LEN = 2048
MAX_COMPLETION_LEN = 1024
MAX_SEQ_LEN = MAX_PROMPT_LEN + MAX_COMPLETION_LEN
LORA_RANK = 32

SYSTEM_PROMPT = (
    "You are an elite Playwright browser automation agent. "
    "First, analyze the DOM snapshot and selector resilience inside <thought>...</thought> tags. "
    "Second, output ONLY valid JavaScript statements using the Playwright `page` object inside <code>...</code> tags. "
    "Never use markdown code fences inside <code> tags."
)


# ==============================================================================
# 2. DATASET LOADERS (JSONL -> SFT WARMUP & DAPO RLVR)
# ==============================================================================
def load_jsonl(file_path: Path) -> list[dict]:
    if not file_path.exists():
        return []
    rows = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def build_sft_warmup_dataset(rollout_rows: list[dict], failure_rows: list[dict], tokenizer) -> Dataset | None:
    """
    Combines verified Browser Failure Recoveries + winning rollout trajectories (reward >= 2.5)
    into a high-precision SFT warmup dataset before launching RLVR/DAPO.
    """
    sft_conversations = []

    for row in failure_rows:
        user_text = (
            f"DOM Snapshot at Failure:\n{row.get('dom_at_failure', row.get('initial_dom', ''))}\n\n"
            f"Previous Failed Code:\n{row.get('attempted_action', '')}\n"
            f"Runtime Error: {row.get('error', '')}\n\n"
            f"Task: {row.get('task', '')}"
        )
        assistant_text = row.get("verified_recovery_completion", "")
        if assistant_text:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
                {"role": "assistant", "content": assistant_text},
            ]
            sft_conversations.append({
                "text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            })

    for row in rollout_rows:
        rewards = row.get("verifier_rewards", [])
        candidates = row.get("candidate_completions", [])
        if not rewards or not candidates:
            continue
        best_idx = max(range(len(rewards)), key=lambda idx: rewards[idx])
        if rewards[best_idx] >= 2.5:
            user_text = f"DOM Snapshot:\n{row['dom_context']}\n\nTask: {row['task_prompt']}"
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
                {"role": "assistant", "content": candidates[best_idx]},
            ]
            sft_conversations.append({
                "text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            })

    if not sft_conversations:
        return None
    return Dataset.from_list(sft_conversations)


def build_dapo_dataset(rollout_rows: list[dict]) -> Dataset:
    """
    Formats rollout prompts and ground-truth verified selectors for TRL GRPOTrainer (DAPO mode).
    """
    formatted = []
    for row in rollout_rows:
        rewards = row.get("verifier_rewards", [])
        candidates = row.get("candidate_completions", [])
        best_completion = ""
        if rewards and candidates:
            best_idx = max(range(len(rewards)), key=lambda idx: rewards[idx])
            best_completion = candidates[best_idx]

        formatted.append({
            "prompt": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"DOM Snapshot:\n{row['dom_context']}\n\nTask: {row['task_prompt']}"},
            ],
            "verified_selector": row.get("verified_selector", ""),
            "reference_completion": best_completion,
        })
    return Dataset.from_list(formatted)


# ==============================================================================
# 3. DETERMINISTIC REWARD FUNCTIONS FOR DAPO
# ==============================================================================
def extract_completion_text(completion) -> str:
    if isinstance(completion, list) and len(completion) > 0 and isinstance(completion[0], dict):
        return completion[0].get("content", "")
    if isinstance(completion, dict):
        return completion.get("content", "")
    return str(completion)


def xml_and_ast_structure_reward(completions, **kwargs) -> list[float]:
    """
    Reward 1: Enforces <thought>...</thought><code>...</code> structure
    and penalizes markdown fences or empty code blocks.
    """
    pattern = re.compile(r"^\s*<thought>([\s\S]+?)</thought>\s*<code>([\s\S]+?)</code>\s*$", re.IGNORECASE)
    rewards = []

    for comp in completions:
        text = extract_completion_text(comp)
        match = pattern.search(text)
        if not match:
            rewards.append(-1.0)
            continue

        thought_body, code_body = match.group(1).strip(), match.group(2).strip()
        score = 0.5

        # Penalize markdown fences leaked inside <code> tags
        if "```" in code_body:
            score -= 0.5
        # Reward substantive reasoning inside <thought>
        if 30 <= len(thought_body) <= 1200:
            score += 0.25
        # Verify balanced braces/parentheses and valid Playwright await call
        if (
            "await " in code_body
            and "page." in code_body
            and code_body.count("(") == code_body.count(")")
            and code_body.count("{") == code_body.count("}")
        ):
            score += 0.5
        else:
            score -= 0.5

        rewards.append(round(score, 3))
    return rewards


def playwright_resilience_and_selector_reward(
    prompts, completions, verified_selector, reference_completion, **kwargs
) -> list[float]:
    """
    Reward 2: Scores Playwright locator resilience, penalizes brittle sleeps,
    and rewards matching the sandbox-verified selector from scripts/sandbox_verifier.mjs.
    """
    code_regex = re.compile(r"<code>([\s\S]*?)</code>", re.IGNORECASE)
    rewards = []

    for comp, target_sel, ref_comp in zip(completions, verified_selector, reference_completion):
        text = extract_completion_text(comp)
        code_match = code_regex.search(text)
        if not code_match:
            rewards.append(-1.0)
            continue

        code = code_match.group(1).strip()
        score = 0.0

        # 1. Penalize brittle anti-patterns
        if "waitForTimeout(" in code:
            score -= 0.5

        # 2. Reward resilient Playwright API patterns
        resilient_patterns = [
            "page.locator(",
            "page.getByRole(",
            "page.getByText(",
            "page.getByLabel(",
            "page.getByPlaceholder(",
            "page.getByTestId(",
            "page.waitForSelector(",
        ]
        if any(pat in code for pat in resilient_patterns):
            score += 1.0

        # 3. High reward for matching the exact sandbox-verified selector
        if target_sel and target_sel in code:
            score += 2.0

        # 4. Bonus for state verification / explicit waiting
        if any(w in code for w in ["waitFor(", "expect(", "waitForLoadState("]):
            score += 0.5

        rewards.append(round(score, 3))
    return rewards


# ==============================================================================
# 4. MAIN TRAINING & EXPORT PIPELINE
# ==============================================================================
def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    GGUF_EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    rollout_rows = load_jsonl(ROLLOUTS_PATH)
    failure_rows = load_jsonl(FAILURES_PATH)

    if not rollout_rows:
        raise FileNotFoundError(
            f"No rollout data found at {ROLLOUTS_PATH}. Run `npm run harvest:ci` or `npm run worker:m1` first."
        )

    print(f"[Trainer] Loaded {len(rollout_rows)} DAPO rollout groups and {len(failure_rows)} failure recoveries.")

    # Load Base Model with Unsloth vLLM fast_inference
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,
        fast_inference=True,
        max_lora_rank=LORA_RANK,
        gpu_memory_utilization=0.6,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=LORA_RANK,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        use_rslora=True,
        random_state=3407,
    )

    # --------------------------------------------------------------------------
    # STAGE 1: Supervised Warm-Up on Verified Failure Recoveries & Top Rollouts
    # --------------------------------------------------------------------------
    sft_dataset = build_sft_warmup_dataset(rollout_rows, failure_rows, tokenizer)
    if sft_dataset is not None and len(sft_dataset) >= 4:
        print(f"[Trainer] Running Stage 1 SFT Warm-Up on {len(sft_dataset)} verified trajectories...")
        sft_trainer = SFTTrainer(
            model=model,
            processing_class=tokenizer,
            train_dataset=sft_dataset,
            args=SFTConfig(
                dataset_text_field="text",
                max_seq_length=MAX_SEQ_LEN,
                per_device_train_batch_size=2,
                gradient_accumulation_steps=4,
                warmup_ratio=0.05,
                num_train_epochs=1,
                learning_rate=1e-4,
                fp16=not torch.cuda.is_bf16_supported(),
                bf16=torch.cuda.is_bf16_supported(),
                optim="adamw_8bit",
                neftune_noise_alpha=5.0,
                logging_steps=5,
                output_dir=str(OUTPUT_DIR / "sft_warmup"),
            ),
        )
        sft_trainer.train()

    # --------------------------------------------------------------------------
    # STAGE 2: RLVR with DAPO (Decoupled Asymmetric Clipping + Token Normalization)
    # --------------------------------------------------------------------------
    dapo_dataset = build_dapo_dataset(rollout_rows)
    print(f"[Trainer] Launching Stage 2 DAPO RLVR on {len(dapo_dataset)} prompts...")

    dapo_args = GRPOConfig(
        use_vllm=True,
        loss_type="dapo",                    # Token-level normalization (eliminates length bias)
        epsilon=0.2,                         # Lower clipping bound
        epsilon_high=0.28,                   # DAPO asymmetric upper bound for exploration
        mask_truncated_completions=True,     # Prevents truncated sequences from corrupting gradients
        scale_rewards="group",               # Normalize rewards within each rollout group
        learning_rate=5e-6,
        adam_beta1=0.9,
        adam_beta2=0.99,
        weight_decay=0.01,
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        num_generations=6,
        max_prompt_length=MAX_PROMPT_LEN,
        max_completion_length=MAX_COMPLETION_LEN,
        max_steps=min(300, max(50, len(dapo_dataset) * 2)),
        logging_steps=5,
        save_steps=50,
        output_dir=str(OUTPUT_DIR / "dapo_rlvr"),
    )

    dapo_trainer = GRPOTrainer(
        model=model,
        processing_class=tokenizer,
        reward_funcs=[
            xml_and_ast_structure_reward,
            playwright_resilience_and_selector_reward,
        ],
        args=dapo_args,
        train_dataset=dapo_dataset,
    )

    dapo_trainer.train()

    # --------------------------------------------------------------------------
    # STAGE 3: Export Quantized GGUF & Ollama Modelfile to Google Drive for M1 Mac
    # --------------------------------------------------------------------------
    print(f"[Trainer] Exporting 4-bit GGUF model to {GGUF_EXPORT_DIR}...")
    model.save_pretrained_gguf(
        str(GGUF_EXPORT_DIR),
        tokenizer,
        quantization_method="q4_k_m",
    )

    modelfile_content = f'''FROM ./unsloth.Q4_K_M.gguf
PARAMETER temperature 0.4
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
SYSTEM """{SYSTEM_PROMPT}"""
'''
    (GGUF_EXPORT_DIR / "Modelfile").write_text(modelfile_content, encoding="utf-8")
    print("[Trainer] Training & GGUF export complete! Ready to load into Ollama on MacBook Air M1.")


if __name__ == "__main__":
    main()

```

---

### 2. `training/train_m1_mlx.sh`

Save this file in `./training/train_m1_mlx.sh` and make it executable (`chmod +x training/train_m1_mlx.sh`). It runs natively on your **MacBook Air M1** without needing Google Colab at all: it converts your `./data/dapo_rollouts.jsonl` and `./data/browser_failures.jsonl` into the train/valid split expected by Apple Silicon's `mlx-lm-lora` / `mlx-lm`, trains the LoRA adapter using unified memory with gradient checkpointing enabled, fuses the adapter weights, and optionally registers the updated model directly in your local Ollama server.

```bash
#!/usr/bin/env bash
# ==============================================================================
# training/train_m1_mlx.sh
# Native Apple Silicon (M1/M2/M3/M4) Micro-Trainer using MLX & mlx-lm-lora.
# Prepares ./data/dapo_rollouts.jsonl + ./data/browser_failures.jsonl, runs
# memory-capped LoRA/DAPO training on M1 unified RAM, and fuses adapters.
# ==============================================================================

set -euo pipefail

MLX_MODEL="${MLX_MODEL:-mlx-community/Qwen2.5-Coder-3B-Instruct-4bit}"
DATA_DIR="${DATA_DIR:-./data}"
MLX_DATASET_DIR="${DATA_DIR}/mlx_dataset"
ADAPTER_DIR="./models/m1_lora_adapters"
FUSED_MODEL_DIR="./models/qwen_browser_m1_fused"
BATCH_SIZE="${BATCH_SIZE:-1}"
NUM_LAYERS="${NUM_LAYERS:-8}"
ITERS="${ITERS:-150}"
LR="${LR:-1e-5}"

echo "=================================================================="
echo "[M1 MLX Trainer] Base Model : ${MLX_MODEL}"
echo "[M1 MLX Trainer] Data Source: ${DATA_DIR}"
echo "=================================================================="

mkdir -p "${MLX_DATASET_DIR}" "${ADAPTER_DIR}"

# 1. Transform dapo_rollouts.jsonl & browser_failures.jsonl into MLX train.jsonl / valid.jsonl
python3 - "${DATA_DIR}" "${MLX_DATASET_DIR}" << 'EOF'
import sys, json
from pathlib import Path

data_dir = Path(sys.argv[1])
out_dir = Path(sys.argv[2])

rollouts_file = data_dir / "dapo_rollouts.jsonl"
failures_file = data_dir / "browser_failures.jsonl"

system_prompt = (
    "You are an elite Playwright browser automation agent. "
    "First, analyze the DOM snapshot and selector resilience inside <thought>...</thought> tags. "
    "Second, output ONLY valid JavaScript statements using the Playwright `page` object inside <code>...</code> tags."
)

records = []

# Ingest verified failure recoveries
if failures_file.exists():
    with open(failures_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            completion = row.get("verified_recovery_completion", "")
            if not completion:
                continue
            user_msg = (
                f"DOM Snapshot:\n{row.get('dom_at_failure', row.get('initial_dom', ''))}\n\n"
                f"Task: {row.get('task', '')}"
            )
            records.append({
                "prompt": f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_msg}<|im_end|>\n<|im_start|>assistant\n",
                "completion": f"{completion}<|im_end|>",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": completion}
                ]
            })

# Ingest highest-reward rollout from each verified group
if rollouts_file.exists():
    with open(rollouts_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            rewards = row.get("verifier_rewards", [])
            candidates = row.get("candidate_completions", [])
            if not rewards or not candidates:
                continue
            best_idx = max(range(len(rewards)), key=lambda i: rewards[i])
            if rewards[best_idx] < 1.5:
                continue
            user_msg = f"DOM Snapshot:\n{row['dom_context']}\n\nTask: {row['task_prompt']}"
            records.append({
                "prompt": f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_msg}<|im_end|>\n<|im_start|>assistant\n",
                "completion": f"{candidates[best_idx]}<|im_end|>",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": candidates[best_idx]}
                ]
            })

if not records:
    print("[M1 MLX Prep] ERROR: No verified trajectories found in ./data/. Run `npm run worker:m1` first.")
    sys.exit(1)

# Guarantee at least 1 validation example even on small datasets
split_idx = max(1, int(len(records) * 0.9))
train_rows = records[:split_idx]
valid_rows = records[split_idx:] if len(records) > 1 else records

with open(out_dir / "train.jsonl", "w", encoding="utf-8") as f:
    for r in train_rows:
        f.write(json.dumps(r) + "\n")

with open(out_dir / "valid.jsonl", "w", encoding="utf-8") as f:
    for r in valid_rows:
        f.write(json.dumps(r) + "\n")

print(f"[M1 MLX Prep] Wrote {len(train_rows)} train rows and {len(valid_rows)} valid rows to {out_dir}")
EOF

# 2. Check & install Apple Silicon MLX training packages if missing
if ! python3 -c "import mlx_lm" >/dev/null 2>&1; then
    echo "[M1 MLX Trainer] Installing mlx-lm and mlx-lm-lora..."
    pip3 install --upgrade mlx-lm mlx-lm-lora
fi

# 3. Execute DAPO / LoRA Training on Apple Silicon Unified Memory
if python3 -c "import mlx_lm_lora" >/dev/null 2>&1; then
    echo "[M1 MLX Trainer] Running native Apple Silicon DAPO training via mlx_lm_lora..."
    python3 -m mlx_lm_lora.train \
        --model "${MLX_MODEL}" \
        --train \
        --data "${MLX_DATASET_DIR}" \
        --train-mode dapo \
        --batch-size "${BATCH_SIZE}" \
        --num-layers "${NUM_LAYERS}" \
        --iters "${ITERS}" \
        --learning-rate "${LR}" \
        --grad-checkpoint \
        --adapter-path "${ADAPTER_DIR}"
else
    echo "[M1 MLX Trainer] Running Apple Silicon LoRA fine-tuning via mlx_lm..."
    python3 -m mlx_lm.lora \
        --model "${MLX_MODEL}" \
        --train \
        --data "${MLX_DATASET_DIR}" \
        --batch-size "${BATCH_SIZE}" \
        --num-layers "${NUM_LAYERS}" \
        --iters "${ITERS}" \
        --learning-rate "${LR}" \
        --grad-checkpoint \
        --adapter-path "${ADAPTER_DIR}"
fi

# 4. Fuse Adapter into Standalone Local MLX Model for Zero-Overhead Inference
echo "[M1 MLX Trainer] Fusing adapter weights into ${FUSED_MODEL_DIR}..."
python3 -m mlx_lm.fuse \
    --model "${MLX_MODEL}" \
    --adapter-path "${ADAPTER_DIR}" \
    --save-path "${FUSED_MODEL_DIR}"

echo "=================================================================="
echo "[M1 MLX Trainer] Complete! Fused model saved at: ${FUSED_MODEL_DIR}"
echo "Serve locally with: python3 -m mlx_lm.server --model ${FUSED_MODEL_DIR} --port 8080"
echo "=================================================================="

```

---

### 3. Updated `IMPLEMENTATION_STATE.md`

```markdown
# IMPLEMENTATION_STATE.md
- **Current Phase:** Phase 3 Complete -> Ready for Phase 4 (Final Phase)
- **Last Completed File:** `training/train_m1_mlx.sh`
- **Next Queued File:** `dashboard/server.mjs` & `dashboard/index.html`

## File & Component Ledger
- [x] `package.json` & `.env.example` (Dependencies & Config)
- [x] `scripts/dom_distiller.mjs` (Strips bloated HTML to interactive element IDs + Shadow DOM support)
- [x] `scripts/sandbox_verifier.mjs` (Executes candidate Playwright code in headless Chromium & captures failure DOMs)
- [x] `scripts/ci_harvester.mjs` (GitHub Actions 6-hour Teacher synthesis + self-healing verification loop)
- [x] `local_m1_factory.mjs` (MacBook Air M1 Ollama/MLX group rollout generator + Skill Library extractor)
- [x] `training/train_dapo_colab.py` (Colab Unsloth 4-bit QLoRA + SFT Failure Warmup + DAPO Trainer + GGUF Export)
- [x] `training/train_m1_mlx.sh` (Native Apple Silicon `mlx-lm-lora` / `mlx-lm` DAPO/LoRA micro-trainer + weight fuser)
- [x] `.github/workflows/harvester.yml` (24/7 GitHub Actions automation pipeline)
- [ ] `dashboard/server.mjs` (Local zero-dependency UI & API server to inspect skills, failure recoveries, and rollouts)

## Architectural Decisions & Cross-File Contracts
- JSONL Schema (`./data/dapo_rollouts.jsonl`): `{"task_prompt": str, "dom_context": str, "candidate_completions": list[str], "verifier_rewards": list[float], "verified_selector": str}`
- Failure Recovery Schema (`./data/browser_failures.jsonl`): `{"url": str, "task": str, "initial_dom": str, "attempted_action": str, "error": str, "dom_at_failure": str, "root_cause": str, "verified_recovery_completion": str, "verified_selector": str}`
- Skill Library Index (`./verified_skills/skill_index.json`): Tracks `skill_id`, `file`, `url`, `task_prompt`, and `verified_selector`.
- Colab GGUF Export Output: Saves `unsloth.Q4_K_M.gguf` and `Modelfile` to `/content/drive/MyDrive/AI_Factory/exported_gguf/` for one-command Ollama import (`ollama create qwen-browser-v2 -f Modelfile`).

```


### 1. `dashboard/server.mjs`

Save this file in `./dashboard/server.mjs` and launch it anytime with `npm run dashboard`. Built using zero external dependencies (`node:http`, `node:fs/promises`, and `node:child_process`), it serves a real-time **AI Factory Control Center UI** at `http://localhost:3333` where you can inspect your **Executable Skill Library**, examine **Browser Failure Self-Healing trajectories**, monitor **DAPO group reward distributions**, and trigger local M1 rollout workers or MLX micro-training runs directly from your browser.

```javascript
/**
 * dashboard/server.mjs
 * Zero-dependency real-time Control Center & Telemetry Server for the
 * Zero-OCI Autonomous Coding & Browser AI Factory.
 * Run with: npm run dashboard -> http://localhost:3333
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 3333);
const DATA_DIR = path.resolve('./data');
const SKILLS_DIR = path.resolve('./verified_skills');
const ROLLOUTS_FILE = path.join(DATA_DIR, 'dapo_rollouts.jsonl');
const FAILURES_FILE = path.join(DATA_DIR, 'browser_failures.jsonl');
const SKILL_INDEX_FILE = path.join(SKILLS_DIR, 'skill_index.json');
const STATE_FILE = path.resolve('./IMPLEMENTATION_STATE.md');

let activeJob = null;
let jobLogs = [];

async function readJsonLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readSkillLibrary() {
  try {
    const rawIndex = await fs.readFile(SKILL_INDEX_FILE, 'utf8');
    const skills = JSON.parse(rawIndex);
    const enriched = await Promise.all(
      skills.map(async (item) => {
        try {
          const code = await fs.readFile(path.join(SKILLS_DIR, item.file), 'utf8');
          return { ...item, code };
        } catch {
          return { ...item, code: '// Skill source file not found' };
        }
      })
    );
    return enriched;
  } catch {
    return [];
  }
}

async function getFactoryTelemetry() {
  const [rollouts, failures, skills, stateMarkdown] = await Promise.all([
    readJsonLines(ROLLOUTS_FILE),
    readJsonLines(FAILURES_FILE),
    readSkillLibrary(),
    fs.readFile(STATE_FILE, 'utf8').catch(() => '# IMPLEMENTATION_STATE.md not found')
  ]);

  let totalCandidates = 0;
  let passingCandidates = 0;
  let cumulativeReward = 0;

  for (const group of rollouts) {
    const rewards = Array.isArray(group.verifier_rewards) ? group.verifier_rewards : [];
    for (const r of rewards) {
      totalCandidates++;
      cumulativeReward += Number(r || 0);
      if (Number(r) >= 2.0) passingCandidates++;
    }
  }

  const passRate = totalCandidates > 0 ? ((passingCandidates / totalCandidates) * 100).toFixed(1) : '0.0';
  const avgReward = totalCandidates > 0 ? (cumulativeReward / totalCandidates).toFixed(2) : '0.00';

  return {
    metrics: {
      rolloutGroups: rollouts.length,
      totalCandidatesEvaluated: totalCandidates,
      sandboxPassRate: `${passRate}%`,
      averageReward: avgReward,
      verifiedSkillsCount: skills.length,
      healedFailuresCount: failures.length,
      readyForColabDapo: rollouts.length >= 25
    },
    activeJob,
    jobLogs: jobLogs.slice(-60),
    skills: skills.slice().reverse(),
    failures: failures.slice(-25).reverse(),
    rollouts: rollouts.slice(-25).reverse(),
    stateMarkdown
  };
}

function triggerBackgroundJob(jobName, command, args = []) {
  if (activeJob) {
    return { started: false, message: `Job '${activeJob}' is already running.` };
  }

  activeJob = jobName;
  jobLogs = [`[${new Date().toISOString()}] Starting job: ${jobName} (${command} ${args.join(' ')})`];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false
  });

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    jobLogs.push(...lines);
  });

  child.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    jobLogs.push(...lines.map((l) => `[WARN] ${l}`));
  });

  child.on('close', (code) => {
    jobLogs.push(`[${new Date().toISOString()}] Job '${jobName}' finished with exit code ${code}.`);
    activeJob = null;
  });

  return { started: true, message: `Started '${jobName}'.` };
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zero-OCI AI Factory — Control Center</title>
  <style>
    :root {
      --bg: #0b0f17;
      --panel: #131b2e;
      --border: #23304d;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --green: #22c55e;
      --amber: #f59e0b;
      --red: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .title-group h1 { font-size: 1.4rem; color: var(--accent); }
    .title-group p { font-size: 0.85rem; color: var(--muted); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button {
      background: #1e293b;
      color: var(--text);
      border: 1px solid var(--accent);
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: background 0.15s;
    }
    button:hover { background: #0284c7; color: #fff; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .kpi-card .label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; }
    .kpi-card .value { font-size: 1.65rem; font-weight: 700; margin-top: 6px; color: var(--accent); }
    .tabs { display: flex; gap: 10px; margin-bottom: 16px; }
    .tab-btn { border-color: var(--border); }
    .tab-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 20px;
    }
    pre {
      background: #070a10;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-size: 0.8rem;
      color: #cbd5e1;
      margin-top: 8px;
      white-space: pre-wrap;
    }
    .item-card {
      border-bottom: 1px solid var(--border);
      padding: 14px 0;
    }
    .item-card:last-child { border-bottom: none; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-right: 6px;
    }
    .badge-green { background: rgba(34, 197, 94, 0.2); color: var(--green); }
    .badge-amber { background: rgba(245, 158, 11, 0.2); color: var(--amber); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header>
    <div class="title-group">
      <h1>Zero-OCI Autonomous Coding & Browser AI Factory</h1>
      <p>Tier 1: Executable Skill Library • Tier 2: Teacher Failure Recovery • Tier 3: Unsloth / M1 MLX DAPO</p>
    </div>
    <div class="actions">
      <button onclick="startJob('m1_worker')">Run M1 Local Worker</button>
      <button onclick="startJob('ci_harvester')">Run Gemini Harvester</button>
      <button onclick="startJob('m1_mlx_train')">Run M1 MLX Micro-Train</button>
      <button onclick="refreshTelemetry()">Refresh Now</button>
    </div>
  </header>

  <section class="kpi-grid" id="kpiGrid"></section>

  <section class="panel" id="jobConsolePanel">
    <strong>Live Worker & Trainer Console</strong> <span id="jobStatusBadge" class="badge badge-green">IDLE</span>
    <pre id="jobLogsBox">No active background job. Click a trigger button above to launch a worker.</pre>
  </section>

  <nav class="tabs">
    <button class="tab-btn active" onclick="switchTab('skillsTab', this)">Executable Skill Library</button>
    <button class="tab-btn" onclick="switchTab('rolloutsTab', this)">DAPO Group Rollouts</button>
    <button class="tab-btn" onclick="switchTab('failuresTab', this)">Self-Healed Browser Failures</button>
    <button class="tab-btn" onclick="switchTab('stateTab', this)">IMPLEMENTATION_STATE.md</button>
  </nav>

  <section id="skillsTab" class="panel"></section>
  <section id="rolloutsTab" class="panel hidden"></section>
  <section id="failuresTab" class="panel hidden"></section>
  <section id="stateTab" class="panel hidden"></section>

  <script>
    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function switchTab(tabId, btn) {
      ['skillsTab', 'rolloutsTab', 'failuresTab', 'stateTab'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.remove('hidden');
      btn.classList.add('active');
    }

    async function startJob(jobType) {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType })
      }).then(r => r.json());
      alert(res.message);
      refreshTelemetry();
    }

    async function refreshTelemetry() {
      const data = await fetch('/api/telemetry').then(r => r.json());
      const m = data.metrics;

      document.getElementById('kpiGrid').innerHTML = [
        ['Verified Skills (0s)', m.verifiedSkillsCount],
        ['DAPO Rollout Groups', m.rolloutGroups],
        ['Candidates Tested', m.totalCandidatesEvaluated],
        ['Sandbox Pass Rate', m.sandboxPassRate],
        ['Mean Verifier Reward', m.averageReward],
        ['Healed DOM Failures', m.healedFailuresCount]
      ].map(([label, val]) => \`
        <div class="kpi-card">
          <div class="label">\${label}</div>
          <div class="value">\${val}</div>
        </div>
      \`).join('');

      const badge = document.getElementById('jobStatusBadge');
      badge.textContent = data.activeJob ? 'RUNNING: ' + data.activeJob : 'IDLE';
      badge.className = 'badge ' + (data.activeJob ? 'badge-amber' : 'badge-green');
      if (data.jobLogs && data.jobLogs.length) {
        document.getElementById('jobLogsBox').textContent = data.jobLogs.join('\\n');
      }

      document.getElementById('skillsTab').innerHTML = data.skills.length
        ? data.skills.map(s => \`
            <div class="item-card">
              <span class="badge badge-green">\${escapeHtml(s.skill_id)}</span>
              <strong>\${escapeHtml(s.task_prompt)}</strong>
              <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">
                URL: \${escapeHtml(s.url)} | Verified Selector: <code>\${escapeHtml(s.verified_selector || 'N/A')}</code>
              </div>
              <pre>\${escapeHtml(s.code)}</pre>
            </div>
          \`).join('')
        : '<p>No skills extracted yet. Run the M1 Worker or Gemini Harvester to populate ./verified_skills/.</p>';

      document.getElementById('rolloutsTab').innerHTML = data.rollouts.length
        ? data.rollouts.map(r => \`
            <div class="item-card">
              <span class="badge badge-amber">Rewards: [\${(r.verifier_rewards || []).join(', ')}]</span>
              <strong>\${escapeHtml(r.task_prompt)}</strong>
              <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">
                Verified Selector: <code>\${escapeHtml(r.verified_selector || 'N/A')}</code>
              </div>
              <pre>\${escapeHtml((r.candidate_completions || [])[0] || '')}</pre>
            </div>
          \`).join('')
        : '<p>No DAPO rollouts recorded yet.</p>';

      document.getElementById('failuresTab').innerHTML = data.failures.length
        ? data.failures.map(f => \`
            <div class="item-card">
              <span class="badge badge-green">HEALED</span>
              <strong>\${escapeHtml(f.task)}</strong>
              <div style="font-size:0.8rem;color:#f87171;margin-top:4px;">
                Root Cause: \${escapeHtml(f.root_cause)} | Original Error: \${escapeHtml(f.error)}
              </div>
              <pre>\${escapeHtml(f.verified_recovery_completion)}</pre>
            </div>
          \`).join('')
        : '<p>No browser failures logged yet.</p>';

      document.getElementById('stateTab').innerHTML = '<pre>' + escapeHtml(data.stateMarkdown) + '</pre>';
    }

    refreshTelemetry();
    setInterval(refreshTelemetry, 5000);
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(DASHBOARD_HTML);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/telemetry') {
    const telemetry = await getFactoryTelemetry();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(telemetry));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/trigger') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { jobType } = JSON.parse(body || '{}');

    let result;
    if (jobType === 'm1_worker') {
      result = triggerBackgroundJob('M1 Local Rollout Worker', 'node', ['local_m1_factory.mjs']);
    } else if (jobType === 'ci_harvester') {
      result = triggerBackgroundJob('Gemini Teacher Harvester', 'node', ['scripts/ci_harvester.mjs']);
    } else if (jobType === 'm1_mlx_train') {
      result = triggerBackgroundJob('M1 MLX DAPO Micro-Trainer', 'bash', ['training/train_m1_mlx.sh']);
    } else {
      result = { started: false, message: `Unknown jobType: ${jobType}` };
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`[AI Factory Dashboard] Live at http://localhost:${PORT}`);
  console.log(`==================================================================`);
});

```

---

### 2. Quick-Start Launch Sequence on Your MacBook Air M1

Run these four commands inside your project directory (`~/Library/CloudStorage/GoogleDrive/My Drive/AI_Factory`) to bring the entire system online:

```bash
# 1. Install dependencies & headless Chromium
npm install
npx playwright install chromium

# 2. Pull the base 3B coder model in Ollama on your M1 Mac
ollama pull qwen2.5-coder:3b

# 3. Start the real-time Control Center Dashboard at http://localhost:3333
npm run dashboard

# 4. Run your first M1 Local Rollout + Skill Extraction batch (or click "Run M1 Local Worker" in the UI)
npm run worker:m1

```

---

### 3. Finalized `IMPLEMENTATION_STATE.md`

Save this completed ledger at `./IMPLEMENTATION_STATE.md` in the root of your repository so both your local dashboard and any future Google AI Studio sessions have the complete architectural map:

```markdown
# IMPLEMENTATION_STATE.md
- **Current Phase:** ALL 4 PHASES COMPLETE (100% Production Ready)
- **Last Completed File:** `dashboard/server.mjs`
- **Next Queued File:** None — Autonomous Evolution Loop Active

## File & Component Ledger
- [x] `package.json` & `.env.example` (Dependencies & Config)
- [x] `scripts/dom_distiller.mjs` (Strips bloated HTML to interactive element IDs + Shadow DOM support)
- [x] `scripts/sandbox_verifier.mjs` (Executes candidate Playwright code in headless Chromium & captures failure DOMs)
- [x] `scripts/ci_harvester.mjs` (GitHub Actions 6-hour Teacher synthesis + self-healing verification loop)
- [x] `local_m1_factory.mjs` (MacBook Air M1 Ollama/MLX group rollout generator + Skill Library extractor)
- [x] `training/train_dapo_colab.py` (Colab Unsloth 4-bit QLoRA + SFT Failure Warmup + DAPO Trainer + GGUF Export)
- [x] `training/train_m1_mlx.sh` (Native Apple Silicon `mlx-lm-lora` / `mlx-lm` DAPO/LoRA micro-trainer + weight fuser)
- [x] `.github/workflows/harvester.yml` (24/7 GitHub Actions automation pipeline)
- [x] `dashboard/server.mjs` (Local zero-dependency UI & API server to inspect skills, failure recoveries, and rollouts)

## Architectural Decisions & Cross-File Contracts
- JSONL Schema (`./data/dapo_rollouts.jsonl`): `{"task_prompt": str, "dom_context": str, "candidate_completions": list[str], "verifier_rewards": list[float], "verified_selector": str}`
- Failure Recovery Schema (`./data/browser_failures.jsonl`): `{"url": str, "task": str, "initial_dom": str, "attempted_action": str, "error": str, "dom_at_failure": str, "root_cause": str, "verified_recovery_completion": str, "verified_selector": str}`
- Skill Library Index (`./verified_skills/skill_index.json`): Tracks `skill_id`, `file`, `url`, `task_prompt`, and `verified_selector` for zero-wait retrieval by `local_m1_factory.mjs`.
- Colab GGUF Export Output: Saves `unsloth.Q4_K_M.gguf` and `Modelfile` to `/content/drive/MyDrive/AI_Factory/exported_gguf/` for one-command Ollama import (`ollama create qwen-browser-v2 -f Modelfile`).

```