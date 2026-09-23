import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { createProjectSchema, updateProjectSchema, MAX_WORKSPACE_BYTES } from '@ino/shared';

const summarySelect = {
  id: true,
  name: true,
  robotId: true,
  scenarioId: true,
  thumbnail: true,
  isTemplate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

export default async function projectRoutes(app: FastifyInstance) {
  // Mọi route trong file này đều yêu cầu đăng nhập
  app.addHook('preHandler', app.authenticate);

  /* ----------------------- Danh sách bài làm ---------------------- */
  app.get('/', async (req, reply) => {
    const projects = await app.prisma.project.findMany({
      where: { ownerId: req.user.sub, isTemplate: false },
      select: summarySelect,
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send({ projects });
  });

  /* ------------------------- Tạo bài làm -------------------------- */
  app.post('/', async (req, reply) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues,
      });
    }

    const project = await app.prisma.project.create({
      data: {
        ownerId: req.user.sub,
        name: parsed.data.name.trim(),
        ...(parsed.data.robotId ? { robotId: parsed.data.robotId } : {}),
        ...(parsed.data.scenarioId ? { scenarioId: parsed.data.scenarioId } : {}),
      },
      select: summarySelect,
    });

    return reply.code(201).send({ project });
  });

  /* -------------------------- Mở bài làm -------------------------- */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const project = await app.prisma.project.findFirst({
      // Bài mẫu thì ai cũng mở được, bài thường chỉ chủ sở hữu
      where: { id: req.params.id, OR: [{ ownerId: req.user.sub }, { isTemplate: true }] },
    });

    if (!project) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Không tìm thấy bài làm' });
    }
    return reply.send({ project });
  });

  /* ----------------------- Lưu (tự động lưu) ---------------------- */
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues,
      });
    }

    if (parsed.data.workspace !== undefined) {
      const size = Buffer.byteLength(JSON.stringify(parsed.data.workspace), 'utf8');
      if (size > MAX_WORKSPACE_BYTES) {
        return reply.code(413).send({ error: 'TOO_LARGE', message: 'Bài làm quá lớn' });
      }
    }

    // Chỉ sửa được bài của chính mình — không sửa được bài mẫu
    const owned = await app.prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user.sub },
      select: { id: true },
    });
    if (!owned) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Không tìm thấy bài làm' });
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.workspace !== undefined) data.workspace = parsed.data.workspace as Prisma.InputJsonValue;
    if (parsed.data.robotId !== undefined) data.robotId = parsed.data.robotId;
    if (parsed.data.scenarioId !== undefined) data.scenarioId = parsed.data.scenarioId;
    if (parsed.data.thumbnail !== undefined) data.thumbnail = parsed.data.thumbnail;

    const project = await app.prisma.project.update({
      where: { id: req.params.id },
      data,
      select: summarySelect,
    });

    return reply.send({ project });
  });

  /* --------------------------- Xoá bài ---------------------------- */
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const result = await app.prisma.project.deleteMany({
      where: { id: req.params.id, ownerId: req.user.sub },
    });
    if (result.count === 0) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Không tìm thấy bài làm' });
    }
    return reply.send({ ok: true });
  });

  /* ---------------- Nhân bản (dùng khi mở bài mẫu) ---------------- */
  app.post<{ Params: { id: string } }>('/:id/duplicate', async (req, reply) => {
    const source = await app.prisma.project.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: req.user.sub }, { isTemplate: true }] },
    });
    if (!source) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Không tìm thấy bài làm' });
    }

    const project = await app.prisma.project.create({
      data: {
        ownerId: req.user.sub,
        name: `${source.name} (bản sao)`,
        workspace: source.workspace as Prisma.InputJsonValue,
        robotId: source.robotId,
        scenarioId: source.scenarioId,
        thumbnail: source.thumbnail,
      },
      select: summarySelect,
    });

    return reply.code(201).send({ project });
  });
}
