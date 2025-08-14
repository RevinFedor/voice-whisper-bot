import { Controller, Post, Body } from '@nestjs/common';
import { ObsidianService } from './obsidian.service';
import { ExportNoteDto } from './dto/export-note.dto';

@Controller('api/obsidian')
export class ObsidianController {
  constructor(private readonly obsidianService: ObsidianService) {}

  @Post('export')
  async exportNote(@Body() dto: ExportNoteDto) {
    return this.obsidianService.exportNote(dto.noteId, dto.folder);
  }
}