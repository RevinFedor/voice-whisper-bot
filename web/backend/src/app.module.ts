import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiTitlesModule } from './ai-titles/ai-titles.module';
import { AiTagsModule } from './ai-tags/ai-tags.module';
// ВРЕМЕННО: Модуль для генерации тестовых данных - удалить в продакшене
import { MockDataModule } from './mock-data/mock-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'prod' 
        ? '../../.env.prod' 
        : '../../.env.dev',
    }),
    PrismaModule,
    NotesModule,
    AiTitlesModule,
    AiTagsModule,
    // ВРЕМЕННО: Модуль для генерации тестовых данных - удалить в продакшене
    MockDataModule,
  ],
})
export class AppModule {}