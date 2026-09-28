import { describe, expect, it, vi } from 'vitest';
import { ApiError, GreenApi, validateCredentials } from './api';
import { normalizePhone } from './format';

const credentials = {
  apiUrl: 'https://3100.api.green-api.com',
  idInstance: '3100000001',
  apiTokenInstance: 'test-token-only',
};
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('GREEN-API integration contract', () => {
  it('connects only to an authorized MAX instance with HTTP notification settings', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ stateInstance: 'authorized' }))
      .mockResolvedValueOnce(
        response({ typeInstance: 'v3', webhookUrl: '', incomingWebhook: 'yes' }),
      );
    await new GreenApi(credentials, fetcher).connect();
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname.split('/')[2])).toEqual([
      'getStateInstance',
      'getSettings',
    ]);
  });

  it.each([
    [{ typeInstance: 'whatsapp', webhookUrl: '', incomingWebhook: 'yes' }, 'инстанс MAX'],
    [
      { typeInstance: 'v3', webhookUrl: 'https://example.com/hook', incomingWebhook: 'yes' },
      'Webhook URL',
    ],
    [{ typeInstance: 'v3', webhookUrl: '', incomingWebhook: 'no' }, 'Получать уведомления'],
  ])('reports an actionable setup error without changing settings', async (settings, message) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ stateInstance: 'authorized' }))
      .mockResolvedValueOnce(response(settings));
    await expect(new GreenApi(credentials, fetcher).connect()).rejects.toThrow(message as string);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });

  it('does not consume the queue for an unauthorized instance', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ stateInstance: 'notAuthorized' }));
    await expect(new GreenApi(credentials, fetcher).connect()).rejects.toThrow('авторизуйте');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('resolves the phone to a MAX chat ID and sends to that ID', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ exist: true, chatId: '10000000', fromCache: true }))
      .mockResolvedValueOnce(response({ idMessage: '123456789' }));
    const api = new GreenApi(credentials, fetcher);
    const chatId = await api.findChat('+7 (900) 000-00-01');
    expect(await api.sendMessage(chatId, 'Привет 👋')).toBe('123456789');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      phoneNumber: 79000000001,
    });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      chatId: '10000000',
      message: 'Привет 👋',
    });
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  });

  it('handles a missing recipient and successful HTTP responses with business errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ exist: false, chatId: '' }))
      .mockResolvedValueOnce(
        response({ status: false, reason: 'instance is starting or not authorized' }),
      );
    const api = new GreenApi(credentials, fetcher);
    await expect(api.findChat('79000000001')).rejects.toThrow('не найден');
    await expect(api.findChat('79000000001')).rejects.toThrow('не смог проверить');
  });

  it('accepts both empty and JSON null long-poll responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(''))
      .mockResolvedValueOnce(response(null));
    const api = new GreenApi(credentials, fetcher);
    expect(await api.receive()).toBeNull();
    expect(await api.receive()).toBeNull();
    expect(String(fetcher.mock.calls[0][0])).toContain('?receiveTimeout=25');
  });

  it('acknowledges the receipt using DELETE, not the message ID', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ result: true }));
    await new GreenApi(credentials, fetcher).acknowledge(42);
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/deleteNotification\/test-token-only\/42$/);
    expect(fetcher.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('never exposes raw server errors or a token in user-facing errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ error: credentials.apiTokenInstance }, 401));
    await expect(new GreenApi(credentials, fetcher).receive()).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
    await expect(new GreenApi(credentials, fetcher).receive()).rejects.not.toThrow(
      credentials.apiTokenInstance,
    );
  });

  it('distinguishes a network failure from a user cancellation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const api = new GreenApi(credentials, fetcher);
    await expect(api.sendMessage('1', 'Привет')).rejects.toBeInstanceOf(ApiError);
    const controller = new AbortController();
    controller.abort();
    await expect(api.receive(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects credentials pointing outside the GREEN-API host before any request', () => {
    for (const apiUrl of [
      'http://3100.api.green-api.com',
      'https://green-api.com.attacker.test',
      'https://evil.test',
      'https://user:password@3100.api.green-api.com',
      'https://3100.api.green-api.com/?next=evil',
      'https://3100.api.green-api.com/other',
    ]) {
      expect(() => validateCredentials({ ...credentials, apiUrl })).toThrow();
    }
    expect(
      validateCredentials({ ...credentials, apiUrl: `${credentials.apiUrl}/v3/` }).apiUrl,
    ).toMatch(/\/v3$/);
  });

  it('validates the message before touching the network', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = new GreenApi(credentials, fetcher);
    await expect(api.sendMessage('1', '   ')).rejects.toThrow('4000');
    await expect(api.sendMessage('1', 'x'.repeat(4001))).rejects.toThrow('4000');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('MAX phone input', () => {
  it('normalizes Russian and Belarusian numbers without accepting arbitrary strings', () => {
    expect(normalizePhone('8 (900) 123-45-67')).toBe('79001234567');
    expect(normalizePhone('+375 29 123-45-67')).toBe('375291234567');
    for (const phone of ['', '+7', 'abc79001234567', '+1 234 567 8901'])
      expect(() => normalizePhone(phone)).toThrow();
  });
});
