import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateDateDto } from './dto/update-date.dto';
import { Note } from '@prisma/client';
export declare class NotesController {
    private readonly notesService;
    constructor(notesService: NotesService);
    getNotes(userId?: string, days?: string): Promise<Note[]>;
    getNoteByTelegramId(messageId: string, userId?: string): Promise<Note>;
    getNoteById(noteId: string, userId?: string): Promise<Note>;
    createNote(userId: string, createNoteDto: CreateNoteDto): Promise<Note>;
    createRandomNote(userId?: string): Promise<Note>;
    initializeDemoData(userId?: string): Promise<{
        message: string;
    }>;
    updateNote(noteId: string, updateData: {
        title?: string;
        content?: string;
    }): Promise<Note>;
    updatePosition(noteId: string, updatePositionDto: UpdatePositionDto): Promise<Note>;
    updateDate(noteId: string, updateDateDto: UpdateDateDto): Promise<Note>;
    bulkDeleteNotes(data: {
        noteIds: string[];
    }, userId?: string): Promise<{
        message: string;
        deletedCount: number;
    }>;
    deleteNote(noteId: string): Promise<{
        message: string;
    }>;
    getUniqueDates(userId?: string): Promise<Date[]>;
}
