import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`📥 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      console.log('   Headers:', {
        'user-id': req.headers['user-id'],
        'content-type': req.headers['content-type'],
      });
      if (req.body) {
        console.log('   Body preview:', JSON.stringify(req.body).substring(0, 200));
      }
    }
    next();
  }
}