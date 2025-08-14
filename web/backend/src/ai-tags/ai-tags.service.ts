import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObsidianService } from '../obsidian/obsidian.service';
import OpenAI from 'openai';

@Injectable()
export class AiTagsService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private obsidianService: ObsidianService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async generateTags(noteId: string, customPrompt?: string) {
    // Логирование начала генерации
    if (customPrompt) {
      console.log('🎯 [Tags] Кастомная генерация');
      console.log('   📝 Промпт:', customPrompt);
    } else {
      console.log('🤖 [Tags] Default генерация');
    }
    
    // Get note details
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Get available tags from Obsidian
    const availableTags = await this.obsidianService.getAllTags();
    console.log(`   📚 Доступно тегов в Obsidian: ${availableTags.length}`);

    // Build the prompt
    const defaultPrompt = `Проанализируй содержимое заметки и предложи релевантные теги.
Учитывай:
- Существующие теги в системе: ${availableTags.length > 0 ? availableTags.join(', ') : 'нет доступных тегов'}
- Тематику и контекст заметки
- Предложи 5-7 тегов
- Смешай существующие подходящие и новые теги
- НЕ добавляй # перед тегами
- Если тег состоит из нескольких слов, используй нижнее подчеркивание между словами (например: web_development)

Формат ответа JSON:
{
  "existing": ["тег1", "тег2"], // теги которые ТОЧНО есть в списке существующих
  "new": ["новый_тег1", "новый_тег2"] // новые предложенные теги
}`;

    let fullPrompt = defaultPrompt;
    if (customPrompt) {
      fullPrompt += `\n\nДополнительные требования от пользователя: ${customPrompt}`;
    }

    const noteContent = `
Заголовок: ${note.title}
Содержимое: ${note.content || 'Пусто'}
Текущие теги: ${note.tags?.length > 0 ? note.tags.join(', ') : 'нет'}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: fullPrompt,
          },
          {
            role: 'user',
            content: noteContent,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      const result = JSON.parse(response);

      // Ensure arrays exist
      const existingTags = result.existing || [];
      const newTags = result.new || [];
      const allTags = [...existingTags, ...newTags];
      
      // Красивое логирование результатов
      console.log(`   ✅ Сгенерировано тегов: ${allTags.length}`);
      if (existingTags.length > 0) {
        console.log(`   📌 Существующие: ${existingTags.map(t => `#${t}`).join(', ')}`);
      }
      if (newTags.length > 0) {
        console.log(`   🆕 Новые: ${newTags.map(t => `#${t}`).join(', ')}`);
      }

      // Save to history only if custom prompt was provided
      if (customPrompt) {
        await this.prisma.tagHistory.create({
          data: {
            noteId,
            tags: allTags,
            existingTags,
            newTags,
            prompt: customPrompt,
            model: 'gpt-4o-mini',
          },
        });
        console.log('   💾 Сохранено в историю');
      }

      return {
        tags: allTags.map(tag => ({
          text: tag.startsWith('#') ? tag : `#${tag}`,
          isNew: newTags.includes(tag),
        })),
        existingTags,
        newTags,
      };
    } catch (error) {
      console.error('   ❌ Ошибка генерации тегов:', error.message);
      throw new Error('Failed to generate tags');
    }
  }

  async getHistory(noteId: string) {
    const history = await this.prisma.tagHistory.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📜 [Tags] Загрузка истории: ${history.length} записей`);

    return history.map(item => ({
      id: item.id,
      tags: item.tags.map(tag => ({
        text: tag.startsWith('#') ? tag : `#${tag}`,
        isNew: item.newTags.includes(tag),
      })),
      existingTags: item.existingTags,
      newTags: item.newTags,
      prompt: item.prompt,
      createdAt: item.createdAt,
    }));
  }

  async clearHistory(noteId: string) {
    const result = await this.prisma.tagHistory.deleteMany({
      where: { noteId },
    });
    
    console.log(`🗑️ [Tags] История очищена: удалено ${result.count} записей`);

    return { success: true };
  }

  async updateNoteTags(noteId: string, tags: string[]) {
    // Remove # from tags before saving
    const cleanTags = tags.map(tag => tag.replace(/^#/, ''));
    
    console.log('📝 [Tags] Обновление тегов заметки');
    console.log(`   🏷️ Теги: ${cleanTags.map(t => `#${t}`).join(', ')}`);
    console.log(`   📊 Количество: ${cleanTags.length}`);

    await this.prisma.note.update({
      where: { id: noteId },
      data: { tags: cleanTags },
    });

    return { success: true, tags: cleanTags };
  }

  async getObsidianTags() {
    const tags = await this.obsidianService.getAllTags();
    console.log(`🏷️ [Tags] Запрос тегов Obsidian: найдено ${tags.length}`);
    return tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  }
}