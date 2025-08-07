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
function createTranscriptKeyboard(messageId) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('📝 Добавить в заметку', `add_note_${messageId}`),
            Markup.button.callback('🎙️ Оставить как голосовое', `keep_voice_${messageId}`),
        ],
    ]);
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
async function processVoice(ctx, fileId, voiceMessageId, withFormatting) {
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
            language: 'ru',
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

        setTimeout(() => {
            transcriptionCache.delete(cacheId);
        }, 30 * 60 * 1000);

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
async function processVideo(ctx, fileId, videoMessageId, withFormatting) {
    const mode = withFormatting ? MODES.WITH_FORMAT : MODES.WITHOUT_FORMAT;

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
            language: 'ru',
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

// Обработчик видео сообщений (MP4)
bot.on('video', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем что это MP4 файл
    const video = ctx.message.video;
    const mimeType = video.mime_type;
    
    if (mimeType && mimeType.includes('mp4')) {
        try {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`📹 Получено видео MP4 от пользователя ${username} (ID: ${userId})`);

            const withFormatting = userPreferences.get(userId) === true;
            const fileId = video.file_id;

            const botReply = await processVideo(ctx, fileId, ctx.message.message_id, withFormatting);

            const mode = getUserMode(userId);
            console.log(`✅ Обработано видео от ${username} в режиме ${mode.name}`);
        } catch (err) {
            console.error(err);
            await ctx.reply('❌ Не удалось извлечь и расшифровать аудио из видео.');
        }
    } else {
        await ctx.reply('⚠️ Поддерживаются только MP4 файлы. Пожалуйста, отправьте видео в формате MP4.');
    }
});

// Обработчик документов (для MP4 файлов отправленных как документы)
bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const document = ctx.message.document;
    
    // Проверяем что это MP4 файл
    if (document.file_name && document.file_name.toLowerCase().endsWith('.mp4')) {
        try {
            const user = ctx.message.from;
            const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
            console.log(`📹 Получен MP4 документ от пользователя ${username} (ID: ${userId})`);

            const withFormatting = userPreferences.get(userId) === true;
            const fileId = document.file_id;

            const botReply = await processVideo(ctx, fileId, ctx.message.message_id, withFormatting);

            const mode = getUserMode(userId);
            console.log(`✅ Обработан MP4 документ от ${username} в режиме ${mode.name}`);
        } catch (err) {
            console.error(err);
            await ctx.reply('❌ Не удалось извлечь и расшифровать аудио из видео.');
        }
    }
});

// Обработчик голосовых сообщений для выбора тегов
bot.on('voice', async (ctx) => {
    const userId = ctx.from.id;

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
    try {
        const user = ctx.message.from;
        const username = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
        console.log(`📩 Получено голосовое сообщение от пользователя ${username} (ID: ${userId})`);

        const withFormatting = userPreferences.get(userId) === true;
        const fileId = ctx.message.voice.file_id;

        const botReply = await processVoice(ctx, fileId, ctx.message.message_id, withFormatting);

        const mode = getUserMode(userId);
        console.log(`✅ Обработано сообщение от ${username} в режиме ${mode.name}`);
    } catch (err) {
        console.error(err);
        await ctx.reply('❌ Не удалось расшифровать сообщение.');
    }
});

// Обработчик текстовых сообщений
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    
    // Пропускаем команды
    if (ctx.message.text.startsWith('/')) return;
    
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
bot.action(/add_note_(text_)?(.+)/, async (ctx) => {
    const isText = ctx.match[1] === 'text_';
    const messageId = ctx.match[2];
    const cacheId = `${ctx.chat.id}_${isText ? 'text_' : ''}${messageId}`;
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

    const progressMessage = await ctx.reply(`🗑️ Удаляю сообщения с ID ${fromId} по ${toId}...`);

    let deletedCount = 0;
    let failedCount = 0;

    for (let messageId = fromId; messageId <= toId; messageId++) {
        try {
            await ctx.telegram.deleteMessage(chatId, messageId);
            deletedCount++;

            if (deletedCount % 10 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } catch (error) {
            failedCount++;
        }
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
            `После расшифровки появятся кнопки для сохранения заметки в Obsidian.\n` +
            `При сохранении можно выбрать теги голосовым сообщением.\n\n` +
            `🎥 *Поддержка видео:*\n` +
            `Отправьте MP4 файл - бот извлечет аудио и расшифрует его.\n\n` +
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
