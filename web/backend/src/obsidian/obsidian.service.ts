import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ObsidianService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    const host = process.env.OBSIDIAN_HOST || '127.0.0.1';
    const port = process.env.OBSIDIAN_PORT || '27123';
    this.baseUrl = `http://${host}:${port}`;
    this.apiKey = process.env.OBSIDIAN_API_KEY || '';
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
}