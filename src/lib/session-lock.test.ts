import { describe, expect, it, vi } from 'vitest';
import { withInstanceLock } from './session-lock';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.skipIf(!globalThis.navigator?.locks)('exclusive access to an instance queue', () => {
  it('only starts the second consumer after the first session ends', async () => {
    const instanceId = crypto.randomUUID();
    const gate = deferred();
    const started = deferred();
    const events: string[] = [];
    const first = withInstanceLock({
      instanceId,
      signal: new AbortController().signal,
      locks: navigator.locks,
      onWaiting: vi.fn(),
      run: async () => {
        events.push('first:start');
        started.resolve();
        await gate.promise;
        events.push('first:end');
      },
    });
    await started.promise;
    const secondWaiting = deferred();
    const second = withInstanceLock({
      instanceId,
      signal: new AbortController().signal,
      locks: navigator.locks,
      onWaiting: secondWaiting.resolve,
      run: async () => {
        events.push('second:start');
      },
    });
    try {
      await secondWaiting.promise;
      expect(events).toEqual(['first:start']);
    } finally {
      gate.resolve();
    }
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('cancels a waiting tab without ever consuming messages', async () => {
    const instanceId = crypto.randomUUID();
    const gate = deferred();
    const started = deferred();
    const first = withInstanceLock({
      instanceId,
      signal: new AbortController().signal,
      locks: navigator.locks,
      onWaiting: vi.fn(),
      run: async () => {
        started.resolve();
        await gate.promise;
      },
    });
    await started.promise;
    const controller = new AbortController();
    const consume = vi.fn();
    const second = withInstanceLock({
      instanceId,
      signal: controller.signal,
      locks: navigator.locks,
      onWaiting: vi.fn(),
      run: consume,
    });
    controller.abort();
    try {
      await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      gate.resolve();
      await first;
    }
    expect(consume).not.toHaveBeenCalled();
  });

  it('does not block a different instance', async () => {
    const gate = deferred();
    const started = deferred();
    const first = withInstanceLock({
      instanceId: crypto.randomUUID(),
      signal: new AbortController().signal,
      locks: navigator.locks,
      onWaiting: vi.fn(),
      run: async () => {
        started.resolve();
        await gate.promise;
      },
    });
    await started.promise;
    const consume = vi.fn();
    try {
      await withInstanceLock({
        instanceId: crypto.randomUUID(),
        signal: new AbortController().signal,
        locks: navigator.locks,
        onWaiting: vi.fn(),
        run: consume,
      });
      expect(consume).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      await first;
    }
  });
});

it('supports older browsers and does not start a cancelled session', async () => {
  const consume = vi.fn();
  const waiting = vi.fn();
  const controller = new AbortController();
  await withInstanceLock({
    instanceId: '1',
    signal: controller.signal,
    locks: undefined,
    onWaiting: waiting,
    run: consume,
  });
  controller.abort();
  await withInstanceLock({
    instanceId: '1',
    signal: controller.signal,
    locks: undefined,
    onWaiting: waiting,
    run: consume,
  });
  expect(consume).toHaveBeenCalledOnce();
  expect(waiting).not.toHaveBeenCalled();
});
