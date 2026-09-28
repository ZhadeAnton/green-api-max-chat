export interface SessionLockProvider {
  request(name: string, options: { signal: AbortSignal }, run: () => Promise<void>): Promise<void>;
}

/** Prevent two tabs from consuming the same instance queue. */
export async function withInstanceLock(options: {
  instanceId: string;
  signal: AbortSignal;
  locks: SessionLockProvider | undefined;
  onWaiting: () => void;
  run: () => Promise<void>;
}): Promise<void> {
  const { signal, locks, run } = options;
  if (signal.aborted) {
    return;
  }
  if (!locks) {
    await run();
    return;
  }
  options.onWaiting();
  await locks.request(`green-api-max:${options.instanceId}`, { signal }, async () => {
    if (!signal.aborted) {
      await run();
    }
  });
}
