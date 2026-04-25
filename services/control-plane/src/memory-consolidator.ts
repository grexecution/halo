/**
 * Memory Consolidator
 *
 * Daily job that finds near-duplicate memories (cosine similarity > 0.95)
 * within the same source and same day, merges them into a single entry,
 * and tracks consolidated pairs to avoid re-processing.
 *
 * Prevents "my name is Gregor" from being stored 50,000 times after 10 years
 * of syncing the same contact over and over.
 */

import type pg from 'pg'
import { emitLog } from './log-store.js'

export async function consolidateMemories(pool: pg.Pool): Promise<number> {
  const client = await pool.connect()
  let merged = 0

  try {
    // Find near-duplicate pairs:
    // - Same source (don't merge emails with calendar events)
    // - Same day (limit explosion of pairs)
    // - Cosine similarity > 0.95
    // - Neither has been consolidated before
    const { rows: pairs } = await client.query<{
      id_a: string
      created_at_a: string
      id_b: string
      created_at_b: string
      content_a: string
      content_b: string
      similarity: number
    }>(
      `SELECT DISTINCT ON (LEAST(a.id, b.id), GREATEST(a.id, b.id))
         a.id         AS id_a,
         a.created_at AS created_at_a,
         b.id         AS id_b,
         b.created_at AS created_at_b,
         a.content    AS content_a,
         b.content    AS content_b,
         1 - (a.embedding <=> b.embedding) AS similarity
       FROM memories a
       JOIN memories b
         ON a.source = b.source
        AND a.id < b.id
        AND a.created_at::date = b.created_at::date
       WHERE a.embedding IS NOT NULL
         AND b.embedding IS NOT NULL
         AND 1 - (a.embedding <=> b.embedding) > 0.95
         AND NOT EXISTS (
           SELECT 1 FROM memory_consolidations mc WHERE mc.memory_id = a.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM memory_consolidations mc WHERE mc.memory_id = b.id
         )
       LIMIT 500`,
    )

    for (const pair of pairs) {
      // Keep the longer/more detailed content
      const keepId = pair.content_a.length >= pair.content_b.length ? pair.id_a : pair.id_b
      const keepCreatedAt =
        pair.content_a.length >= pair.content_b.length ? pair.created_at_a : pair.created_at_b
      const dropId = keepId === pair.id_a ? pair.id_b : pair.id_a
      const dropCreatedAt = keepId === pair.id_a ? pair.created_at_b : pair.created_at_a

      try {
        await client.query('BEGIN')

        // Append merge provenance to the kept entry's metadata
        await client.query(
          `UPDATE memories
           SET metadata = metadata || jsonb_build_object('merged_from', $1::text, 'merged_at', NOW()::text)
           WHERE id = $2 AND created_at = $3`,
          [dropId, keepId, keepCreatedAt],
        )

        // Delete the duplicate
        await client.query('DELETE FROM memories WHERE id = $1 AND created_at = $2', [
          dropId,
          dropCreatedAt,
        ])

        // Record consolidation for both IDs
        await client.query(
          `INSERT INTO memory_consolidations (memory_id, merged_into)
           VALUES ($1, $2), ($3, NULL)
           ON CONFLICT (memory_id) DO NOTHING`,
          [dropId, keepId, keepId],
        )

        await client.query('COMMIT')
        merged++
      } catch (err) {
        await client.query('ROLLBACK')
        emitLog({
          level: 'warn',
          agentId: 'memory-consolidator',
          message: `Failed to merge ${pair.id_a} + ${pair.id_b}: ${String(err)}`,
        })
      }
    }

    emitLog({
      level: 'info',
      agentId: 'memory-consolidator',
      message: `Consolidation complete: merged ${merged} duplicate pairs out of ${pairs.length} candidates`,
    })
  } finally {
    client.release()
  }

  return merged
}
