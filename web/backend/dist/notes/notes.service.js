"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const LAYOUT_CONFIG = {
    columnWidth: 180,
    columnSpacing: 50,
    rowHeight: 50,
    rowSpacing: 15,
    startX: 100,
    startY: 120,
    headerY: 50,
};
let NotesService = class NotesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findNextAvailableY(userId, date) {
        const notesInColumn = await this.prisma.note.findMany({
            where: {
                userId,
                date,
                manuallyPositioned: false,
                isArchived: false,
            },
            orderBy: { y: 'asc' },
            select: { y: true },
        });
        if (notesInColumn.length === 0) {
            return LAYOUT_CONFIG.startY;
        }
        let previousY = LAYOUT_CONFIG.startY - LAYOUT_CONFIG.rowHeight - LAYOUT_CONFIG.rowSpacing;
        for (const note of notesInColumn) {
            const expectedY = previousY + LAYOUT_CONFIG.rowHeight + LAYOUT_CONFIG.rowSpacing;
            if (note.y - expectedY >= LAYOUT_CONFIG.rowHeight) {
                return expectedY;
            }
            previousY = note.y;
        }
        return notesInColumn[notesInColumn.length - 1].y + LAYOUT_CONFIG.rowHeight + LAYOUT_CONFIG.rowSpacing;
    }
    async createNote(userId, data) {
        console.log('🔨 [NotesService] Creating note...');
        console.log('   userId:', userId);
        console.log('   title:', data.title);
        console.log('   type:', data.type);
        let noteDate;
        if (data.date) {
            if (typeof data.date === 'string') {
                const [year, month, day] = data.date.split('-').map(Number);
                noteDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            }
            else {
                noteDate = new Date(data.date);
            }
        }
        else {
            const today = new Date();
            noteDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
        }
        if (isNaN(noteDate.getTime())) {
            const today = new Date();
            noteDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
        }
        let x;
        let y;
        let manuallyPositioned;
        if (data.x !== undefined && data.y !== undefined) {
            x = data.x;
            y = data.y;
            manuallyPositioned = data.manuallyPositioned ?? true;
            console.log('   📍 Using provided position: x=' + x + ', y=' + y);
        }
        else {
            x = 0;
            y = await this.findNextAvailableY(userId, noteDate);
            manuallyPositioned = false;
            console.log('   🎯 Auto-positioning: x=0 (frontend will calculate), y=' + y);
            console.log('   📅 For date:', noteDate.toISOString());
        }
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
            },
        });
        console.log('✅ [NotesService] Note created successfully!');
        console.log('   Note ID:', createdNote.id);
        console.log('   Position: x=' + x + ', y=' + y);
        console.log('   Date:', noteDate.toISOString());
        return createdNote;
    }
    async createRandomNote(userId) {
        const types = ['voice', 'text'];
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
    async getNotes(userId, days = 14) {
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
    async getNoteById(noteId, userId) {
        const note = await this.prisma.note.findFirst({
            where: {
                id: noteId,
                userId,
            },
        });
        if (!note) {
            throw new Error(`Note with ID ${noteId} not found`);
        }
        return note;
    }
    async updateNote(noteId, updateData) {
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
        });
        if (!note) {
            throw new Error('Note not found');
        }
        console.log(`📝 Content update for note ${noteId}:`, updateData);
        return this.prisma.note.update({
            where: { id: noteId },
            data: {
                ...(updateData.title !== undefined && { title: updateData.title }),
                ...(updateData.content !== undefined && { content: updateData.content }),
                updatedAt: new Date(),
            },
        });
    }
    async updateNotePosition(noteId, x, y) {
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
        });
        if (!note) {
            throw new Error('Note not found');
        }
        console.log(`📍 Position update for note ${noteId}:`, {
            newPosition: { x, y },
        });
        return this.prisma.note.update({
            where: { id: noteId },
            data: {
                x,
                y,
                manuallyPositioned: true,
            },
        });
    }
    async deleteNote(noteId) {
        await this.prisma.note.delete({
            where: { id: noteId },
        });
    }
    async getUniqueDates(userId) {
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
    async initializeDemoData(userId) {
        const count = await this.prisma.note.count({
            where: { userId },
        });
        if (count > 0) {
            return;
        }
        const demoNotes = [
            { title: 'Утренний стендап', content: 'Обсуждение задач на день', type: 'voice', daysAgo: 0 },
            { title: 'Список дел', content: '- Code review\n- Документация\n- Тесты', type: 'text', daysAgo: 0 },
            { title: 'Идея для проекта', content: 'Интеграция с внешним API', type: 'text', daysAgo: 1 },
            { title: 'Встреча с командой', content: 'Обсуждение архитектуры', type: 'voice', daysAgo: 1 },
            { title: 'Заметки по рефакторингу', content: 'Улучшить производительность', type: 'text', daysAgo: 2 },
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
};
exports.NotesService = NotesService;
exports.NotesService = NotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotesService);
//# sourceMappingURL=notes.service.js.map