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
const TIME_DELAY = 300_000;

const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
    timeout: TIME_DELAY, // 5 минут
});

// Хранилище пользовательских настроек: userId -> boolean (true = с форматированием, false = без форматирования)
const userPreferences = new Map();

// Хранилище связок: messageId бота -> { voiceMessageId, fileId }
const botMessageToVoice = new Map();

// Константы для индикаторов режима
const MODES = {
    WITH_FORMAT: {
        emoji: '🎨',
        name: 'С форматированием',
        description: 'улучшение читаемости и заголовок',
    },
    WITHOUT_FORMAT: {
        emoji: '📝',
        name: 'Без форматирования',
        description: 'только расшифровка',
    },
};

// Функция для получения текущего режима пользователя
function getUserMode(userId) {
    const withFormatting = userPreferences.get(userId) !== false; // По умолчанию с форматированием
    return withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;
}

// Функция для улучшения читаемости текста без изменения слов
async function improveReadability(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content:
                        'Ты - эксперт по улучшению читаемости текста. Твоя задача - сделать текст более структурированным и удобным для чтения, НО с соблюдением следующих правил:\n' +
                        '1. Сохрани не менее 90% оригинальных слов без изменений\n' +
                        '2. НЕ меняй формулировки фраз и предложений\n' +
                        '3. НЕ сокращай текст и не убирай информацию\n' +
                        '4. НЕ добавляй новую информацию\n' +
                        '5. Можно исправлять пунктуацию, добавлять абзацы и исправлять очевидные ошибки расшифровки\n' +
                        '6. Можно убирать слова-паразиты и повторения\n' +
                        'Твоя цель - улучшить структуру и читаемость, сохраняя при этом все оригинальные формулировки.',
                },
                {
                    role: 'user',
                    content: `Улучши читаемость этого текста: ${text}`,
                },
            ],
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Ошибка при улучшении читаемости:', error);
        return text; // Возвращаем оригинальный текст в случае ошибки
    }
}

// Функция для создания заголовка к тексту расшифровки
async function createTitle(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content:
                        'Ты создаешь заголовки для личных заметок и мыслей пользователя. Твоя задача:\n\n' +
                        '1. Анализируй количество идей/тем в тексте:\n' +
                        '   - Если 1 тема → короткий заголовок (3-5 слов)\n' +
                        '   - Если 2-3 темы → средний заголовок (6-10 слов)\n' +
                        '   - Если много тем → длинный заголовок (10-15 слов)\n\n' +
                        '2. Включай ключевые цитаты или термины из текста в кавычках\n' +
                        '3. Делай заголовок понятным только автору заметки\n' +
                        '4. Используй конкретные слова пользователя, а не общие фразы\n' +
                        '5. Создавай заголовок как "тэг" для поиска заметки в будущем\n\n' +
                        'Примеры:\n' +
                        '- Одна тема: "Идея про автоматизацию"\n' +
                        '- Несколько тем: "Планы на проект, встреча с Иваном, бюджет"\n' +
                        '- Много деталей: "Анализ конкурентов: их цены, наш USP, стратегия продвижения"',
                },
                {
                    role: 'user',
                    content: `Создай заголовок для этой личной заметки: ${text}`,
                },
            ],
        });

        return response.choices[0].message.content.trim().replace(/"/g, ''); // Убираем кавычки
    } catch (error) {
        console.error('Ошибка при создании заголовка:', error);
        return 'Заметка';
    }
}

// Функция для обработки голосового сообщения
async function processVoice(ctx, fileId, voiceMessageId, withFormatting) {
    const mode = withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;

    // Отправка сообщения о загрузке
    const loadingMessage = await ctx.reply(`${mode.emoji} ⏳ Обрабатываю в режиме "${mode.name}"...`, {
        reply_to_message_id: voiceMessageId,
    });

    try {
        const link = await ctx.telegram.getFileLink(fileId);
        const res = await fetch(link.href);
        const buffer = await res.arrayBuffer();
        const tmpPath = `/tmp/${uuid()}.ogg`;
        await writeFile(tmpPath, Buffer.from(buffer));

        const rawTranscript = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: createReadStream(tmpPath),
            response_format: 'text',
            language: 'ru',
        });

        // Удаляем сообщение о загрузке
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

        let botReply;

        if (withFormatting) {
            const improvedTranscript = await improveReadability(rawTranscript);
            const title = await createTitle(improvedTranscript);

            botReply = await ctx.reply(
                `${mode.emoji} *Режим: ${mode.name}*\n\n` +
                    `**Заголовок:**\n\`${title}\`\n\n` +
                    `**Расшифровка:**\n\`\`\`\n${improvedTranscript}\n\`\`\``,
                {
                    parse_mode: 'Markdown',
                    reply_to_message_id: voiceMessageId,
                }
            );
        } else {
            botReply = await ctx.reply(`${mode.emoji} *Режим: ${mode.name}*\n\n` + `**Расшифровка:**\n\`\`\`\n${rawTranscript}\n\`\`\``, {
                parse_mode: 'Markdown',
                reply_to_message_id: voiceMessageId,
            });
        }

        // Сохраняем связку с fileId
        botMessageToVoice.set(botReply.message_id, { voiceMessageId, fileId });

        return botReply;
    } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        throw error;
    }
}

// Команда /start
bot.command('start', (ctx) => {
    const mode = getUserMode(ctx.from.id);
    ctx.reply(
        `🤖 *Добро пожаловать в бот для расшифровки голосовых сообщений!*\n\n` +
            `${mode.emoji} Текущий режим: *${mode.name}*\n\n` +
            `📋 *Доступные команды:*\n` +
            `/format - режим с форматированием ${MODES.WITH_FORMAT.emoji}\n` +
            `/noformat - режим без форматирования ${MODES.WITHOUT_FORMAT.emoji}\n` +
            `/toggle - быстрое переключение режима\n` +
            `/mode - проверить текущий режим\n` +
            `/help - подробная справка\n\n` +
            `Просто отправьте голосовое сообщение для расшифровки! 🎙️`,
        { parse_mode: 'Markdown' }
    );
});

// Команда для включения форматирования
bot.command('format', async (ctx) => {
    const userId = ctx.from.id;

    // Проверяем, является ли это ответом на сообщение бота с расшифровкой
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                // Устанавливаем новый режим
                userPreferences.set(userId, true);

                // Удаляем команду пользователя и предыдущий ответ бота
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);

                // Удаляем связку из хранилища
                botMessageToVoice.delete(botMessage.message_id);

                // Переобрабатываем голосовое сообщение в новом режиме
                await processVoice(ctx, voiceData.fileId, voiceData.voiceMessageId, true);

                return;
            } catch (error) {
                console.error('Error processing format command:', error);
                await ctx.reply('❌ Не удалось переобработать сообщение.');
                return;
            }
        }
    }

    // Обычное поведение команды
    userPreferences.set(userId, true);
    ctx.reply(
        `${MODES.WITH_FORMAT.emoji} *Режим включен: ${MODES.WITH_FORMAT.name}*\n\nВаши голосовые сообщения будут обрабатываться с улучшением читаемости и заголовком.`,
        {
            parse_mode: 'Markdown',
        }
    );
});

// Команда для выключения форматирования
bot.command('noformat', async (ctx) => {
    const userId = ctx.from.id;

    // Проверяем, является ли это ответом на сообщение бота с расшифровкой
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                // Устанавливаем новый режим
                userPreferences.set(userId, false);

                // Удаляем команду пользователя и предыдущий ответ бота
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);

                // Удаляем связку из хранилища
                botMessageToVoice.delete(botMessage.message_id);

                // Переобрабатываем голосовое сообщение в новом режиме
                await processVoice(ctx, voiceData.fileId, voiceData.voiceMessageId, false);

                return;
            } catch (error) {
                console.error('Error processing noformat command:', error);
                await ctx.reply('❌ Не удалось переобработать сообщение.');
                return;
            }
        }
    }

    // Обычное поведение команды
    userPreferences.set(userId, false);
    ctx.reply(
        `${MODES.WITHOUT_FORMAT.emoji} *Режим включен: ${MODES.WITHOUT_FORMAT.name}*\n\nВаши голосовые сообщения будут просто расшифрованы без дополнительной обработки.`,
        {
            parse_mode: 'Markdown',
        }
    );
});

// Команда для быстрого переключения режима
bot.command('toggle', (ctx) => {
    const userId = ctx.from.id;
    const currentMode = userPreferences.get(userId) !== false;
    userPreferences.set(userId, !currentMode);

    const newMode = getUserMode(userId);
    ctx.reply(`${newMode.emoji} *Режим переключен на: ${newMode.name}*\n\n${newMode.description}`, {
        parse_mode: 'Markdown',
    });
});

// Команда для проверки текущего режима
bot.command('mode', (ctx) => {
    const mode = getUserMode(ctx.from.id);
    ctx.reply(`${mode.emoji} *Текущий режим: ${mode.name}*\n\n${mode.description}`, {
        parse_mode: 'Markdown',
    });
});

// Команда для удаления голосового сообщения и расшифровки
async function handleDelete(ctx) {
    // Проверяем, является ли это ответом на сообщение бота с расшифровкой
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                // Удаляем команду пользователя
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                
                // Удаляем ответ бота с расшифровкой
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);
                
                // Удаляем оригинальное голосовое сообщение
                await ctx.telegram.deleteMessage(ctx.chat.id, voiceData.voiceMessageId);

                // Удаляем связку из хранилища
                botMessageToVoice.delete(botMessage.message_id);

                return;
            } catch (error) {
                console.error('Error processing delete command:', error);
                // Если не удалось удалить некоторые сообщения, просто логируем ошибку
                // но не показываем пользователю, чтобы не засорять чат
                return;
            }
        }
    }

    // Если команда используется не как ответ на расшифровку, удаляем только саму команду
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch (error) {
        console.error('Error deleting command message:', error);
    }
}

bot.command('d', handleDelete);
bot.command('del', handleDelete);

bot.on('voice', async (ctx) => {
    try {
        // Логирование получения сообщения
        const user = ctx.message.from;
        const userId = user.id;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`📩 Получено голосовое сообщение от пользователя ${username} (ID: ${userId})`);

        // Получаем режим пользователя
        const withFormatting = userPreferences.get(userId) !== false;
        const fileId = ctx.message.voice.file_id;

        // Обрабатываем голосовое сообщение
        const botReply = await processVoice(ctx, fileId, ctx.message.message_id, withFormatting);

        // Логирование успешной обработки
        const mode = getUserMode(userId);
        console.log(`✅ Обработано сообщение от ${username} в режиме ${mode.name}`);
    } catch (err) {
        console.error(err);
        await ctx.reply('❌ Не удалось расшифровать сообщение.');
    }
});

// Добавляем справку
bot.command('help', (ctx) => {
    const mode = getUserMode(ctx.from.id);
    ctx.reply(
        `🤖 *Бот для расшифровки голосовых сообщений*\n\n` +
            `${mode.emoji} Текущий режим: *${mode.name}*\n\n` +
            `Отправьте голосовое сообщение, и бот расшифрует его.\n\n` +
            `📋 *Доступные команды:*\n` +
            `${MODES.WITH_FORMAT.emoji} \`/format\` - включить режим с форматированием (улучшение читаемости и заголовок)\n` +
            `${MODES.WITHOUT_FORMAT.emoji} \`/noformat\` - включить режим без форматирования (только расшифровка)\n` +
            `🔄 \`/toggle\` - быстрое переключение между режимами\n` +
            `ℹ️ \`/mode\` - проверить текущий режим работы\n` +
            `🆘 \`/help\` - показать эту справку\n` +
            `🏠 \`/start\` - начать работу с ботом\n\n` +
            `💡 *Режимы работы:*\n` +
            `${MODES.WITH_FORMAT.emoji} **С форматированием:** заголовок + улучшенный текст\n` +
            `${MODES.WITHOUT_FORMAT.emoji} **Без форматирования:** только чистая расшифровка\n\n` +
            `💬 *Совет:* Ответьте на расшифровку командой /format или /noformat, чтобы переобработать это же сообщение в другом режиме!\n\n` +
            `📝 Текст форматируется моноширинным шрифтом для удобного копирования`,
        { parse_mode: 'Markdown' }
    );
});

bot.launch();


// Устанавливаем команды для автокомплита
bot.telegram.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'format', description: 'Режим с форматированием 🎨' },
    { command: 'noformat', description: 'Режим без форматирования 📝' },
    { command: 'toggle', description: 'Переключить режим' },
    { command: 'mode', description: 'Текущий режим' },
    { command: 'd', description: 'Удалить сообщения 🗑️' },
    { command: 'del', description: 'Удалить сообщения 🗑️' },
    { command: 'help', description: 'Справка по командам' },
]);

console.log('🤖 Бот запущен');
