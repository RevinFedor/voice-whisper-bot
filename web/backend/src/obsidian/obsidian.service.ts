import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ObsidianService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultFolder: string;

  constructor(private prisma: PrismaService) {
    if (!process.env.OBSIDIAN_HOST) throw new Error('OBSIDIAN_HOST is required in environment variables');
    if (!process.env.OBSIDIAN_PORT) throw new Error('OBSIDIAN_PORT is required in environment variables');
    if (!process.env.OBSIDIAN_API_KEY) throw new Error('OBSIDIAN_API_KEY is required in environment variables');
    if (!process.env.OBSIDIAN_FOLDER) throw new Error('OBSIDIAN_FOLDER is required in environment variables');
    
    const host = process.env.OBSIDIAN_HOST;
    const port = process.env.OBSIDIAN_PORT;
    this.baseUrl = `http://${host}:${port}`;
    this.apiKey = process.env.OBSIDIAN_API_KEY;
    this.defaultFolder = process.env.OBSIDIAN_FOLDER;
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

      // Формируем frontmatter для Obsidian
      // Форматируем дату в локальном часовом поясе вместо UTC
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };
      
      const dateForDisplay = formatLocalDate(note.date);
      const tags = note.tags?.length > 0 ? note.tags : [];
      
      // Экранируем title для YAML (заключаем в кавычки если содержит спецсимволы)
      const escapedTitle = note.title.includes(':') || note.title.includes('"') || note.title.includes('\n')
        ? `"${note.title.replace(/"/g, '\\"')}"` 
        : note.title;

      // Формируем YAML frontmatter - только необходимые поля
      let frontmatter = `---
title: ${escapedTitle}
date: "${dateForDisplay}"
source: WebApplication`;

      // Добавляем tags только если они есть
      if (tags.length > 0) {
        frontmatter += `\ntags:\n  - ${tags.join('\n  - ')}`;
      }
      // Если тегов нет - не добавляем поле tags вообще

      frontmatter += `\n---`;

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

        // Устанавливаем правильные системные даты файла
        await this.setFileDates(filepath, note.date, note.updatedAt);

        // Удаляем заметку из БД после успешного экспорта
        await this.prisma.note.delete({
          where: { id: noteId },
        });
        console.log('   🗑️ Заметка удалена из БД');

        // Формируем URL для открытия в Obsidian
        if (!process.env.OBSIDIAN_VAULT_NAME) throw new Error('OBSIDIAN_VAULT_NAME is required in environment variables');
        const vaultName = process.env.OBSIDIAN_VAULT_NAME;
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

  /**
   * Устанавливает системные даты создания и модификации файла
   * Использует команду SetFile на macOS
   */
  private async setFileDates(filepath: string, createdDate: Date, modifiedDate: Date): Promise<void> {
    try {
      // Получаем путь к vault
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '/Users/fedor/Documents/Obsidian Vault';
      const fullPath = `${vaultPath}/${filepath}`;
      
      // Форматируем даты для SetFile (MM/DD/YYYY HH:MM:SS)
      const formatDate = (date: Date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
      };
      
      const createdStr = formatDate(createdDate);
      const modifiedStr = formatDate(modifiedDate);
      
      // Устанавливаем дату создания
      await execAsync(`SetFile -d '${createdStr}' "${fullPath}"`);
      console.log(`   📅 Дата создания установлена: ${createdStr}`);
      
      // Устанавливаем дату модификации
      await execAsync(`SetFile -m '${modifiedStr}' "${fullPath}"`);
      console.log(`   📅 Дата модификации установлена: ${modifiedStr}`);
      
    } catch (error) {
      // Не критичная ошибка - файл создан, просто даты системные не изменены
      console.warn(`   ⚠️ Не удалось изменить системные даты: ${error.message}`);
      console.log(`   ℹ️ Файл создан с правильным frontmatter (created/modified)`);
    }
  }
}