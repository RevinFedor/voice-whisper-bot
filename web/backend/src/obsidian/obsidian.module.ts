import { Module } from '@nestjs/common';
import { ObsidianService } from './obsidian.service';
import { ObsidianController } from './obsidian.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ObsidianController],
  providers: [ObsidianService],
  exports: [ObsidianService],
})
export class ObsidianModule {}