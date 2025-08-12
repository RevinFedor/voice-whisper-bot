import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePositionDto {
  @ApiProperty({ description: 'X coordinate in tldraw' })
  @IsNumber()
  x: number;

  @ApiProperty({ description: 'Y coordinate in tldraw' })
  @IsNumber()
  y: number;
}