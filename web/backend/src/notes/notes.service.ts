import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Note, NoteType, Prisma } from '@prisma/client';

// Layout configuration constants
const LAYOUT_CONFIG = {
  columnWidth: 180,
  columnSpacing: 50,
  rowHeight: 150,
  rowSpacing: 30,
  startX: 100,
  startY: 120,
  headerY: 50,
};

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate X position for a date column
   */
  private calculateColumnX(date: Date, baseDate: Date): number {
    // Normalize both dates to start of day to avoid time component issues
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    const normalizedBase = new Date(baseDate);
    normalizedBase.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((normalizedDate.getTime() - normalizedBase.getTime()) / (24 * 60 * 60 * 1000));
    return LAYOUT_CONFIG.startX + (daysDiff * (LAYOUT_CONFIG.columnWidth + LAYOUT_CONFIG.columnSpacing));
  }

  /**
   * Find the next available Y position in a column (fills gaps)
   */
  private async findNextAvailableY(userId: string, date: Date, columnX: number): Promise<number> {
    // Get all notes in this column that haven't been manually moved
    const notesInColumn = await this.prisma.note.findMany({
      where: {
        userId,
        date,
        OR: [
          { manuallyPositioned: false },
          { x: columnX }, // Include notes that were moved back to column
        ],
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

  /**
   * Get earliest date from all notes (for base date calculation)
   */
  private async getBaseDate(userId: string): Promise<Date> {
    const earliestNote = await this.prisma.note.findFirst({
      where: { userId, isArchived: false },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    // If no notes, use today - 7 days
    if (!earliestNote) {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      return date;
    }

    return earliestNote.date;
  }

  /**
   * Create a new note with automatic positioning
   */
  async createNote(userId: string, data: {
    title: string;
    content?: string;
    type: NoteType;
    date?: Date | string;
    voiceDuration?: number;
    voiceFileUrl?: string;
  }): Promise<Note> {
    // Get or create test user if needed (for development)
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // Create test user for development
      user = await this.prisma.user.create({
        data: {
          id: userId,
          telegramId: BigInt(123456789),
          telegramUsername: 'test_user',
          firstName: 'Test',
        },
      });
    }

    // Use provided date or today
    let noteDate: Date;
    if (data.date) {
      // Handle both Date object and string format
      if (typeof data.date === 'string') {
        // Parse YYYY-MM-DD format
        noteDate = new Date(data.date);
      } else {
        noteDate = new Date(data.date);
      }
    } else {
      noteDate = new Date();
    }
    // Ensure it's a valid date
    if (isNaN(noteDate.getTime())) {
      noteDate = new Date();
    }
    // Set to beginning of day in local timezone
    noteDate.setHours(0, 0, 0, 0);

    // Get base date for column calculation
    const baseDate = await this.getBaseDate(userId);
    
    // Calculate column X position
    const columnX = this.calculateColumnX(noteDate, baseDate);
    
    // Find next available Y position (fills gaps)
    const y = await this.findNextAvailableY(userId, noteDate, columnX);

    // Create the note
    return this.prisma.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        type: data.type,
        date: noteDate,
        x: columnX,
        y,
        manuallyPositioned: false,
        voiceDuration: data.voiceDuration,
        voiceFileUrl: data.voiceFileUrl,
      },
    });
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
      voiceDuration: type === 'voice' ? Math.floor(Math.random() * 300) : undefined,
    });
  }

  /**
   * Get all notes for a user
   */
  async getNotes(userId: string, days: number = 14): Promise<Note[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.prisma.note.findMany({
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

    // Check if note is being moved back to its original column
    const baseDate = await this.getBaseDate(note.userId);
    const originalColumnX = this.calculateColumnX(note.date, baseDate);
    
    // Check if note is within column bounds (column width is 180)
    const columnThreshold = LAYOUT_CONFIG.columnWidth / 2; // Allow some flexibility
    const isBackInColumn = Math.abs(x - originalColumnX) < columnThreshold;
    
    console.log(`📍 Position update for note ${noteId}:`, {
      newPosition: { x, y },
      originalColumnX,
      isBackInColumn,
      manuallyPositioned: !isBackInColumn,
    });

    return this.prisma.note.update({
      where: { id: noteId },
      data: {
        x,
        y,
        manuallyPositioned: !isBackInColumn,
      },
    });
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
        voiceDuration: note.type === 'voice' ? 120 : undefined,
      });
    }
  }
}