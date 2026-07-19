import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = ['/', '/programs', '/parents', '/team', '/privacy', '/terms', '/safety'];

test('public pages render without console errors or horizontal overflow', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  for (const pathname of publicPages) {
    const response = await page.goto(pathname);
    expect(response.status(), pathname).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${pathname} has horizontal overflow`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('public internal links and same-page anchors resolve', async ({ page, request }) => {
  const checked = new Set();
  for (const pathname of publicPages) {
    await page.goto(pathname);
    const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    for (const href of hrefs) {
      if (!href || href.startsWith('mailto:')) continue;
      const url = new URL(href, 'http://127.0.0.1:3217');
      if (url.origin !== 'http://127.0.0.1:3217') continue;
      if (url.pathname === pathname && url.hash) {
        expect(await page.locator(url.hash).count(), `${pathname} → ${href}`).toBeGreaterThan(0);
        continue;
      }
      if (checked.has(url.pathname)) continue;
      checked.add(url.pathname);
      const response = await request.get(url.pathname);
      expect(response.status(), `${pathname} → ${href}`).toBeLessThan(400);
    }
  }
});

test('every application control has a programmatic label', async ({ page }) => {
  await page.goto('/#apply');
  const unlabeled = await page.locator('#application-form input, #application-form select, #application-form textarea, #application-form button').evaluateAll(elements =>
    elements.filter(element => {
      if (element.type === 'hidden') return false;
      if (element.tagName === 'BUTTON') return !element.textContent.trim() && !element.getAttribute('aria-label');
      return !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby');
    }).map(element => element.name || element.id || element.tagName)
  );
  expect(unlabeled).toEqual([]);
});

test('public pages have no automated WCAG A or AA violations', async ({ page }) => {
  for (const pathname of publicPages) {
    await page.goto(pathname);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, `${pathname}: ${results.violations.map(item => item.id).join(', ')}`).toEqual([]);
  }
});

test('minor selection reveals and requires guardian controls', async ({ page }) => {
  await page.goto('/#apply');
  const panel = page.locator('[data-guardian-fields]');
  await expect(panel).toBeHidden();
  await page.selectOption('#age-range', '13-17');
  await expect(panel).toBeVisible();
  await expect(page.locator('#guardian-name')).toHaveAttribute('required', '');
  await page.selectOption('#age-range', '18-plus');
  await expect(panel).toBeHidden();
});

test('enhanced application flow reports storage and email separately', async ({ page }, testInfo) => {
  await page.goto('/#apply');
  await page.fill('#applicant-name', 'Browser Test Applicant');
  await page.fill('#contact-email', `browser-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.selectOption('#grade', '12th');
  await page.selectOption('#age-range', '18-plus');
  await page.selectOption('#level', { label: 'Level 1 — Python Foundations' });
  await page.selectOption('#experience-level', 'exploring');
  await page.fill('#coding-tools', 'Scratch and Python tutorials');
  await page.fill('#project-experience', 'A small maze game.');
  await page.fill('#learning-goals', 'I want to become confident in Python and build a study app.');
  await page.check('#privacy-consent');
  await page.check('#terms-consent');
  await page.check('#safety-consent');
  await page.getByRole('button', { name: 'Submit secure application' }).click();
  const success = page.locator('[data-application-success]');
  await expect(success).toBeVisible();
  await expect(success.locator('[data-reference]')).toHaveText(/^CF-\d{4}-[A-F0-9]{8}$/);
  await expect(success.locator('[data-confirmation-note]')).toContainText('stored');
});

test('admin login stays legible, protects the token, and reports startup failures', async ({ page }) => {
  await page.goto('/admin');

  const titleLines = await page.getByRole('heading', { name: 'Admissions dashboard' }).evaluate(title => {
    const range = document.createRange();
    range.selectNodeContents(title);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
  });
  expect(titleLines).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);

  await page.fill('#admin-token', 'e2e-admin-token-that-is-longer-than-thirty-two-characters');
  await page.getByRole('button', { name: 'Open dashboard' }).click();
  await expect(page.locator('[data-dashboard]')).toBeVisible();
  await expect(page.locator('[data-login-panel]')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cf_admin_token'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('cf_admin_token'))).toBeTruthy();

  await page.getByRole('button', { name: 'Lock dashboard' }).click();
  await page.route('**/api/admin/metrics', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'Function startup failed.' } })
  }));
  await page.fill('#admin-token', 'admin-token-that-is-longer-than-thirty-two-characters');
  await page.getByRole('button', { name: 'Open dashboard' }).click();
  await expect(page.locator('[data-login-status]')).toContainText('server could not start');
  await expect(page.locator('[data-login-status]')).not.toContainText('[object Object]');
});

test('mobile navigation communicates its state', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only behavior');
  await page.goto('/');
  const button = page.locator('[data-menu-button]');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-navigation]')).toBeVisible();
});

test('reduced motion and JavaScript-disabled content remain usable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3217/');
  await expect(page.getByRole('heading', { name: /A clear path into/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Python Foundations/ })).toBeVisible();
  await expect(page.locator('#application-form')).toBeVisible();
  await expect(page.locator('[data-guardian-fields]')).toBeVisible();
  await context.close();
});
