import { AppError } from "@/server/errors";

export type ActionError = { code: string; message: string };
export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: ActionError };

/** Turns a domain error into a result the UI can toast; anything unexpected is rethrown. */
export function fail(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof AppError)
    return { ok: false, error: { code: error.code, message: error.message } };
  throw error;
}
