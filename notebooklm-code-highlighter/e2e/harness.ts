/**
 * One driver interface over two automation stacks:
 * - Chromium: Playwright, which loads unpacked extensions natively.
 * - Firefox: Selenium + geckodriver, because Playwright's Firefox can't
 *   install add-ons.
 *
 * Both serve the fixture page under the real NotebookLM hostnames so the
 * production manifest's match patterns are what's under test.
 */
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { Builder, Origin, type WebDriver } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { Command } from 'selenium-webdriver/lib/command.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

export type Engine = 'chromium' | 'firefox';

export const NEW_HOST = 'notebook.google.com';
export const LEGACY_HOST = 'notebooklm.google.com';

export const VIEWPORT = { width: 1000, height: 700 };

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/notebook.html'), 'utf8');

export interface Driver {
  goto(host: string): Promise<void>;
  /** Runs an async, self-contained function in the page. */
  evaluate<T, A extends unknown[]>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
  click(x: number, y: number): Promise<void>;
  wheel(x: number, y: number, dx: number, dy: number): Promise<void>;
  /** Viewport-sized PNG. */
  screenshot(): Promise<Buffer>;
  close(): Promise<void>;
}

function extensionDir(engine: Engine): string {
  const dir = path.join(ROOT, '.output', engine === 'chromium' ? 'chrome-mv3' : 'firefox-mv2');
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
    throw new Error(`Missing ${dir}. Run "pnpm build && pnpm build:firefox" first.`);
  }
  return dir;
}

export function launch(engine: Engine): Promise<Driver> {
  return engine === 'chromium' ? launchChromium() : launchFirefox();
}

async function launchChromium(): Promise<Driver> {
  const ext = extensionDir('chromium');
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: VIEWPORT,
    colorScheme: 'light',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  // Answer requests to the NotebookLM hosts with the fixture
  await context.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === NEW_HOST || hostname === LEGACY_HOST
      ? route.fulfill({ contentType: 'text/html', body: FIXTURE })
      : route.abort();
  });
  const page: Page = await context.newPage();

  return {
    async goto(host) {
      await page.goto(`https://${host}/notebook/fixture`);
    },
    evaluate(fn, ...args) {
      return page.evaluate(([src, a]) => (0, eval)(`(${src})`)(...a), [fn.toString(), args] as const);
    },
    async click(x, y) {
      await page.mouse.click(x, y);
    },
    async wheel(x, y, dx, dy) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(dx, dy);
    },
    screenshot() {
      return page.screenshot({ animations: 'disabled', caret: 'hide' });
    },
    close() {
      return context.close();
    },
  };
}

/** HTTPS server with a throwaway self-signed cert for both hostnames. */
async function startFixtureServer(): Promise<https.Server> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlm-e2e-cert-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', key, '-out', cert, '-subj', `/CN=${NEW_HOST}`,
    '-addext', `subjectAltName=DNS:${NEW_HOST},DNS:${LEGACY_HOST}`,
  ], { stdio: 'ignore' });
  const server = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(FIXTURE);
    }
  );
  fs.rmSync(dir, { recursive: true, force: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

/**
 * Selenium sizes the outer window, so grow it by the browser chrome until the
 * viewport matches Chromium's. Resizes apply asynchronously, hence the retries.
 */
async function sizeViewport(driver: WebDriver): Promise<void> {
  let outer = { width: VIEWPORT.width, height: VIEWPORT.height };
  for (let attempt = 0; attempt < 10; attempt++) {
    await driver.manage().window().setRect(outer);
    await driver.sleep(100);
    const [width, height] = (await driver.executeScript('return [innerWidth, innerHeight]')) as [number, number];
    if (width === VIEWPORT.width && height === VIEWPORT.height) return;
    outer = { width: outer.width + VIEWPORT.width - width, height: outer.height + VIEWPORT.height - height };
  }
  throw new Error('Could not size the Firefox viewport');
}

async function launchFirefox(): Promise<Driver> {
  const ext = extensionDir('firefox');
  const server = await startFixtureServer();
  const { port } = server.address() as AddressInfo;

  const options = new firefox.Options()
    .addArguments('-headless')
    // Resolve the NotebookLM hosts to 127.0.0.1. Match patterns without a
    // port match any port, so the random server port is fine.
    .setPreference('network.dns.localDomains', `${NEW_HOST},${LEGACY_HOST}`)
    .setPreference('layout.css.prefers-color-scheme.content-override', 1) // light
    .setPreference('general.smoothScroll', false)
    .setPreference('layout.css.devPixelsPerPx', '1.0');
  options.setAcceptInsecureCerts(true);
  if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
  else if (process.platform === 'darwin') options.setBinary('/Applications/Firefox.app/Contents/MacOS/firefox');

  const driver: WebDriver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();

  try {
    // Install from the unpacked directory by path. Selenium's installAddon()
    // uploads a zip that Firefox can't read content scripts from.
    await driver.execute(
      new Command('install addon').setParameter('path', ext).setParameter('temporary', true)
    );
    await sizeViewport(driver);
  } catch (error) {
    await driver.quit();
    server.close();
    throw error;
  }

  return {
    async goto(host) {
      await driver.get(`https://${host}:${port}/notebook/fixture`);
    },
    async evaluate(fn, ...args) {
      const result = (await driver.executeAsyncScript(
        `const done = arguments[arguments.length - 1];
         (${fn.toString()})(...Array.prototype.slice.call(arguments, 0, -1))
           .then((value) => done({ value }), (error) => done({ error: String(error) }));`,
        ...args
      )) as { value?: unknown; error?: string };
      if (result.error) throw new Error(result.error);
      return result.value as never;
    },
    async click(x, y) {
      await driver.actions().move({ x: Math.round(x), y: Math.round(y), origin: Origin.VIEWPORT }).click().perform();
    },
    async wheel(x, y, dx, dy) {
      // Actions#scroll exists at runtime but is missing from @types/selenium-webdriver
      const actions = driver.actions() as unknown as {
        scroll(x: number, y: number, dx: number, dy: number): { perform(): Promise<void> };
      };
      await actions.scroll(Math.round(x), Math.round(y), dx, dy).perform();
    },
    async screenshot() {
      return Buffer.from(await driver.takeScreenshot(), 'base64');
    },
    async close() {
      await driver.quit();
      server.close();
    },
  };
}
