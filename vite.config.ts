import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * `/api/region` в dev-режиме: Vercel-функции локально не работают, поэтому
 * регион отдаёт сам dev-сервер.
 *
 * По умолчанию — «ru», как и в продакшне, когда страна посетителя не
 * определилась (российская версия не показывает иконки соцсетей Meta).
 * Посмотреть международную версию можно тремя способами:
 *   - `VITE_DEV_REGION=global` в `.env.local`;
 *   - подставить гео-заголовок Vercel:
 *     `curl -H "x-vercel-ip-country: US" http://localhost:5173/api/region`;
 *   - параметр `?region=global` в адресной строке (обрабатывает клиент,
 *     см. src/lib/region.ts), `?region=auto` возвращает определение заново.
 */
function regionDevApi(): Plugin {
  const handle = (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    // Локально гео-заголовка Vercel нет. Для проверки продакшн-логики можно
    // подставить его самому:  curl -H "x-vercel-ip-country: US" /api/region
    const raw = req.headers["x-vercel-ip-country"];
    const country = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().toUpperCase();

    let region: "ru" | "global";
    if (country) region = country !== "RU" ? "global" : "ru";
    else region = process.env.VITE_DEV_REGION === "global" ? "global" : "ru";

    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ region, country }));
  };

  return {
    name: "led-region-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/region", handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/region", handle);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Подтягиваем VITE_DEV_REGION из .env / .env.local в process.env,
  // чтобы dev-эндпоинт `/api/region` видел его так же, как Vercel в продакшне.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["VITE_DEV_REGION"]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), regionDevApi()],
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
