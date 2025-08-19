import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Note, NoteType, Prisma } from '@prisma/client';

// Layout configuration constants
const LAYOUT_CONFIG = {
  columnWidth: 180,
  columnSpacing: 50,
  rowHeight: 50,  // Уменьшено в 3 раза для компактности
  rowSpacing: 15, // Уменьшен интервал между карточками
  startX: 100,
  startY: 120,
  headerY: 50,
};

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to convert BigInt fields to strings for JSON serialization
   */
  private serializeNote(note: Note): any {
    return {
      ...note,
      telegramMessageId: note.telegramMessageId ? note.telegramMessageId.toString() : null,
      telegramChatId: note.telegramChatId ? note.telegramChatId.toString() : null,
    };
  }

  // X position calculation removed - now handled by frontend

  /**
   * Find the next available Y position in a column (fills gaps)
   */
  private async findNextAvailableY(userId: string, date: Date): Promise<number> {
    // Get start and end of day for date range query
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get all notes in this column that haven't been manually moved
    const notesInColumn = await this.prisma.note.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        manuallyPositioned: false, // Only include notes that are in the column
        isArchived: false,
      },
      orderBy: { y: 'asc' },
      select: { y: true },
    });

    // If no notes in column, return start position
    if (notesInColumn.length === 0) {
      return LAYOUT_CONFIG.startY;
    }

    // Look for gaps in the column
    let previousY = LAYOUT_CONFIG.startY - LAYOUT_CONFIG.rowHeight - LAYOUT_CONFIG.rowSpacing;
    
    for (const note of notesInColumn) {
      const expectedY = previousY + LAYOUT_CONFIG.rowHeight + LAYOUT_CONFIG.rowSpacing;
      
      // If there's a gap big enough for a note
      if (note.y - expectedY >= LAYOUT_CONFIG.rowHeight) {
        return expectedY;
      }
      previousY = note.y;
    }

    // No gaps found, add to end
    return notesInColumn[notesInColumn.length - 1].y + LAYOUT_CONFIG.rowHeight + LAYOUT_CONFIG.rowSpacing;
  }

  // Base date calculation removed - frontend uses TODAY=5000 as reference

  /**
   * Create a new note with automatic positioning
   */
  async createNote(userId: string, data: {
    title: string;
    content?: string;
    type: NoteType;
    date?: Date | string;
    x?: number;
    y?: number;
    manuallyPositioned?: boolean;
    tags?: string[];
    aiSuggestedTags?: any;
    telegramMessageId?: string;
  }): Promise<Note> {
    console.log('🔨 [NotesService] Creating note...');
    console.log('   userId:', userId);
    console.log('   title:', data.title);
    console.log('   type:', data.type);
    
    // No user management needed - app is local
    // Skip user creation completely - just use the userId as string identifier
    
    // Use provided date or current time
    let noteDate: Date;
    if (data.date) {
      noteDate = new Date(data.date);
    } else {
      noteDate = new Date(); // Current date and time
    }
    // Ensure it's a valid date
    if (isNaN(noteDate.getTime())) {
      noteDate = new Date(); // Fallback to current time if invalid
    }
    // Don't call setHours for UTC dates - they're already at midnight UTC
    
    // Check if position is provided (for merged notes)
    let x: number;
    let y: number;
    let manuallyPositioned: boolean;
    
    if (data.x !== undefined && data.y !== undefined) {
      // Use provided position (for merged notes)
      x = data.x;
      y = data.y;
      manuallyPositioned = data.manuallyPositioned ?? true;
      console.log('   📍 Using provided position: x=' + x + ', y=' + y);
    } else {
      // Find next available Y position (fills gaps)
      x = 0; // X is calculated on frontend for column notes
      y = await this.findNextAvailableY(userId, noteDate);
      manuallyPositioned = false;
      console.log('   🎯 Auto-positioning: x=0 (frontend will calculate), y=' + y);
      console.log('   📅 For date:', noteDate.toISOString());
    }

    // Create the note
    const createdNote = await this.prisma.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        type: data.type,
        date: noteDate,
        x,
        y,
        manuallyPositioned,
        tags: data.tags || [],
        aiSuggestedTags: data.aiSuggestedTags || null,
        telegramMessageId: data.telegramMessageId ? BigInt(data.telegramMessageId) : null,
      },
    });
    
    console.log('✅ [NotesService] Note created successfully!');
    console.log('   Note ID:', createdNote.id);
    console.log('   Position: x=' + x + ', y=' + y);
    console.log('   Date:', noteDate.toISOString());
    console.log('   Tags:', createdNote.tags);
    
    // Convert BigInt to string for JSON serialization
    return this.serializeNote(createdNote);
  }

  /**
   * Create a random note (for testing)
   */
  async createRandomNote(userId: string): Promise<Note> {
    const types: NoteType[] = ['voice', 'text'];
    const titles = [
      'Утренний стендап',
      'Идея для проекта',
      'Заметка с встречи',
      'TODO на завтра',
      'Важная мысль',
      'Код ревью',
      'Планы на неделю',
      'Обратная связь',
    ];
    
    const contents = [
      'Обсуждение текущих задач',
      'Нужно не забыть реализовать',
      'Интересная концепция для улучшения',
      'Список важных пунктов',
      'Требует дополнительного анализа',
    ];

    // Random date within last 7 days
    const daysAgo = Math.floor(Math.random() * 7);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);

    const type = types[Math.floor(Math.random() * types.length)];
    
    return this.createNote(userId, {
      title: titles[Math.floor(Math.random() * titles.length)],
      content: contents[Math.floor(Math.random() * contents.length)],
      type,
      date,
    });
  }

  /**
   * Get all notes for a user
   */
  async getNotes(userId: string, days: number = 14): Promise<Note[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const notes = await this.prisma.note.findMany({
      where: {
        userId,
        date: { gte: startDate },
        isArchived: false,
      },
      orderBy: [
        { date: 'desc' },
        { y: 'asc' },
      ],
    });
    
    // Convert BigInt fields to strings
    return notes.map(note => this.serializeNote(note));
  }

  /**
   * Get a single note by ID
   */
  async getNoteById(noteId: string, userId: string): Promise<Note> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }

    return this.serializeNote(note);
  }

  /**
   * Get a note by Telegram message ID
   */
  async getNoteByTelegramId(messageId: string, userId: string): Promise<Note> {
    const note = await this.prisma.note.findFirst({
      where: {
        telegramMessageId: BigInt(messageId),
        userId,
      },
    });

    if (!note) {
      throw new Error(`Note with Telegram message ID ${messageId} not found`);
    }

    return this.serializeNote(note);
  }

  /**
   * Update note content (title and text)
   */
  async updateNote(
    noteId: string,
    updateData: { title?: string; content?: string },
  ): Promise<Note> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    console.log(`📝 Content update for note ${noteId}:`, updateData);

    const updatedNote = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.content !== undefined && { content: updateData.content }),
        updatedAt: new Date(),
      },
    });
    
    return this.serializeNote(updatedNote);
  }

  /**
   * Update note position (when user drags it)
   */
  async updateNotePosition(
    noteId: string,
    x: number,
    y: number,
  ): Promise<Note> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Note: Column detection is now handled by frontend since X positions are calculated there
    // When a note is dragged out of a column, frontend should set manuallyPositioned = true
    
    console.log(`📍 Position update for note ${noteId}:`, {
      newPosition: { x, y },
    });

    const updatedNote = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        x,
        y,
        manuallyPositioned: true, // Any manual position update marks it as manually positioned
      },
    });
    
    return this.serializeNote(updatedNote);
  }

  /**
   * Update note date and time
   */
  async updateNoteDate(noteId: string, dateString: string): Promise<Note> {
    const newDate = new Date(dateString);
    
    // Validate date
    if (isNaN(newDate.getTime())) {
      throw new Error('Invalid date format');
    }

    // Получаем текущую заметку
    const currentNote = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!currentNote) {
      throw new Error('Note not found');
    }

    console.log('📅 [Notes] Updating note date');
    console.log(`   Note ID: ${noteId}`);
    console.log(`   New date: ${newDate.toISOString()}`);
    console.log(`   manuallyPositioned: ${currentNote.manuallyPositioned}`);

    // Подготавливаем данные для обновления
    const updateData: any = { 
      date: newDate,
    };

    // Если заметка не была перемещена вручную, пересчитываем позицию для новой колонки
    if (!currentNote.manuallyPositioned) {
      const newY = await this.findNextAvailableY(currentNote.userId, newDate);
      updateData.y = newY;
      updateData.x = 0; // X=0 для колоночных заметок, frontend пересчитает
      console.log(`   📍 Новая позиция в колонке: y=${newY}`);
    }

    const updatedNote = await this.prisma.note.update({
      where: { id: noteId },
      data: updateData,
    });
    
    return this.serializeNote(updatedNote);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    await this.prisma.note.delete({
      where: { id: noteId },
    });
  }

  /**
   * Delete multiple notes
   */
  async bulkDeleteNotes(noteIds: string[], userId: string): Promise<number> {
    console.log(`🗑️ Bulk delete request for notes:`, noteIds);
    console.log(`   User-ID:`, userId);
    
    const result = await this.prisma.note.deleteMany({
      where: {
        id: {
          in: noteIds,
        },
        userId: userId,
      },
    });
    
    console.log(`✅ Deleted ${result.count} notes`);
    return result.count;
  }

  /**
   * Get unique dates for columns
   */
  async getUniqueDates(userId: string): Promise<Date[]> {
    const notes = await this.prisma.note.findMany({
      where: {
        userId,
        isArchived: false,
      },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    });

    return notes.map(n => n.date);
  }

  /**
   * Initialize demo data
   */
  async initializeDemoData(userId: string): Promise<void> {
    // Check if user has notes
    const count = await this.prisma.note.count({
      where: { userId },
    });

    if (count > 0) {
      return; // Already has notes
    }

    // Create demo notes
    const demoNotes = [
      { title: 'Утренний стендап', content: 'Обсуждение задач на день', type: 'voice' as NoteType, daysAgo: 0 },
      { title: 'Список дел', content: '- Code review\n- Документация\n- Тесты', type: 'text' as NoteType, daysAgo: 0 },
      { title: 'Идея для проекта', content: 'Интеграция с внешним API', type: 'text' as NoteType, daysAgo: 1 },
      { title: 'Встреча с командой', content: 'Обсуждение архитектуры', type: 'voice' as NoteType, daysAgo: 1 },
      { title: 'Заметки по рефакторингу', content: 'Улучшить производительность', type: 'text' as NoteType, daysAgo: 2 },
    ];

    for (const note of demoNotes) {
      const date = new Date();
      date.setDate(date.getDate() - note.daysAgo);
      date.setHours(0, 0, 0, 0);

      await this.createNote(userId, {
        ...note,
        date,
      });
    }
  }
}