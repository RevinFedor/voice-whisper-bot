#!/usr/bin/env node

import dotenv from 'dotenv';
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

dotenv.config();

// Configuration
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const API_URL = 'http://localhost:3001/api'; // Web app backend URL

// Initialize bot and OpenAI
const bot = new Telegraf(TELEGRAM_TOKEN);
const openai = new OpenAI({
    apiKey: OPENAI_KEY,
});

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
async function saveNoteToDatabase(title, content, type = 'voice') {
    try {
        const response = await axios.post(`${API_URL}/notes`, {
            title,
            content,
            type,
            date: new Date().toISOString(),
            // Don't send x,y - let backend calculate position automatically
            tags: []
        }, {
            headers: {
                'user-id': 'test-user-id', // Same as web app to show on same canvas
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Ошибка сохранения в БД:', error);
        throw error;
    }
}

// Handle voice messages
bot.on('voice', async (ctx) => {
    const userId = ctx.from.id;
    const voiceFileId = ctx.message.voice.file_id;
    
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
        
        // Save to database
        await saveNoteToDatabase(title, transcription, 'voice');
        
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
        'Все заметки сохраняются в веб-приложение.\n' +
        'Просто отправьте мне любое сообщение!'
    );
});

// Handle audio files (MP3, etc)
bot.on('audio', async (ctx) => {
    const audioFileId = ctx.message.audio.file_id;
    const processingMsg = await ctx.reply('⏳ Начинаю обработку аудио файла...');
    
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
        
        // Save to database
        await saveNoteToDatabase(title, transcription, 'voice');
        
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
});

// Handle video files (MP4, etc) - extract audio and transcribe
bot.on('video', async (ctx) => {
    const videoFileId = ctx.message.video.file_id;
    const processingMsg = await ctx.reply('⏳ Начинаю обработку видео файла...');
    
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
        
        // Save to database
        await saveNoteToDatabase(title, transcription, 'voice');
        
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
});

// Handle text messages - save directly to database
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // Skip commands
    if (text.startsWith('/')) return;
    
    try {
        // Generate title from first 50 chars or first line
        const firstLine = text.split('\n')[0];
        const title = firstLine.length > 50 
            ? firstLine.substring(0, 47) + '...' 
            : firstLine;
        
        // Save to database
        await saveNoteToDatabase(title, text, 'text');
        
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