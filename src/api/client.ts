interface RequestOptions extends RequestInit {
  skipJson?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipJson = false, headers, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(skipJson ? {} : { 'Content-Type': 'application/json' }),
      ...(headers || {}),
    },
  });

  const raw = await response.text();
  const data = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && data.error) ||
      `请求失败 (${response.status})`;
    throw new Error(String(message));
  }

  return (data as T) ?? ({} as T);
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
