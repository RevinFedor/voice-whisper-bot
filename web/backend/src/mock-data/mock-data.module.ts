import { Module } from '@nestjs/common';
import { MockDataController } from './mock-data.controller';
import { MockDataService } from './mock-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MockDataController],
  providers: [MockDataService],
})
export class MockDataModule {}