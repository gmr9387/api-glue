// Centralized retry / backoff policy. Workers ask this module whether a
// failed job should be re-queued and when.

import type { ConnectorError } from "./connectors.ts";

export interface RetryPolicy {
  maxRetries: number;
  baseMs: number;
  capMs: number;
}

export const DEFAULT_POLICY: RetryPolicy = { maxRetries: 3, baseMs: 500, capMs: 30_000 };

export function shouldRetry(err: ConnectorError | undefined, attempt: number, policy: RetryPolicy): boolean {
  if (!err) return false;
  if (!err.retryable) return false;
  return attempt < policy.maxRetries;
}

/** Decorrelated exponential backoff with full jitter. */
export function nextBackoffMs(attempt: number, policy: RetryPolicy): number {
  const exp = Math.min(policy.capMs, policy.baseMs * 2 ** attempt);
  return Math.round(Math.random() * exp);
}
