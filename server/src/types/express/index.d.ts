import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      id: string;
      email: string;
      displayName?: string;
      profileImageUrl?: string;
      role: 'admin' | 'user' | 'guest';
      [key: string]: string | number | undefined;
    };
  }
}
