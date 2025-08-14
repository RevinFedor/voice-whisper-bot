import { IsString, IsOptional, IsArray } from 'class-validator';

export class ExportNoteDto {
  @IsString()
  noteId: string;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}