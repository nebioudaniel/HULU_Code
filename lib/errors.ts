export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      return String(code);
    }
  }
  return undefined;
}

export function logError(scope: string, error: unknown, step: string): void {
  console.error(scope, { step, name: errorName(error), code: errorCode(error) });
}
