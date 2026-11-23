import type { getCurrentAuth } from "../modules/auth/auth.service";

type AuthContext = NonNullable<Awaited<ReturnType<typeof getCurrentAuth>>>;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
