import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ObsidianService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultFolder: string;

  constructor(private prisma: PrismaService) {
    const host = process.env.OBSIDIAN_HOST || '127.0.0.1';
    const port = process.env.OBSIDIAN_PORT || '27123';
    this.baseUrl = `http://${host}:${port}`;
    this.apiKey = process.env.OBSIDIAN_API_KEY || '';
    this.defaultFolder = process.env.OBSIDIAN_FOLDER || 'Telegram Voice Notes';
  }

  async getAllTags(): Promise<string[]> {
    try {
      // Get all files with tags using search
      const response = await axios.post(
        `${this.baseUrl}/search/`,
        {
          '!=': [{ var: 'tags' }, []],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/vnd.olrapi.jsonlogic+json',
          },
        }
      );

      const allTags = new Set<string>();

      // For each file, get its metadata
      if (response.data && Array.isArray(response.data)) {
        
        // Process all files
        for (const item of response.data) {
          if (item.filename && item.filename.endsWith('.md')) {
            try {
              const fileResponse = await axios.get(
                `${this.baseUrl}/vault/${encodeURIComponent(item.filename)}`,
                {
                  headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    Accept: 'application/json',
                  },
                }
              );

              // Если data это строка, значит API возвращает только контент
              // Нужно искать теги в frontmatter или использовать другой endpoint
              if (typeof fileResponse.data === 'string') {
                // Попробуем извлечь теги из frontmatter
                const frontmatterMatch = fileResponse.data.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                  const frontmatter = frontmatterMatch[1];
                  
                  // Два формата: tags: [tag1, tag2] или tags:\n  - tag1\n  - tag2
                  // Сначала пробуем формат списка YAML
                  const yamlListMatch = frontmatter.match(/tags:\s*\n((?:\s*-\s*.+\n?)+)/);
                  if (yamlListMatch) {
                    const tagsList = yamlListMatch[1];
                    const tags = tagsList.match(/-\s*(.+)/g)?.map(t => t.replace(/-\s*/, '').trim()) || [];
                    tags.forEach(tag => {
                      if (tag && tag !== 'tg-transcript') {
                        allTags.add(tag);
                      }
                    });
                  } else {
                    // Пробуем формат inline [tag1, tag2]
                    const inlineMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
                    if (inlineMatch) {
                      const tagsString = inlineMatch[1];
                      const tags = tagsString.split(',').map(t => t.trim().replace(/['"]/g, ''));
                      tags.forEach(tag => {
                        if (tag && tag !== 'tg-transcript') {
                          allTags.add(tag);
                        }
                      });
                    }
                  }
                }
              } else if (fileResponse.data && fileResponse.data.tags) {
                fileResponse.data.tags.forEach((tag: string) => {
                  if (tag && tag !== 'tg-transcript') {
                    allTags.add(tag);
                  }
                });
              }
            } catch (e) {
              // Skip files with errors silently
            }
          }
        }
      }

      const result = Array.from(allTags).sort();
      return result;
    } catch (error) {
      // Return empty array if Obsidian is not available
      console.log('⚠️ [Obsidian] Недоступен, используем пустой список тегов');
      return [];
    }
  }

  async exportNote(noteId: string, folder?: string): Promise<{
    success: boolean;
    filepath?: string;
    vaultName?: string;
    obsidianUrl?: string;
    error?: string;
  }> {
    try {
      // Получаем заметку из БД
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
      });

      if (!note) {
        throw new Error('Note not found');
      }

      // Формируем путь к файлу
      const targetFolder = folder || this.defaultFolder;
      // Sanitize filename - удаляем недопустимые символы для имени файла
      let sanitizedTitle = note.title
        .replace(/[\/\\:*?"<>|]/g, '') // Удаляем недопустимые символы
        .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
        .trim();
      
      // Ограничиваем длину имени файла (252 символа максимум для учета .md расширения)
      // Также учитываем длину пути к папке
      const maxFilenameLength = 200; // Безопасное значение с учетом пути
      if (sanitizedTitle.length > maxFilenameLength) {
        sanitizedTitle = sanitizedTitle.substring(0, maxFilenameLength).trim();
        console.log(`   ⚠️ Имя файла сокращено до ${maxFilenameLength} символов`);
      }
      
      const filename = `${sanitizedTitle}.md`;
      const filepath = `${targetFolder}/${filename}`;

      // Формируем frontmatter
      const formattedDate = note.date.toISOString().slice(0, 16).replace('T', ' ');
      const tags = note.tags?.length > 0 ? note.tags : [];
      
      // Экранируем title для YAML (заключаем в кавычки если содержит спецсимволы)
      const escapedTitle = note.title.includes(':') || note.title.includes('"') || note.title.includes('\n')
        ? `"${note.title.replace(/"/g, '\\"')}"` 
        : note.title;

      // Формируем YAML frontmatter
      let frontmatter = `---
title: ${escapedTitle}
date: "${formattedDate}"
source: WebApplication`;

      // Добавляем tags только если они есть
      if (tags.length > 0) {
        frontmatter += `\ntags:\n  - ${tags.join('\n  - ')}`;
      }
      // Если тегов нет - не добавляем поле tags вообще

      frontmatter += `\ncreated: "${note.createdAt.toISOString()}"
---`;

      const content = `${frontmatter}

${note.content || ''}`;

      // Отправляем в Obsidian
      console.log('📤 [Obsidian] Отправка запроса на экспорт...');
      console.log(`   🔗 URL: ${this.baseUrl}/vault/${encodeURIComponent(filepath)}`);
      
      const response = await axios.put(
        `${this.baseUrl}/vault/${encodeURIComponent(filepath)}`,
        content,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'text/markdown',
          },
          // Не пытаемся парсить ответ как JSON, так как Obsidian возвращает пустой ответ
          responseType: 'text',
          // Принимаем любой статус 2xx как успешный
          validateStatus: (status) => status >= 200 && status < 300,
        }
      );

      console.log(`   📊 Статус ответа: ${response.status}`);
      
      // Obsidian API возвращает 200 или 204 при успехе
      if (response.status === 200 || response.status === 204) {
        console.log('✅ [Obsidian] Заметка успешно экспортирована');
        console.log(`   📝 Заголовок: ${note.title}`);
        console.log(`   📁 Папка: ${targetFolder}`);
        console.log(`   🏷️ Теги: ${tags.length > 0 ? tags.join(', ') : 'нет'}`);

        // Удаляем заметку из БД после успешного экспорта
        await this.prisma.note.delete({
          where: { id: noteId },
        });
        console.log('   🗑️ Заметка удалена из БД');

        // Формируем URL для открытия в Obsidian
        const vaultName = process.env.OBSIDIAN_VAULT_NAME || 'Obsidian';
        // Для Obsidian URL нужно использовать только имя файла, не полный путь
        const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filepath)}`;

        return {
          success: true,
          filepath: targetFolder,
          vaultName,
          obsidianUrl,
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [Obsidian] Ошибка экспорта:');
      console.error('   Сообщение:', error.message);
      if (error.response) {
        console.error('   Статус:', error.response.status);
        console.error('   Данные:', error.response.data);
      }
      if (error.code) {
        console.error('   Код ошибки:', error.code);
      }
      
      // Более подробное сообщение об ошибке
      let errorMessage = 'Failed to export note';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Obsidian API недоступен. Убедитесь, что Obsidian запущен и REST API активен';
      } else if (error.response?.status === 401) {
        errorMessage = 'Неверный API ключ для Obsidian';
      } else if (error.response?.status === 404) {
        errorMessage = 'Путь не найден в Obsidian vault';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}