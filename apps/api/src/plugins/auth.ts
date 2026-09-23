import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser, Role } from '@ino/shared';
import { env, isProd } from '../env.js';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_DAYS = 30;
export const REFRESH_COOKIE = 'ino_rt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: chặn request nếu chưa đăng nhập */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    issueRefreshToken: (userId: string, reply: FastifyReply) => Promise<void>;
    clearRefreshToken: (reply: FastifyReply) => void;
  }
}

export function toPublicUser(u: {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}): PublicUser {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role };
}

export default fp(async (app: FastifyInstance) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: ACCESS_TOKEN_TTL },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Bạn cần đăng nhập' });
    }
  });

  app.decorate('issueRefreshToken', async (userId: string, reply: FastifyReply) => {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await app.prisma.session.create({ data: { userId, refreshToken: token, expiresAt } });

    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/api/v1/auth',
      expires: expiresAt,
    });
  });

  app.decorate('clearRefreshToken', (reply: FastifyReply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  });
});
