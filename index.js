import { Telegraf, Markup } from 'telegraf';
import { writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import axios from 'axios';

// Загружаем переменные из файла .env
dotenv.config();

// Используем переменные из .env
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const TIME_DELAY = 400_000;

// Конфигурация Obsidian API
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY || '';
const OBSIDIAN_HOST = process.env.OBSIDIAN_HOST || '127.0.0.1';
const OBSIDIAN_PORT = process.env.OBSIDIAN_PORT || '27123';
const OBSIDIAN_URL = `http://${OBSIDIAN_HOST}:${OBSIDIAN_PORT}`;
const OBSIDIAN_FOLDER = process.env.OBSIDIAN_FOLDER || 'Telegram Voice Notes';

const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
    timeout: TIME_DELAY, // 5 минут
});

// Хранилище пользовательских настроек: userId -> boolean (true = с форматированием, false = без форматирования)
const userPreferences = new Map();

// Хранилище связок: messageId бота -> { voiceMessageId, fileId }
const botMessageToVoice = new Map();

// Хранилище начальных сообщений для удаления диапазона: userId -> messageId
const deleteRangeStart = new Map();

// Хранилище для временного сохранения расшифровок для Obsidian
const transcriptionCache = new Map();

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

// Функция для разбиения длинного текста на части
function splitLongText(text, maxLength = 3500) {
    const parts = [];
    let currentPart = '';
    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentPart + line + '\n').length > maxLength) {
            if (currentPart) {
                parts.push(currentPart.trim());
                currentPart = '';
            }
            // Если одна строка длиннее maxLength, разбиваем её по словам
            if (line.length > maxLength) {
                const words = line.split(' ');
                let currentLine = '';
                for (const word of words) {
                    if ((currentLine + word + ' ').length > maxLength) {
                        parts.push(currentLine.trim());
                        currentLine = word + ' ';
                    } else {
                        currentLine += word + ' ';
                    }
                }
                if (currentLine) {
                    currentPart = currentLine;
                }
            } else {
                currentPart = line + '\n';
            }
        } else {
            currentPart += line + '\n';
        }
    }

    if (currentPart) {
        parts.push(currentPart.trim());
    }

    return parts;
}

// Функция для создания inline keyboard
function createTranscriptKeyboard(messageId) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('📝 Добавить в заметку', `add_note_${messageId}`),
            Markup.button.callback('🎙️ Оставить как голосовое', `keep_voice_${messageId}`),
        ],
    ]);
}

// Функция для отправки заметки в Obsidian
async function createObsidianNote(data) {
    try {
        const date = new Date(data.timestamp);
        
        // Создаем имя файла только с заголовком
        const filename = `${data.title}.md`;
        const filepath = `${OBSIDIAN_FOLDER}/${filename}`;
        
        // Форматируем дату для properties (YYYY-MM-DD HH:MM)
        const formattedDate = date.toISOString().slice(0, 16).replace('T', ' ');
        
        // Форматируем контент для Obsidian
        const content = `---
title: "${data.title}"
date: ${formattedDate}
tags: [tg-transcript]
source: telegram-voice
mode: ${data.mode}
---

# ${data.title}

${data.content}`;

        // Отправляем запрос к Obsidian API
        const response = await axios.put(`${OBSIDIAN_URL}/vault/${encodeURIComponent(filepath)}`, content, {
            headers: {
                Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
                'Content-Type': 'text/markdown',
            },
        });

        return { success: true, filepath };
    } catch (error) {
        console.error('Ошибка при создании заметки в Obsidian:', error);
        return { success: false, error: error.message };
    }
}

// Обновленная функция processVoice
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

        // Пытаемся удалить сообщение о загрузке
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        } catch (deleteError) {
            console.log('Не удалось удалить сообщение о загрузке:', deleteError.message);
        }

        let messageContent;
        let title = '';

        if (withFormatting) {
            const improvedTranscript = await improveReadability(rawTranscript);
            title = await createTitle(improvedTranscript);
            messageContent = improvedTranscript;
        } else {
            messageContent = rawTranscript;
        }

        // Проверяем длину сообщения
        const fullMessage = withFormatting
            ? `${mode.emoji} *Режим: ${mode.name}*\n\n**Заголовок:**\n\`${title}\`\n\n**Расшифровка:**\n\`\`\`\n${messageContent}\n\`\`\``
            : `${mode.emoji} *Режим: ${mode.name}*\n\n**Расшифровка:**\n\`\`\`\n${messageContent}\n\`\`\``;

        let botReply;

        if (fullMessage.length > 4000) {
            // Если сообщение слишком длинное, отправляем его частями или файлом
            const filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
            const fileContent = withFormatting ? `Заголовок: ${title}\n\n${messageContent}` : messageContent;

            const tmpFilePath = `/tmp/${filename}`;
            await writeFile(tmpFilePath, fileContent, 'utf8');

            botReply = await ctx.replyWithDocument(
                { source: tmpFilePath, filename: filename },
                {
                    caption:
                        `${mode.emoji} *Режим: ${mode.name}*\n\n` +
                        (withFormatting ? `**Заголовок:** \`${title}\`\n\n` : '') +
                        `📄 Расшифровка слишком длинная, отправляю файлом.`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: voiceMessageId,
                    ...createTranscriptKeyboard(voiceMessageId),
                }
            );

            // Удаляем временный файл
            try {
                const fs = await import('fs/promises');
                await fs.unlink(tmpFilePath);
            } catch (err) {
                console.log('Не удалось удалить временный файл:', err.message);
            }
        } else {
            // Обычная отправка для коротких сообщений с кнопками
            botReply = await ctx.reply(fullMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: voiceMessageId,
                ...createTranscriptKeyboard(voiceMessageId),
            });
        }

        // Сохраняем в кэш для последующего использования
        const cacheId = `${ctx.chat.id}_${voiceMessageId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Голосовая заметка',
            content: messageContent,
            timestamp: new Date(),
            userId: ctx.from.id,
            mode: mode.name,
        });

        // Сохраняем связку с fileId
        botMessageToVoice.set(botReply.message_id, { voiceMessageId, fileId });

        // Автоматически удаляем из кэша через 30 минут
        setTimeout(() => {
            transcriptionCache.delete(cacheId);
        }, 30 * 60 * 1000);

        return botReply;
    } catch (error) {
        // Пытаемся удалить сообщение о загрузке в случае ошибки
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        } catch (deleteError) {
            console.log('Не удалось удалить сообщение о загрузке при ошибке:', deleteError.message);
        }
        throw error;
    }
}

// Обработчик кнопки "Добавить в заметку"
bot.action(/add_note_(.+)/, async (ctx) => {
    const voiceMessageId = ctx.match[1];
    const cacheId = `${ctx.chat.id}_${voiceMessageId}`;
    const transcriptionData = transcriptionCache.get(cacheId);

    if (!transcriptionData) {
        await ctx.answerCbQuery('❌ Расшифровка не найдена. Попробуйте заново.');
        return;
    }

    // Проверяем настройки Obsidian
    if (!OBSIDIAN_API_KEY) {
        await ctx.answerCbQuery('❌ API ключ Obsidian не настроен');
        await ctx.editMessageReplyMarkup();
        await ctx.reply('⚠️ Для работы с Obsidian необходимо настроить API ключ в файле .env:\nOBSIDIAN_API_KEY=ваш_ключ');
        return;
    }

    try {
        // Создаем заметку в Obsidian
        const result = await createObsidianNote(transcriptionData);

        if (result.success) {
            // Удаляем кнопки после успешного добавления
            await ctx.editMessageReplyMarkup();
            await ctx.answerCbQuery('✅ Заметка добавлена в Obsidian!');

            // Отправляем подтверждение
            const confirmMsg = await ctx.reply(`✅ Заметка сохранена в Obsidian!\n📁 Путь: \`${result.filepath}\``, { parse_mode: 'Markdown' });

            // Очищаем кэш
            transcriptionCache.delete(cacheId);
        } else {
            await ctx.answerCbQuery('❌ Ошибка при добавлении заметки');
            console.error('Ошибка Obsidian:', result.error);
        }
    } catch (error) {
        console.error('Ошибка при создании заметки:', error);
        await ctx.answerCbQuery('❌ Не удалось подключиться к Obsidian');
    }
});

// Обработчик кнопки "Оставить как голосовое"
bot.action(/keep_voice_(.+)/, async (ctx) => {
    const voiceMessageId = ctx.match[1];
    const cacheId = `${ctx.chat.id}_${voiceMessageId}`;

    // Просто удаляем кнопки
    await ctx.editMessageReplyMarkup();
    await ctx.answerCbQuery('👌 Оставлено как голосовое сообщение');

    // Очищаем кэш
    transcriptionCache.delete(cacheId);
});

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

// Команда для отметки начала диапазона удаления
bot.command(['del_start', 'delstart', 'ds'], async (ctx) => {
    const userId = ctx.from.id;

    // Проверяем, что это ответ на сообщение
    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, которое будет началом диапазона для удаления.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const startMessageId = ctx.message.reply_to_message.message_id;
    deleteRangeStart.set(userId, startMessageId);

    // Отправляем подтверждение и удаляем через несколько секунд
    const confirmMessage = await ctx.reply('✅ Начало диапазона отмечено. Теперь ответьте командой /del_end на последнее сообщение для удаления.', {
        reply_to_message_id: ctx.message.message_id,
    });

    // Удаляем команду пользователя
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

    // Удаляем подтверждение через 5 секунд
    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, confirmMessage.message_id);
        } catch (error) {
            console.error('Не удалось удалить подтверждение:', error);
        }
    }, 5000);
});

// Команда для отметки конца диапазона и удаления
bot.command(['del_end', 'delend', 'de'], async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    // Проверяем, что это ответ на сообщение
    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, которое будет концом диапазона для удаления.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    // Проверяем, есть ли сохраненное начало диапазона
    const startMessageId = deleteRangeStart.get(userId);
    if (!startMessageId) {
        await ctx.reply('⚠️ Сначала отметьте начало диапазона командой /del_start', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const endMessageId = ctx.message.reply_to_message.message_id;

    // Определяем правильный порядок (start должен быть меньше end)
    const fromId = Math.min(startMessageId, endMessageId);
    const toId = Math.max(startMessageId, endMessageId);

    // Отправляем сообщение о процессе удаления
    const progressMessage = await ctx.reply(`🗑️ Удаляю сообщения с ID ${fromId} по ${toId}...`);

    let deletedCount = 0;
    let failedCount = 0;

    // Удаляем сообщения в диапазоне
    for (let messageId = fromId; messageId <= toId; messageId++) {
        try {
            await ctx.telegram.deleteMessage(chatId, messageId);
            deletedCount++;

            // Небольшая задержка, чтобы не превысить лимиты API
            if (deletedCount % 10 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } catch (error) {
            // Сообщение может быть уже удалено или недоступно
            failedCount++;
        }
    }

    // Удаляем команду пользователя
    try {
        await ctx.telegram.deleteMessage(chatId, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

    // Очищаем сохраненное начало диапазона
    deleteRangeStart.delete(userId);

    // Обновляем сообщение о прогрессе
    try {
        await ctx.telegram.editMessageText(
            chatId,
            progressMessage.message_id,
            null,
            `✅ Удаление завершено!\n📊 Удалено: ${deletedCount} сообщений\n❌ Пропущено: ${failedCount} сообщений`
        );
    } catch (error) {
        console.error('Не удалось обновить сообщение о прогрессе:', error);
    }

    // Удаляем сообщение о результате через 5 секунд
    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(chatId, progressMessage.message_id);
        } catch (error) {
            console.error('Не удалось удалить сообщение о результате:', error);
        }
    }, 5000);
});

// Команда для удаления всех сообщений начиная с указанного (включая его)
bot.command(['del_all', 'delall', 'da'], async (ctx) => {
    const chatId = ctx.chat.id;

    // Проверяем, что это ответ на сообщение
    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, начиная с которого нужно удалить все сообщения.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const startMessageId = ctx.message.reply_to_message.message_id;
    const currentMessageId = ctx.message.message_id;

    // Отправляем сообщение о процессе удаления
    const progressMessage = await ctx.reply(`🗑️ Удаляю все сообщения начиная с ID ${startMessageId} (включительно)...`);

    let deletedCount = 0;
    let failedCount = 0;
    let consecutiveFailures = 0;

    // Удаляем сообщения начиная с указанного (включая его)
    // Устанавливаем разумный лимит попыток (например, +1000 сообщений от текущего)
    const maxMessageId = currentMessageId + 1000;

    for (let messageId = startMessageId; messageId <= maxMessageId; messageId++) {
        try {
            await ctx.telegram.deleteMessage(chatId, messageId);
            deletedCount++;
            consecutiveFailures = 0; // Сбрасываем счетчик неудач

            // Небольшая задержка, чтобы не превысить лимиты API
            if (deletedCount % 10 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } catch (error) {
            failedCount++;
            consecutiveFailures++;

            // Если много подряд неудачных попыток, возможно, достигли конца сообщений
            if (consecutiveFailures >= 50) {
                console.log(`Прекращаем удаление после ${consecutiveFailures} неудачных попыток подряд`);
                break;
            }
        }
    }

    // Удаляем команду пользователя
    try {
        await ctx.telegram.deleteMessage(chatId, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

    // Обновляем сообщение о прогрессе
    try {
        await ctx.telegram.editMessageText(
            chatId,
            progressMessage.message_id,
            null,
            `✅ Удаление завершено!\n📊 Удалено: ${deletedCount} сообщений\n❌ Пропущено: ${failedCount} сообщений\n📍 Начиная с сообщения ID: ${startMessageId}`
        );
    } catch (error) {
        console.error('Не удалось обновить сообщение о прогрессе:', error);
    }

    // Удаляем сообщение о результате через 7 секунд
    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(chatId, progressMessage.message_id);
        } catch (error) {
            console.error('Не удалось удалить сообщение о результате:', error);
        }
    }, 7000);
});

// Команда для отмены выбора начала диапазона
bot.command(['del_cancel', 'delcancel', 'dc'], async (ctx) => {
    const userId = ctx.from.id;

    if (deleteRangeStart.has(userId)) {
        deleteRangeStart.delete(userId);
        const msg = await ctx.reply('❌ Выбор диапазона для удаления отменен.');

        // Удаляем команду
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        } catch (error) {
            console.error('Не удалось удалить команду:', error);
        }

        // Удаляем подтверждение через 3 секунды
        setTimeout(async () => {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
            } catch (error) {
                console.error('Не удалось удалить подтверждение:', error);
            }
        }, 3000);
    } else {
        await ctx.reply('ℹ️ Нет активного выбора диапазона для удаления.');
    }
});

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
            `🗑️ \`/d\` или \`/del\` - удалить голосовое и расшифровку\n` +
            `📍 \`/del_start\` - отметить начало диапазона для удаления\n` +
            `📍 \`/del_end\` - отметить конец и удалить диапазон сообщений\n` +
            `🧹 \`/del_all\` - удалить все сообщения после указанного\n` +
            `❌ \`/del_cancel\` - отменить выбор диапазона\n` +
            `🆘 \`/help\` - показать эту справку\n` +
            `🏠 \`/start\` - начать работу с ботом\n\n` +
            `💡 *Режимы работы:*\n` +
            `${MODES.WITH_FORMAT.emoji} **С форматированием:** заголовок + улучшенный текст\n` +
            `${MODES.WITHOUT_FORMAT.emoji} **Без форматирования:** только чистая расшифровка\n\n` +
            `📝 *Obsidian интеграция:*\n` +
            `После расшифровки появятся кнопки для сохранения заметки в Obsidian\n\n` +
            `💬 *Совет:* Ответьте на расшифровку командой /format или /noformat, чтобы переобработать это же сообщение в другом режиме!\n\n` +
            `🗑️ *Удаление сообщений:*\n` +
            `• Диапазон: /del_start на первое → /del_end на последнее\n` +
            `• Все после: /del_all на сообщение → удалит все после него\n\n` +
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
    { command: 'del_start', description: 'Начало диапазона удаления 📍' },
    { command: 'del_end', description: 'Конец диапазона и удаление 📍' },
    { command: 'del_all', description: 'Удалить все после сообщения 🧹' },
    { command: 'del_cancel', description: 'Отменить выбор диапазона ❌' },
    { command: 'help', description: 'Справка по командам' },
]);

console.log('🤖 Бот запущен');
