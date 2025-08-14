import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiTitlesModule } from './ai-titles/ai-titles.module';
import { AiTagsModule } from './ai-tags/ai-tags.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    NotesModule,
    AiTitlesModule,
    AiTagsModule,
  ],
})
export class AppModule {}