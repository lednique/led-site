import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * В dev-режиме serverless-функции Vercel не работают, поэтому поднимаем
 * `/api/commission` прямо внутри dev-сервера Vite — с той же логикой,
 * что и в продакшне (`api/_lib/commission.ts`).
 */
function commissionDevApi(): Plugin {
  return {
    name: "led-commission-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/commission", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: "Method not allowed" }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          body = {};
        }

        const { handleCommission } = await server.ssrLoadModule("/api/_lib/commission.ts");
        const forwarded = req.headers["x-forwarded-for"];
        const ip =
          (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? "").split(",")[0].trim() ||
          req.socket.remoteAddress ||
          "";

        const result = await handleCommission(body, ip);
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Подтягиваем TELEGRAM_* из .env / .env.local в process.env,
  // чтобы dev-эндпоинт видел их так же, как Vercel в продакшне.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), commissionDevApi()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
    },
  };
});
