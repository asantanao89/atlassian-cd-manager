import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { getEnv } from './env'
import { healthRoutes } from './routes/health.routes'
import { bitbucketRoutes } from './routes/bitbucket.routes'
import { discordRoutes } from './routes/discord.routes'
import { jiraRoutes } from './routes/jira.routes'

async function start(): Promise<void> {
  const env = getEnv()

  const server = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.authorization'],
    },
  })

  await server.register(cors, {
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  })

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await server.register(healthRoutes)
  await server.register(jiraRoutes, { prefix: '/api/jira' })
  await server.register(bitbucketRoutes, { prefix: '/api/bitbucket' })
  await server.register(discordRoutes, { prefix: '/api/discord' })

  server.setErrorHandler((error, _req, reply) => {
    server.log.error({ err: error }, 'Unhandled server error')
    reply.status(500).send({ error: 'Internal server error' })
  })

  try {
    await server.listen({ port: env.SERVER_PORT, host: '0.0.0.0' })
    console.log(`✅ Server running on http://localhost:${env.SERVER_PORT}`)
    console.log(`   Accepting requests from: ${env.CLIENT_ORIGIN}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
