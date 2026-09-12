import type { JwtPayload } from '../lib/types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
