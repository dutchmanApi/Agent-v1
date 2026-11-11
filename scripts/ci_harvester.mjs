import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { distillDOM } from './dom_distiller.mjs';
import { verifyCandidateInSandbox } from './sandbox_verifier.mjs';

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is required. Add it as a GitHub Actions secret.');
const ai = new GoogleGenAI({ apiKey: key });
// Candidate code runs in Node. Remove credentials from the environment before
// any generated code is evaluated; the SDK already holds its API client config.
delete process.env.GEMINI_API_KEY;

const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const root = process.cwd();
const dataDir = path.join(root, 'data');
const skillsDir = path.join(root, 'verified_skills');
const rolloutPath = path.join(dataDir, 'dapo_rollouts.jsonl');
const failurePath = path.join(dataDir, 'browser_failures.jsonl');
const skillIndexPath = path.join(skillsDir, 'skill_index.json');
const targets = (process.env.HARVEST_TARGETS || [
  'https://books.toscrape.com/',
  'https://quotes.toscrape.com/js/',
  'https://the-internet.herokuapp.com/dropdown',
  'https://the-internet.herokuapp.com/tables'
].join(',')).split(',').map((url) => url.trim()).filter(Boolean);

async function ensureStorage() {
  await Promise.all([mkdir(dataDir, { recursive: true }), mkdir(skillsDir, { recursive: true })]);
  try { JSON.parse(await readFile(skillIndexPath, 'utf8')); }
  catch { await writeFile(skillIndexPath, '[]\n', 'utf8'); }
}

async function generateJson(prompt) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.3 }
  });
  const text = response.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return JSON.parse(text);
}

async function synthesize(url, snapshot) {
  const generated = await generateJson(`Create one browser task and four candidate Playwright completions based on this visible DOM. Only use safe page locator, read, and interaction methods. Do not access Node globals, the filesystem, environment variables, or external network. Return JSON: {"task_prompt": string, "candidates": [four strings]}, each candidate formatted <thought>...</thought><code>JavaScript statements using page...</code>.\nURL: ${url}\nDOM:\n${snapshot}`);
  if (typeof generated.task_prompt !== 'string' || !Array.isArray(generated.candidates) || generated.candidates.length !== 4 || generated.candidates.some((x) => typeof x !== 'string')) {
    throw new Error('Gemini output did not match the required task/candidate schema.');
  }
  return generated;
}

async function heal(failure) {
  return generateJson(`Repair this failed Playwright action. Use only the page object and return JSON {"root_cause": string, "repaired_completion": "<thought>...</thought><code>...</code>"}.\nTask: ${failure.task}\nCode: ${failure.attempted_action}\nError: ${failure.error}\nDOM at failure:\n${failure.dom_at_failure}`);
}

async function saveSkill(url, task, code, selector) {
  const id = `skill_${createHash('sha256').update(`${url}\n${task}`).digest('hex').slice(0, 12)}`;
  const file = `${id}.mjs`;
  const safeComment = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/\*\//g, '* /');
  const source = `/** Verified browser skill: ${id}\n * URL: ${safeComment(url)}\n * Task: ${safeComment(task)}\n */\nexport async function executeSkill(page, params = {}) {\n${code.split('\n').map((line) => `  ${line}`).join('\n')}\n}\n`;
  await writeFile(path.join(skillsDir, file), source, 'utf8');
  const index = JSON.parse(await readFile(skillIndexPath, 'utf8'));
  const record = { skill_id: id, file, url, task_prompt: task, verified_selector: selector, updated_at: new Date().toISOString() };
  const at = index.findIndex((entry) => entry.skill_id === id);
  if (at < 0) index.push(record); else index[at] = record;
  await writeFile(skillIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

async function run() {
  await ensureStorage();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const url of targets) {
      console.log(`[Harvester] ${url}`);
      let initial;
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        initial = await distillDOM(page, 100);
        await page.close();
      } catch (error) {
        console.warn(`[Harvester] Skipping navigation failure: ${error.message}`);
        continue;
      }
      if (!initial.items.length) { console.warn('[Harvester] No visible controls found.'); continue; }

      try {
        const generated = await synthesize(url, initial.snapshotText);
        const candidates = generated.candidates.slice();
        const results = [];
        let best = null;
        let firstFailure = null;
        for (const completion of candidates) {
          const result = await verifyCandidateInSandbox(browser, url, generated.task_prompt, completion, 15000);
          results.push(result);
          if (result.goal_achieved && (!best || result.reward > best.reward)) best = result;
          if (!result.goal_achieved && result.failure_record && !firstFailure) firstFailure = result.failure_record;
        }
        if (best && best.reward >= 2.5) await saveSkill(url, generated.task_prompt, best.extracted_code, best.primary_selector);

        if (firstFailure) {
          try {
            const repair = await heal(firstFailure);
            if (typeof repair.repaired_completion === 'string') {
              const recovered = await verifyCandidateInSandbox(browser, url, generated.task_prompt, repair.repaired_completion, 15000);
              if (recovered.goal_achieved) {
                await appendFile(failurePath, `${JSON.stringify({
                  url, task: generated.task_prompt, initial_dom: initial.snapshotText,
                  ...firstFailure, root_cause: String(repair.root_cause || ''),
                  verified_recovery_completion: repair.repaired_completion,
                  verified_selector: recovered.primary_selector
                })}\n`, 'utf8');
              }
            }
          } catch (error) { console.warn(`[Harvester] Recovery failed: ${error.message}`); }
        }

        const rewards = results.map((result) => result.reward);
        if (rewards.length > 1 && Math.max(...rewards) > Math.min(...rewards)) {
          await appendFile(rolloutPath, `${JSON.stringify({
            task_prompt: generated.task_prompt,
            dom_context: initial.snapshotText,
            candidate_completions: candidates,
            verifier_rewards: rewards,
            verified_selector: best?.primary_selector || ''
          })}\n`, 'utf8');
        }
      } catch (error) { console.error(`[Harvester] Failed to process ${url}: ${error.message}`); }
    }
  } finally { await browser.close(); }
}

run().catch((error) => { console.error(`[Harvester] Fatal: ${error.stack || error}`); process.exitCode = 1; });
