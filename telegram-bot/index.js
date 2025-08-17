#!/usr/bin/env node

import { Telegraf } from 'telegraf';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import OpenAI from 'openai';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration - all from environment variables
if (!process.env.TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN is required in environment variables');
if (!process.env.OPENAI_KEY) throw new Error('OPENAI_KEY is required in environment variables');
if (!process.env.API_URL) throw new Error('API_URL is required in environment variables');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const API_URL = process.env.API_URL; // Web app backend URL

// Initialize bot and OpenAI
const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
});

// Message queue to handle messages sequentially
const messageQueue = [];
let isProcessing = false;

// Store last created note for merge command
let lastCreatedNote = null;

// Merge mode state for each user
const mergeStates = new Map(); // userId -> { isActive, notes: [], startTime }

// Process messages from queue
async function processQueue() {
    if (isProcessing || messageQueue.length === 0) {
        return;
    }
    
    isProcessing = true;
    
    while (messageQueue.length > 0) {
        const { handler, ctx } = messageQueue.shift();
        const remaining = messageQueue.length;
        
        console.log(`📨 Processing message from queue (${remaining} remaining)...`);
        
        try {
            await handler(ctx);
        } catch (error) {
            console.error('Error processing queued message:', error);
        }
        // Add small delay between messages to ensure proper ordering
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isProcessing = false;
    console.log('✅ Queue processing complete');
}

// Add message to queue
function enqueueMessage(handler, ctx) {
    messageQueue.push({ handler, ctx });
    console.log(`📥 Message added to queue (total: ${messageQueue.length})`);
    processQueue();
}

// Helper function to transcribe audio
async function transcribeAudio(filePath) {
    try {
        const audioFile = await fs.readFile(filePath);
        const transcription = await openai.audio.transcriptions.create({
            file: new File([audioFile], path.basename(filePath), { type: 'audio/ogg' }),
            model: 'whisper-1',
            language: 'ru'
        });
        
        return transcription.text;
    } catch (error) {
        console.error('Ошибка транскрипции:', error);
        throw error;
    }
}

// Generate title from content using AI
async function generateTitle(content) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Создай краткий заголовок (2-4 слова) для заметки на основе содержания. Ответь только заголовком, без лишних слов.'
                },
                {
                    role: 'user',
                    content: content
                }
            ],
            temperature: 0.7,
            max_tokens: 20
        });
        
        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Ошибка генерации заголовка:', error);
        return 'Голосовая заметка';
    }
}

// Save note to database
async function saveNoteToDatabase(title, content, type = 'voice', telegramMessageId = null) {
    try {
        const response = await axios.post(`${API_URL}/notes`, {
            title,
            content,
            type,
            date: new Date().toISOString(),
            // Don't send x,y - let backend calculate position automatically
            tags: [],
            telegramMessageId: telegramMessageId ? telegramMessageId.toString() : null
        }, {
            headers: {
                'user-id': 'test-user-id', // Same as web app to show on same canvas
                'Content-Type': 'application/json'
            }
        });
        
        // Store last created note
        lastCreatedNote = response.data;
        
        return response.data;
    } catch (error) {
        console.error('Ошибка сохранения в БД:', error);
        throw error;
    }
}

// Find note by telegram message ID
async function findNoteByTelegramId(messageId) {
    try {
        const response = await axios.get(`${API_URL}/notes/telegram/${messageId}`, {
            headers: {
                'user-id': 'test-user-id'
            }
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        console.error('Ошибка поиска заметки:', error);
        return null;
    }
}

// Update existing note
async function updateNote(noteId, updates) {
    try {
        const response = await axios.patch(`${API_URL}/notes/${noteId}`, updates, {
            headers: {
                'user-id': 'test-user-id',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Ошибка обновления заметки:', error);
        throw error;
    }
}

// Actual voice message handler
async function handleVoiceMessage(ctx) {
    const userId = ctx.from.id;
    const voiceFileId = ctx.message.voice.file_id;
    const messageId = ctx.message.message_id;
    
    // Send initial message
    const processingMsg = await ctx.reply('⏳ Начинаю обработку голосового сообщения...');
    
    try {
        // Download voice file
        const fileLink = await ctx.telegram.getFileLink(voiceFileId);
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        
        // Save to temporary file
        const tempPath = path.join(__dirname, `temp_${Date.now()}.ogg`);
        await fs.writeFile(tempPath, buffer);
        
        // Transcribe audio
        const transcription = await transcribeAudio(tempPath);
        
        // Clean up temp file
        await fs.unlink(tempPath).catch(console.error);
        
        if (!transcription || transcription.trim().length === 0) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply('❌ Не удалось распознать голосовое сообщение');
            return;
        }
        
        // Generate title
        const title = await generateTitle(transcription);
        
        // Check if user is in merge mode
        const userId = ctx.from.id;
        const mergeState = mergeStates.get(userId);
        if (mergeState && mergeState.isActive) {
            // Add to merge queue
            mergeState.notes.push({
                title,
                content: transcription,
                type: 'voice',
                telegramMessageId: messageId
            });
            
            console.log(`📝 Added voice note to merge queue. User: ${userId}, Total notes: ${mergeState.notes.length}`);
            
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply(
                `✅ Заметка ${mergeState.notes.length} добавлена в очередь объединения\n\n📝 *${title}*\n${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`,
                {
                    reply_to_message_id: ctx.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }
        
        // Check if this is a reply to another message
        if (ctx.message.reply_to_message) {
            const replyToId = ctx.message.reply_to_message.message_id;
            const originalNote = await findNoteByTelegramId(replyToId);
            
            if (originalNote) {
                // Merge with existing note
                const mergedTitle = originalNote.title + ' / ' + title;
                const mergedContent = originalNote.content + '\n\n////// \n\n' + transcription;
                
                await updateNote(originalNote.id, {
                    title: mergedTitle,
                    content: mergedContent
                });
                
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
                await ctx.reply(
                    `🔄 Заметка объединена с существующей\n\n📝 *${mergedTitle}*`,
                    {
                        reply_to_message_id: ctx.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }
        }
        
        // Save as new note
        await saveNoteToDatabase(title, transcription, 'voice', messageId);
        
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Send success message as reply to original voice
        await ctx.reply(
            `✅ Голосовое сообщение успешно расшифровано и добавлено в приложение\n\n📝 *${title}*\n${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
        
    } catch (error) {
        console.error('Ошибка обработки голосового сообщения:', error);
        
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        
        await ctx.reply('❌ Произошла ошибка при обработке голосового сообщения', {
            reply_to_message_id: ctx.message.message_id
        });
    }
}

// Handle voice messages - add to queue
bot.on('voice', (ctx) => {
    enqueueMessage(handleVoiceMessage, ctx);
});

// Handle start command
bot.start((ctx) => {
    ctx.reply(
        '👋 Привет! Я бот для сохранения заметок.\n\n' +
        '📝 Что я умею:\n' +
        '• 🎤 Голосовые сообщения - расшифрую и сохраню\n' +
        '• 📄 Текстовые сообщения - сохраню как есть\n' +
        '• 🎵 Аудио файлы (MP3) - расшифрую и сохраню\n' +
        '• 🎬 Видео файлы (MP4) - извлеку звук и расшифрую\n\n' +
        '🔄 Команды объединения:\n' +
        '• Ответ на сообщение - автоматически объединю\n' +
        '• /merge - объединить последнюю с указанной\n' +
        '• /merge_start - начать режим множественного объединения\n' +
        '• /merge_end - завершить и объединить все\n' +
        '• /merge_cancel - отменить режим\n' +
        '• /merge_status - проверить статус режима\n\n' +
        'Все заметки сохраняются в веб-приложение.\n' +
        'Просто отправьте мне любое сообщение!'
    );
});

// Handle merge_start command
const handleMergeStart = async (ctx) => {
    const userId = ctx.from.id;
    
    // Check if already in merge mode
    if (mergeStates.has(userId) && mergeStates.get(userId).isActive) {
        await ctx.reply(
            '⚠️ Вы уже в режиме объединения. Используйте:\n' +
            '/merge_end - чтобы завершить\n' +
            '/merge_cancel - чтобы отменить\n' +
            '/merge_status - проверить статус',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    // Start merge mode
    mergeStates.set(userId, {
        isActive: true,
        notes: [],
        startTime: Date.now()
    });
    
    console.log(`🔄 Merge mode started for user ${userId}`);
    
    await ctx.reply(
        '🔄 Режим объединения начат!\n\n' +
        'Теперь все отправленные заметки будут накапливаться.\n\n' +
        'Команды:\n' +
        '• /merge_end - объединить все заметки\n' +
        '• /merge_cancel - отменить режим\n' +
        '• /merge_status - проверить статус',
        { reply_to_message_id: ctx.message.message_id }
    );
};

bot.command('merge_start', handleMergeStart);
bot.command('m_start', handleMergeStart);
bot.command('ms', handleMergeStart);

// Handle merge_status command
const handleMergeStatus = async (ctx) => {
    const userId = ctx.from.id;
    const mergeState = mergeStates.get(userId);
    
    if (!mergeState || !mergeState.isActive) {
        await ctx.reply(
            '🔴 Режим объединения не активен\n\n' +
            'Для начала используйте /merge_start',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    const duration = Math.floor((Date.now() - mergeState.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    await ctx.reply(
        `🟢 Режим объединения активен\n\n` +
        `📄 Заметок в очереди: ${mergeState.notes.length}\n` +
        `⏱ Время: ${minutes > 0 ? minutes + 'м ' : ''}${seconds}с\n\n` +
        `Команды:\n` +
        `• /merge_end - завершить и объединить\n` +
        `• /merge_cancel - отменить режим`,
        { reply_to_message_id: ctx.message.message_id }
    );
};

bot.command('merge_status', handleMergeStatus);
bot.command('m_status', handleMergeStatus);
bot.command('mst', handleMergeStatus);

// Handle merge_end command
const handleMergeEnd = async (ctx) => {
    const userId = ctx.from.id;
    
    // Check if in merge mode
    const mergeState = mergeStates.get(userId);
    if (!mergeState || !mergeState.isActive) {
        await ctx.reply(
            '❌ Вы не в режиме объединения. Сначала используйте /merge_start',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    // Check if there are notes to merge
    if (mergeState.notes.length === 0) {
        await ctx.reply(
            '❌ Нет заметок для объединения',
            { reply_to_message_id: ctx.message.message_id }
        );
        mergeStates.delete(userId);
        return;
    }
    
    console.log(`📊 Merging ${mergeState.notes.length} notes for user ${userId}`);
    
    // Merge all notes
    let mergedTitle = mergeState.notes.map(n => n.title).join(' / ');
    let mergedContent = mergeState.notes.map(n => n.content).join('\n\n////// \n\n');
    
    // Truncate title if too long
    if (mergedTitle.length > 200) {
        mergedTitle = mergedTitle.substring(0, 197) + '...';
    }
    
    try {
        // Save merged note
        await saveNoteToDatabase(mergedTitle, mergedContent, 'text');
        
        const notesCount = mergeState.notes.length;
        
        // Clear merge state
        mergeStates.delete(userId);
        
        await ctx.reply(
            `✨ Заметки успешно объединены!\n\n` +
            `📄 Объединено заметок: ${notesCount}\n` +
            `📝 *${mergedTitle}*`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Ошибка при объединении:', error);
        await ctx.reply(
            '❌ Ошибка при сохранении объединенной заметки',
            { reply_to_message_id: ctx.message.message_id }
        );
    }
};

bot.command('merge_end', handleMergeEnd);
bot.command('m_end', handleMergeEnd);
bot.command('me', handleMergeEnd);

// Handle merge_cancel command
const handleMergeCancel = async (ctx) => {
    const userId = ctx.from.id;
    
    // Check if in merge mode
    const mergeState = mergeStates.get(userId);
    if (!mergeState || !mergeState.isActive) {
        await ctx.reply(
            '❌ Вы не в режиме объединения',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    const notesCount = mergeState.notes.length;
    
    // Save accumulated notes separately if any
    if (notesCount > 0) {
        for (const note of mergeState.notes) {
            await saveNoteToDatabase(note.title, note.content, note.type, note.telegramMessageId);
        }
    }
    
    // Clear merge state
    mergeStates.delete(userId);
    
    await ctx.reply(
        `❌ Режим объединения отменен.\n` +
        (notesCount > 0 ? `📄 ${notesCount} заметок сохранены отдельно.` : ''),
        { reply_to_message_id: ctx.message.message_id }
    );
};

bot.command('merge_cancel', handleMergeCancel);
bot.command('m_cancel', handleMergeCancel);
bot.command('mc', handleMergeCancel);

// Handle merge command
const handleMerge = async (ctx) => {
    // Check if this is a reply
    if (!ctx.message.reply_to_message) {
        await ctx.reply(
            '❌ Используйте эту команду в ответ на сообщение, с которым хотите объединить последнюю заметку',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    // Check if we have a last created note
    if (!lastCreatedNote) {
        await ctx.reply(
            '❌ Нет последней заметки для объединения. Сначала создайте заметку.',
            { reply_to_message_id: ctx.message.message_id }
        );
        return;
    }
    
    const replyToId = ctx.message.reply_to_message.message_id;
    
    try {
        // Find the target note
        const targetNote = await findNoteByTelegramId(replyToId);
        
        if (!targetNote) {
            await ctx.reply(
                '❌ Не найдена заметка для этого сообщения',
                { reply_to_message_id: ctx.message.message_id }
            );
            return;
        }
        
        // Check if trying to merge with itself
        if (targetNote.id === lastCreatedNote.id) {
            await ctx.reply(
                '❌ Нельзя объединить заметку саму с собой',
                { reply_to_message_id: ctx.message.message_id }
            );
            return;
        }
        
        // Merge notes
        const mergedTitle = targetNote.title + ' / ' + lastCreatedNote.title;
        const mergedContent = targetNote.content + '\n\n////// \n\n' + lastCreatedNote.content;
        
        // Update target note
        await updateNote(targetNote.id, {
            title: mergedTitle,
            content: mergedContent
        });
        
        // Delete the last created note
        await axios.delete(`${API_URL}/notes/${lastCreatedNote.id}`, {
            headers: {
                'user-id': 'test-user-id'
            }
        });
        
        // Clear last created note
        lastCreatedNote = null;
        
        await ctx.reply(
            `✅ Заметки успешно объединены\n\n📝 *${mergedTitle}*`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Ошибка при объединении заметок:', error);
        await ctx.reply(
            '❌ Ошибка при объединении заметок',
            { reply_to_message_id: ctx.message.message_id }
        );
    }
};

bot.command('merge', handleMerge);
bot.command('m', handleMerge);

// Actual audio message handler
async function handleAudioMessage(ctx) {
    const audioFileId = ctx.message.audio.file_id;
    const messageId = ctx.message.message_id;
    const processingMsg = await ctx.reply('⏳ Начинаю обработку аудио файла...');
    const userId = ctx.from.id;
    
    try {
        // Download audio file
        const fileLink = await ctx.telegram.getFileLink(audioFileId);
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        
        // Save to temporary file
        const tempPath = path.join(__dirname, `temp_audio_${Date.now()}.mp3`);
        await fs.writeFile(tempPath, buffer);
        
        // Transcribe audio
        const transcription = await transcribeAudio(tempPath);
        
        // Clean up temp file
        await fs.unlink(tempPath).catch(console.error);
        
        if (!transcription || transcription.trim().length === 0) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply('❌ Не удалось распознать аудио файл');
            return;
        }
        
        // Generate title
        const title = await generateTitle(transcription);
        
        // Check if user is in merge mode
        const mergeState = mergeStates.get(userId);
        if (mergeState && mergeState.isActive) {
            // Add to merge queue
            mergeState.notes.push({
                title,
                content: transcription,
                type: 'voice',
                telegramMessageId: messageId
            });
            
            console.log(`📝 Added voice note to merge queue. User: ${userId}, Total notes: ${mergeState.notes.length}`);
            
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply(
                `✅ Заметка ${mergeState.notes.length} добавлена в очередь объединения\n\n📝 *${title}*\n${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`,
                {
                    reply_to_message_id: ctx.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }
        
        // Check if this is a reply to another message
        if (ctx.message.reply_to_message) {
            const replyToId = ctx.message.reply_to_message.message_id;
            const originalNote = await findNoteByTelegramId(replyToId);
            
            if (originalNote) {
                // Merge with existing note
                const mergedTitle = originalNote.title + ' / ' + title;
                const mergedContent = originalNote.content + '\n\n////// \n\n' + transcription;
                
                await updateNote(originalNote.id, {
                    title: mergedTitle,
                    content: mergedContent
                });
                
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
                await ctx.reply(
                    `🔄 Заметка объединена с существующей\n\n📝 *${mergedTitle}*`,
                    {
                        reply_to_message_id: ctx.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }
        }
        
        // Save as new note
        await saveNoteToDatabase(title, transcription, 'voice', messageId);
        
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Send success message
        await ctx.reply(
            `✅ Аудио файл успешно расшифрован и добавлен в приложение\n\n📝 *${title}*\n${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Ошибка обработки аудио файла:', error);
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        await ctx.reply('❌ Ошибка при обработке аудио файла', {
            reply_to_message_id: ctx.message.message_id
        });
    }
}

// Handle audio files (MP3, etc) - add to queue
bot.on('audio', (ctx) => {
    enqueueMessage(handleAudioMessage, ctx);
});

// Actual video message handler
async function handleVideoMessage(ctx) {
    const videoFileId = ctx.message.video.file_id;
    const messageId = ctx.message.message_id;
    const processingMsg = await ctx.reply('⏳ Начинаю обработку видео файла...');
    const userId = ctx.from.id;
    
    try {
        // Download video file
        const fileLink = await ctx.telegram.getFileLink(videoFileId);
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        
        // Save to temporary file
        const tempPath = path.join(__dirname, `temp_video_${Date.now()}.mp4`);
        await fs.writeFile(tempPath, buffer);
        
        // Try to transcribe directly (Whisper can handle video files)
        const transcription = await transcribeAudio(tempPath);
        
        // Clean up temp file
        await fs.unlink(tempPath).catch(console.error);
        
        if (!transcription || transcription.trim().length === 0) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply('❌ Не удалось извлечь аудио из видео файла');
            return;
        }
        
        // Generate title
        const title = await generateTitle(transcription);
        
        // Check if user is in merge mode
        const mergeState = mergeStates.get(userId);
        if (mergeState && mergeState.isActive) {
            // Add to merge queue
            mergeState.notes.push({
                title,
                content: transcription,
                type: 'voice',
                telegramMessageId: messageId
            });
            
            console.log(`📝 Added voice note to merge queue. User: ${userId}, Total notes: ${mergeState.notes.length}`);
            
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply(
                `✅ Заметка ${mergeState.notes.length} добавлена в очередь объединения\n\n📝 *${title}*\n${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`,
                {
                    reply_to_message_id: ctx.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }
        
        // Check if this is a reply to another message
        if (ctx.message.reply_to_message) {
            const replyToId = ctx.message.reply_to_message.message_id;
            const originalNote = await findNoteByTelegramId(replyToId);
            
            if (originalNote) {
                // Merge with existing note
                const mergedTitle = originalNote.title + ' / ' + title;
                const mergedContent = originalNote.content + '\n\n////// \n\n' + transcription;
                
                await updateNote(originalNote.id, {
                    title: mergedTitle,
                    content: mergedContent
                });
                
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
                await ctx.reply(
                    `🔄 Заметка объединена с существующей\n\n📝 *${mergedTitle}*`,
                    {
                        reply_to_message_id: ctx.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }
        }
        
        // Save as new note
        await saveNoteToDatabase(title, transcription, 'voice', messageId);
        
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Send success message
        await ctx.reply(
            `✅ Видео файл успешно расшифрован и добавлен в приложение\n\n📝 *${title}*\n${transcription.substring(0, 200)}${transcription.length > 200 ? '...' : ''}`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Ошибка обработки видео файла:', error);
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        await ctx.reply('❌ Ошибка при обработке видео файла', {
            reply_to_message_id: ctx.message.message_id
        });
    }
}

// Handle video files (MP4, etc) - add to queue
bot.on('video', (ctx) => {
    enqueueMessage(handleVideoMessage, ctx);
});

// Actual text message handler
async function handleTextMessage(ctx) {
    const text = ctx.message.text;
    const messageId = ctx.message.message_id;
    const userId = ctx.from.id;
    
    try {
        // Generate title from first 50 chars or first line
        const firstLine = text.split('\n')[0];
        const title = firstLine.length > 50 
            ? firstLine.substring(0, 47) + '...' 
            : firstLine;
        
        // Check if user is in merge mode
        const mergeState = mergeStates.get(userId);
        if (mergeState && mergeState.isActive) {
            // Add to merge queue
            mergeState.notes.push({
                title,
                content: text,
                type: 'text',
                telegramMessageId: messageId
            });
            
            console.log(`📝 Added text note to merge queue. User: ${userId}, Total notes: ${mergeState.notes.length}`);
            
            await ctx.reply(
                `✅ Заметка ${mergeState.notes.length} добавлена в очередь объединения\n\n📝 *${title}*`,
                {
                    reply_to_message_id: ctx.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }
        
        // Check if this is a reply to another message
        if (ctx.message.reply_to_message) {
            const replyToId = ctx.message.reply_to_message.message_id;
            const originalNote = await findNoteByTelegramId(replyToId);
            
            if (originalNote) {
                // Merge with existing note
                const mergedTitle = originalNote.title + ' / ' + title;
                const mergedContent = originalNote.content + '\n\n////// \n\n' + text;
                
                await updateNote(originalNote.id, {
                    title: mergedTitle,
                    content: mergedContent
                });
                
                await ctx.reply(
                    `🔄 Заметка объединена с существующей\n\n📝 *${mergedTitle}*`,
                    {
                        reply_to_message_id: ctx.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }
        }
        
        // Save as new note
        await saveNoteToDatabase(title, text, 'text', messageId);
        
        // Send confirmation
        await ctx.reply(
            `✅ Текстовая заметка добавлена в приложение\n\n📝 *${title}*`,
            {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Ошибка сохранения текстовой заметки:', error);
        await ctx.reply('❌ Ошибка при сохранении заметки', {
            reply_to_message_id: ctx.message.message_id
        });
    }
}

// Handle text messages - add to queue
bot.on('text', (ctx) => {
    // Skip commands
    if (!ctx.message.text.startsWith('/')) {
        enqueueMessage(handleTextMessage, ctx);
    }
});

// Launch bot
bot.launch()
    .then(() => {
        console.log('✅ Telegram бот запущен');
        console.log('📝 Поддержка: голосовые, текст, MP3, MP4');
        console.log('💾 Все сообщения сохраняются в единое приложение');
    })
    .catch(error => {
        console.error('❌ Ошибка запуска бота:', error);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));