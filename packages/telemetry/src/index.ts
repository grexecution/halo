import pino from 'pino'
import type { DestinationStream } from 'pino'

export const REDACTED_FIELDS: string[] = [
  'apiKey',
  'api_key',
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'Authorization',
  'x-api-key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  '*.apiKey',
  '*.api_key',
  '*.password',
  '*.secret',
  '*.token',
  '*.authorization',
  '*.accessToken',
  '*.access_token',
  'headers.authorization',
  'headers.Authorization',
  'headers.x-api-key',
]

interface CreateLoggerOptions {
  stream?: DestinationStream
  level?: string
}

export function createLogger(opts: CreateLoggerOptions = {}): pino.Logger {
  return pino(
    {
      level: opts.level ?? 'info',
      redact: {
        paths: REDACTED_FIELDS,
        censor: '[Redacted]',
      },
    },
    opts.stream,
  )
}

export const logger = createLogger()
