import { Controller, Post, Delete, Body, Headers } from '@nestjs/common';
import { MockDataService } from './mock-data.service';

@Controller('api/mock-data')
export class MockDataController {
  constructor(private readonly mockDataService: MockDataService) {}

  @Post('generate-week')
  async generateWeekData(
    @Headers('user-id') userId: string,
    @Body() body: { startDate?: string },
  ) {
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    return this.mockDataService.generateWeekData(userId, startDate);
  }

  @Delete('clear')
  async clearMockData(@Headers('user-id') userId: string) {
    return this.mockDataService.clearMockData(userId);
  }
}