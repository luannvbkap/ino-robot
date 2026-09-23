import type { FastifyInstance } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { loginSchema, registerSchema } from '@ino/shared';
import { REFRESH_COOKIE, toPublicUser } from '../plugins/auth.js';

export default async function authRoutes(app: FastifyInstance) {
  /* --------------------------- Đăng ký --------------------------- */
  app.post('/register', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues,
      });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Email này đã được đăng ký' });
    }

    const user = await app.prisma.user.create({
      data: {
        email,
        passwordHash: await hash(parsed.data.password),
        displayName: parsed.data.displayName.trim(),
      },
    });

    await app.issueRefreshToken(user.id, reply);
    const accessToken = app.jwt.sign({ sub: user.id, role: user.role });

    return reply.code(201).send({ accessToken, user: toPublicUser(user) });
  });

  /* -------------------------- Đăng nhập -------------------------- */
  app.post('/login', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues,
      });
    }

    const user = await app.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    });

    // Báo lỗi chung cho cả hai trường hợp, tránh lộ email nào đã tồn tại
    const invalid = { error: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' };
    if (!user) return reply.code(401).send(invalid);

    const ok = await verify(user.passwordHash, parsed.data.password);
    if (!ok) return reply.code(401).send(invalid);

    await app.issueRefreshToken(user.id, reply);
    const accessToken = app.jwt.sign({ sub: user.id, role: user.role });

    return reply.send({ accessToken, user: toPublicUser(user) });
  });

  /* ------------------------ Cấp lại token ------------------------ */
  app.post('/refresh', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: 'NO_SESSION', message: 'Chưa đăng nhập' });
    }

    const session = await app.prisma.session.findUnique({
      where: { refreshToken: token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await app.prisma.session.delete({ where: { id: session.id } });
      app.clearRefreshToken(reply);
      return reply.code(401).send({ error: 'SESSION_EXPIRED', message: 'Phiên đăng nhập đã hết hạn' });
    }

    // Xoay vòng refresh token: mỗi lần dùng là cấp token mới
    await app.prisma.session.delete({ where: { id: session.id } });
    await app.issueRefreshToken(session.userId, reply);

    const accessToken = app.jwt.sign({ sub: session.userId, role: session.user.role });
    return reply.send({ accessToken, user: toPublicUser(session.user) });
  });

  /* -------------------------- Đăng xuất -------------------------- */
  app.post('/logout', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      await app.prisma.session.deleteMany({ where: { refreshToken: token } });
    }
    app.clearRefreshToken(reply);
    return reply.send({ ok: true });
  });

  /* --------------------------- Tôi là ai -------------------------- */
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản' });
    }
    return reply.send({ user: toPublicUser(user) });
  });
}
