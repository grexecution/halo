import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const PORT = Number(process.env['CONTROL_PLANE_PORT'] ?? 3001)

await app.listen({ port: PORT, host: '0.0.0.0' })
