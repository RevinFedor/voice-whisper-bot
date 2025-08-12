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
        voiceDuration?: number;
        voiceFileUrl?: string;
    }): Promise<Note>;
    createRandomNote(userId: string): Promise<Note>;
    getNotes(userId: string, days?: number): Promise<Note[]>;
    updateNotePosition(noteId: string, x: number, y: number): Promise<Note>;
    deleteNote(noteId: string): Promise<void>;
    getUniqueDates(userId: string): Promise<Date[]>;
    initializeDemoData(userId: string): Promise<void>;
}
