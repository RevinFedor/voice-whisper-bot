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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const notes_service_1 = require("./notes.service");
const create_note_dto_1 = require("./dto/create-note.dto");
const update_position_dto_1 = require("./dto/update-position.dto");
let NotesController = class NotesController {
    constructor(notesService) {
        this.notesService = notesService;
    }
    async getNotes(userId = 'test-user-id', days) {
        const daysNumber = days ? parseInt(days, 10) : 14;
        return this.notesService.getNotes(userId, daysNumber);
    }
    async createNote(userId = 'test-user-id', createNoteDto) {
        return this.notesService.createNote(userId, {
            ...createNoteDto,
            date: createNoteDto.date ? new Date(createNoteDto.date) : undefined,
        });
    }
    async createRandomNote(userId = 'test-user-id') {
        return this.notesService.createRandomNote(userId);
    }
    async initializeDemoData(userId = 'test-user-id') {
        await this.notesService.initializeDemoData(userId);
        return { message: 'Demo data initialized successfully' };
    }
    async updatePosition(noteId, updatePositionDto) {
        return this.notesService.updateNotePosition(noteId, updatePositionDto.x, updatePositionDto.y);
    }
    async deleteNote(noteId) {
        await this.notesService.deleteNote(noteId);
        return { message: 'Note deleted successfully' };
    }
    async getUniqueDates(userId = 'test-user-id') {
        return this.notesService.getUniqueDates(userId);
    }
};
exports.NotesController = NotesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all notes for a user' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, description: 'Number of days to fetch' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all notes' }),
    __param(0, (0, common_1.Headers)('user-id')),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "getNotes", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new note' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Note created successfully' }),
    __param(0, (0, common_1.Headers)('user-id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_note_dto_1.CreateNoteDto]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "createNote", null);
__decorate([
    (0, common_1.Post)('random'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a random note (for testing)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Random note created successfully' }),
    __param(0, (0, common_1.Headers)('user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "createRandomNote", null);
__decorate([
    (0, common_1.Post)('initialize'),
    (0, swagger_1.ApiOperation)({ summary: 'Initialize demo data' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Demo data initialized' }),
    __param(0, (0, common_1.Headers)('user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "initializeDemoData", null);
__decorate([
    (0, common_1.Patch)(':id/position'),
    (0, swagger_1.ApiOperation)({ summary: 'Update note position (after drag)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Position updated successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_position_dto_1.UpdatePositionDto]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "updatePosition", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a note' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Note deleted successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "deleteNote", null);
__decorate([
    (0, common_1.Get)('dates'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unique dates for columns' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns unique dates' }),
    __param(0, (0, common_1.Headers)('user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotesController.prototype, "getUniqueDates", null);
exports.NotesController = NotesController = __decorate([
    (0, swagger_1.ApiTags)('notes'),
    (0, common_1.Controller)('api/notes'),
    __metadata("design:paramtypes", [notes_service_1.NotesService])
], NotesController);
//# sourceMappingURL=notes.controller.js.map