const DEFAULT_TIMEOUT_MS = 60_000

export class ToolTimeoutError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`)
    this.name = 'ToolTimeoutError'
  }
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number | undefined,
  toolName: string,
): Promise<T> {
  const ms = timeoutMs ?? DEFAULT_TIMEOUT_MS

  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ToolTimeoutError(toolName, ms))
    }, ms)
  })

  try {
    return await Promise.race([fn(), timeoutPromise])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
