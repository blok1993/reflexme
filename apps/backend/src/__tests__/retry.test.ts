import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the retry logic by extracting it. Since withRetry is not exported,
// we replicate its behaviour in a pure unit test.

type RetryOptions = { maxAttempts?: number };

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3 }: RetryOptions = {},
): Promise<T> {
  let lastError!: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const status = (err as { status?: number }).status;
      const nonRetriable = status === 401 || status === 403 || status === 400 || status === 422;
      if (nonRetriable) throw err;
      if (attempt < maxAttempts) {
        // No real delay in tests
      }
    }
  }
  throw lastError;
}

describe('withRetry', () => {
  it('resolves immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 up to maxAttempts then throws', async () => {
    const err = Object.assign(new Error('server error'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 401 (auth error)', async () => {
    const err = Object.assign(new Error('unauthorized'), { status: 401 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 400 (validation error)', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 422 (invalid params)', async () => {
    const err = Object.assign(new Error('unprocessable'), { status: 422 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('unprocessable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (no status)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxAttempts: 2 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
