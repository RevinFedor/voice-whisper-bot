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
        for (const item of response.data) {
          if (item.filename && item.filename.endsWith('.md')) {
            try {
              const fileResponse = await axios.get(
                `${this.baseUrl}/vault/${encodeURIComponent(item.filename)}`,
                {
                  headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                  },
                }
              );

              if (fileResponse.data && fileResponse.data.tags) {
                fileResponse.data.tags.forEach((tag: string) => {
                  if (tag && tag !== 'tg-transcript') {
                    allTags.add(tag);
                  }
                });
              }
            } catch (e) {
              // Skip files with errors
              console.warn(`Error getting file ${item.filename}:`, e);
            }
          }
        }
      }

      return Array.from(allTags).sort();
    } catch (error) {
      console.error('Error fetching tags from Obsidian:', error);
      // Return empty array if Obsidian is not available
      return [];
    }
  }
}