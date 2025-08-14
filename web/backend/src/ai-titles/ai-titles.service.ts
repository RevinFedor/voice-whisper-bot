import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { TitleHistory, TitleType } from '@prisma/client';

@Injectable()
export class AiTitlesService {
  private openai: OpenAI;
  
  // Default prompt для генерации заголовков
  private readonly DEFAULT_PROMPT = `
    Ты - эксперт по созданию заголовков для заметок.
    Создай краткий, информативный и запоминающийся заголовок для заметки.
    Требования:
    - Заголовок должен быть на том же языке, что и контент
    - Максимум 60 символов
    - Отражать основную суть заметки
    - Быть понятным и лаконичным
    - Не использовать специальные символы: / \ : * ? " < > |
    
    Верни ТОЛЬКО заголовок, без кавычек и дополнительного текста.
  `;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_KEY is not configured');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Generate AI title for a note
   */
  async generateTitle(noteId: string, customPrompt?: string): Promise<TitleHistory> {
    // Get the note
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    // Save current title as manual if it's different from what we have in history
    if (note.title) {
      const existingHistory = await this.prisma.titleHistory.findFirst({
        where: {
          noteId,
          title: note.title,
        },
      });

      if (!existingHistory) {
        await this.prisma.titleHistory.create({
          data: {
            noteId,
            title: note.title,
            type: TitleType.manual,
          },
        });
      }
    }

    try {
      // Build the prompt
      const systemPrompt = customPrompt 
        ? `${this.DEFAULT_PROMPT}\n\nДополнительные требования от пользователя: ${customPrompt}`
        : this.DEFAULT_PROMPT;

      // Логируем использование промпта
      if (customPrompt) {
        console.log(`🎨 AI Title Generation with custom prompt for note ${noteId}:`);
        console.log(`   Custom prompt: "${customPrompt}"`);
      } else {
        console.log(`🤖 AI Title Generation with DEFAULT prompt for note ${noteId}`);
      }

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Создай заголовок для следующей заметки:\n\n${note.content || 'Пустая заметка'}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const generatedTitle = completion.choices[0]?.message?.content?.trim();
      
      if (!generatedTitle) {
        throw new Error('Failed to generate title');
      }

      // Clean the title from forbidden characters
      const cleanTitle = generatedTitle.replace(/[\/\\:*?"<>|]/g, '');

      console.log(`✅ Generated title: "${cleanTitle}"`);

      // Save to history
      const titleHistory = await this.prisma.titleHistory.create({
        data: {
          noteId,
          title: cleanTitle,
          type: TitleType.ai,
          prompt: customPrompt || null,
          model: 'gpt-4o-mini',
        },
      });

      // Update the note's title
      await this.prisma.note.update({
        where: { id: noteId },
        data: { title: cleanTitle },
      });

      console.log(`💾 Title saved to history with ID: ${titleHistory.id}`);

      return titleHistory;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new InternalServerErrorException('Failed to generate title');
    }
  }

  /**
   * Get title history for a note
   */
  async getTitleHistory(noteId: string): Promise<TitleHistory[]> {
    return this.prisma.titleHistory.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a title from history
   */
  async deleteTitleFromHistory(historyId: string): Promise<void> {
    await this.prisma.titleHistory.delete({
      where: { id: historyId },
    });
  }

  /**
   * Apply a title from history to the note
   */
  async applyTitleFromHistory(noteId: string, historyId: string): Promise<void> {
    const historyItem = await this.prisma.titleHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyItem || historyItem.noteId !== noteId) {
      throw new NotFoundException('Title history item not found');
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { title: historyItem.title },
    });
  }

  /**
   * Save current title to history as manual
   */
  async saveCurrentTitleToHistory(noteId: string): Promise<TitleHistory | null> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note || !note.title) {
      console.log(`⚠️ Note ${noteId} has no title to save`);
      return null;
    }

    // Check if this title already exists in history
    const existing = await this.prisma.titleHistory.findFirst({
      where: {
        noteId,
        title: note.title,
      },
    });

    if (existing) {
      console.log(`ℹ️ Title "${note.title}" already exists in history for note ${noteId}`);
      return existing;
    }

    const saved = await this.prisma.titleHistory.create({
      data: {
        noteId,
        title: note.title,
        type: TitleType.manual,
      },
    });

    console.log(`✅ Saved manual title "${note.title}" to history for note ${noteId}`);
    return saved;
  }
}