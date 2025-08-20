import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateDateDto } from './dto/update-date.dto';
import { Note } from '@prisma/client';

@ApiTags('notes')
@Controller('api/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notes for a user' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to fetch (if not specified, returns ALL notes)' })
  @ApiResponse({ status: 200, description: 'Returns all notes' })
  async getNotes(
    @Headers('user-id') userId: string = 'test-user-id',
    @Query('days') days?: string,
  ): Promise<Note[]> {
    const daysNumber = days ? parseInt(days, 10) : undefined;
    return this.notesService.getNotes(userId, daysNumber);
  }

  @Get('telegram/:messageId')
  @ApiOperation({ summary: 'Get a note by Telegram message ID' })
  @ApiResponse({ status: 200, description: 'Returns the note' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async getNoteByTelegramId(
    @Param('messageId') messageId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<Note> {
    return this.notesService.getNoteByTelegramId(messageId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single note by ID' })
  @ApiResponse({ status: 200, description: 'Returns the note' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async getNoteById(
    @Param('id') noteId: string,
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<Note> {
    return this.notesService.getNoteById(noteId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  async createNote(
    @Headers('user-id') userId: string = 'test-user-id',
    @Body() createNoteDto: CreateNoteDto,
  ): Promise<Note> {
    console.log('📮 [Notes] POST /api/notes request received');
    console.log('   User-ID:', userId);
    console.log('   Title:', createNoteDto.title);
    console.log('   Type:', createNoteDto.type);
    console.log('   Date:', createNoteDto.date);
    console.log('   Tags:', createNoteDto.tags);
    
    return this.notesService.createNote(userId, {
      ...createNoteDto,
      date: createNoteDto.date,
    });
  }

  @Post('random')
  @ApiOperation({ summary: 'Create a random note (for testing)' })
  @ApiResponse({ status: 201, description: 'Random note created successfully' })
  async createRandomNote(
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<Note> {
    return this.notesService.createRandomNote(userId);
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize demo data' })
  @ApiResponse({ status: 201, description: 'Demo data initialized' })
  async initializeDemoData(
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<{ message: string }> {
    await this.notesService.initializeDemoData(userId);
    return { message: 'Demo data initialized successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note content (title and text)' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  async updateNote(
    @Param('id') noteId: string,
    @Body() updateData: { title?: string; content?: string },
  ): Promise<Note> {
    return this.notesService.updateNote(noteId, updateData);
  }

  @Patch(':id/position')
  @ApiOperation({ summary: 'Update note position (after drag)' })
  @ApiResponse({ status: 200, description: 'Position updated successfully' })
  async updatePosition(
    @Param('id') noteId: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ): Promise<Note> {
    return this.notesService.updateNotePosition(
      noteId,
      updatePositionDto.x,
      updatePositionDto.y,
    );
  }

  @Patch(':id/date')
  @ApiOperation({ summary: 'Update note date and time' })
  @ApiResponse({ status: 200, description: 'Date updated successfully' })
  async updateDate(
    @Param('id') noteId: string,
    @Body() updateDateDto: UpdateDateDto,
  ): Promise<Note> {
    return this.notesService.updateNoteDate(noteId, updateDateDto.date);
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Delete multiple notes' })
  @ApiResponse({ status: 200, description: 'Notes deleted successfully' })
  async bulkDeleteNotes(
    @Body() data: { noteIds: string[] },
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<{ message: string; deletedCount: number }> {
    const deletedCount = await this.notesService.bulkDeleteNotes(data.noteIds, userId);
    return { 
      message: `Successfully deleted ${deletedCount} notes`,
      deletedCount 
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  async deleteNote(@Param('id') noteId: string): Promise<{ message: string }> {
    await this.notesService.deleteNote(noteId);
    return { message: 'Note deleted successfully' };
  }

  @Get('dates')
  @ApiOperation({ summary: 'Get unique dates for columns' })
  @ApiResponse({ status: 200, description: 'Returns unique dates' })
  async getUniqueDates(
    @Headers('user-id') userId: string = 'test-user-id',
  ): Promise<Date[]> {
    return this.notesService.getUniqueDates(userId);
  }
}