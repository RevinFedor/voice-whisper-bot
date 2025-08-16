import { PrismaService } from '../prisma/prisma.service';
import { Note, NoteType } from '@prisma/client';
export declare class NotesService {
    private prisma;
    constructor(prisma: PrismaService);
    private findNextAvailableY;
    createNote(userId: string, data: {
        title: string;
        content?: string;
        type: NoteType;
        date?: Date | string;
        x?: number;
        y?: number;
        manuallyPositioned?: boolean;
        tags?: string[];
        aiSuggestedTags?: any;
    }): Promise<Note>;
    createRandomNote(userId: string): Promise<Note>;
    getNotes(userId: string, days?: number): Promise<Note[]>;
    getNoteById(noteId: string, userId: string): Promise<Note>;
    updateNote(noteId: string, updateData: {
        title?: string;
        content?: string;
    }): Promise<Note>;
    updateNotePosition(noteId: string, x: number, y: number): Promise<Note>;
    deleteNote(noteId: string): Promise<void>;
    bulkDeleteNotes(noteIds: string[], userId: string): Promise<number>;
    getUniqueDates(userId: string): Promise<Date[]>;
    initializeDemoData(userId: string): Promise<void>;
}
