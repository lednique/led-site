#!/usr/bin/env node
/**
 * Помощник: узнать TELEGRAM_CHAT_ID.
 *
 *   1. Откройте своего бота в Telegram и напишите ему любое сообщение (например /start).
 *   2. Запустите:  TELEGRAM_BOT_TOKEN=<токен> npm run telegram:chat-id
 *      (токен также подхватывается из .env / .env.local)
 *   3. Скопируйте показанный chat id в переменную TELEGRAM_CHAT_ID.
 *
 * Дополнительно: `npm run telegram:chat-id -- --test` отправит тестовое
 * сообщение в найденный чат.
 */

import { readFileSync, existsSync } from "node:fs";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("✖ TELEGRAM_BOT_TOKEN не задан (переменная окружения или .env.local)");
  process.exit(1);
}

const api = (method, params) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  }).then((r) => r.json());

const me = await api("getMe");
if (!me.ok) {
  console.error("✖ Токен не принят Telegram:", me.description);
  process.exit(1);
}
console.log(`✔ Бот: @${me.result.username} (${me.result.first_name})`);

const updates = await api("getUpdates", { timeout: 0 });
const chats = new Map();
for (const update of updates.result ?? []) {
  const chat =
    update.message?.chat ?? update.my_chat_member?.chat ?? update.channel_post?.chat;
  if (chat) chats.set(chat.id, chat);
}

if (chats.size === 0) {
  console.log("");
  console.log("Пока нет ни одного сообщения боту.");
  console.log(`Откройте https://t.me/${me.result.username}, нажмите Start и запустите скрипт снова.`);
  process.exit(0);
}

console.log("");
console.log("Найденные чаты (используйте id как TELEGRAM_CHAT_ID):");
for (const chat of chats.values()) {
  const title = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ");
  console.log(`  ${chat.id}  —  ${title}${chat.username ? ` (@${chat.username})` : ""} [${chat.type}]`);
}

if (process.argv.includes("--test")) {
  for (const chat of chats.values()) {
    const res = await api("sendMessage", {
      chat_id: chat.id,
      text: "✅ LED Contact Bot подключён — заявки с сайта будут приходить сюда.",
    });
    console.log(res.ok ? `✔ Тестовое сообщение отправлено в ${chat.id}` : `✖ ${chat.id}: ${res.description}`);
  }
}
