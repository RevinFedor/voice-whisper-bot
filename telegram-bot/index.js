/*
 * ВАЖНО: Порядок определения обработчиков критичен!
 * 1. Сначала команды (bot.command) 
 * 2. Затем actions (bot.action)
 * 3. В конце общие обработчики (bot.on)
 * См. DEVELOPMENT_RULES.md для подробностей
 */

import { Telegraf, Markup } from 'telegraf';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { exec } from 'child_process';
const execPromise = promisify(exec);

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
    timeout: TIME_DELAY,
});

// Хранилища
const userPreferences = new Map();
const botMessageToVoice = new Map();
const deleteRangeStart = new Map();
const transcriptionCache = new Map();
const tagSelectionState = new Map(); // Для хранения состояния выбора тегов
const tagConfirmationState = new Map(); // Добавьте для хранения состояния подтверждения
const collectSessionState = new Map(); // Хранилище для активных сессий накопления сообщений
const completedSessionsMap = new Map(); // Хранилище для завершенных сессий (для удаления)
const messageHistory = new Map(); // История сообщений для удаления
const pendingMessages = new Map(); // Сообщения в процессе обработки (для обработки reply во время обработки)
const processedCallbacks = new Set(); // Для предотвращения повторной обработки callback queries

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
    const withFormatting = userPreferences.get(userId) === true;
    return withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;
}

// Функция для обработки автоматического старта коллекции при ответе
async function handleReplyAndStartCollection(ctx, userId, replyToMsg) {
    // Автоматически запускаем коллекцию
    const session = new CollectSession(userId, ctx.chat.id);
    collectSessionState.set(userId, session);
    
    // Проверяем, является ли это ответом на сообщение бота (расшифровку)
    if (replyToMsg.from?.is_bot) {
        // Ищем связанное исходное сообщение
        const voiceData = botMessageToVoice.get(replyToMsg.message_id);
        if (voiceData) {
            // Добавляем исходное голосовое сообщение в коллекцию
            const cacheId = `${ctx.chat.id}_${voiceData.voiceMessageId}`;
            const cachedData = transcriptionCache.get(cacheId);
            if (cachedData && cachedData.rawTranscript) {
                session.addMessage('voice', cachedData.rawTranscript, voiceData.voiceMessageId, voiceData.fileId);
            } else {
                session.addMessage('voice', null, voiceData.voiceMessageId, voiceData.fileId);
            }
            session.trackMessage(voiceData.voiceMessageId, 'user_content');
            session.trackMessage(replyToMsg.message_id, 'bot_response');
        }
    } else {
        // Это ответ на обычное сообщение пользователя
        const originalMsg = replyToMsg;
        const originalMsgId = originalMsg.message_id;
        
        // Проверяем, обрабатывается ли исходное сообщение
        const pendingKey = `${ctx.chat.id}_${originalMsgId}`;
        const pendingData = pendingMessages.get(pendingKey);
        if (pendingData) {
            // Сообщение еще обрабатывается, добавляем placeholder
            session.addMessage('pending', 'Сообщение в обработке...', originalMsgId, pendingData.fileId);
            session.trackMessage(originalMsgId, 'user_content');
            pendingData.collectSession = session; // Связываем с сессией для последующего обновления
        } else {
            // Сообщение уже обработано, добавляем как обычно
            if (originalMsg.voice) {
                session.addMessage('voice', null, originalMsg.message_id, originalMsg.voice.file_id);
                session.trackMessage(originalMsg.message_id, 'user_content');
            } else if (originalMsg.text) {
                session.addMessage('text', originalMsg.text, originalMsg.message_id);
                session.trackMessage(originalMsg.message_id, 'user_content');
            } else if (originalMsg.video) {
                session.addMessage('video', null, originalMsg.message_id, originalMsg.video.file_id);
                session.trackMessage(originalMsg.message_id, 'user_content');
            } else if (originalMsg.document) {
                const fileName = originalMsg.document.file_name || 'file';
                const fileExt = fileName.toLowerCase().split('.').pop();
                if (fileExt === 'mp4') {
                    session.addMessage('document', null, originalMsg.message_id, originalMsg.document.file_id);
                    session.trackMessage(originalMsg.message_id, 'user_content');
                }
            }
        }
    }
    
    // Уведомляем о начале коллекции
    const notification = await ctx.reply(`🔄 Автоматически начата коллекция сообщений\n\nОтправляйте сообщения для добавления или используйте /done для завершения`);
    session.trackMessage(notification.message_id, 'bot_notification');
    
    return session;
}

// Класс для управления сессией накопления
class CollectSession {
    constructor(userId, chatId) {
        this.userId = userId;
        this.chatId = chatId;
        this.messages = [];
        this.textCount = 0;
        this.voiceCount = 0;
        this.photoCount = 0;
        this.videoCount = 0;
        this.documentCount = 0;
        this.startTime = new Date();
        this.statusMessageId = null;
        this.timeoutTimer = null;
        // Для отслеживания всех сообщений сессии (для удаления)
        this.allMessageIds = [];
    }

    addMessage(type, content, messageId, fileId = null) {
        this.messages.push({
            type,
            content,
            messageId,
            fileId,
            timestamp: new Date()
        });

        switch(type) {
            case 'text':
                this.textCount++;
                break;
            case 'voice':
                this.voiceCount++;
                break;
            case 'photo':
                this.photoCount++;
                break;
            case 'video':
                this.videoCount++;
                break;
            case 'document':
                this.documentCount++;
                break;
        }

        this.resetTimeout();
    }

    // Метод для отслеживания всех сообщений сессии
    trackMessage(messageId, messageType) {
        this.allMessageIds.push({
            id: messageId,
            type: messageType, // 'user_command', 'bot_status', 'user_content', 'bot_response', 'final_result'
            timestamp: new Date()
        });
        console.log(`📌 Отслеживаю сообщение: ID=${messageId}, тип=${messageType}, всего=${this.allMessageIds.length}`);
    }

    getTotalCount() {
        return this.messages.length;
    }

    getStatusText() {
        const parts = [];
        if (this.textCount > 0) parts.push(`${this.textCount} текстовых`);
        if (this.voiceCount > 0) parts.push(`${this.voiceCount} голосовых`);
        if (this.photoCount > 0) parts.push(`${this.photoCount} фото`);
        if (this.videoCount > 0) parts.push(`${this.videoCount} видео`);
        if (this.documentCount > 0) parts.push(`${this.documentCount} документов`);
        
        if (parts.length === 0) return 'нет сообщений';
        return parts.join(', ');
    }

    resetTimeout() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
    }

    clear() {
        this.messages = [];
        this.textCount = 0;
        this.voiceCount = 0;
        this.photoCount = 0;
        this.videoCount = 0;
        this.documentCount = 0;
        this.allMessageIds = [];
        this.resetTimeout();
    }
}

// Функция для улучшения читаемости текста без изменения слов
async function improveReadability(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
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
        return text;
    }
}

// Функция для создания заголовка к тексту расшифровки
async function createTitle(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
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

        return response.choices[0].message.content.trim().replace(/"/g, '');
    } catch (error) {
        console.error('Ошибка при создании заголовка:', error);
        return 'Заметка';
    }
}

// Функция для получения всех тегов из Obsidian
async function getObsidianTags() {
    try {
        // Получаем все файлы с тегами через поиск
        const response = await axios.post(
            `${OBSIDIAN_URL}/search/`,
            {
                '!=': [{ var: 'tags' }, []],
            },
            {
                headers: {
                    Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
                    'Content-Type': 'application/vnd.olrapi.jsonlogic+json',
                },
            }
        );

        const allTags = new Set();

        // Для каждого файла получаем его метаданные
        if (response.data && Array.isArray(response.data)) {
            for (const item of response.data) {
                if (item.filename && item.filename.endsWith('.md')) {
                    try {
                        const fileResponse = await axios.get(`${OBSIDIAN_URL}/vault/${encodeURIComponent(item.filename)}`, {
                            headers: {
                                Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
                                Accept: 'application/vnd.olrapi.note+json',
                            },
                        });

                        if (fileResponse.data && fileResponse.data.tags) {
                            fileResponse.data.tags.forEach((tag) => {
                                if (tag && tag !== 'tg-transcript') {
                                    allTags.add(tag);
                                }
                            });
                        }
                    } catch (e) {
                        // Пропускаем файлы с ошибками
                    }
                }
            }
        }

        return Array.from(allTags).sort();
    } catch (error) {
        console.error('Ошибка при получении тегов:', error);
        return [];
    }
}
// Функция для извлечения тегов из голосового сообщения
async function extractTagsFromVoice(voiceText, availableTags) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Извлеки теги из голосового сообщения и раздели их на существующие и новые.
Существующие теги в системе: ${availableTags.join(', ')}

Правила извлечения:
1. Извлеки ВСЕ упомянутые в сообщении теги
2. Раздели их на две группы:
   - existing: теги которые ТОЧНО есть в списке существующих (с учетом регистра)
   - new: новые теги которых НЕТ в списке существующих
3. Если пользователь говорит "тег" перед словами - объедини их в один тег с подчеркиванием
4. Слова "подчеркивание", "нижнее подчеркивание", "через черточку" - объедини предыдущее и следующее слово
5. Новые теги форматируй в snake_case (только латиница, цифры и подчеркивания)
6. Убирай из тегов символ # если он есть

Примеры:
- "личное" и есть тег "personal" → existing: ["personal"], new: []
- "тег личностное развитие" → new: ["личностное_развитие"]
- "личностное подчеркивание развитие" → new: ["личностное_развитие"]
- "новый проект" → new: ["новый_проект"]

Верни ТОЛЬКО валидный JSON в формате:
{"existing": ["tag1", "tag2"], "new": ["new_tag1", "new_tag2"]}`,
                },
                {
                    role: 'user',
                    content: voiceText,
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0].message.content);
        
        // Гарантируем правильную структуру
        return {
            existing: Array.isArray(result.existing) ? result.existing : [],
            new: Array.isArray(result.new) ? result.new : []
        };
    } catch (error) {
        console.error('Ошибка при извлечении тегов:', error);
        return { existing: [], new: [] };
    }
}

async function showTagConfirmation(ctx, selectedTags, transcriptionData, voiceMessageId, availableTags) {
    const { existing, new: newTags } = selectedTags;
    
    // Получаем данные из tagSelectionState
    const tagState = tagSelectionState.get(ctx.from.id);
    const tagSelectionMsgId = tagState ? tagState.tagSelectionMsgId : null;
    const botMessageId = tagState ? tagState.botMessageId : null; // добавляем
    
    let confirmMessage = '✅ **Выбранные теги:**\n\n';
    
    // Показываем существующие теги
    confirmMessage += '📌 **Существующие теги:**\n';
    if (existing.length > 0) {
        confirmMessage += existing.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ');
    } else {
        confirmMessage += '_нет_';
    }
    
    // Показываем новые теги
    confirmMessage += '\n\n🆕 **Новые теги:**\n';
    if (newTags.length > 0) {
        confirmMessage += newTags.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ');
    } else {
        confirmMessage += '_нет_';
    }
    
    confirmMessage += '\n\n❓ Добавить заметку с этими тегами?';
    confirmMessage += '\n\n💬 Или отправьте новое голосовое для изменения тегов';

    const confirmMsg = await ctx.reply(confirmMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ Да, добавить', `confirm_tags_${voiceMessageId}`)]]),
    });

    // Объединяем все теги для сохранения
    const allTags = [...existing, ...newTags];
    
    tagConfirmationState.set(ctx.from.id, {
        selectedTags: allTags, // сохраняем объединенный список для createObsidianNote
        selectedTagsStructured: selectedTags, // сохраняем структурированный объект для отображения
        transcriptionData,
        voiceMessageId,
        confirmMsgId: confirmMsg.message_id,
        availableTags,
        tagSelectionMsgId: tagSelectionMsgId, // добавляем сюда
        botMessageId: botMessageId // добавляем
    });
}

// Функция для получения рекомендаций тегов от AI
async function getTagRecommendations(text, availableTags) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Проанализируй текст и предложи теги.
Доступные теги: ${availableTags.join(', ')}

ВАЖНОЕ ПРАВИЛО: Если тег состоит из нескольких слов, используй нижнее подчеркивание между словами.

СТРОГО раздели теги на две категории:
1. existing - ТОЛЬКО теги, которые точно есть в списке доступных тегов
2. new - ТОЛЬКО новые теги, которых НЕТ в списке доступных

Верни ТОЛЬКО валидный JSON, ничего больше!
{"existing": ["тег1", "тег2"], "new": ["новый_тег1", "новый_тег2"]}`,
                },
                {
                    role: 'user',
                    content: text,
                },
            ],
            response_format: { type: 'json_object' }, // Форсируем JSON ответ
        });

        const result = JSON.parse(response.choices[0].message.content);

        // Гарантируем нужную структуру
        return {
            existing: Array.isArray(result.existing) ? result.existing : [],
            new: Array.isArray(result.new) ? result.new : [],
        };
    } catch (error) {
        console.error('Ошибка при получении рекомендаций тегов:', error);
        return { existing: [], new: [] };
    }
}

// Функция для создания inline keyboard
function createTranscriptKeyboard(messageId, isCollect = false) {
    if (isCollect) {
        // Для накопленных заметок
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('📝 Добавить в Obsidian', `add_note_combined_${messageId}`),
                Markup.button.callback('🗑️ Удалить всё', `delete_collect_${messageId}`)
            ]
        ]);
    } else {
        // Для обычных сообщений
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('📝 Добавить в заметку', `add_note_${messageId}`),
                Markup.button.callback('🗑️', `delete_msg_${messageId}`)
            ]
        ]);
    }
}

// Функция для отправки заметки в Obsidian
async function createObsidianNote(data, selectedTags = []) {
    try {
        const date = new Date(data.timestamp);
        const filename = `${data.title}.md`;
        const filepath = `${OBSIDIAN_FOLDER}/${filename}`;

        const formattedDate = date.toISOString().slice(0, 16).replace('T', ' ');

        // Объединяем теги
        const allTags = ['tg-transcript', ...selectedTags];

        const content = `---
title: "${data.title}"
date: ${formattedDate}
tags: [${allTags.join(', ')}]
source: telegram-voice
mode: ${data.mode}
---

${data.content}`;

        const response = await axios.put(`${OBSIDIAN_URL}/vault/${encodeURIComponent(filepath)}`, content, {
            headers: {
                Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
                'Content-Type': 'text/markdown',
            },
        });

        return { success: true, filepath, tags: selectedTags };
    } catch (error) {
        console.error('Ошибка при создании заметки в Obsidian:', error);
        return { success: false, error: error.message };
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

// Обновленная функция processVoice
async function processVoice(ctx, fileId, voiceMessageId, withFormatting, pendingKey = null) {
    const mode = withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;

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
            // Автоопределение языка
        });

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
            // Создаем заголовок даже для неформатированного текста
            title = await createTitle(rawTranscript);
            messageContent = rawTranscript;
        }

        const fullMessage = `${mode.emoji} *Режим: ${mode.name}*\n\n**Заголовок:**\n\`${title}\`\n\n**Расшифровка:**\n\`\`\`\n${messageContent}\n\`\`\``;

        let botReply;

        if (fullMessage.length > 4000) {
            const filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
            const fileContent = `Заголовок: ${title}\n\n${messageContent}`;

            const tmpFilePath = `/tmp/${filename}`;
            await writeFile(tmpFilePath, fileContent, 'utf8');

            botReply = await ctx.replyWithDocument(
                { source: tmpFilePath, filename: filename },
                {
                    caption:
                        `${mode.emoji} *Режим: ${mode.name}*\n\n` +
                        `**Заголовок:** \`${title}\`\n\n` +
                        `📄 Расшифровка слишком длинная, отправляю файлом.`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: voiceMessageId,
                    ...createTranscriptKeyboard(voiceMessageId),
                }
            );

            try {
                const fs = await import('fs/promises');
                await fs.unlink(tmpFilePath);
            } catch (err) {
                console.log('Не удалось удалить временный файл:', err.message);
            }
        } else {
            botReply = await ctx.reply(fullMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: voiceMessageId,
                ...createTranscriptKeyboard(voiceMessageId),
            });
        }

        const cacheId = `${ctx.chat.id}_${voiceMessageId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Голосовая заметка',
            content: messageContent,
            timestamp: new Date(),
            userId: ctx.from.id,
            mode: mode.name,
        });

        botMessageToVoice.set(botReply.message_id, { voiceMessageId, fileId });
        
        // Сохраняем историю сообщений для удаления
        messageHistory.set(botReply.message_id, {
            userMessageId: voiceMessageId,
            botMessageIds: [loadingMessage.message_id], // если не удалилось
            type: 'voice'
        });

        setTimeout(() => {
            transcriptionCache.delete(cacheId);
            messageHistory.delete(botReply.message_id);
        }, 30 * 60 * 1000);
        
        // Проверяем, есть ли ожидающая коллекция для этого сообщения
        if (pendingKey) {
            const pendingData = pendingMessages.get(pendingKey);
            if (pendingData && pendingData.collectSession) {
                // Обновляем сообщение в коллекции с реальной расшифровкой
                const session = pendingData.collectSession;
                const msgIndex = session.messages.findIndex(m => m.messageId === voiceMessageId);
                if (msgIndex !== -1) {
                    session.messages[msgIndex].type = 'voice';
                    session.messages[msgIndex].content = rawTranscript; // Сохраняем оригинальную расшифровку
                }
            }
            // Удаляем из pending
            pendingMessages.delete(pendingKey);
        }

        return botReply;
    } catch (error) {
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

    if (!OBSIDIAN_API_KEY) {
        await ctx.answerCbQuery('❌ API ключ Obsidian не настроен');
        await ctx.editMessageReplyMarkup();
        await ctx.reply('⚠️ Для работы с Obsidian необходимо настроить API ключ в файле .env:\nOBSIDIAN_API_KEY=ваш_ключ');
        return;
    }

    await ctx.answerCbQuery('🔍 Загружаю теги...');

    try {
        const availableTags = await getObsidianTags();

        // Получаем рекомендации тегов
        const recommendations = await getTagRecommendations(transcriptionData.content, availableTags);

        let tagsMessage = '📋 **Доступные теги:**\n';
        if (availableTags.length > 0) {
            tagsMessage += availableTags.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ');
        } else {
            tagsMessage += '_Теги не найдены_';
        }

        // Добавляем рекомендации
        tagsMessage += '\n\n🤖 **Рекомендуемые теги:**';
        if (recommendations.existing.length > 0) {
            tagsMessage += `\nИз существующих: ${recommendations.existing.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ')}`;
        }
        if (recommendations.new.length > 0) {
            tagsMessage += `\nНовые: ${recommendations.new.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ')}`;
        }

        tagsMessage += '\n\n💬 Отправьте ГС или текст с нужными тегами';

        const tagSelectionMsg = await ctx.reply(tagsMessage, {
            parse_mode: 'Markdown',
        });

        tagSelectionState.set(ctx.from.id, {
            voiceMessageId,
            transcriptionData,
            tagSelectionMsgId: tagSelectionMsg.message_id,
            availableTags,
            botMessageId: ctx.callbackQuery.message.message_id // добавляем
        });
    } catch (error) {
        console.error('Ошибка при загрузке тегов:', error);
        await ctx.reply('❌ Не удалось загрузить теги. Добавляю заметку без тегов...');

        const result = await createObsidianNote(transcriptionData);
        if (result.success) {
            await ctx.editMessageReplyMarkup();
            await ctx.reply(`✅ Заметка сохранена в Obsidian!\n📝 ${transcriptionData.title}`, {
                parse_mode: 'Markdown',
            });
            transcriptionCache.delete(cacheId);
        }
    }
});

// Функция для извлечения аудио из MP4
async function extractAudioFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(outputPath)
            .audioCodec('libopus')
            .format('ogg')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

// Функция обработки видео файлов
async function processVideo(ctx, fileId, videoMessageId, withFormatting, fileSize = 0, pendingKey = null) {
    const mode = withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;
    
    // Проверяем размер файла (Telegram API ограничение - 20 МБ)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ в байтах
    
    if (fileSize > MAX_FILE_SIZE) {
        await ctx.reply(
            '⚠️ *Файл слишком большой*\n\n' +
            `📊 Размер вашего файла: ${(fileSize / 1024 / 1024).toFixed(1)} МБ\n` +
            `📏 Максимальный размер: 20 МБ\n\n` +
            '💡 *Что делать:*\n' +
            '1. Сожмите видео перед отправкой\n' +
            '2. Обрежьте видео на части\n' +
            '3. Используйте более низкое качество\n' +
            '4. Отправьте только аудиодорожку',
            { 
                parse_mode: 'Markdown',
                reply_to_message_id: videoMessageId 
            }
        );
        return null;
    }

    const loadingMessage = await ctx.reply(`${mode.emoji} ⏳ Извлекаю аудио из видео и обрабатываю в режиме "${mode.name}"...`, {
        reply_to_message_id: videoMessageId,
    });

    try {
        const link = await ctx.telegram.getFileLink(fileId);
        const res = await fetch(link.href);
        const buffer = await res.arrayBuffer();
        const videoPath = `/tmp/${uuid()}.mp4`;
        const audioPath = `/tmp/${uuid()}.ogg`;
        
        await writeFile(videoPath, Buffer.from(buffer));
        
        // Извлекаем аудио из видео
        await extractAudioFromVideo(videoPath, audioPath);
        
        // Удаляем временный видео файл
        await unlink(videoPath);

        const rawTranscript = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: createReadStream(audioPath),
            response_format: 'text',
            // Автоопределение языка
        });
        
        // Удаляем временный аудио файл
        await unlink(audioPath);

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
            title = await createTitle(rawTranscript);
            messageContent = rawTranscript;
        }

        const fullMessage = `${mode.emoji} *Режим: ${mode.name}*\n🎥 *Источник: видео*\n\n**Заголовок:**\n\`${title}\`\n\n**Расшифровка:**\n\`\`\`\n${messageContent}\n\`\`\``;

        let botReply;

        if (fullMessage.length > 4000) {
            const filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
            const fileContent = `Заголовок: ${title}\n\n${messageContent}`;

            const tmpFilePath = `/tmp/${filename}`;
            await writeFile(tmpFilePath, fileContent, 'utf8');

            botReply = await ctx.replyWithDocument(
                { source: tmpFilePath, filename: filename },
                {
                    caption:
                        `${mode.emoji} *Режим: ${mode.name}*\n🎥 *Источник: видео*\n\n` +
                        `**Заголовок:** \`${title}\`\n\n` +
                        `📄 Расшифровка слишком длинная, отправляю файлом.`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: videoMessageId,
                    ...createTranscriptKeyboard(videoMessageId),
                }
            );

            await unlink(tmpFilePath);
        } else {
            botReply = await ctx.reply(fullMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: videoMessageId,
                ...createTranscriptKeyboard(videoMessageId),
            });
        }

        const cacheId = `${ctx.chat.id}_${videoMessageId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Видео заметка',
            content: messageContent,
            timestamp: new Date(),
            userId: ctx.from.id,
            mode: mode.name,
        });

        botMessageToVoice.set(botReply.message_id, { voiceMessageId: videoMessageId, fileId });

        setTimeout(() => {
            transcriptionCache.delete(cacheId);
        }, 30 * 60 * 1000);
        
        // Проверяем, есть ли ожидающая коллекция для этого сообщения
        if (pendingKey) {
            const pendingData = pendingMessages.get(pendingKey);
            if (pendingData && pendingData.collectSession) {
                // Обновляем сообщение в коллекции с реальной расшифровкой
                const session = pendingData.collectSession;
                const msgIndex = session.messages.findIndex(m => m.messageId === videoMessageId);
                if (msgIndex !== -1) {
                    session.messages[msgIndex].type = 'video';
                    session.messages[msgIndex].content = rawTranscript; // Сохраняем оригинальную расшифровку
                }
            }
            // Удаляем из pending
            pendingMessages.delete(pendingKey);
        }

        return botReply;
    } catch (error) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        } catch (deleteError) {
            console.log('Не удалось удалить сообщение о загрузке при ошибке:', deleteError.message);
        }
        throw error;
    }
}

// ============= КОМАНДЫ НАКОПЛЕНИЯ =============
// ВАЖНО: Команды должны быть определены ДО обработчиков сообщений!

// Команда для начала сессии накопления
bot.command(['collect', 'заметка'], async (ctx) => {
    console.log('📝 Команда /collect вызвана пользователем:', ctx.from.username || ctx.from.id);
    const userId = ctx.from.id; // Это число!
    const chatId = ctx.chat.id;
    
    // Проверяем, есть ли уже активная сессия
    if (collectSessionState.has(userId)) {
        await ctx.reply(
            '⚠️ У вас уже есть активная сессия накопления сообщений.\n\n' +
            'Используйте:\n' +
            '• `/done` или `/готово` - завершить и обработать\n' +
            '• `/cancel` или `/отмена` - отменить накопление\n' +
            '• `/status` - посмотреть статус',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Создаем новую сессию
    const session = new CollectSession(userId, chatId);
    collectSessionState.set(userId, session);
    
    // Отслеживаем команду /collect
    session.trackMessage(ctx.message.message_id, 'user_command');
    
    const statusMsg = await ctx.reply(
        '📝 *Режим накопления активирован*\n\n' +
        'Отправляйте сообщения (голосовые, текст, фото, видео).\n' +
        'Каждое сообщение будет добавлено в общую заметку.\n\n' +
        '📊 Сообщений: 0\n\n' +
        'Команды:\n' +
        '• `/done` - завершить и обработать все сообщения\n' +
        '• `/cancel` - отменить накопление\n' +
        '• `/status` - текущий статус',
        { parse_mode: 'Markdown' }
    );
    
    session.statusMessageId = statusMsg.message_id;
    session.trackMessage(statusMsg.message_id, 'bot_status');
    
    // Устанавливаем таймер на 5 минут
    session.timeoutTimer = setTimeout(async () => {
        if (collectSessionState.has(userId)) {
            await ctx.telegram.sendMessage(
                ctx.chat.id,
                '⚠️ Режим накопления будет автоматически завершен через 1 минуту из-за неактивности.\n' +
                'Отправьте сообщение чтобы продолжить или `/done` чтобы завершить сейчас.'
            );
            
            // Финальный таймер на 1 минуту
            session.timeoutTimer = setTimeout(async () => {
                if (collectSessionState.has(userId) && collectSessionState.get(userId) === session) {
                    collectSessionState.delete(userId);
                    await ctx.telegram.sendMessage(
                        ctx.chat.id,
                        '❌ Режим накопления отменен из-за неактивности.'
                    );
                }
            }, 60000); // 1 минута
        }
    }, 300000); // 5 минут
});

// Команда для завершения накопления и обработки
bot.command(['done', 'готово'], async (ctx) => {
    const userId = ctx.from.id;
    const session = collectSessionState.get(userId);
    
    if (!session) {
        await ctx.reply('ℹ️ Нет активного режима накопления.\nИспользуйте `/collect` чтобы начать.');
        return;
    }
    
    if (session.getTotalCount() === 0) {
        await ctx.reply('⚠️ Нет сообщений для обработки. Добавьте хотя бы одно сообщение.');
        return;
    }
    
    // Отслеживаем команду /done
    session.trackMessage(ctx.message.message_id, 'user_command');
    
    // Очищаем таймер
    session.resetTimeout();
    
    const processingMsg = await ctx.reply(
        `⏳ Обрабатываю ${session.getTotalCount()} сообщений...\n` +
        `📊 ${session.getStatusText()}`,
        { parse_mode: 'Markdown' }
    );
    
    session.trackMessage(processingMsg.message_id, 'bot_status');
    
    try {
        // Объединяем все сообщения
        let combinedText = '';
        const withFormatting = userPreferences.get(userId) === true;
        
        for (const msg of session.messages) {
            if (msg.type === 'pending') {
                // Пропускаем pending сообщения или обрабатываем как нераспознанное
                combinedText += '[Сообщение не успело обработаться]\n\n';
            } else if (msg.type === 'text') {
                combinedText += msg.content + '\n\n';
            } else if (msg.type === 'voice') {
                if (msg.content) {
                    // Уже есть расшифровка (сообщение было обработано)
                    combinedText += msg.content + '\n\n';
                } else if (msg.fileId) {
                    // Расшифровываем голосовое
                    const link = await ctx.telegram.getFileLink(msg.fileId);
                    const res = await fetch(link.href);
                    const buffer = await res.arrayBuffer();
                    const tmpPath = `/tmp/${uuid()}.ogg`;
                    await writeFile(tmpPath, Buffer.from(buffer));
                    
                    const transcript = await openai.audio.transcriptions.create({
                        model: 'whisper-1',
                        file: createReadStream(tmpPath),
                        response_format: 'text',
                    });
                    
                    await unlink(tmpPath);
                    combinedText += transcript + '\n\n';
                }
            } else if ((msg.type === 'video' || msg.type === 'audio') && msg.fileId) {
                // Обрабатываем видео/аудио - извлекаем аудио и расшифровываем
                try {
                    const link = await ctx.telegram.getFileLink(msg.fileId);
                    const res = await fetch(link.href);
                    const buffer = await res.arrayBuffer();
                    
                    let audioPath = `/tmp/${uuid()}.ogg`;
                    
                    if (msg.type === 'video') {
                        const videoPath = `/tmp/${uuid()}.mp4`;
                        await writeFile(videoPath, Buffer.from(buffer));
                        await extractAudioFromVideo(videoPath, audioPath);
                        await unlink(videoPath);
                    } else {
                        // Для аудио - конвертируем если нужно
                        const inputPath = `/tmp/${uuid()}_audio`;
                        await writeFile(inputPath, Buffer.from(buffer));
                        
                        await new Promise((resolve, reject) => {
                            ffmpeg(inputPath)
                                .audioCodec('libopus')
                                .format('ogg')
                                .save(audioPath)
                                .on('end', resolve)
                                .on('error', reject);
                        });
                        await unlink(inputPath);
                    }
                    
                    const transcript = await openai.audio.transcriptions.create({
                        model: 'whisper-1',
                        file: createReadStream(audioPath),
                        response_format: 'text',
                    });
                    
                    await unlink(audioPath);
                    combinedText += transcript + '\n\n';
                } catch (err) {
                    console.error(`Ошибка обработки ${msg.type}:`, err);
                }
            }
            // Фото пропускаем - можно добавить OCR если нужно
        }
        
        // Обрабатываем объединенный текст
        let finalContent = combinedText.trim();
        let title = '';
        
        if (withFormatting) {
            finalContent = await improveReadability(finalContent);
        }
        
        title = await createTitle(finalContent);
        
        // Удаляем сообщение о процессинге
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Отправляем результат
        const mode = getUserMode(userId);
        const fullMessage = 
            `${mode.emoji} *Обработанная заметка*\n` +
            `📊 Объединено сообщений: ${session.getTotalCount()}\n\n` +
            `**Заголовок:**\n\`${title}\`\n\n` +
            `**Содержание:**\n\`\`\`\n${finalContent}\n\`\`\``;
        
        let botReply;
        
        if (fullMessage.length > 4000) {
            const filename = `combined_note_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
            const fileContent = `Заголовок: ${title}\n\nОбъединено сообщений: ${session.getTotalCount()}\n${session.getStatusText()}\n\n${finalContent}`;
            
            const tmpFilePath = `/tmp/${filename}`;
            await writeFile(tmpFilePath, fileContent, 'utf8');
            
            botReply = await ctx.replyWithDocument(
                { source: tmpFilePath, filename: filename },
                {
                    caption:
                        `${mode.emoji} *Обработанная заметка*\n` +
                        `📊 Объединено: ${session.getTotalCount()} (${session.getStatusText()})\n\n` +
                        `**Заголовок:** \`${title}\`\n\n` +
                        `📄 Заметка слишком длинная, отправляю файлом.`,
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback('📝 Добавить в Obsidian', `add_note_combined_${userId}`),
                            Markup.button.callback('🗑️ Удалить всё', `delete_collect_${userId}`)
                        ]
                    ])
                }
            );
            
            await unlink(tmpFilePath);
        } else {
            botReply = await ctx.reply(fullMessage, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('📝 Добавить в Obsidian', `add_note_combined_${userId}`),
                        Markup.button.callback('🗑️ Удалить всё', `delete_collect_${userId}`)
                    ]
                ])
            });
        }
        
        // Отслеживаем финальное сообщение
        session.trackMessage(botReply.message_id, 'final_result');
        
        // Сохраняем в кэш для возможности добавления в Obsidian
        const cacheId = `${ctx.chat.id}_combined_${userId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Объединенная заметка',
            content: finalContent,
            timestamp: new Date(),
            userId: userId,
            mode: mode.name,
            messagesCount: session.getTotalCount(),
            messagesInfo: session.getStatusText()
        });
        
        // ВАЖНО: Удаляем сессию сразу после завершения обработки
        collectSessionState.delete(userId);
        
        // Но сохраняем сессию в отдельном хранилище для удаления сообщений
        completedSessionsMap.set(userId, session);
        
        setTimeout(() => {
            transcriptionCache.delete(cacheId);
            // Удаляем завершенную сессию из временного хранилища
            completedSessionsMap.delete(userId);
        }, 30 * 60 * 1000);
        
    } catch (error) {
        console.error('Ошибка при обработке накопленных сообщений:', error);
        await ctx.reply('❌ Произошла ошибка при обработке сообщений.');
    }
    
    // НЕ удаляем сессию сразу, она нужна для удаления истории!
    // Она будет удалена после удаления истории или через таймаут (30 минут)
});

// Команда отмены накопления  
bot.command(['cancel', 'отмена'], async (ctx) => {
    const userId = ctx.from.id;
    const session = collectSessionState.get(userId);
    
    if (!session) {
        await ctx.reply('ℹ️ Нет активного режима накопления.');
        return;
    }
    
    session.resetTimeout();
    const count = session.getTotalCount();
    collectSessionState.delete(userId);
    
    await ctx.reply(
        `❌ *Режим накопления отменен*\n\n` +
        `Удалено из очереди: ${count} сообщений`,
        { parse_mode: 'Markdown' }
    );
});

// Команда просмотра статуса
bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const session = collectSessionState.get(userId);
    
    if (!session) {
        await ctx.reply('ℹ️ Нет активного режима накопления.\nИспользуйте `/collect` чтобы начать.');
        return;
    }
    
    const elapsed = Math.floor((new Date() - session.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    await ctx.reply(
        `📊 *Статус накопления*\n\n` +
        `📝 Сообщений в очереди: ${session.getTotalCount()}\n` +
        `📋 Детали: ${session.getStatusText()}\n` +
        `⏱️ Время сессии: ${minutes}:${seconds.toString().padStart(2, '0')}\n\n` +
        `Команды:\n` +
        `• `/done` - завершить и обработать\n` +
        `• `/cancel` - отменить накопление`,
        { parse_mode: 'Markdown' }
    );
});

// ============= КОНЕЦ КОМАНД НАКОПЛЕНИЯ =============

// Обработчик видео сообщений (MP4)
bot.on('video', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем, является ли сообщение ответом на другое сообщение
    if (ctx.message.reply_to_message && !collectSessionState.has(userId)) {
        await handleReplyAndStartCollection(ctx, userId, ctx.message.reply_to_message);
    }
    
    // Проверяем режим накопления
    const collectSession = collectSessionState.get(userId);
    if (collectSession) {
        const video = ctx.message.video;
        collectSession.addMessage('video', null, ctx.message.message_id, video.file_id);
        
        // Отслеживаем сообщение пользователя
        collectSession.trackMessage(ctx.message.message_id, 'user_content');
        
        const messageIndex = collectSession.getTotalCount();
        const replyMsg = await ctx.reply(
            `🎥 Добавлено видео #${messageIndex}\n` +
            `📊 Всего сообщений: ${collectSession.getTotalCount()}`,
            { reply_to_message_id: ctx.message.message_id }
        );
        
        // Отслеживаем ответ бота
        collectSession.trackMessage(replyMsg.message_id, 'bot_response');
        
        return;
    }
    
    // Проверяем что это MP4 файл
    const video = ctx.message.video;
    const mimeType = video.mime_type;
    const fileSize = video.file_size || 0;
    
    if (mimeType && mimeType.includes('mp4')) {
        try {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`📹 Получено видео MP4 от пользователя ${username} (ID: ${userId}), размер: ${(fileSize / 1024 / 1024).toFixed(1)} МБ`);

            const withFormatting = userPreferences.get(userId) === true;
            const fileId = video.file_id;
            const videoMessageId = ctx.message.message_id;
            
            // Отмечаем сообщение как обрабатываемое
            const pendingKey = `${ctx.chat.id}_${videoMessageId}`;
            pendingMessages.set(pendingKey, {
                type: 'video',
                fileId: video.file_id,
                userId: userId,
                chatId: ctx.chat.id,
                startTime: new Date()
            });

            const botReply = await processVideo(ctx, fileId, videoMessageId, withFormatting, fileSize, pendingKey);
            
            if (botReply) {
                const mode = getUserMode(userId);
                console.log(`✅ Обработано видео от ${username} в режиме ${mode.name}`);
            }
        } catch (err) {
            console.error(err);
            // Удаляем из pending при ошибке
            pendingMessages.delete(pendingKey);
            
            if (err.response && err.response.description === 'Bad Request: file is too big') {
                await ctx.reply(
                    '❌ *Файл слишком большой для обработки*\n\n' +
                    '📏 Telegram API позволяет ботам загружать файлы до 20 МБ.\n' +
                    '💡 Попробуйте сжать видео или отправить его частями.',
                    { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
                );
            } else {
                await ctx.reply('❌ Не удалось извлечь и расшифровать аудио из видео.');
            }
        }
    } else {
        await ctx.reply('⚠️ Поддерживаются только MP4 файлы. Пожалуйста, отправьте видео в формате MP4.');
    }
});

// Функция обработки аудио файлов
async function processAudioFile(ctx, fileId, messageId, withFormatting, fileName = 'audio') {
    const mode = withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;
    
    const loadingMessage = await ctx.reply(
        `${mode.emoji} ⏳ Обрабатываю аудио файл "${fileName}"...`,
        { reply_to_message_id: messageId }
    );
    
    try {
        const link = await ctx.telegram.getFileLink(fileId);
        const res = await fetch(link.href);
        const buffer = await res.arrayBuffer();
        
        // Сохраняем временный файл
        const inputPath = `/tmp/${uuid()}_${fileName}`;
        await writeFile(inputPath, Buffer.from(buffer));
        
        // Конвертируем в OGG для Whisper если нужно
        let audioPath = inputPath;
        if (!fileName.toLowerCase().endsWith('.ogg')) {
            audioPath = `/tmp/${uuid()}.ogg`;
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioCodec('libopus')
                    .format('ogg')
                    .save(audioPath)
                    .on('end', resolve)
                    .on('error', reject);
            });
            await unlink(inputPath);
        }
        
        const rawTranscript = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: createReadStream(audioPath),
            response_format: 'text',
            // Автоопределение языка
        });
        
        await unlink(audioPath);
        
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        } catch (e) {}
        
        let messageContent;
        let title = '';
        
        if (withFormatting) {
            const improvedTranscript = await improveReadability(rawTranscript);
            title = await createTitle(improvedTranscript);
            messageContent = improvedTranscript;
        } else {
            title = await createTitle(rawTranscript);
            messageContent = rawTranscript;
        }
        
        const fullMessage = 
            `${mode.emoji} *Режим: ${mode.name}*\n` +
            `🎵 *Аудио файл: ${fileName}*\n\n` +
            `**Заголовок:**\n\`${title}\`\n\n` +
            `**Расшифровка:**\n\`\`\`\n${messageContent}\n\`\`\``;
        
        let botReply;
        
        if (fullMessage.length > 4000) {
            const filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
            const fileContent = `Источник: ${fileName}\nЗаголовок: ${title}\n\n${messageContent}`;
            
            const tmpFilePath = `/tmp/${filename}`;
            await writeFile(tmpFilePath, fileContent, 'utf8');
            
            botReply = await ctx.replyWithDocument(
                { source: tmpFilePath, filename: filename },
                {
                    caption:
                        `${mode.emoji} *Режим: ${mode.name}*\n` +
                        `🎵 *Аудио файл: ${fileName}*\n\n` +
                        `**Заголовок:** \`${title}\`\n\n` +
                        `📄 Расшифровка слишком длинная, отправляю файлом.`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: messageId,
                    ...createTranscriptKeyboard(messageId),
                }
            );
            
            await unlink(tmpFilePath);
        } else {
            botReply = await ctx.reply(fullMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: messageId,
                ...createTranscriptKeyboard(messageId),
            });
        }
        
        const cacheId = `${ctx.chat.id}_${messageId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Аудио заметка',
            content: messageContent,
            timestamp: new Date(),
            userId: ctx.from.id,
            mode: mode.name,
            source: fileName
        });
        
        setTimeout(() => {
            transcriptionCache.delete(cacheId);
        }, 30 * 60 * 1000);
        
        return botReply;
    } catch (error) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
        } catch (e) {}
        throw error;
    }
}

// ВРЕМЕННО ОТКЛЮЧЕНО: глобальное логирование
/* bot.use(async (ctx, next) => {
    const user = ctx.from;
    const username = user?.username ? `@${user.username}` : `${user?.first_name || 'Unknown'}`;
    
    console.log('\n=== НОВОЕ СООБЩЕНИЕ ===');
    console.log('От:', username, `(ID: ${user?.id})`);
    console.log('Тип обновления:', ctx.updateType);
    
    if (ctx.message) {
        console.log('Тип сообщения:', Object.keys(ctx.message).filter(k => 
            ['text', 'voice', 'document', 'video', 'audio', 'photo'].includes(k)
        ).join(', ') || 'unknown');
        
        if (ctx.message.document) {
            console.log('Документ:', {
                file_name: ctx.message.document.file_name,
                mime_type: ctx.message.document.mime_type,
                file_size: ctx.message.document.file_size,
                file_id: ctx.message.document.file_id?.substring(0, 20) + '...'
            });
        }
        
        if (ctx.message.audio) {
            console.log('Аудио:', {
                performer: ctx.message.audio.performer,
                title: ctx.message.audio.title,
                duration: ctx.message.audio.duration,
                mime_type: ctx.message.audio.mime_type,
                file_size: ctx.message.audio.file_size,
                file_id: ctx.message.audio.file_id?.substring(0, 20) + '...'
            });
        }
        
        if (ctx.message.voice) {
            console.log('Голосовое:', {
                duration: ctx.message.voice.duration,
                mime_type: ctx.message.voice.mime_type,
                file_size: ctx.message.voice.file_size
            });
        }
        
        if (ctx.message.video) {
            console.log('Видео:', {
                duration: ctx.message.video.duration,
                mime_type: ctx.message.video.mime_type,
                file_size: ctx.message.video.file_size
            });
        }
        
        if (ctx.message.text) {
            console.log('Текст:', ctx.message.text.substring(0, 100));
        }
    }
    
    console.log('===================\n');
    
    return next();
}); */

// Обработчик аудио сообщений (когда Telegram распознает файл как аудио)
bot.on('audio', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем режим накопления
    const collectSession = collectSessionState.get(userId);
    if (collectSession) {
        const audio = ctx.message.audio;
        collectSession.addMessage('audio', null, ctx.message.message_id, audio.file_id);
        
        const messageIndex = collectSession.getTotalCount();
        await ctx.reply(
            `🎵 Добавлено аудио #${messageIndex}\n` +
            `📊 Всего сообщений: ${collectSession.getTotalCount()}`,
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    const audio = ctx.message.audio;
    const fileName = audio.file_name || `${audio.title || 'audio'}.${audio.mime_type?.split('/')[1] || 'mp3'}`;
    
    console.log('🎵 Обработка AUDIO сообщения:', fileName);
    
    try {
        const user = ctx.message.from;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`🎵 Получено аудио ${fileName} от ${username}, размер: ${(audio.file_size / 1024 / 1024).toFixed(1)} МБ`);
        
        const withFormatting = userPreferences.get(userId) === true;
        const fileId = audio.file_id;
        
        const botReply = await processAudioFile(ctx, fileId, ctx.message.message_id, withFormatting, fileName);
        
        if (botReply) {
            const mode = getUserMode(userId);
            console.log(`✅ Обработано аудио от ${username} в режиме ${mode.name}`);
        }
    } catch (err) {
        console.error('Ошибка при обработке аудио:', err);
        await ctx.reply('❌ Не удалось расшифровать аудио файл.');
    }
});

// Обработчик документов (для MP4 и аудио файлов)
bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const document = ctx.message.document;
    const fileName = document.file_name || 'file';
    const fileExt = fileName.toLowerCase().split('.').pop();
    
    console.log('📄 Обработка DOCUMENT:', fileName, 'расширение:', fileExt);
    
    // Проверяем, является ли сообщение ответом на другое сообщение
    if (ctx.message.reply_to_message && !collectSessionState.has(userId) && fileExt === 'mp4') {
        await handleReplyAndStartCollection(ctx, userId, ctx.message.reply_to_message);
    }
    
    // Проверяем что это MP4 файл
    if (fileExt === 'mp4') {
        const fileSize = document.file_size || 0;
        
        try {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`📹 Получен MP4 документ от пользователя ${username} (ID: ${userId}), размер: ${(fileSize / 1024 / 1024).toFixed(1)} МБ`);

            const withFormatting = userPreferences.get(userId) === true;
            const fileId = document.file_id;

            const botReply = await processVideo(ctx, fileId, ctx.message.message_id, withFormatting, fileSize);
            
            if (botReply) {
                const mode = getUserMode(userId);
                console.log(`✅ Обработан MP4 документ от ${username} в режиме ${mode.name}`);
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.description === 'Bad Request: file is too big') {
                await ctx.reply(
                    '❌ *Файл слишком большой для обработки*\n\n' +
                    '📏 Telegram API позволяет ботам загружать файлы до 20 МБ.\n' +
                    '💡 Попробуйте сжать видео или отправить его частями.',
                    { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
                );
            } else {
                await ctx.reply('❌ Не удалось извлечь и расшифровать аудио из видео.');
            }
        }
    } else if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm'].includes(fileExt)) {
        // Обработка аудио файлов
        const fileSize = document.file_size || 0;
        const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 МБ для аудио
        
        if (fileSize > MAX_FILE_SIZE) {
            await ctx.reply(
                '⚠️ *Аудио файл слишком большой*\n\n' +
                `📊 Размер вашего файла: ${(fileSize / 1024 / 1024).toFixed(1)} МБ\n` +
                `📏 Максимальный размер: 25 МБ\n\n` +
                '💡 Попробуйте обрезать аудио или уменьшить битрейт',
                { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
            );
            return;
        }
        
        try {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`🎵 Получен аудио файл ${fileName} от пользователя ${username} (ID: ${userId}), размер: ${(fileSize / 1024 / 1024).toFixed(1)} МБ`);
            
            const withFormatting = userPreferences.get(userId) === true;
            const fileId = document.file_id;
            
            const botReply = await processAudioFile(ctx, fileId, ctx.message.message_id, withFormatting, fileName);
            
            if (botReply) {
                const mode = getUserMode(userId);
                console.log(`✅ Обработан аудио файл от ${username} в режиме ${mode.name}`);
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.description === 'Bad Request: file is too big') {
                await ctx.reply(
                    '❌ *Файл слишком большой для обработки*\n\n' +
                    '📏 Telegram API позволяет ботам загружать файлы до 20 МБ.\n' +
                    '💡 Попробуйте сжать аудио или разделить на части.',
                    { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
                );
            } else {
                await ctx.reply('❌ Не удалось расшифровать аудио файл.');
            }
        }
    }
});


bot.command('video', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const parts = text.split(' ');
    
    if (parts.length < 2) {
        await ctx.reply(
            '📹 *Обработка видео по ссылке*\n\n' +
            'Использование:\n' +
            '`/video [ссылка_на_видео]`\n\n' +
            'Примеры:\n' +
            '`/video https://youtube.com/watch?v=...`\n' +
            '`/video https://youtu.be/...`\n' +
            '`/video https://vt.tiktok.com/...`\n\n' +
            '💡 Бот извлечет аудио из видео и расшифрует его.\n' +
            '⚠️ Работает с видео любого размера!\n' +
            '🎵 Поддерживает YouTube и TikTok!',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const videoUrl = parts.slice(1).join(' ').trim();
    
    try {
        const withFormatting = userPreferences.get(userId) === true;
        await processVideoFromUrl(ctx, videoUrl, withFormatting);
        
        const mode = getUserMode(userId);
        const user = ctx.message.from;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`✅ Обработано видео по ссылке от ${username} в режиме ${mode.name}`);
    } catch (error) {
        console.error('Ошибка при обработке команды /video:', error);
    }
});


// Обработчик голосовых сообщений для выбора тегов
bot.on('voice', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем, является ли сообщение ответом на другое сообщение
    if (ctx.message.reply_to_message && !collectSessionState.has(userId)) {
        await handleReplyAndStartCollection(ctx, userId, ctx.message.reply_to_message);
    }
    
    // Проверяем режим накопления
    const collectSession = collectSessionState.get(userId);
    if (collectSession) {
        const fileId = ctx.message.voice.file_id;
        collectSession.addMessage('voice', null, ctx.message.message_id, fileId);
        
        // Отслеживаем сообщение пользователя
        collectSession.trackMessage(ctx.message.message_id, 'user_content');
        
        const messageIndex = collectSession.getTotalCount();
        const replyMsg = await ctx.reply(
            `🎤 Добавлено голосовое сообщение #${messageIndex}\n` +
            `📊 Всего сообщений: ${collectSession.getTotalCount()}`,
            { reply_to_message_id: ctx.message.message_id }
        );
        
        // Отслеживаем ответ бота
        collectSession.trackMessage(replyMsg.message_id, 'bot_response');
        
        return;
    }

    // Проверяем подтверждение тегов
    if (tagConfirmationState.has(userId)) {
        const confirmState = tagConfirmationState.get(userId);

        try {
            // Удаляем предыдущее сообщение с подтверждением
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, confirmState.confirmMsgId);
            } catch (e) {}

            // Расшифровываем новое голосовое
            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const res = await fetch(link.href);
            const buffer = await res.arrayBuffer();
            const tmpPath = `/tmp/${uuid()}.ogg`;
            await writeFile(tmpPath, Buffer.from(buffer));

            const tagVoiceText = await openai.audio.transcriptions.create({
                model: 'whisper-1',
                file: createReadStream(tmpPath),
                response_format: 'text',
                language: 'ru',
            });

            const selectedTags = await extractTagsFromVoice(tagVoiceText, confirmState.availableTags);

            // Показываем новое подтверждение
            await showTagConfirmation(ctx, selectedTags, confirmState.transcriptionData, confirmState.voiceMessageId, confirmState.availableTags);

            // Удаляем голосовое
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
            } catch (e) {}
        } catch (error) {
            console.error('Ошибка при обновлении тегов:', error);
            await ctx.reply('❌ Не удалось обработать теги');
        }
        return;
    }

    // Проверяем выбор тегов
    if (tagSelectionState.has(userId)) {
        const state = tagSelectionState.get(userId);

        try {
            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const res = await fetch(link.href);
            const buffer = await res.arrayBuffer();
            const tmpPath = `/tmp/${uuid()}.ogg`;
            await writeFile(tmpPath, Buffer.from(buffer));

            const tagVoiceText = await openai.audio.transcriptions.create({
                model: 'whisper-1',
                file: createReadStream(tmpPath),
                response_format: 'text',
                language: 'ru',
            });

            const selectedTags = await extractTagsFromVoice(tagVoiceText, state.availableTags);

            // Удаляем только голосовое сообщение
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
            } catch (e) {}

            // Показываем подтверждение
            await showTagConfirmation(ctx, selectedTags, state.transcriptionData, state.voiceMessageId, state.availableTags);

            tagSelectionState.delete(userId);
        } catch (error) {
            console.error('Ошибка при обработке тегов:', error);
            await ctx.reply('❌ Не удалось обработать теги');
            tagSelectionState.delete(userId);
        }

        return;
    }

    // Обычная обработка голосовых сообщений
    const voiceMessageId = ctx.message.message_id;
    
    // Отмечаем сообщение как обрабатываемое
    const pendingKey = `${ctx.chat.id}_${voiceMessageId}`;
    pendingMessages.set(pendingKey, {
        type: 'voice',
        fileId: ctx.message.voice.file_id,
        userId: userId,
        chatId: ctx.chat.id,
        startTime: new Date()
    });
    
    try {
        const user = ctx.message.from;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`📩 Получено голосовое сообщение от пользователя ${username} (ID: ${userId})`);

        const withFormatting = userPreferences.get(userId) === true;
        const fileId = ctx.message.voice.file_id;

        const botReply = await processVoice(ctx, fileId, voiceMessageId, withFormatting, pendingKey);

        const mode = getUserMode(userId);
        console.log(`✅ Обработано сообщение от ${username} в режиме ${mode.name}`);
    } catch (err) {
        console.error(err);
        await ctx.reply('❌ Не удалось расшифровать сообщение.');
        // Удаляем из pending при ошибке
        pendingMessages.delete(pendingKey);
    }
});

// Обработчик текстовых сообщений
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    
    // Пропускаем команды
    if (ctx.message.text.startsWith('/')) return;
    
    // Проверяем, является ли сообщение ответом на другое сообщение
    if (ctx.message.reply_to_message && !collectSessionState.has(userId)) {
        await handleReplyAndStartCollection(ctx, userId, ctx.message.reply_to_message);
    }
    
    // Проверяем режим накопления
    const collectSession = collectSessionState.get(userId);
    if (collectSession) {
        const text = ctx.message.text;
        collectSession.addMessage('text', text, ctx.message.message_id);
        
        // Отслеживаем сообщение пользователя
        collectSession.trackMessage(ctx.message.message_id, 'user_content');
        
        const messageIndex = collectSession.getTotalCount();
        const replyMsg = await ctx.reply(
            `✅ Добавлено текстовое сообщение #${messageIndex}\n` +
            `📊 Всего сообщений: ${collectSession.getTotalCount()}`,
            { reply_to_message_id: ctx.message.message_id }
        );
        
        // Отслеживаем ответ бота
        collectSession.trackMessage(replyMsg.message_id, 'bot_response');
        
        return;
    }
    
    // Проверяем подтверждение тегов
    if (tagConfirmationState.has(userId)) {
        const confirmState = tagConfirmationState.get(userId);

        try {
            // Удаляем предыдущее сообщение с подтверждением
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, confirmState.confirmMsgId);
            } catch (e) {}

            // Извлекаем теги из текста
            const selectedTags = await extractTagsFromVoice(ctx.message.text, confirmState.availableTags);

            // Показываем новое подтверждение
            await showTagConfirmation(ctx, selectedTags, confirmState.transcriptionData, confirmState.voiceMessageId, confirmState.availableTags);

            // Удаляем текстовое сообщение
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
            } catch (e) {}
        } catch (error) {
            console.error('Ошибка при обновлении тегов:', error);
            await ctx.reply('❌ Не удалось обработать теги');
        }
        return;
    }
    
    // Проверяем выбор тегов
    if (tagSelectionState.has(userId)) {
        const state = tagSelectionState.get(userId);

        try {
            // Извлекаем теги из текста
            const selectedTags = await extractTagsFromVoice(ctx.message.text, state.availableTags);

            // Удаляем текстовое сообщение
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
            } catch (e) {}

            // Показываем подтверждение
            await showTagConfirmation(ctx, selectedTags, state.transcriptionData, state.voiceMessageId, state.availableTags);

            tagSelectionState.delete(userId);
        } catch (error) {
            console.error('Ошибка при обработке тегов:', error);
            await ctx.reply('❌ Не удалось обработать теги');
            tagSelectionState.delete(userId);
        }

        return;
    }
    
    // Обычная обработка текстовых сообщений (создание заметки)
    try {
        const messageText = ctx.message.text;
        const messageId = ctx.message.message_id;
        
        const title = await createTitle(messageText);
        const responseText = `📝 **Заголовок:** \`${title}\``;
        
        const botReply = await ctx.reply(responseText, {
            parse_mode: 'Markdown',
            reply_to_message_id: messageId,
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📝 Добавить в заметку', `add_note_text_${messageId}`)]
            ])
        });
        
        const cacheId = `${ctx.chat.id}_text_${messageId}`;
        transcriptionCache.set(cacheId, {
            title: title || 'Текстовая заметка',
            content: messageText,
            timestamp: new Date(),
            userId: ctx.from.id,
            mode: 'Текст',
            isText: true
        });
        
        setTimeout(() => {
            transcriptionCache.delete(cacheId);
        }, 30 * 60 * 1000);
        
    } catch (error) {
        console.error('Ошибка при обработке текстового сообщения:', error);
        await ctx.reply('❌ Не удалось обработать сообщение.');
    }
});

// Обновляем обработчик кнопки "Добавить в заметку" для поддержки текстовых сообщений
bot.action(/add_note_(text_|combined_)?(.+)/, async (ctx) => {
    const prefix = ctx.match[1];
    const isText = prefix === 'text_';
    const isCombined = prefix === 'combined_';
    const messageId = ctx.match[2];
    let cacheId;
    if (isCombined) {
        cacheId = `${ctx.chat.id}_combined_${messageId}`;
    } else if (isText) {
        cacheId = `${ctx.chat.id}_text_${messageId}`;
    } else {
        cacheId = `${ctx.chat.id}_${messageId}`;
    }
    const transcriptionData = transcriptionCache.get(cacheId);

    if (!transcriptionData) {
        await ctx.answerCbQuery('❌ Данные не найдены. Попробуйте заново.');
        return;
    }

    if (!OBSIDIAN_API_KEY) {
        await ctx.answerCbQuery('❌ API ключ Obsidian не настроен');
        await ctx.editMessageReplyMarkup();
        await ctx.reply('⚠️ Для работы с Obsidian необходимо настроить API ключ в файле .env:\nOBSIDIAN_API_KEY=ваш_ключ');
        return;
    }

    await ctx.answerCbQuery('🔍 Загружаю теги...');

    try {
        const availableTags = await getObsidianTags();

        // Получаем рекомендации тегов
        const recommendations = await getTagRecommendations(transcriptionData.content, availableTags);

        let tagsMessage = '📋 **Доступные теги:**\n';
        if (availableTags.length > 0) {
            tagsMessage += availableTags.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ');
        } else {
            tagsMessage += '_Теги не найдены_';
        }

        // Добавляем рекомендации
        tagsMessage += '\n\n🤖 **Рекомендуемые теги:**';
        if (recommendations.existing.length > 0) {
            tagsMessage += `\nИз существующих: ${recommendations.existing.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ')}`;
        }
        if (recommendations.new.length > 0) {
            tagsMessage += `\nНовые: ${recommendations.new.map((tag) => `#${tag.replace(/_/g, '\\_')}`).join(', ')}`;
        }

        tagsMessage += '\n\n💬 Отправьте ГС или текст с нужными тегами';

        const tagSelectionMsg = await ctx.reply(tagsMessage, {
            parse_mode: 'Markdown',
        });

        tagSelectionState.set(ctx.from.id, {
            voiceMessageId: messageId,
            transcriptionData,
            tagSelectionMsgId: tagSelectionMsg.message_id,
            availableTags,
            isText: isText, // сохраняем флаг
            botMessageId: ctx.callbackQuery.message.message_id // добавляем
        });
    } catch (error) {
        console.error('Ошибка при загрузке тегов:', error);
        await ctx.reply('❌ Не удалось загрузить теги. Добавляю заметку без тегов...');
 
        const result = await createObsidianNote(transcriptionData);
        if (result.success) {
            await ctx.editMessageReplyMarkup();
            await ctx.reply(`✅ Заметка сохранена в Obsidian!\n📝 ${transcriptionData.title}`, {
                parse_mode: 'Markdown',
            });
            transcriptionCache.delete(cacheId);
        }
    }
});

// Обработчик кнопки "Оставить как голосовое"
bot.action(/keep_voice_(.+)/, async (ctx) => {
    const voiceMessageId = ctx.match[1];
    const cacheId = `${ctx.chat.id}_${voiceMessageId}`;

    await ctx.editMessageReplyMarkup();
    await ctx.answerCbQuery('👌 Оставлено как голосовое сообщение');

    transcriptionCache.delete(cacheId);
});

// Обработчик удаления обычных сообщений (без подтверждения)
bot.action(/delete_msg_(.+)/, async (ctx) => {
    const messageId = ctx.match[1];
    const historyData = messageHistory.get(ctx.callbackQuery.message.message_id);
    
    let deletedCount = 0;
    let errors = 0;
    
    try {
        // Удаляем сообщение бота (текущее сообщение с кнопками)
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
        deletedCount++;
    } catch (e) {
        errors++;
    }
    
    // Если есть история сообщений
    if (historyData) {
        // Удаляем исходное сообщение пользователя
        if (historyData.userMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, historyData.userMessageId);
                deletedCount++;
            } catch (e) {
                errors++;
            }
        }
        
        // Удаляем все связанные сообщения бота
        if (historyData.botMessageIds) {
            for (const msgId of historyData.botMessageIds) {
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
                    deletedCount++;
                } catch (e) {
                    errors++;
                }
            }
        }
        
        // Очищаем историю
        messageHistory.delete(ctx.callbackQuery.message.message_id);
    } else {
        // Если истории нет, пытаемся удалить по messageId
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
            deletedCount++;
        } catch (e) {
            errors++;
        }
    }
    
    // Очищаем кэши
    const cacheId = `${ctx.chat.id}_${messageId}`;
    transcriptionCache.delete(cacheId);
    transcriptionCache.delete(`${ctx.chat.id}_text_${messageId}`);
    
    if (errors === 0) {
        await ctx.answerCbQuery(`✅ Удалено`);
    } else {
        await ctx.answerCbQuery(`⚠️ Удалено частично`);
    }
});

// Обработчик удаления истории накопления (с подтверждением)
bot.action(/delete_collect_(.+)/, async (ctx) => {
    const callbackId = ctx.callbackQuery.id;
    
    // Проверяем, не обработали ли мы уже этот callback
    if (processedCallbacks.has(callbackId)) {
        await ctx.answerCbQuery('Уже обрабатывается...');
        return;
    }
    
    // Добавляем в обработанные
    processedCallbacks.add(callbackId);
    
    // Удаляем через 5 секунд из памяти
    setTimeout(() => {
        processedCallbacks.delete(callbackId);
    }, 5000);
    
    const userId = ctx.match[1];
    console.log('🗑️ Попытка удаления истории для userId:', userId);
    console.log('📊 Активные сессии:', Array.from(collectSessionState.keys()));
    console.log('📊 Завершенные сессии:', Array.from(completedSessionsMap.keys()));
    
    // ВАЖНО: Сначала отвечаем на callback query чтобы избежать повторов!
    try {
        await ctx.answerCbQuery();
    } catch (e) {
        console.error('Ошибка при ответе на callback query:', e);
        processedCallbacks.delete(callbackId);
        return;
    }
    
    // Преобразуем userId в число если нужно
    const userIdNum = parseInt(userId);
    // Ищем сессию сначала в активных, потом в завершенных
    let session = collectSessionState.get(userId) || collectSessionState.get(userIdNum) ||
                  completedSessionsMap.get(userId) || completedSessionsMap.get(userIdNum);
    
    if (!session) {
        console.log('❌ Сессия не найдена для userId:', userId, 'или', userIdNum);
        // Удаляем кнопки с сообщения, так как сессия уже не существует
        try {
            await ctx.editMessageReplyMarkup();
        } catch (e) {}
        return;
    }
    
    console.log('✅ Сессия найдена, сообщений:', session.allMessageIds.length);
    
    const totalMessages = session.allMessageIds.length;
    
    // Показываем подтверждение в новом сообщении
    try {
        const confirmMsg = await ctx.reply(
            `⚠️ *Удалить историю сессии?*\n\n` +
            `Будет удалено: ${totalMessages} сообщений\n\n`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Да, удалить', `confirm_delete_collect_${userId}`),
                        Markup.button.callback('❌ Отмена', `cancel_delete_collect_${userId}`)
                    ]
                ])
            }
        );
        
        // НЕ добавляем это сообщение в историю сессии!
        // Оно будет удалено отдельно
    } catch (e) {
        console.error('Ошибка при показе подтверждения:', e);
    }
});

// Подтверждение удаления истории накопления
bot.action(/confirm_delete_collect_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    
    // Сначала отвечаем на callback чтобы избежать повторов
    await ctx.answerCbQuery('⏳ Удаляю...');
    
    // Преобразуем userId в число если нужно
    const userIdNum = parseInt(userId);
    // Ищем сессию сначала в активных, потом в завершенных
    let session = collectSessionState.get(userId) || collectSessionState.get(userIdNum) ||
                  completedSessionsMap.get(userId) || completedSessionsMap.get(userIdNum);
    
    if (!session) {
        try {
            await ctx.deleteMessage();
        } catch (e) {}
        return;
    }
    
    console.log(`📊 Удаление ${session.allMessageIds.length} сообщений для пользователя ${userId}`);
    
    let deletedCount = 0;
    let errors = 0;
    
    // Удаляем все сообщения из истории сессии
    for (const msg of session.allMessageIds) {
        try {
            await ctx.telegram.deleteMessage(session.chatId, msg.id);
            deletedCount++;
        } catch (e) {
            errors++;
        }
    }
    
    // Удаляем сообщение с подтверждением
    try {
        await ctx.deleteMessage();
    } catch (e) {}
    
    // Очищаем сессию и кэши (удаляем оба возможных ключа)
    collectSessionState.delete(userId);
    collectSessionState.delete(userIdNum);
    const cacheId = `${ctx.chat.id}_combined_${userId}`;
    transcriptionCache.delete(cacheId);
    transcriptionCache.delete(`${ctx.chat.id}_combined_${userIdNum}`);
    
    // Отправляем результат
    const resultMsg = await ctx.reply(
        `✅ История сессии удалена\n` +
        `📊 Удалено: ${deletedCount} из ${session.allMessageIds.length} сообщений`,
        { parse_mode: 'Markdown' }
    );
    
    // Удаляем уведомление через 3 секунды
    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, resultMsg.message_id);
        } catch (e) {}
    }, 3000);
});

// Отмена удаления истории накопления
bot.action(/cancel_delete_collect_(.+)/, async (ctx) => {
    // Сначала отвечаем на callback чтобы избежать повторов
    await ctx.answerCbQuery('❌ Отменено');
    
    // Затем удаляем сообщение с подтверждением
    try {
        await ctx.deleteMessage();
    } catch (e) {
        console.error('Не удалось удалить сообщение подтверждения:', e);
    }
});

bot.action(/confirm_tags_(.+)/, async (ctx) => {
    const voiceMessageId = ctx.match[1];
    const userId = ctx.from.id;
    const confirmState = tagConfirmationState.get(userId);

    if (!confirmState || confirmState.voiceMessageId !== voiceMessageId) {
        await ctx.answerCbQuery('❌ Сессия истекла');
        return;
    }

    try {
        // Создаем заметку
        const result = await createObsidianNote(confirmState.transcriptionData, confirmState.selectedTags);

        if (result.success) {
            // Удаляем сообщение подтверждения
            await ctx.telegram.deleteMessage(ctx.chat.id, confirmState.confirmMsgId);
            
            // Удаляем сообщение с выбором тегов
            if (confirmState.tagSelectionMsgId) {
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, confirmState.tagSelectionMsgId);
                } catch (e) {}
            }
            
            // Удаляем исходное сообщение бота с заголовком
            if (confirmState.botMessageId) {
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, confirmState.botMessageId);
                } catch (e) {}
            }

            // Удаляем кнопки с исходного сообщения
            const cacheId = `${ctx.chat.id}_${voiceMessageId}`;
            const botMsg = Array.from(botMessageToVoice.entries()).find(([msgId, data]) => data.voiceMessageId === voiceMessageId);
            if (botMsg) {
                await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, botMsg[0]);
            }

            // Используем структурированные теги для отображения, если они есть
            const structuredTags = confirmState.selectedTagsStructured || { existing: confirmState.selectedTags, new: [] };
            let tagsStr = '';

            if (structuredTags.existing.length > 0 || structuredTags.new.length > 0) {
                tagsStr = '\n';
                if (structuredTags.existing.length > 0) {
                    tagsStr += `\n📌 Существующие: ${structuredTags.existing.map((t) => `#${t.replace(/_/g, '\\_')}`).join(', ')}`;
                }
                if (structuredTags.new.length > 0) {
                    tagsStr += `\n🆕 Новые: ${structuredTags.new.map((t) => `#${t.replace(/_/g, '\\_')}`).join(', ')}`;
                }
            } else if (confirmState.selectedTags.length > 0) {
                // Fallback для обратной совместимости
                tagsStr = `\n🏷️ Теги: ${confirmState.selectedTags.map((t) => `#${t.replace(/_/g, '\\_')}`).join(', ')}`;
            }

            await ctx.answerCbQuery('✅ Заметка сохранена!');
            await ctx.reply(`✅ Заметка сохранена в Obsidian!${tagsStr}\n📝 ${confirmState.transcriptionData.title}`, {
                parse_mode: 'Markdown',
            });

            transcriptionCache.delete(cacheId);
            tagConfirmationState.delete(userId);
        } else {
            await ctx.answerCbQuery('❌ Ошибка при сохранении');
        }
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        await ctx.answerCbQuery('❌ Не удалось сохранить');
    }
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

    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                userPreferences.set(userId, true);
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);
                botMessageToVoice.delete(botMessage.message_id);
                await processVoice(ctx, voiceData.fileId, voiceData.voiceMessageId, true);
                return;
            } catch (error) {
                console.error('Error processing format command:', error);
                await ctx.reply('❌ Не удалось переобработать сообщение.');
                return;
            }
        }
    }

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

    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                userPreferences.set(userId, false);
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);
                botMessageToVoice.delete(botMessage.message_id);
                await processVoice(ctx, voiceData.fileId, voiceData.voiceMessageId, false);
                return;
            } catch (error) {
                console.error('Error processing noformat command:', error);
                await ctx.reply('❌ Не удалось переобработать сообщение.');
                return;
            }
        }
    }

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
    const currentMode = userPreferences.get(userId) === true;
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
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from?.is_bot) {
        const botMessage = ctx.message.reply_to_message;
        const voiceData = botMessageToVoice.get(botMessage.message_id);

        if (voiceData) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, botMessage.message_id);
                await ctx.telegram.deleteMessage(ctx.chat.id, voiceData.voiceMessageId);
                botMessageToVoice.delete(botMessage.message_id);
                return;
            } catch (error) {
                console.error('Error processing delete command:', error);
                return;
            }
        }
    }

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

    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, которое будет началом диапазона для удаления.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const startMessageId = ctx.message.reply_to_message.message_id;
    deleteRangeStart.set(userId, startMessageId);

    const confirmMessage = await ctx.reply('✅ Начало диапазона отмечено. Теперь ответьте командой /del_end на последнее сообщение для удаления.', {
        reply_to_message_id: ctx.message.message_id,
    });

    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

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

    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, которое будет концом диапазона для удаления.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const startMessageId = deleteRangeStart.get(userId);
    if (!startMessageId) {
        await ctx.reply('⚠️ Сначала отметьте начало диапазона командой /del_start', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const endMessageId = ctx.message.reply_to_message.message_id;
    const fromId = Math.min(startMessageId, endMessageId);
    const toId = Math.max(startMessageId, endMessageId);
    
    // Ограничиваем диапазон для больших промежутков
    const MAX_RANGE = 10000; // Максимум 10000 сообщений за раз
    const actualToId = Math.min(toId, fromId + MAX_RANGE);

    const progressMessage = await ctx.reply(
        `🗑️ Удаляю сообщения...\n` +
        `📊 Диапазон: ${fromId} - ${actualToId}\n` +
        `⏳ Это может занять время...`
    );

    let deletedCount = 0;
    let failedCount = 0;
    let lastDeletedId = null;
    let consecutiveFailures = 0;

    // Удаляем пачками для оптимизации
    const BATCH_SIZE = 50;
    for (let batchStart = fromId; batchStart <= actualToId; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, actualToId);
        const deletePromises = [];
        
        for (let messageId = batchStart; messageId <= batchEnd; messageId++) {
            deletePromises.push(
                ctx.telegram.deleteMessage(chatId, messageId)
                    .then(() => {
                        deletedCount++;
                        lastDeletedId = messageId;
                        consecutiveFailures = 0;
                        return true;
                    })
                    .catch(() => {
                        failedCount++;
                        consecutiveFailures++;
                        return false;
                    })
            );
        }
        
        await Promise.all(deletePromises);
        
        // Обновляем прогресс каждые 50 сообщений
        if (deletedCount > 0 && deletedCount % 50 === 0) {
            try {
                await ctx.telegram.editMessageText(
                    chatId,
                    progressMessage.message_id,
                    null,
                    `🗑️ Удаляю сообщения...\n` +
                    `✅ Удалено: ${deletedCount}\n` +
                    `⏳ Обработано: ${batchEnd - fromId + 1} из ${actualToId - fromId + 1}`
                );
            } catch (e) {}
        }
        
        // Если слишком много ошибок подряд - останавливаемся
        if (consecutiveFailures > 100) {
            console.log('Слишком много ошибок подряд, останавливаем удаление');
            break;
        }
        
        // Небольшая задержка между пачками
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
        await ctx.telegram.deleteMessage(chatId, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

    deleteRangeStart.delete(userId);

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

    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(chatId, progressMessage.message_id);
        } catch (error) {
            console.error('Не удалось удалить сообщение о результате:', error);
        }
    }, 5000);
});

// Команда для удаления всех сообщений начиная с указанного
bot.command(['del_all', 'delall', 'da'], async (ctx) => {
    const chatId = ctx.chat.id;

    if (!ctx.message.reply_to_message) {
        await ctx.reply('⚠️ Ответьте этой командой на сообщение, начиная с которого нужно удалить все сообщения.', {
            reply_to_message_id: ctx.message.message_id,
        });
        return;
    }

    const startMessageId = ctx.message.reply_to_message.message_id;
    const currentMessageId = ctx.message.message_id;

    const progressMessage = await ctx.reply(`🗑️ Удаляю все сообщения начиная с ID ${startMessageId} (включительно)...`);

    let deletedCount = 0;
    let failedCount = 0;
    let consecutiveFailures = 0;

    const maxMessageId = currentMessageId + 1000;

    for (let messageId = startMessageId; messageId <= maxMessageId; messageId++) {
        try {
            await ctx.telegram.deleteMessage(chatId, messageId);
            deletedCount++;
            consecutiveFailures = 0;

            if (deletedCount % 10 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } catch (error) {
            failedCount++;
            consecutiveFailures++;

            if (consecutiveFailures >= 50) {
                console.log(`Прекращаем удаление после ${consecutiveFailures} неудачных попыток подряд`);
                break;
            }
        }
    }

    try {
        await ctx.telegram.deleteMessage(chatId, ctx.message.message_id);
    } catch (error) {
        console.error('Не удалось удалить команду:', error);
    }

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

    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(chatId, progressMessage.message_id);
        } catch (error) {
            console.error('Не удалось удалить сообщение о результате:', error);
        }
    }, 7000);
});

// Команда для удаления последних N сообщений
bot.command(['clear', 'cls'], async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;
    const parts = text.split(' ');
    
    // Определяем количество сообщений для удаления
    let count = 100; // По умолчанию 100
    if (parts.length > 1) {
        const num = parseInt(parts[1]);
        if (!isNaN(num) && num > 0) {
            count = Math.min(num, 1000); // Максимум 1000
        }
    }
    
    const currentMessageId = ctx.message.message_id;
    const startId = Math.max(1, currentMessageId - count);
    
    const progressMessage = await ctx.reply(
        `🗑️ Удаляю последние ${count} сообщений...\n` +
        `⏳ Это может занять время...`
    );
    
    let deletedCount = 0;
    let failedCount = 0;
    
    // Удаляем пачками
    const BATCH_SIZE = 20;
    for (let batchStart = currentMessageId; batchStart >= startId; batchStart -= BATCH_SIZE) {
        const batchEnd = Math.max(batchStart - BATCH_SIZE + 1, startId);
        const deletePromises = [];
        
        for (let messageId = batchStart; messageId >= batchEnd; messageId--) {
            deletePromises.push(
                ctx.telegram.deleteMessage(chatId, messageId)
                    .then(() => {
                        deletedCount++;
                        return true;
                    })
                    .catch(() => {
                        failedCount++;
                        return false;
                    })
            );
        }
        
        await Promise.all(deletePromises);
        
        // Обновляем прогресс
        if ((deletedCount + failedCount) % 50 === 0) {
            try {
                await ctx.telegram.editMessageText(
                    chatId,
                    progressMessage.message_id,
                    null,
                    `🗑️ Удаляю сообщения...\n` +
                    `✅ Удалено: ${deletedCount}\n` +
                    `❌ Пропущено: ${failedCount}`
                );
            } catch (e) {}
        }
        
        // Задержка между пачками
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Финальное сообщение
    try {
        await ctx.telegram.editMessageText(
            chatId,
            progressMessage.message_id,
            null,
            `✅ Удаление завершено!\n` +
            `📊 Удалено: ${deletedCount} сообщений\n` +
            `❌ Пропущено: ${failedCount} сообщений`
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

// Команда для отмены выбора начала диапазона
bot.command(['del_cancel', 'delcancel', 'dc'], async (ctx) => {
    const userId = ctx.from.id;

    if (deleteRangeStart.has(userId)) {
        deleteRangeStart.delete(userId);
        const msg = await ctx.reply('❌ Выбор диапазона для удаления отменен.');

        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        } catch (error) {
            console.error('Не удалось удалить команду:', error);
        }

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

// Добавляем справку  
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
            `🧹 \`/clear [N]\` - удалить последние N сообщений (по умолчанию 100)\n` +
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
            `После расшифровки появятся кнопки для сохранения заметки в Obsidian.\n` +
            `При сохранении можно выбрать теги голосовым сообщением.\n\n` +
            `🎥 *Поддержка видео:*\n` +
            `• Отправьте MP4 файл (до 20 МБ)\n\n` +
            `🎵 *Поддержка аудио:*\n` +
            `• MP3, WAV, OGG, M4A, AAC, FLAC, OPUS, WebM\n` +
            `• Максимальный размер: 25 МБ\n\n` +
            `💬 *Совет:* Ответьте на расшифровку командой /format или /noformat, чтобы переобработать это же сообщение в другом режиме!\n\n` +
            `🗑️ *Удаление сообщений:*\n` +
            `• Диапазон: /del_start на первое → /del_end на последнее\n` +
            `• Все после: /del_all на сообщение → удалит все после него\n\n` +
            `📝 *Режим накопления (новое!):*\n` +
            `• \`/collect\` - начать накопление сообщений\n` +
            `• Отправляйте голосовые, текст, видео, аудио\n` +
            `• \`/done\` - объединить все в одну заметку\n` +
            `• \`/cancel\` - отменить накопление\n` +
            `• \`/status\` - проверить статус накопления\n\n` +
            `📝 Текст форматируется моноширинным шрифтом для удобного копирования`,
        { parse_mode: 'Markdown' }
    );
});

bot.launch();

// Устанавливаем команды для автокомплита
bot.telegram.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'collect', description: 'Начать накопление сообщений 📝' },
    { command: 'done', description: 'Завершить и обработать накопление ✅' },
    { command: 'cancel', description: 'Отменить накопление ❌' },
    { command: 'status', description: 'Статус накопления 📊' },
    { command: 'format', description: 'Режим с форматированием 🎨' },
    { command: 'noformat', description: 'Режим без форматирования 📝' },
    { command: 'toggle', description: 'Переключить режим' },
    { command: 'mode', description: 'Текущий режим' },
    { command: 'clear', description: 'Удалить последние N сообщений 🧹' },
    { command: 'd', description: 'Удалить сообщения 🗑️' },
    { command: 'del', description: 'Удалить сообщения 🗑️' },
    { command: 'del_start', description: 'Начало диапазона удаления 📍' },
    { command: 'del_end', description: 'Конец диапазона и удаление 📍' },
    { command: 'del_all', description: 'Удалить все после сообщения 🧹' },
    { command: 'del_cancel', description: 'Отменить выбор диапазона ❌' },
    { command: 'help', description: 'Справка по командам' },
]);

console.log('🤖 Бот запущен');
