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

  // X position calculation removed - now handled by frontend

  /**
   * Find the next available Y position in a column (fills gaps)
   */
  private async findNextAvailableY(userId: string, date: Date): Promise<number> {
    // Get all notes in this column that haven't been manually moved
    const notesInColumn = await this.prisma.note.findMany({
      where: {
        userId,
        date,
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
    
    // Find next available Y position (fills gaps)
    const y = await this.findNextAvailableY(userId, noteDate);

    // Create the note
    // X position is 0 for column notes (frontend will calculate actual position)
    return this.prisma.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        type: data.type,
        date: noteDate,
        x: 0, // X is calculated on frontend for column notes
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

    // Note: Column detection is now handled by frontend since X positions are calculated there
    // When a note is dragged out of a column, frontend should set manuallyPositioned = true
    
    console.log(`📍 Position update for note ${noteId}:`, {
      newPosition: { x, y },
    });

    return this.prisma.note.update({
      where: { id: noteId },
      data: {
        x,
        y,
        manuallyPositioned: true, // Any manual position update marks it as manually positioned
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