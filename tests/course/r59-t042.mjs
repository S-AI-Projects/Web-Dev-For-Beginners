import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium, startStaticServer } from './browser-support.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const results = [];
let server;
let browser;
let failure;
let screenshotPath;

try {
  server = await startStaticServer(repoRoot);
  browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    let missingLogoFixtureHit = false;
    let logoResponseStatus = null;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.url().endsWith('/logo.svg')) logoResponseStatus = response.status();
    });
    await page.route('**/logo.svg', async (route) => {
      missingLogoFixtureHit = true;
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'fixture: logo unavailable' });
    });

    await page.goto(`${server.origin}/7-bank-project/solution/index.html`, { waitUntil: 'networkidle' });
    await page.locator('#loginForm').waitFor();

    const loginForm = page.locator('#loginForm');
    const registerForm = page.locator('#registerForm');
    await loginForm.locator('button[type="submit"]').click();
    const emptyLogin = await page.locator('#username').evaluate((input) => ({
      valid: input.checkValidity(),
      valueMissing: input.validity.valueMissing,
      errorText: document.querySelector('#loginError').textContent.trim(),
    }));

    await registerForm.locator('button[type="submit"]').click();
    const emptyRegistration = await page.evaluate(() => ({
      usernameMissing: document.querySelector('#user').validity.valueMissing,
      currencyMissing: document.querySelector('#currency').validity.valueMissing,
      errorText: document.querySelector('#registerError').textContent.trim(),
    }));

    await page.locator('#username').fill('r59-account-that-does-not-exist');
    await loginForm.locator('button[type="submit"]').click();
    await page.waitForTimeout(150);

    const actual = await page.evaluate(() => {
      const heading = document.querySelector('#loginTitle');
      const logo = document.querySelector('#loginTitle img');
      const logoBox = logo.getBoundingClientRect();
      return {
        title: document.title,
        headingText: heading.textContent.replace(/\s+/g, ' ').trim(),
        headingVisible: Boolean(heading.getClientRects().length),
        logoAlt: logo.alt,
        logoNaturalWidth: logo.naturalWidth,
        logoHeight: logoBox.height,
        loginError: document.querySelector('#loginError').textContent.trim(),
        registerError: document.querySelector('#registerError').textContent.trim(),
        savedAccount: localStorage.getItem('savedAccount'),
        accounts: localStorage.getItem('accounts'),
        loginLabel: document.querySelector('label[for="username"]')?.textContent.trim(),
        registerLabel: document.querySelector('label[for="user"]')?.textContent.trim(),
      };
    });
    const expected = {
      title: 'Login',
      emptyLoginRejected: true,
      emptyRegistrationRejected: true,
      unknownAccountError: 'Account not found',
      missingLogoReturns404: true,
      logoHasReadableAlternative: true,
      noAccountPersisted: true,
      noPageErrors: true,
    };
    results.push({
      input: {
        emptyLogin: true,
        emptyRegistration: true,
        username: 'r59-account-that-does-not-exist',
        fixture: { asset: 'logo.svg', responseStatus: 404 },
      },
      expected,
      actual: {
        ...actual,
        emptyLogin,
        emptyRegistration,
        missingLogoFixtureHit,
        logoResponseStatus,
        pageErrors,
      },
    });

    assert.equal(emptyLogin.valid, false, 'the empty login must fail required-field validation');
    assert.equal(emptyLogin.valueMissing, true, 'the username input must report its missing value');
    assert.equal(emptyLogin.errorText, '', 'empty login must not show a misleading server error');
    assert.equal(emptyRegistration.usernameMissing, true, 'registration username is required');
    assert.equal(emptyRegistration.currencyMissing, true, 'registration currency is required');
    assert.equal(emptyRegistration.errorText, '', 'empty registration must not show a server error');
    assert.equal(actual.title, expected.title);
    assert.ok(actual.headingVisible, 'the login heading must stay visible when the logo fails');
    assert.match(actual.headingText, /Squirrel.*Banking/, 'visible brand text must remain readable');
    assert.equal(actual.logoAlt, '', 'the repeated logo is decorative; adjacent brand text is the fallback');
    assert.equal(missingLogoFixtureHit, true, 'the missing-logo fixture must be exercised');
    assert.equal(logoResponseStatus, 404, 'the browser must observe the failed image response');
    assert.equal(actual.logoNaturalWidth, 0, 'the fixture image must remain unavailable');
    assert.equal(actual.loginError, 'Account not found', 'unknown users must receive an inline error');
    assert.equal(actual.savedAccount, null, 'a rejected login must not persist an account');
    assert.equal(actual.accounts, '[]', 'validation and login failure must leave the account list empty');
    assert.equal(actual.loginLabel, 'Username', 'the login input must retain its visible label');
    assert.equal(actual.registerLabel, 'Username (required)', 'the registration input must retain its visible label');
    assert.deepEqual(pageErrors, [], 'the app must not report runtime errors');

    const evidenceName = process.env.R59_T042_EVIDENCE ?? 'results';
    screenshotPath = resolve(repoRoot, `work/R59-T042/${evidenceName}.png`);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.at(-1).actual.screenshot = `work/R59-T042/${evidenceName}.png`;

    const recoveryContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const recoveryPage = await recoveryContext.newPage();
      const recoveryErrors = [];
      let healthyLogoStatus = null;
      recoveryPage.on('pageerror', (error) => recoveryErrors.push(error.message));
      recoveryPage.on('response', (response) => {
        if (response.url().endsWith('/logo.svg')) healthyLogoStatus = response.status();
      });
      await recoveryPage.goto(`${server.origin}/7-bank-project/solution/index.html`, { waitUntil: 'networkidle' });
      await recoveryPage.locator('#loginForm').waitFor();
      await recoveryPage.locator('#loginTitle img').evaluate((image) => image.decode());
      const healthyLogo = await recoveryPage.locator('#loginTitle img').evaluate((image) => ({
        naturalWidth: image.naturalWidth,
        height: image.getBoundingClientRect().height,
        alt: image.alt,
        heading: document.querySelector('#loginTitle').textContent.replace(/\s+/g, ' ').trim(),
      }));
      results.push({
        input: { fixture: null, state: 'fresh browser storage' },
        expected: { logoReturns200: true, imageLoaded: true, noPageErrors: true },
        actual: { ...healthyLogo, logoResponseStatus: healthyLogoStatus, pageErrors: recoveryErrors },
      });
      assert.equal(healthyLogoStatus, 200, 'the normal logo path must load successfully');
      assert.ok(healthyLogo.naturalWidth > 0, 'the logo must render when the asset is available');
      assert.ok(healthyLogo.height > 0 && healthyLogo.height <= 48,
        'the loaded logo must stay within the heading-sized 48px box');
      assert.equal(healthyLogo.alt, '', 'the loaded logo must not repeat the adjacent brand text');
      assert.deepEqual(recoveryErrors, [], 'asset recovery must not introduce page errors');
      const recoveryScreenshot = resolve(repoRoot, `work/R59-T042/${evidenceName}-recovered.png`);
      await recoveryPage.screenshot({ path: recoveryScreenshot, fullPage: true });
      results.at(-1).actual.screenshot = `work/R59-T042/${evidenceName}-recovered.png`;
    } finally {
      await recoveryContext.close();
    }
  } finally {
    await context.close();
  }
} catch (error) {
  failure = error;
  if (results.length) results.at(-1).failure = error.message;
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'tests/course/package.json'), 'utf8'));
  const evidenceName = process.env.R59_T042_EVIDENCE ?? 'results';
  const evidence = {
    task: 'R59-T042',
    command: 'node tests/course/r59-t042.mjs',
    tools: { node: process.version, playwright: packageJson.devDependencies.playwright, browser: browser?.version() ?? null },
    results,
    failure: failure?.message ?? null,
  };
  const evidencePath = resolve(repoRoot, `work/R59-T042/${evidenceName}.json`);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

if (failure) {
  console.error(`R59-T042 failed: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log(`R59-T042 passed; evidence: work/R59-T042/results.json`);
}
