import type { Connection, Notification } from '../types';
import { ApiError } from './api';
import { errorMessage } from './format';

export interface NotificationSource {
  receive(signal: AbortSignal): Promise<Notification | null>;
  acknowledge(receiptId: number, signal: AbortSignal): Promise<void>;
}

const POLL_INTERVAL_MS = 1000;
const RETRY_DELAY_BASE_MS = 1500;
const RETRY_DELAY_MAX_MS = 15_000;

export function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollNotifications(
  source: NotificationSource,
  options: {
    signal: AbortSignal;
    onNotification: (notification: Notification) => void;
    onConnection: (connection: Connection) => void;
    delay?: typeof abortableDelay;
  },
): Promise<void> {
  const { signal, onNotification, onConnection, delay = abortableDelay } = options;
  let pendingReceipt: number | null = null;
  let failures = 0;
  onConnection({ status: 'connecting' });
  while (!signal.aborted) {
    try {
      if (pendingReceipt !== null) {
        await source.acknowledge(pendingReceipt, signal);
        pendingReceipt = null;
      }
      if (signal.aborted) {
        return;
      }
      const notification = await source.receive(signal);
      if (signal.aborted) {
        return;
      }
      if (notification) {
        onNotification(notification);
        pendingReceipt = notification.receiptId;
        if (signal.aborted) {
          return;
        }
        await source.acknowledge(pendingReceipt, signal);
        pendingReceipt = null;
      }
      failures = 0;
      onConnection({ status: 'connected' });
      await delay(POLL_INTERVAL_MS, signal);
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      if (error instanceof ApiError && !error.retryable) {
        onConnection({ status: 'error', message: error.message });
        return;
      }
      failures += 1;
      onConnection({ status: 'retrying', message: errorMessage(error) });
      try {
        await delay(
          Math.min(RETRY_DELAY_BASE_MS * 2 ** (failures - 1), RETRY_DELAY_MAX_MS),
          signal,
        );
      } catch {
        return;
      }
    }
  }
}
