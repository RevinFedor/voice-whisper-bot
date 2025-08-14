import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiTitlesService } from './ai-titles.service';
import { GenerateTitleDto } from './dto/generate-title.dto';
import { TitleHistory } from '@prisma/client';

@ApiTags('ai-titles')
@Controller('api/ai-titles')
export class AiTitlesController {
  constructor(private readonly aiTitlesService: AiTitlesService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI title for a note' })
  @ApiResponse({ 
    status: 200, 
    description: 'Title generated successfully',
    type: Object 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Note not found' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Failed to generate title' 
  })
  async generateTitle(
    @Body() generateTitleDto: GenerateTitleDto,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<TitleHistory> {
    return this.aiTitlesService.generateTitle(
      generateTitleDto.noteId,
      generateTitleDto.prompt,
    );
  }

  @Get('history/:noteId')
  @ApiOperation({ summary: 'Get title history for a note' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns title history',
    type: [Object]
  })
  async getTitleHistory(
    @Param('noteId') noteId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<TitleHistory[]> {
    return this.aiTitlesService.getTitleHistory(noteId);
  }

  @Delete('history/:historyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a title from history' })
  @ApiResponse({ 
    status: 204, 
    description: 'Title deleted from history' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'History item not found' 
  })
  async deleteTitleFromHistory(
    @Param('historyId') historyId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<void> {
    return this.aiTitlesService.deleteTitleFromHistory(historyId);
  }

  @Post('apply/:noteId/:historyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a title from history to the note' })
  @ApiResponse({ 
    status: 204, 
    description: 'Title applied successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Note or history item not found' 
  })
  async applyTitleFromHistory(
    @Param('noteId') noteId: string,
    @Param('historyId') historyId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<void> {
    return this.aiTitlesService.applyTitleFromHistory(noteId, historyId);
  }

  @Post('save-current/:noteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save current title to history as manual' })
  @ApiResponse({ 
    status: 200, 
    description: 'Title saved to history',
    type: Object
  })
  async saveCurrentTitleToHistory(
    @Param('noteId') noteId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<TitleHistory | null> {
    return this.aiTitlesService.saveCurrentTitleToHistory(noteId);
  }
}