import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { completeItalianL0 } from './helpers/complete-l0';

test('foundation events survive offline practice, synchronize across devices, and isolate accounts', async ({ page, context, browser, baseURL }) => {
  test.skip(process.env.E2E_ACCOUNT_TEST !== '1', 'Requires isolated local Postgres and virtual passkeys');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const name = `foundation-sync-${crypto.randomUUID()}`;
  const otherName = `${name}-other`;
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const practice = async () => {
    await page.getByRole('button', { name: 'Names and introductions', exact: true }).click();
    await page.getByRole('button', { name: 'Begin practice', exact: true }).click();
    await page.getByRole('radio', { name: 'sono', exact: true }).check();
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Course', exact: true }).click();
  };
  let second;
  try {
    await page.goto('/login');
    await page.getByLabel('Account name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
    await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { accountIdentifier: name } });
    const other = await db.user.create({ data: { accountIdentifier: otherName } });
    await page.goto('/courses/italian');
    await completeItalianL0(page);
    await practice(); // Guest work must not be silently uploaded.
    await expect(page.getByText(/8 practice results on this device/)).toBeVisible();
    await page.getByRole('button', { name: 'Use my account', exact: true }).click();
    await expect(page.getByText(/0 practice results on this device/)).toBeVisible();
    await expect(page.getByText('Practice synced.', { exact: true })).toBeVisible();
    await completeItalianL0(page);
    await practice();
    await expect.poll(() => db.foundationPracticeEvent.count({ where: { userId: user.id } })).toBe(8);
    await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
    await expect(page.getByText('Downloaded. You can open offline study without a connection.', { exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.goto('/study.html?language=italian');
    await expect(page.getByText(/8 practice results on this device/)).toBeVisible();
    await practice();
    await expect(page.getByText(/9 practice results on this device/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/9 practice results on this device/)).toBeVisible();
    expect(await db.foundationPracticeEvent.count({ where: { userId: user.id } })).toBe(8);
    await context.setOffline(false);
    await expect.poll(() => db.foundationPracticeEvent.count({ where: { userId: user.id } })).toBe(9);

    second = await browser.newContext({ baseURL, storageState: { cookies: await context.cookies(), origins: [] } });
    const secondPage = await second.newPage();
    await secondPage.goto('/courses/italian');
    await secondPage.getByRole('button', { name: 'Use my account', exact: true }).click();
    await expect(secondPage.getByText(/9 practice results on this device/)).toBeVisible();
    await expect(secondPage.getByText('Practice synced.', { exact: true })).toBeVisible();
    const csrf = (await context.cookies()).find(c => c.name === 'verbalibera_csrf')!.value;
    const headers = { origin: new URL(baseURL!).origin, 'x-csrf-token': csrf };
    const snapshot = await (await context.request.get(`/api/course-progress?userId=${user.id}`)).json();
    const replay = { userId: user.id, events: snapshot.events };
    const responses = await Promise.all(Array.from({ length: 8 }, () => context.request.post('/api/course-progress', { headers, data: replay })));
    expect(responses.every(r => r.status() === 200)).toBe(true);
    expect(await db.foundationPracticeEvent.count({ where: { userId: user.id } })).toBe(9);
    const conflict = await context.request.post('/api/course-progress', { headers, data: { userId: user.id, events: [{ ...snapshot.events[0], id: 'new-in-conflicting-batch' }, { ...snapshot.events[0], correct: false }] } });
    expect(conflict.status()).toBe(409);
    expect(await db.foundationPracticeEvent.count({ where: { userId: user.id } })).toBe(9);
    expect((await context.request.get(`/api/course-progress?userId=${other.id}`)).status()).toBe(409);
    expect((await context.request.post('/api/course-progress', { headers, data: { ...replay, userId: other.id } })).status()).toBe(409);
    expect(await db.foundationPracticeEvent.count({ where: { userId: other.id } })).toBe(0);
    await page.getByRole('button', { name: 'Use this browser only', exact: true }).click();
    await expect(page.getByText(/8 practice results on this device/)).toBeVisible();
  } finally {
    await context.setOffline(false);
    await second?.close();
    await db.user.deleteMany({ where: { accountIdentifier: { in: [name, otherName] } } });
    await db.$disconnect();
  }
});
