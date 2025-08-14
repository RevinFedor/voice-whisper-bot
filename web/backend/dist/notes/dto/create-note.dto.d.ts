import { NoteType } from '@prisma/client';
export declare class CreateNoteDto {
    title: string;
    content?: string;
    type: NoteType;
    date?: string;
    x?: number;
    y?: number;
    manuallyPositioned?: boolean;
}
