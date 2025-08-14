import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { AiTagsService } from './ai-tags.service';
import { GenerateTagsDto } from './dto/generate-tags.dto';

@Controller('api/tags')
export class AiTagsController {
  constructor(private readonly aiTagsService: AiTagsService) {}

  @Post('generate')
  async generateTags(@Body() dto: GenerateTagsDto) {
    return this.aiTagsService.generateTags(dto.noteId, dto.prompt);
  }

  @Get('history/:noteId')
  async getHistory(@Param('noteId') noteId: string) {
    return this.aiTagsService.getHistory(noteId);
  }

  @Delete('history/:noteId')
  async clearHistory(@Param('noteId') noteId: string) {
    return this.aiTagsService.clearHistory(noteId);
  }

  @Post('update/:noteId')
  async updateNoteTags(
    @Param('noteId') noteId: string,
    @Body() body: { tags: string[] },
  ) {
    return this.aiTagsService.updateNoteTags(noteId, body.tags);
  }
  
  @Post('update-suggestions/:noteId')
  async updateAiSuggestions(
    @Param('noteId') noteId: string,
    @Body() body: { aiSuggestions: any[] },
  ) {
    return this.aiTagsService.updateAiSuggestions(noteId, body.aiSuggestions);
  }

  @Get('obsidian')
  async getObsidianTags() {
    return this.aiTagsService.getObsidianTags();
  }
}