type ApiOpts = RequestInit & { body?: unknown };

class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

const listeners = new Set<(err: ApiError) => void>();
export function onApiError(handler: (err: ApiError) => void) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  const isJson = opts.body !== undefined && !(opts.body instanceof FormData);
  const init: RequestInit = {
    credentials: "include",
    ...opts,
    headers: {
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    body: isJson ? JSON.stringify(opts.body) : (opts.body as BodyInit | null | undefined),
  };
  const res = await fetch(path, init);
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new ApiError(res.status, (data as { error?: string })?.error || `http_${res.status}`, data);
    listeners.forEach((l) => l(err));
    throw err;
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export { ApiError };
