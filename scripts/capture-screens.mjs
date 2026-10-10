/**
 * Capture the article screenshots by driving the real stack in a headless
 * Chrome: boot → dial → door → pocket → proof (real vision verdict) →
 * journal → meadow → settings.
 *
 * Usage: node scripts/capture-screens.mjs [outDir]
 * Requires: agent on :8787 with Ollama up, web on :5183, system Chrome.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, process.argv[2] ?? 'submission/assets');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.HELIO_WEB ?? 'http://127.0.0.1:5183';
const GRASS = resolve(ROOT, 'vibe_images/grass-proof-test_1791659853346_4c30699f.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForText(page, pattern, timeoutMs = 30_000) {
  const dead = Date.now() + timeoutMs;
  while (Date.now() < dead) {
    const txt = await page.evaluate(() => document.body.innerText);
    if (pattern.test(txt)) return txt;
    await sleep(700);
  }
  throw new Error(`timeout waiting for ${pattern}`);
}

async function clickButton(page, pattern) {
  const ok = await page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const btn = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, pattern.source);
  if (!ok) throw new Error(`button not found: ${pattern}`);
}

const shots = [];
async function shoot(page, name, fullPage = false) {
  const path = resolve(OUT, name);
  await page.screenshot({ path, fullPage });
  shots.push(name);
  console.log(`  · ${name}`);
}

async function main() {
  if (!existsSync(CHROME)) throw new Error(`chrome not found at ${CHROME}`);
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    userDataDir: resolve(ROOT, '.cache/helio-shot-profile'),
    args: ['--no-first-run', '--disable-extensions', '--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => console.error('[page error]', e.message));

    console.log('boot…');
    await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // intro shows after a 1.5s splash on a fresh profile — wait for its input
    const bootInput = await page
      .waitForSelector('input', { timeout: 6_000 })
      .catch(() => null);
    if (bootInput) {
      await bootInput.type('Jin', { delay: 40 });
      await sleep(300);
      await clickButton(page, /begin/i);
    }

    console.log('waiting for mission (LLM, can take ~90s)…');
    await waitForText(page, /TODAY'S SEED|today’s seed/i, 240_000);
    await sleep(1500);
    await shoot(page, '01-dial.png');

    console.log('door…');
    await page.evaluate(() => {
      const wrap = document.querySelector('.home__dialwrap');
      const target = wrap?.querySelector('svg, canvas, button') ?? wrap;
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText(page, /A SEED FOR/i, 10_000);
    await sleep(600);
    await shoot(page, '02-door.png', true);

    console.log('pocket…');
    await clickButton(page, /i'm going|im going|i’m going/i);
    await waitForText(page, /THE SCREEN IS DONE NOW/i, 10_000);
    await sleep(700);
    await shoot(page, '03-pocket.png');

    console.log('proof (real vision verdict, ~90s on CPU)…');
    await page.click('.pocket__shutter');
    await waitForText(page, /choose photo|take one photo/i, 10_000);
    const file = await page.$('input[type=file]');
    if (!file) throw new Error('file input missing (camera present?)');
    await file.uploadFile(GRASS);
    await waitForText(page, /verified|not quite|no grass|sure/i, 300_000);
    await sleep(1200);
    await shoot(page, '05-stamp.png', true);

    console.log('journal…');
    await clickButton(page, /field journal|journal/i);
    await waitForText(page, /field journal|pages/i, 10_000);
    // the haiku is written by the local model a few seconds after the verdict
    await page.waitForSelector('.page__haiku', { timeout: 120_000 }).catch(() => {});
    await sleep(600);
    await shoot(page, '06-journal.png', true);
    const firstPage = await page.$('.page');
    if (firstPage) {
      await firstPage.click();
      await page.waitForSelector('.sheet__card', { timeout: 5_000 }).catch(() => {});
      await sleep(600);
      await shoot(page, '06b-journal-sheet.png', true);
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => document.querySelector('.sheet')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await sleep(400);
    }

    console.log('meadow…');
    await clickButton(page, /← home|home/i);
    await sleep(800);
    await clickButton(page, /^meadow$/i);
    await waitForText(page, /species dex|meadow/i, 10_000);
    await sleep(900);
    await shoot(page, '07-meadow.png', true);

    console.log('settings…');
    await clickButton(page, /← home|home/i);
    await sleep(800);
    await clickButton(page, /^settings$/i);
    await waitForText(page, /test connection/i, 10_000);
    await clickButton(page, /test connection/i);
    await waitForText(page, /ok ·/i, 15_000).catch(() => {});
    await sleep(500);
    await shoot(page, '08-settings.png', true);

    console.log(`\ndone — ${shots.length} screenshots in ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
