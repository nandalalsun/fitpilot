// End-to-end check of the MVP acceptance journeys against a running build.
// Usage: node e2e/journeys.mjs [baseUrl] [screenshotDir]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright'); // globally installed

const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.argv[3];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('✓', msg); };
const nav = (name) => page.locator('nav.nav button', { hasText: name }).click();

await page.goto(BASE);
// ── Onboarding
await page.getByPlaceholder('What should I call you?').fill('Sam');
await page.getByPlaceholder('30').fill('29');
await page.getByPlaceholder('5', { exact: true }).fill('5');
await page.getByPlaceholder('10', { exact: true }).fill('10');
await page.getByPlaceholder('175').fill('172');
await shot('01-onboarding');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: /Build muscle Gain size/ }).click();
await page.getByRole('button', { name: 'Continue' }).click();
// Train every day so "today" always has a workout regardless of the date the test runs.
for (const d of ['Wed', 'Sat', 'Sun']) await page.locator('.week button', { hasText: d }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await shot('02-targets');
await page.getByRole('button', { name: 'Create my plan' }).click();
await page.getByText("Today's workout").waitFor();
ok(await page.getByText('Sam').count() > 0, 'onboarding creates profile and lands on Home');
await shot('03-home');

// ── Journey 1: start, log, finish, see in history
await page.getByRole('button', { name: /Start workout/ }).first().click();
await page.getByText('In progress').first().waitFor();
const firstWeight = await page.getByLabel('Set 1 weight', { exact: true }).first().inputValue();
ok(Number(firstWeight) > 0 || firstWeight === '0', `weight pre-filled (${firstWeight})`);
await page.getByLabel('Increase Set 1 weight').first().click();
const cards = page.locator('.ex-card');
const n = await cards.count();
for (let i = 0; i < n; i++) {
  const sets = cards.nth(i).getByRole('button', { name: /Complete set/ });
  for (let j = 0; j < await sets.count(); j++) await sets.nth(j).click();
}
ok(await page.getByRole('timer').count() === 1, 'rest timer starts after a set');
await shot('04-active');
// Reload mid-workout: progress must survive
await page.reload();
await page.getByText('In progress').first().waitFor();
ok(await page.locator('.done-btn.on').count() > 0, 'progress survives reload');
await page.getByRole('button', { name: 'Finish' }).click();
await page.getByRole('button', { name: /Save as completed/ }).click();
await page.getByText('Workout saved').waitFor();
await shot('05-summary');
await page.getByRole('button', { name: 'Done' }).click();
await nav('Workout');
await page.getByRole('button', { name: 'History' }).click();
ok(await page.locator('.badge.completed').count() >= 1, 'completed session in history');

// ── Journey 2 + 5: missed workout through the coach (tomorrow's entry is irrelevant; use yesterday which exists since plan starts today → use "today")
await nav('Coach');
await page.getByLabel('Message').fill("I couldn't go to the gym yesterday");
await page.getByLabel('Send').click();
await page.waitForTimeout(300);
const txt = await page.locator('.bubble.coach').last().innerText();
ok(/scheduled workout|missed|week/i.test(txt), 'coach responds to missed workout');

await page.getByLabel('Message').fill('I ate two boiled eggs and one cup of rice for lunch');
await page.getByLabel('Send').click();
await page.getByText('Save this meal?').waitFor();
await shot('06-coach');
await page.locator('.proposal').last().getByRole('button', { name: 'Confirm' }).click();
ok(await page.getByText('✓ Applied').count() >= 1, 'meal saved only after confirmation');

await page.getByLabel('Message').fill('How much protein do I have left?');
await page.getByLabel('Send').click();
await page.waitForTimeout(200);
ok(/Remaining/.test(await page.locator('.bubble.coach').last().innerText()), 'protein remaining answered from data');

// ── Journey 4 (no AI key): describe → review → correct → save
await nav('Nutrition');
await page.getByRole('button', { name: 'Describe' }).click();
await page.getByPlaceholder(/I had one cup of rice/).fill('chicken curry with two rotis');
await page.getByRole('button', { name: 'Review & save' }).click();
await page.getByText('Review meal').waitFor();
ok(await page.locator('.badge.est', { hasText: 'Check' }).count() >= 1, 'assumed quantity is flagged for review');
await page.getByLabel('Quantity').first().fill('1.5');
await shot('07-review');
await page.getByRole('button', { name: 'Save meal' }).click();
ok(await page.locator('.list-item', { hasText: 'Chicken curry' }).count() >= 1, 'edited meal saved');
await page.getByRole('button', { name: 'Photo' }).click();
ok(await page.getByText(/needs an AI key/).count() === 1, 'photo logging explains AI key requirement');
await page.keyboard.press('Escape');
await shot('08-nutrition');

// ── Journey 6: progress
await nav('Home');
await page.getByPlaceholder(/Log today's weight/).fill('172');
await page.getByRole('button', { name: 'Log', exact: true }).click();
await nav('Progress');
await page.getByText('Weekly report').waitFor();
await shot('09-progress');
await page.getByRole('button', { name: 'Strength' }).click();
ok(await page.locator('svg.chart').count() + await page.getByText('One session so far').count() >= 1, 'strength view renders');

// ── Journeys 2 & 3 in the UI: backdate the plan so earlier days exist and are "not reported"
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('fitpilot.v1'));
  const d = new Date(); d.setDate(d.getDate() - 3);
  s.plan.createdAt = d.toISOString();
  localStorage.setItem('fitpilot.v1', JSON.stringify(s));
});
await nav('Home');
await page.reload();
await page.getByText('Not reported yet').first().waitFor();
ok(await page.locator('.badge.unreported').count() >= 2, 'past workouts show as not reported (not missed)');
await shot('11-unreported');
await page.locator('.card', { hasText: 'Not reported yet' }).first().getByRole('button', { name: 'Missed it' }).click();
await page.getByText('Adjust your week?').waitFor();
ok(await page.getByText('Recommended', { exact: true }).count() === 1, 'missed workout yields a recommended adjustment');
await shot('12-reschedule');
await page.getByRole('button', { name: /Apply this change|Keep plan/ }).first().click();
await page.locator('.card', { hasText: 'Not reported yet' }).first().getByRole('button', { name: 'Partly' }).click();
await page.getByText('Which exercises did you do?').waitFor();
await page.locator('.sheet .list-item').first().click();
await page.getByRole('button', { name: 'Save partial workout' }).click();
await nav('Workout');
await page.getByRole('button', { name: 'History' }).click();
ok(await page.locator('.badge.partial').count() >= 1 && await page.locator('.badge.missed').count() >= 1, 'history shows partial and missed separately');
await shot('13-history');
// Settings + export
await nav('Home');
await page.getByLabel('Settings').click();
await page.getByText('Your data').waitFor();
await shot('10-settings');

ok(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
