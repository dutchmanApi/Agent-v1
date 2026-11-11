import 'dotenv/config';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { distillDOM } from './scripts/dom_distiller.mjs';
import { verifyCandidateInSandbox } from './scripts/sandbox_verifier.mjs';

const ollama = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
const model = process.env.LOCAL_MODEL || 'qwen2.5-coder:3b';
const groupSize = Math.max(2, Math.min(8, Number(process.env.GROUP_SIZE) || 4));
const dataDir = path.resolve(process.env.DATA_DIR || './data');
const skillsDir = path.resolve('./verified_skills');
const indexFile = path.join(skillsDir, 'skill_index.json');
const rolloutFile = path.join(dataDir, 'dapo_rollouts.jsonl');
const driveDir = process.env.GDRIVE_FACTORY_DIR || path.join(os.homedir(), 'Library/CloudStorage/GoogleDrive/My Drive/AI_Factory');
const tasks = [
  { url: 'https://the-internet.herokuapp.com/dropdown', task: 'Select Option 2 from the dropdown and verify it is selected.' },
  { url: 'https://the-internet.herokuapp.com/tables', task: 'Read the first row of the sortable data table.' },
  { url: 'https://books.toscrape.com/', task: 'Open the Travel category from the category list.' },
  { url: 'https://quotes.toscrape.com/js/', task: 'Extract the text of the first visible quote.' }
];

async function init() {
  await Promise.all([mkdir(dataDir, { recursive: true }), mkdir(skillsDir, { recursive: true })]);
  try { JSON.parse(await readFile(indexFile, 'utf8')); }
  catch { await writeFile(indexFile, '[]\n', 'utf8'); }
}

async function skillHint(url) {
  try {
    const index = JSON.parse(await readFile(indexFile, 'utf8'));
    const match = index.find((entry) => new URL(entry.url).hostname === new URL(url).hostname);
    if (!match) return '';
    const source = await readFile(path.join(skillsDir, path.basename(match.file)), 'utf8');
    return `Verified skill example (adapt only if useful):\n${source.slice(0, 5000)}\n\n`;
  } catch { return ''; }
}

async function generate(task, dom, hint, temperature) {
  const response = await fetch(`${ollama}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model,
      system: 'Write one Playwright completion only. Return <thought>...</thought><code>JavaScript statements using page</code>. Do not use Node globals, filesystem, process, network APIs, dynamic imports, constructors, or prototypes.',
      prompt: `${hint}Visible DOM:\n${dom}\n\nTask: ${task}\n\nReturn the completion now.`,
      stream: false,
      options: { temperature, top_p: 0.9, num_ctx: 4096 }
    })
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.response !== 'string' || !data.response.trim()) throw new Error('Ollama returned an empty completion.');
  return data.response;
}

async function registerSkill(url, task, code, selector) {
  const id = `skill_${createHash('sha256').update(`${url}\n${task}`).digest('hex').slice(0, 12)}`;
  const file = `${id}.mjs`;
  const source = `/** Local verified skill: ${id} */\nexport async function executeSkill(page, params = {}) {\n${code.split('\n').map((line) => `  ${line}`).join('\n')}\n}\n`;
  await writeFile(path.join(skillsDir, file), source, 'utf8');
  const index = JSON.parse(await readFile(indexFile, 'utf8'));
  const record = { skill_id: id, file, url, task_prompt: task, verified_selector: selector, updated_at: new Date().toISOString() };
  const at = index.findIndex((entry) => entry.skill_id === id);
  if (at < 0) index.push(record); else index[at] = record;
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

async function saveRollout(row) {
  const line = `${JSON.stringify(row)}\n`;
  await appendFile(rolloutFile, line, 'utf8');
  try {
    await mkdir(driveDir, { recursive: true });
    await appendFile(path.join(driveDir, 'dapo_rollouts.jsonl'), line, 'utf8');
    console.log(`[M1 worker] Mirrored rollout to ${driveDir}`);
  } catch { console.log('[M1 worker] Google Drive is not available; kept the local copy.'); }
}

async function run() {
  await init();
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    for (const item of tasks) {
      console.log(`[M1 worker] ${item.url}`);
      let dom;
      try {
        const page = await browser.newPage();
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        dom = await distillDOM(page, 90);
        await page.close();
      } catch (error) { console.warn(`[M1 worker] Skipped: ${error.message}`); continue; }
      const hint = await skillHint(item.url);
      const completions = [];
      const rewards = [];
      let best;
      for (let i = 0; i < groupSize; i++) {
        try {
          const completion = await generate(item.task, dom.snapshotText, hint, 0.55 + i * 0.08);
          const result = await verifyCandidateInSandbox(browser, item.url, item.task, completion, 15000);
          completions.push(completion);
          rewards.push(result.reward);
          console.log(`  candidate ${i + 1}/${groupSize}: ${result.status}, reward=${result.reward}`);
          if (result.goal_achieved && (!best || result.reward > best.reward)) best = result;
        } catch (error) {
          console.warn(`  candidate ${i + 1}/${groupSize} failed: ${error.message}`);
        }
      }
      if (best && best.reward >= 2.5) await registerSkill(item.url, item.task, best.extracted_code, best.primary_selector);
      if (rewards.length > 1 && Math.max(...rewards) > Math.min(...rewards)) {
        await saveRollout({
          task_prompt: item.task,
          dom_context: dom.snapshotText,
          candidate_completions: completions,
          verifier_rewards: rewards,
          verified_selector: best?.primary_selector || ''
        });
      }
    }
  } finally { await browser.close(); }
}

run().catch((error) => { console.error(`[M1 worker] Fatal: ${error.stack || error}`); process.exitCode = 1; });
