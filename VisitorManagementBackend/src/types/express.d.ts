import { UserPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
      user?: UserPayload;
    }
  }
}

export {};