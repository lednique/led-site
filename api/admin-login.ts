import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const expected = process.env.ADMIN_PASSWORD;
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!expected) {
    res.status(500).json({ ok: false, error: "ADMIN_PASSWORD is not set" });
    return;
  }
  if (password !== expected) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
}
