import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsBoolean } from 'class-validator';
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
}