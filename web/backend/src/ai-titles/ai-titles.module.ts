import { Module } from '@nestjs/common';
import { AiTitlesController } from './ai-titles.controller';
import { AiTitlesService } from './ai-titles.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiTitlesController],
  providers: [AiTitlesService],
  exports: [AiTitlesService],
})
export class AiTitlesModule {}