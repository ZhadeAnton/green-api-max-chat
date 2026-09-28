import type { Credentials, Notification } from '../types';
import { MESSAGE_LIMIT, normalizePhone } from './format';

export const DEFAULT_API_URL = 'https://3100.api.green-api.com';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function validateCredentials(input: Credentials): Credentials {
  let url: URL;
  try {
    url = new URL(input.apiUrl.trim());
  } catch {
    throw new Error('Проверьте apiUrl из личного кабинета GREEN-API.');
  }
  if (
    url.protocol !== 'https:' ||
    !/^(?:\d+\.)?api\.green-api\.com$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/(?:v3\/?)?$/.test(url.pathname)
  ) {
    throw new Error('Укажите HTTPS-адрес API GREEN-API, например https://3100.api.green-api.com.');
  }
  const idInstance = input.idInstance.trim();
  const apiTokenInstance = input.apiTokenInstance.trim();
  if (!/^\d{4,20}$/.test(idInstance))
    throw new Error('idInstance должен содержать от 4 до 20 цифр.');
  if (!/^[a-zA-Z0-9_-]{8,256}$/.test(apiTokenInstance))
    throw new Error('Проверьте apiTokenInstance: скопируйте ключ целиком, без пробелов.');
  return { apiUrl: url.href.replace(/\/$/, ''), idInstance, apiTokenInstance };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function httpError(status: number): ApiError {
  const messages: Record<number, string> = {
    400: 'GREEN-API отклонил запрос. Проверьте параметры и настройки уведомлений в личном кабинете.',
    401: 'Не удалось авторизоваться. Проверьте idInstance и apiTokenInstance.',
    403: 'Доступ ограничен. Проверьте ключ, состояние инстанса и тариф в GREEN-API.',
    404: 'Инстанс не найден на этом сервере. Проверьте apiUrl и idInstance.',
    429: 'Слишком много запросов. Подождите немного и повторите попытку.',
    469: 'MAX временно ограничил поиск номеров. Повторите попытку позднее.',
  };
  return new ApiError(
    messages[status] ?? `GREEN-API временно недоступен (HTTP ${status}).`,
    status,
    status === 429 || status >= 500,
  );
}

export class GreenApi {
  readonly credentials: Credentials;

  constructor(
    credentials: Credentials,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.credentials = validateCredentials(credentials);
  }

  private async request(
    method: string,
    endpoint: string,
    options: { body?: unknown; signal?: AbortSignal; suffix?: string; timeout?: number } = {},
  ): Promise<unknown> {
    const { apiUrl, idInstance, apiTokenInstance } = this.credentials;
    const timeout = AbortSignal.timeout(options.timeout ?? 25_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    // Never log the request URL: GREEN-API puts the token in its path.
    const url = `${apiUrl}/waInstance${idInstance}/${endpoint}/${encodeURIComponent(apiTokenInstance)}${options.suffix ?? ''}`;
    try {
      const response = await this.fetcher(url, {
        method,
        signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        redirect: 'error',
        ...(options.body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options.body),
            }),
      });
      if (!response.ok) throw httpError(response.status);
      const raw = await response.text();
      if (!raw.trim()) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw new ApiError('GREEN-API вернул некорректный ответ. Попробуйте ещё раз.');
      }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (error instanceof ApiError) throw error;
      if (timeout.aborted) throw new ApiError('Сервер не ответил вовремя. Проверьте соединение.');
      throw new ApiError('Не удалось связаться с GREEN-API. Проверьте интернет и адрес сервера.');
    }
  }

  async connect(signal?: AbortSignal): Promise<void> {
    const state = await this.request('GET', 'getStateInstance', { signal });
    if (!isRecord(state) || typeof state.stateInstance !== 'string')
      throw new ApiError('Не удалось определить состояние инстанса.', 0, false);
    if (state.stateInstance !== 'authorized') {
      const descriptions: Record<string, string> = {
        notAuthorized: 'Сначала авторизуйте инстанс MAX в личном кабинете GREEN-API.',
        starting: 'Инстанс запускается. Подождите несколько минут и подключитесь снова.',
        blocked: 'Аккаунт MAX заблокирован. Проверьте его состояние в личном кабинете.',
        suspended: 'На аккаунте MAX действуют временные ограничения.',
        pendingPassword: 'Завершите авторизацию MAX в личном кабинете GREEN-API.',
      };
      throw new ApiError(
        descriptions[state.stateInstance] ??
          'Инстанс не готов к работе. Проверьте личный кабинет GREEN-API.',
        0,
        false,
      );
    }
    const settings = await this.request('GET', 'getSettings', { signal });
    if (!isRecord(settings))
      throw new ApiError('Не удалось прочитать настройки инстанса.', 0, false);
    if (settings.typeInstance !== 'v3')
      throw new ApiError(
        'Для этого приложения нужен инстанс MAX (v3). Выберите его в GREEN-API.',
        0,
        false,
      );
    if (settings.webhookUrl)
      throw new ApiError(
        'Для получения сообщений очистите Webhook URL в настройках инстанса GREEN-API и подождите минуту.',
        0,
        false,
      );
    if (settings.incomingWebhook !== 'yes')
      throw new ApiError(
        'Включите «Получать уведомления о входящих сообщениях и файлах» в настройках инстанса GREEN-API.',
        0,
        false,
      );
  }

  async findChat(phone: string, signal?: AbortSignal): Promise<string> {
    const response = await this.request('POST', 'checkAccount', {
      body: { phoneNumber: Number(normalizePhone(phone)) },
      signal,
    });
    if (!isRecord(response)) throw new ApiError('Не удалось проверить номер телефона.');
    if (response.exist === false)
      throw new ApiError(
        'Аккаунт MAX не найден. Проверьте номер и доступность поиска по номеру у получателя.',
        0,
        false,
      );
    if (response.exist !== true || typeof response.chatId !== 'string' || !response.chatId)
      throw new ApiError(
        'MAX не смог проверить номер. Проверьте состояние инстанса и повторите попытку позднее.',
        0,
        false,
      );
    return response.chatId;
  }

  async sendMessage(chatId: string, text: string, signal?: AbortSignal): Promise<string> {
    if (!text.trim() || text.length > MESSAGE_LIMIT)
      throw new ApiError(
        `Сообщение должно содержать от 1 до ${MESSAGE_LIMIT} символов.`,
        400,
        false,
      );
    const response = await this.request('POST', 'sendMessage', {
      body: { chatId, message: text },
      signal,
    });
    if (!isRecord(response) || typeof response.idMessage !== 'string' || !response.idMessage)
      throw new ApiError('Не удалось подтвердить отправку сообщения. Проверьте переписку в MAX.');
    return response.idMessage;
  }

  async receive(signal?: AbortSignal): Promise<Notification | null> {
    const response = await this.request('GET', 'receiveNotification', {
      signal,
      suffix: '?receiveTimeout=25',
      timeout: 35_000,
    });
    if (response === null) return null;
    if (
      !isRecord(response) ||
      !Number.isSafeInteger(response.receiptId) ||
      !isRecord(response.body)
    )
      throw new ApiError('Неожиданный формат уведомления GREEN-API.', 0, false);
    return { receiptId: response.receiptId as number, body: response.body };
  }

  async acknowledge(receiptId: number, signal?: AbortSignal): Promise<void> {
    const response = await this.request('DELETE', 'deleteNotification', {
      signal,
      suffix: `/${receiptId}`,
    });
    if (!isRecord(response) || typeof response.result !== 'boolean')
      throw new ApiError('Не удалось подтвердить получение уведомления.');
    // false also means this receipt was already deleted. Re-fetching is safe;
    // message IDs are deduplicated before an event is applied to the UI.
  }
}
