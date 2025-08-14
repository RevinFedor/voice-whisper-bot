import { IsString, IsOptional, IsUUID } from 'class-validator';

export class GenerateTagsDto {
  @IsUUID()
  noteId: string;

  @IsString()
  @IsOptional()
  prompt?: string;
}