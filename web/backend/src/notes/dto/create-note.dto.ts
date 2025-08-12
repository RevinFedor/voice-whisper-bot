import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
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

  @ApiProperty({ description: 'Voice duration in seconds', required: false })
  @IsOptional()
  @IsNumber()
  voiceDuration?: number;

  @ApiProperty({ description: 'Voice file URL', required: false })
  @IsOptional()
  @IsString()
  voiceFileUrl?: string;
}