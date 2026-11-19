// Keep-alive for the free Render instance (an external cron calls it every few minutes).
// Deliberately standalone: it doesn't load the API app or touch the database, so pings cost
// nothing but the request itself. /api/health remains the "is the API working" check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const HEAD = GET;
