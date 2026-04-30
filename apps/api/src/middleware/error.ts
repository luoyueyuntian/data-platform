import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { code: err.status, message: err.message },
      err.status,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    { code: 500, message: 'Internal server error' },
    500,
  );
};
