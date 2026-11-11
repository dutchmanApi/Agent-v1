import { distillDOM } from './dom_distiller.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export function parseModelCompletion(rawText = '') {
  const source = String(rawText);
  const thoughtMatch = source.match(/<thought>([\s\S]*?)<\/thought>/i);
  const codeMatch = source.match(/<code>([\s\S]*?)<\/code>/i);
  const markdownMatch = source.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);
  return {
    hasValidXmlFormat: Boolean(thoughtMatch && codeMatch),
    thought: thoughtMatch?.[1].trim() || '',
    code: codeMatch?.[1].trim() || markdownMatch?.[1].trim() || ''
  };
}

export function analyzeStaticCodeQuality(code = '') {
  let syntaxValid = false;
  try { new AsyncFunction('page', code); syntaxValid = Boolean(code.trim()); } catch { /* invalid syntax */ }
  // Model output is evaluated by Node for Playwright control. Reject common
  // ambient capability access before compiling or executing it.
  const unsafeCode = /\b(?:process|require|fetch|XMLHttpRequest|WebSocket|globalThis|global|eval|Function|import)\b|constructor|__proto__|prototype/.test(code);
  const usesBrittleSleep = /\.waitForTimeout\s*\(/.test(code);
  const usesResilientLocators = /page\.(?:locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|waitForSelector)\s*\(/.test(code);
  const selectorMatch = code.match(/(?:locator|waitForSelector|click|fill|selectOption)\s*\(\s*(['"`])([^'"`]*)\1/);
  return { syntaxValid: syntaxValid && !unsafeCode, unsafeCode, usesResilientLocators, usesBrittleSleep, primarySelector: selectorMatch?.[2] || '' };
}

/** Execute a candidate in a fresh browser context and capture failure telemetry. */
export async function verifyCandidateInSandbox(browser, url, taskPrompt, rawCompletion, timeoutMs = 15000) {
  const parsed = parseModelCompletion(rawCompletion);
  const analysis = analyzeStaticCodeQuality(parsed.code);
  let reward = parsed.hasValidXmlFormat ? 0.5 : 0;
  const base = {
    syntax_valid: analysis.syntaxValid,
    goal_achieved: false,
    execution_ms: 0,
    extracted_code: parsed.code,
    thought: parsed.thought,
    primary_selector: analysis.primarySelector,
    failure_record: null
  };
  if (!analysis.syntaxValid) {
    return { ...base, status: 'syntax_error', reward: Number((reward - 0.5).toFixed(2)) };
  }
  reward += 0.5;
  if (analysis.usesResilientLocators && !analysis.usesBrittleSleep) reward += 0.5;
  else if (analysis.usesBrittleSleep) reward -= 0.25;

  let context;
  const consoleErrors = [];
  const networkFailures = [];
  const started = Date.now();
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'block'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    page.on('requestfailed', (request) => networkFailures.push(
      `${request.method()} ${request.url()} (${request.failure()?.errorText || 'failed'})`
    ));

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await new AsyncFunction('page', parsed.code)(page);
    const elapsed = Date.now() - started;
    reward += 2;
    if (elapsed < 4000) reward += 0.5;
    const finalDom = await distillDOM(page, 60);
    return {
      ...base,
      status: 'success',
      reward: Number(reward.toFixed(2)),
      goal_achieved: true,
      execution_ms: elapsed,
      final_url: finalDom.url,
      failure_record: null
    };
  } catch (error) {
    const elapsed = Date.now() - started;
    let domAtFailure = '';
    try {
      const page = context?.pages()[0];
      if (page && !page.isClosed()) domAtFailure = (await distillDOM(page, 80)).snapshotText;
    } catch { domAtFailure = 'DOM unavailable (page crashed or navigated away)'; }
    return {
      ...base,
      status: 'runtime_failure',
      reward: Number((reward - 0.5).toFixed(2)),
      execution_ms: elapsed,
      failure_record: {
        url,
        task: taskPrompt,
        attempted_action: parsed.code,
        error: error?.stack || String(error),
        console_errors: consoleErrors.slice(0, 10),
        network_failures: networkFailures.slice(0, 10),
        dom_at_failure: domAtFailure,
        timestamp: new Date().toISOString()
      }
    };
  } finally {
    await context?.close().catch(() => {});
  }
}

// Backward-compatible adapter for the original verifier interface.
export async function verifyPlaywrightCode(browser, targetUrl, candidateCode) {
  const wrapped = `<thought>Legacy candidate</thought><code>${candidateCode}</code>`;
  const result = await verifyCandidateInSandbox(browser, targetUrl, '', wrapped);
  return {
    ...result,
    success: result.goal_achieved,
    executionTime: result.execution_ms,
    logs: {
      console: result.failure_record?.console_errors || [],
      networkErrors: result.failure_record?.network_failures || []
    },
    verified_code: result.goal_achieved ? candidateCode : undefined,
    error_trace: result.failure_record?.error,
    dom_at_failure: result.failure_record?.dom_at_failure,
    failed_code: result.goal_achieved ? undefined : candidateCode
  };
}
