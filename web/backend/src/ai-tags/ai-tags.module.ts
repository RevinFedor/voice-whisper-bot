import { Module } from '@nestjs/common';
import { AiTagsController } from './ai-tags.controller';
import { AiTagsService } from './ai-tags.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ObsidianModule } from '../obsidian/obsidian.module';

@Module({
  imports: [PrismaModule, ObsidianModule],
  controllers: [AiTagsController],
  providers: [AiTagsService],
})
export class AiTagsModule {}