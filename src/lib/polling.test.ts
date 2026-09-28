import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { abortableDelay, pollNotifications, type NotificationSource } from './polling';

describe('notification queue lifecycle', () => {
  it('processes a notification once, retries a failed DELETE and only then gets the next item', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    let received = 0;
    let acknowledged = 0;
    const source: NotificationSource = {
      receive: async () => {
        calls.push('receive');
        if (++received === 2) {
          controller.abort();
          return null;
        }
        return { receiptId: 12, body: { typeWebhook: 'unknown' } };
      },
      acknowledge: async (receiptId) => {
        calls.push(`delete:${receiptId}`);
        if (++acknowledged === 1) throw new ApiError('Temporary outage');
      },
    };
    await pollNotifications(source, {
      signal: controller.signal,
      onNotification: () => {
        calls.push('process');
      },
      onConnection: vi.fn(),
      delay: async () => {},
    });
    expect(calls).toEqual(['receive', 'process', 'delete:12', 'delete:12', 'receive']);
  });

  it('backs off after transient failures and recovers without overlapping receive calls', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    const connection = vi.fn();
    let calls = 0;
    const source: NotificationSource = {
      receive: async () => {
        calls++;
        if (calls <= 2) throw new ApiError('Network error');
        return null;
      },
      acknowledge: vi.fn(),
    };
    await pollNotifications(source, {
      signal: controller.signal,
      onNotification: vi.fn(),
      onConnection: connection,
      delay: async (ms) => {
        delays.push(ms);
        if (delays.length === 3) controller.abort();
      },
    });
    expect(delays).toEqual([1500, 3000, 1000]);
    expect(connection.mock.calls.at(-1)?.[0]).toEqual({ status: 'connected' });
    expect(source.acknowledge).not.toHaveBeenCalled();
  });

  it('stops on invalid credentials instead of retrying forever', async () => {
    const source = {
      receive: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401, false)),
      acknowledge: vi.fn(),
    };
    const connection = vi.fn();
    const delay = vi.fn();
    await pollNotifications(source, {
      signal: new AbortController().signal,
      onNotification: vi.fn(),
      onConnection: connection,
      delay,
    });
    expect(source.receive).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(connection).toHaveBeenLastCalledWith({ status: 'error', message: 'Unauthorized' });
  });

  it('ignores late responses from a cancelled session', async () => {
    const controller = new AbortController();
    const source = {
      receive: async () => {
        controller.abort();
        return { receiptId: 99, body: {} };
      },
      acknowledge: vi.fn(),
    };
    const notify = vi.fn();
    await pollNotifications(source, {
      signal: controller.signal,
      onNotification: notify,
      onConnection: vi.fn(),
    });
    expect(notify).not.toHaveBeenCalled();
    expect(source.acknowledge).not.toHaveBeenCalled();
  });

  it('cancels retry timers promptly on logout', async () => {
    const controller = new AbortController();
    const promise = abortableDelay(60_000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
