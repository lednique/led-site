import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCommission } from "./_lib/commission";

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const result = await handleCommission((body ?? {}) as Record<string, unknown>, clientIp(req));
  res.status(result.status).json(result.body);
}
