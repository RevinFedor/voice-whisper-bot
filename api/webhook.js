import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import { v4 as uuid } from 'uuid';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';

// Временная директория для файлов
const TMP_DIR = path.join(os.tmpdir(), 'voice-whisper-bot');

// Создаем бота и OpenAI клиент только для обработки запросов, не для настройки вебхука
let bot = null;
let openai = null;

// Создаем временную директорию если не существует
async function ensureTempDir() {
    try {
        await mkdir(TMP_DIR, { recursive: true });
    } catch (error) {
        console.error('Ошибка при создании временной директории:', error);
    }
}

// Функция инициализации для создания экземпляров только при обработке запроса
function initialize() {
    // Инициализируем только если еще не инициализировано
    if (!bot) {
        bot = new Telegraf(process.env.TELEGRAM_TOKEN);

        // Обработчик голосовых сообщений
        bot.on('voice', async (ctx) => {
            try {
                // Логирование получения сообщения
                const user = ctx.message.from;
                const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
                console.log(`📩 Получено голосовое сообщение от ${username} (ID: ${user.id})`);

                // Отправка сообщения о загрузке
                const loadingMessage = await ctx.reply('⏳ Обрабатываю голосовое сообщение...');

                const fileId = ctx.message.voice.file_id;
                const link = await ctx.telegram.getFileLink(fileId);

                // Скачиваем аудиофайл
                const res = await fetch(link.href);
                const buffer = await res.arrayBuffer();

                // Сохраняем файл во временную директорию
                await ensureTempDir();
                const tmpPath = path.join(TMP_DIR, `${uuid()}.ogg`);
                await writeFile(tmpPath, Buffer.from(buffer));

                // Отправляем в Whisper для расшифровки
                const transcript = await openai.audio.transcriptions.create({
                    model: 'whisper-1',
                    file: createReadStream(tmpPath),
                    response_format: 'text',
                    language: 'ru',
                });

                // Удаляем временный файл
                try {
                    await unlink(tmpPath);
                } catch (e) {
                    console.error('Ошибка при удалении временного файла:', e);
                }

                // Удаляем сообщение о загрузке
                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

                // Отправляем результат
                await ctx.reply(`📝 Расшифровка:\n${transcript}`);

                console.log(`✅ Обработано сообщение от ${username}, длина расшифровки: ${transcript.length} символов`);
            } catch (err) {
                console.error('Ошибка при обработке голосового сообщения:', err);
                await ctx.reply('❌ Не удалось расшифровать сообщение.');
            }
        });

        // Обработчик текстовых сообщений
        bot.on('text', (ctx) => {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`💬 Получено текстовое сообщение от ${username}: ${ctx.message.text}`);

            ctx.reply('Отправьте голосовое сообщение, и я расшифрую его в текст.');
        });
    }

    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
    }
}

// Обработка вебхука - основная точка входа для Vercel
export default async function (req, res) {
    try {
        // Обработка GET запросов - настройка вебхука
        if (req.method === 'GET') {
            // Используем временный экземпляр бота только для настройки вебхука
            const tempBot = new Telegraf(process.env.TELEGRAM_TOKEN);

            const webhookUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/webhook` : null;

            if (webhookUrl) {
                try {
                    await tempBot.telegram.setWebhook(webhookUrl);
                    console.log(`🤖 Вебхук установлен на ${webhookUrl}`);
                } catch (e) {
                    console.error('❌ Ошибка при установке вебхука:', e);
                }
            }

            return res.status(200).json({
                ok: true,
                message: 'Бот запущен и готов к работе!',
                webhookUrl: webhookUrl || 'Нет URL для вебхука',
            });
        }

        // Обработка POST запросов от Telegram - обработка сообщений
        if (req.method === 'POST' && req.body) {
            // Инициализируем экземпляры бота и OpenAI только при обработке запроса
            initialize();

            // Проверяем, что это webhook от Telegram
            if (req.body.update_id) {
                // Обрабатываем только один раз
                await bot.handleUpdate(req.body);
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(404).json({ ok: false, message: 'Метод не поддерживается' });
    } catch (error) {
        console.error('Ошибка при обработке запроса:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
