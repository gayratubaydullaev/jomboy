import { createHmac } from 'crypto';
import { verifyTelegramWebAppInitData } from './telegram-init-data';

function buildInitData(botToken: string, authDate: number, userId = 12345): string {
  const user = JSON.stringify({ id: userId, first_name: 'Test' });
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user,
  });
  const sortedKeys = [...params.keys()].sort();
  const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('verifyTelegramWebAppInitData', () => {
  const botToken = 'test-bot-token';

  it('accepts valid fresh initData', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildInitData(botToken, authDate);
    expect(verifyTelegramWebAppInitData(initData, botToken)).toBe(true);
  });

  it('rejects expired initData', () => {
    const authDate = Math.floor(Date.now() / 1000) - 90000;
    const initData = buildInitData(botToken, authDate);
    expect(verifyTelegramWebAppInitData(initData, botToken)).toBe(false);
  });

  it('rejects tampered hash', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildInitData(botToken, authDate) + 'tamper';
    expect(verifyTelegramWebAppInitData(initData, botToken)).toBe(false);
  });
});
