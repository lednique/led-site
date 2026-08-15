import type { VercelRequest, VercelResponse } from "@vercel/node";
// The .js suffix is intentional: Vercel runs TypeScript API files as native
// ESM after transpilation, where extensionless local imports do not resolve.
import { handleCommission } from "../server/commission.js";

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

function parseBody(body: unknown): Record<string, unknown> {
  let value = body;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    value = value.toString("utf8");
  }
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const result = await handleCommission(parseBody(req.body), clientIp(req));
    res.status(result.status).json(result.body);
  } catch (err) {
    // Keep the endpoint JSON-shaped even if an unexpected runtime error slips
    // through. The browser can then show its normal retry state instead of
    // receiving Vercel's HTML FUNCTION_INVOCATION_FAILED page.
    console.error("[commission] unexpected handler error:", err);
    res.status(500).json({ success: false, error: "Could not deliver the message. Try again later." });
  }
}
