import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * В dev-режиме serverless-функции Vercel не работают, поэтому поднимаем
 * `/api/commission` прямо внутри dev-сервера Vite — с той же логикой,
 * что и в продакшне (`server/commission.ts`).
 */
function commissionDevApi(): Plugin {
  return {
    name: "led-commission-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/commission", async (req, res) => {
        const sendJson = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (req.method === "OPTIONS") {
          res.setHeader("Allow", "POST, OPTIONS");
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST, OPTIONS");
          sendJson(405, { success: false, error: "Method not allowed" });
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);

          let body: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              body = parsed as Record<string, unknown>;
            }
          } catch {
            body = {};
          }

          const { handleCommission } = await server.ssrLoadModule("/server/commission.ts");
          const forwarded = req.headers["x-forwarded-for"];
          const ip =
            (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? "").split(",")[0].trim() ||
            req.socket.remoteAddress ||
            "";

          const result = await handleCommission(body, ip);
          sendJson(result.status, result.body);
        } catch (err) {
          console.error("[commission] unexpected dev handler error:", err);
          sendJson(500, { success: false, error: "Could not deliver the message. Try again later." });
        }
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
