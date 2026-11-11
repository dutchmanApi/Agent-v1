import 'dotenv/config';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3333);
const root = path.resolve(process.env.FACTORY_ROOT || process.cwd());
const paths = {
  rollouts: path.join(root, 'data/dapo_rollouts.jsonl'),
  failures: path.join(root, 'data/browser_failures.jsonl'),
  skills: path.join(root, 'verified_skills/skill_index.json'),
  state: path.join(root, 'IMPLEMENTATION_STATE.md'),
};

let activeJob = null;
let logs = [];
function log(message) {
  logs.push(`${new Date().toISOString()} ${message}`);
  if (logs.length > 200) logs = logs.slice(-200);
}

async function jsonl(file) {
  try {
    const content = await readFile(file, 'utf8');
    return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { const item = JSON.parse(line); return item && typeof item === 'object' ? [item] : []; }
      catch { return []; }
    });
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function readSkills() {
  try {
    const index = JSON.parse(await readFile(paths.skills, 'utf8'));
    if (!Array.isArray(index)) return [];
    return await Promise.all(index.slice(-100).map(async (skill) => {
      try {
        const file = path.resolve(path.dirname(paths.skills), skill.file);
        if (!file.startsWith(`${path.dirname(paths.skills)}${path.sep}`)) return { ...skill, code: 'Invalid skill path.' };
        return { ...skill, code: await readFile(file, 'utf8') };
      } catch { return { ...skill, code: 'Skill source file unavailable.' }; }
    }));
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function telemetry() {
  const [rollouts, failures, skills, state] = await Promise.all([
    jsonl(paths.rollouts), jsonl(paths.failures), readSkills(),
    readFile(paths.state, 'utf8').catch((error) => error.code === 'ENOENT' ? 'IMPLEMENTATION_STATE.md not found.' : Promise.reject(error)),
  ]);
  const rewards = rollouts.flatMap((row) => Array.isArray(row.verifier_rewards) ? row.verifier_rewards.map(Number).filter(Number.isFinite) : []);
  const passed = rewards.filter((reward) => reward >= 2).length;
  return {
    metrics: {
      rolloutGroups: rollouts.length,
      candidatesEvaluated: rewards.length,
      passRate: rewards.length ? `${(passed * 100 / rewards.length).toFixed(1)}%` : '0.0%',
      averageReward: rewards.length ? (rewards.reduce((sum, value) => sum + value, 0) / rewards.length).toFixed(2) : '0.00',
      verifiedSkills: skills.length,
      healedFailures: failures.length,
    },
    activeJob, logs: logs.slice(-60), skills: skills.reverse(),
    failures: failures.slice(-25).reverse(), rollouts: rollouts.slice(-25).reverse(), state,
  };
}

const html = await readFile(path.join(root, 'dashboard/index.html'), 'utf8');

function send(res, status, payload, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(payload) : payload);
}

function startJob(jobType) {
  if (activeJob) return { started: false, message: `A job is already running: ${activeJob}` };
  const commands = {
    'worker:m1': ['npm', ['run', 'worker:m1']],
    'harvest:ci': ['npm', ['run', 'harvest:ci']],
    'train:m1': ['npm', ['run', 'train:m1']],
  };
  const command = commands[jobType];
  if (!command) return { started: false, message: 'Unknown job type.' };
  activeJob = jobType;
  logs = [];
  log(`Starting ${jobType}`);
  const child = spawn(command[0], command[1], { cwd: root, env: process.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => chunk.toString().split(/\r?\n/).filter(Boolean).forEach(log));
  child.stderr.on('data', (chunk) => chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => log(`[stderr] ${line}`)));
  child.on('error', (error) => { log(`Could not start job: ${error.message}`); activeJob = null; });
  child.on('close', (code) => { log(`Finished ${jobType} (exit ${code})`); activeJob = null; });
  return { started: true, message: `Started ${jobType}.` };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, html, 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/telemetry') return send(res, 200, await telemetry());
    if (req.method === 'POST' && url.pathname === '/api/trigger') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4096) return send(res, 413, { error: 'Request too large.' }); }
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch { return send(res, 400, { error: 'Invalid JSON.' }); }
      return send(res, 200, startJob(parsed.jobType));
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (error) { return send(res, 500, { error: error.message }); }
});

server.listen(port, host, () => console.log(`AI Factory dashboard: http://${host}:${port}`));
