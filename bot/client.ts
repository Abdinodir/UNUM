import { mintToken } from '../auth';

/**
 * Bot backendning O'Z HTTP API'si bilan gaplashadi (localhost orqali).
 *
 * DB ga to'g'ridan-to'g'ri yozish tezroq bo'lardi, lekin unda bot ilova
 * o'tadigan tekshiruvlarni chetlab o'tgan bo'lardi: rate-limit, AI javobini
 * normalizatsiya qilish, premium himoyasi, kolleksiya kvotalari. Bir xil yo'l
 * — bir xil xatti-harakat.
 */
export class BackendClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    userId: number,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mintToken(userId)}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Server javobi tushunarsiz (${res.status})`);
    }
    if (!res.ok) throw new Error(json.error || `Server xatosi (${res.status})`);
    return json as T;
  }

  get<T>(userId: number, path: string) {
    return this.request<T>(userId, 'GET', path);
  }
  post<T>(userId: number, path: string, body: unknown) {
    return this.request<T>(userId, 'POST', path, body);
  }
  put<T>(userId: number, path: string, body: unknown) {
    return this.request<T>(userId, 'PUT', path, body);
  }
}
