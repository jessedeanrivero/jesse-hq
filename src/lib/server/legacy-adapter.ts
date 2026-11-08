// Runs an original Vercel Node-style handler `(req, res) => …` inside a Next.js Route Handler,
// so the classic app's API functions keep their exact behavior without being rewritten.

type LegacyReq = { method: string; body: unknown; query: Record<string, string>; headers: Record<string, string> };
type LegacyHandler = (req: LegacyReq, res: LegacyRes) => unknown;

class LegacyRes {
  statusCode = 200;
  headers = new Headers();
  body: string | null = null;
  ended = false;

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(data: unknown) {
    this.headers.set('Content-Type', 'application/json');
    this.body = JSON.stringify(data);
    this.ended = true;
    return this;
  }
  send(data: unknown) {
    this.body = typeof data === 'string' ? data : JSON.stringify(data);
    this.ended = true;
    return this;
  }
  end() {
    this.ended = true;
    return this;
  }
}

export async function runLegacy(handler: LegacyHandler, request: Request): Promise<Response> {
  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const text = await request.text();
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
  }
  const url = new URL(request.url);
  const req: LegacyReq = {
    method: request.method,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(request.headers.entries()),
  };
  const res = new LegacyRes();
  await handler(req, res);
  return new Response(res.body, { status: res.statusCode, headers: res.headers });
}
