import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class GenerateTitleDto {
  @ApiProperty({ 
    description: 'Note ID to generate title for',
    example: 'uuid-string'
  })
  @IsString()
  @IsNotEmpty()
  noteId: string;

  @ApiProperty({ 
    description: 'Custom prompt for title generation (optional)',
    example: 'Make it sound professional and technical',
    required: false
  })
  @IsString()
  @IsOptional()
  prompt?: string;
}