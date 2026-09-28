import type { Connection, Notification } from '../types';
import { ApiError } from './api';
import { errorMessage } from './format';

export interface NotificationSource {
  receive(signal: AbortSignal): Promise<Notification | null>;
  acknowledge(receiptId: number, signal: AbortSignal): Promise<void>;
}

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
      // When DELETE fails, retry that receipt before receiving another item.
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
      // Also bounds the rate when an API returns empty responses immediately.
      await delay(1000, signal);
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
        await delay(Math.min(1500 * 2 ** (failures - 1), 15_000), signal);
      } catch {
        return;
      }
    }
  }
}
