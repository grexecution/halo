import { join } from 'node:path'
import { homedir } from 'node:os'

export const EMBEDDING_DIM = 384

// Cache models next to other data so they survive across restarts
async function configureEnv() {
  const mod = await import('@xenova/transformers')

  const env =
    (mod as unknown as { env: Record<string, unknown> }).env ??
    (mod as unknown as { default: { env: Record<string, unknown> } }).default?.env
  if (env) env['cacheDir'] = join(homedir(), '.open-greg', 'models')
}

type EmbeddingPipeline = (
  text: string,
  opts: Record<string, unknown>,
) => Promise<{ data: Float32Array }>

let _pipe: EmbeddingPipeline | null = null
let _initPromise: Promise<EmbeddingPipeline | null> | null = null

async function loadPipeline(): Promise<EmbeddingPipeline | null> {
  try {
    await configureEnv()
    const { pipeline } = await import('@xenova/transformers')
    const p = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    return p as unknown as EmbeddingPipeline
  } catch {
    return null
  }
}

export async function getEmbedder(): Promise<EmbeddingPipeline | null> {
  if (_pipe) return _pipe
  if (_initPromise) return _initPromise
  _initPromise = loadPipeline().then((p) => {
    _pipe = p
    return p
  })
  return _initPromise
}

export async function embed(text: string): Promise<number[] | null> {
  const pipe = await getEmbedder()
  if (!pipe) return null
  try {
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  } catch {
    return null
  }
}

export function zeroVector(): number[] {
  return new Array(EMBEDDING_DIM).fill(0)
}

// Warm up the embedding pipeline in the background (do not await)
export function warmUpEmbedder() {
  void getEmbedder()
}
