import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UpdateDateDto {
  @ApiProperty({
    description: 'New date for the note (ISO string)',
    example: '2024-08-19T14:30:00.000Z',
  })
  @IsDateString()
  date: string;
}