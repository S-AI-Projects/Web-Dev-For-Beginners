import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium, startStaticServer } from './browser-support.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pageUrl = '/7-bank-project/solution/index.html';
const demoAccount = {
  user: 'r59-persistent-demo',
  description: 'Persistent demo account',
  balance: 42,
  currency: 'USD',
  transactions: [],
};
const results = [];
let server;
let browser;
let failure;

try {
  server = await startStaticServer(repoRoot);
  browser = await launchChromium();

  const supported = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await supported.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript((account) => {
      localStorage.setItem('accounts', JSON.stringify([account]));
      localStorage.setItem('savedAccount', JSON.stringify(account));
      localStorage.setItem('schemaVersion', '1');
    }, demoAccount);
    await page.goto(`${server.origin}${pageUrl}`, { waitUntil: 'networkidle' });
    await page.locator('#balance').waitFor();
    const restored = await page.evaluate(() => ({
      route: location.pathname,
      accountDescription: document.querySelector('#transactions-description').textContent.trim(),
      balance: document.querySelector('#balance').textContent.trim(),
      expectedBalance: new Intl.NumberFormat(navigator.language, {
        style: 'currency', currency: 'USD', currencySign: 'accounting', maximumFractionDigits: 2,
      }).format(42),
      noticeVisible: !document.querySelector('#storageNotice').hidden,
      savedAccount: JSON.parse(localStorage.getItem('savedAccount'))?.user,
    }));
    assert.equal(restored.accountDescription, 'Persistent demo account');
    assert.equal(restored.balance, restored.expectedBalance);
    assert.equal(restored.noticeVisible, false, 'available localStorage must not show a fallback warning');

    await page.goto(`${server.origin}${pageUrl}`, { waitUntil: 'networkidle' });
    await page.locator('#balance').waitFor();
    const afterReload = await page.locator('#transactions-description').textContent();
    assert.equal(afterReload.trim(), 'Persistent demo account', 'the supported path must restore after reload');

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.locator('#loginHeading').waitFor();
    const reset = await page.evaluate(() => ({
      route: location.pathname,
      savedAccount: localStorage.getItem('savedAccount'),
      loginVisible: Boolean(document.querySelector('#loginHeading')?.getClientRects().length),
      noticeVisible: !document.querySelector('#storageNotice').hidden,
    }));
    assert.equal(reset.route, '/login');
    assert.equal(reset.savedAccount, 'null', 'logout must clear the persisted session');
    assert.equal(reset.loginVisible, true);
    assert.equal(reset.noticeVisible, false);
    assert.deepEqual(pageErrors, [], 'the supported storage path must not report page errors');
    results.push({
      input: { feature: 'localStorage available', seed: demoAccount, actions: ['load', 'reload', 'logout'] },
      expected: {
        restoreAfterReload: true,
        logoutClearsSavedAccount: true,
        routeAfterLogout: '/login',
        fallbackNotice: false,
        noPageErrors: true,
      },
      actual: { restored, afterReload: afterReload.trim(), reset, pageErrors },
    });
    const evidenceName = process.env.R59_T045_EVIDENCE ?? 'results';
    const screenshot = resolve(repoRoot, `work/R59-T045/${evidenceName}-supported.png`);
    await mkdir(dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: true });
    results.at(-1).actual.screenshot = `work/R59-T045/${evidenceName}-supported.png`;
  } finally {
    await supported.close();
  }

  const unsupported = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await unsupported.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: false,
        get() { throw new DOMException('Storage is disabled in this context', 'SecurityError'); },
      });
    });
    await page.goto(`${server.origin}${pageUrl}`, { waitUntil: 'networkidle' });
    await page.locator('#loginHeading').waitFor();
    const initialFallback = await page.evaluate(() => ({
      route: location.pathname,
      heading: document.querySelector('#loginHeading').textContent.trim(),
      noticeVisible: !document.querySelector('#storageNotice').hidden,
      noticeText: document.querySelector('#storageNotice').textContent.replace(/\s+/g, ' ').trim(),
      usernameRequired: document.querySelector('#username').validity.valueMissing,
    }));
    assert.equal(initialFallback.noticeVisible, true, 'unavailable storage must be stated explicitly');
    assert.match(initialFallback.noticeText, /stay in this tab.*not be saved/i);
    assert.equal(initialFallback.usernameRequired, true, 'login remains usable with normal form validation');
    await page.locator('#user').fill('r59-volatile-demo');
    await page.locator('#currency').fill('INR');
    await page.locator('#registerForm button[type="submit"]').click();
    await page.locator('#balance').waitFor();
    await page.waitForTimeout(150);
    const volatileSession = await page.evaluate(() => ({
      route: location.pathname,
      noticeVisible: !document.querySelector('#storageNotice').hidden,
      balanceVisible: Boolean(document.querySelector('#balance')?.getClientRects().length),
      accountDescription: document.querySelector('#transactions-description')?.textContent.trim(),
    }));
    assert.equal(volatileSession.route, '/dashboard', 'the in-tab fallback must continue the session');
    assert.equal(volatileSession.noticeVisible, true);
    assert.equal(volatileSession.balanceVisible, true);
    await page.goto(`${server.origin}${pageUrl}`, { waitUntil: 'networkidle' });
    await page.locator('#loginHeading').waitFor();
    const afterReload = await page.evaluate(() => ({
      route: location.pathname,
      noticeVisible: !document.querySelector('#storageNotice').hidden,
      loginVisible: Boolean(document.querySelector('#loginHeading')?.getClientRects().length),
    }));
    assert.equal(afterReload.route, '/login', 'volatile state must not be represented as persisted');
    assert.equal(afterReload.noticeVisible, true);
    assert.equal(afterReload.loginVisible, true);
    assert.deepEqual(pageErrors, [], 'unavailable storage must not create uncaught page errors');
    results.push({
      input: { feature: 'localStorage getter throws SecurityError', actions: ['load', 'register in tab', 'reload'] },
      expected: {
        explicitSessionOnlyNotice: true,
        registrationWorksInTab: true,
        stateNotRestoredAfterReload: true,
        noPageErrors: true,
      },
      actual: { initialFallback, volatileSession, afterReload, pageErrors },
    });
    const evidenceName = process.env.R59_T045_EVIDENCE ?? 'results';
    const screenshot = resolve(repoRoot, `work/R59-T045/${evidenceName}-unsupported.png`);
    await mkdir(dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: true });
    results.at(-1).actual.screenshot = `work/R59-T045/${evidenceName}-unsupported.png`;
  } finally {
    await unsupported.close();
  }
} catch (error) {
  failure = error;
  if (results.length) results.at(-1).failure = error.message;
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'tests/course/package.json'), 'utf8'));
  const evidenceName = process.env.R59_T045_EVIDENCE ?? 'results';
  const evidence = {
    task: 'R59-T045',
    command: 'node tests/course/r59-t045.mjs',
    tools: { node: process.version, playwright: packageJson.devDependencies.playwright, browser: browser?.version() ?? null },
    results,
    failure: failure?.message ?? null,
  };
  const evidencePath = resolve(repoRoot, `work/R59-T045/${evidenceName}.json`);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

if (failure) {
  console.error(`R59-T045 failed: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('R59-T045 passed for supported and unavailable localStorage paths.');
}
