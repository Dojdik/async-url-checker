/**
 * Low-level HTTP client (shared infrastructure).
 * Features/entities depend on this abstraction, not on fetch details (DIP).
 */

import { API_BASE_DEFAULT } from '@/shared/api/routes';

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? API_BASE_DEFAULT;

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      (typeof (body as { message: unknown }).message === 'string' ||
        Array.isArray((body as { message: unknown }).message))
        ? Array.isArray((body as { message: unknown[] }).message)
          ? (body as { message: string[] }).message.join(', ')
          : String((body as { message: string }).message)
        : `HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
