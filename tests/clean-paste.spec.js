const { test, expect } = require('@playwright/test');
const path = require('path');

// Step 1 tests — box shell only.
// These check: the page loads, the box exists, typing does nothing,
// and pasting plain text shows it in the box.

test.describe('Clean Paste — Step 1: Box shell', () => {

  test.beforeEach(async ({ page }) => {
    // This file lives in tests/, and clean-paste.html lives one level up
    // at the project root — path.join(__dirname, '..', ...) points there
    // regardless of what folder you run `npx playwright test` from.
    const filePath = path.join(__dirname, '..', 'clean-paste.html');
    await page.goto('file://' + filePath);
  });

  test('page loads and the paste box exists', async ({ page }) => {
    const box = page.locator('#paste-box');
    await expect(box).toBeVisible();
  });

  test('box shows placeholder text when empty', async ({ page }) => {
    const box = page.locator('#paste-box');
    const placeholder = await box.getAttribute('data-placeholder');
    expect(placeholder).toContain('paste');
  });

  test('typing into the box does nothing', async ({ page }) => {
    const box = page.locator('#paste-box');
    await box.click();
    await page.keyboard.type('hello world');
    await expect(box).toHaveText('');
  });

  test('pasting plain text shows it in the box', async ({ page }) => {
    const box = page.locator('#paste-box');
    await box.click();

    // Simulate a paste event directly, rather than using the real OS
    // clipboard. This works identically across Chromium/Firefox/WebKit —
    // real clipboard permissions are inconsistent across browsers and
    // aren't actually what we're testing here (we're testing our own
    // paste handler, not the OS clipboard).
    await box.evaluate((el) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'Hello from Playwright');

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
      });

      // Firefox doesn't reliably accept clipboardData passed through the
      // constructor's options object (Chromium/WebKit do). Defining it
      // directly works consistently across all three engines.
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: dataTransfer,
      });

      el.dispatchEvent(pasteEvent);
    });

    await expect(box).toHaveText('Hello from Playwright');
  });

});