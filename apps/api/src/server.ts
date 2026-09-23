import Fastify from 'fastify';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import { env, isProd } from './env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth.routes.js';
import projectRoutes from './modules/projects.routes.js';
import configRoutes from './modules/config.routes.js';

const app = Fastify({
  logger: isProd
    ? true
    : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
  bodyLimit: 2 * 1024 * 1024, // 2 MB — đủ cho workspace 1 MB + ảnh thu nhỏ
});

await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

await app.register(prismaPlugin);
await app.register(authPlugin);

app.get('/api/v1/health', async () => ({ ok: true, time: new Date().toISOString() }));

await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(projectRoutes, { prefix: '/api/v1/projects' });
await app.register(configRoutes, { prefix: '/api/v1' });

app.setErrorHandler((err: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
  app.log.error(err);
  const status = err.statusCode ?? 500;
  return reply.code(status).send({
    error: status === 500 ? 'INTERNAL_ERROR' : err.code ?? 'ERROR',
    message: status === 500 ? 'Lỗi máy chủ' : err.message,
  });
});

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
