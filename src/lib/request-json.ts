export async function requestJson<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: init?.cache ?? 'no-store',
  });

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
