import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { NoteType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ description: 'Note title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Note content', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ enum: NoteType, description: 'Type of note' })
  @IsEnum(NoteType)
  type: NoteType;

  @ApiProperty({ description: 'Date for the note', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'X position for manually positioned notes', required: false })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiProperty({ description: 'Y position for manually positioned notes', required: false })
  @IsOptional()
  @IsNumber()
  y?: number;

  @ApiProperty({ description: 'Whether the note was manually positioned', required: false })
  @IsOptional()
  @IsBoolean()
  manuallyPositioned?: boolean;

  @ApiProperty({ description: 'Tags for the note', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'AI suggested tags', required: false })
  @IsOptional()
  aiSuggestedTags?: any;
}