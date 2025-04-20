import { Telegraf } from 'telegraf';
import { writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

// Загружаем переменные из файла .env
dotenv.config();

// Используем переменные из .env
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;

const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

bot.on('voice', async (ctx) => {
    try {
        // Логирование получения сообщения
        const user = ctx.message.from;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`📩 Получено голосовое сообщение от пользователя ${username} (ID: ${user.id})`);

        // Отправка сообщения о загрузке
        const loadingMessage = await ctx.reply('⏳ Обрабатываю голосовое сообщение...');

        const fileId = ctx.message.voice.file_id;
        // Получаем прямую ссылку на файл
        const link = await ctx.telegram.getFileLink(fileId);

        // Скачиваем буфер
        const res = await fetch(link.href);
        const buffer = await res.arrayBuffer();
        const tmpPath = `/tmp/${uuid()}.ogg`;
        await writeFile(tmpPath, Buffer.from(buffer));

        // Отправляем в Whisper v2 (model = "whisper‑1")
        const transcript = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: createReadStream(tmpPath),
            response_format: 'text', // получим чистый текст
            language: 'ru', // ускорит распознавание, если уверены в языке
        });

        // Удаляем сообщение о загрузке
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

        // Отправляем результат
        await ctx.reply(`📝 Расшифровка:\n${transcript}`);

        // Логирование успешной обработки
        console.log(`✅ Обработано сообщение от ${username}, длина расшифровки: ${transcript.length} символов`);
    } catch (err) {
        console.error(err);
        await ctx.reply('❌ Не удалось расшифровать сообщение.');
    }
});

bot.launch();
console.log('🤖 Бот запущен');
