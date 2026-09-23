import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

/** Tài khoản demo + một bài mẫu, để có dữ liệu thử ngay sau khi cài */
async function main() {
  const email = 'demo@ino.vn';

  const teacher = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      displayName: 'Giáo viên Demo',
      role: 'TEACHER',
      passwordHash: await hash('demo1234'),
    },
  });

  const existing = await prisma.project.findFirst({
    where: { ownerId: teacher.id, isTemplate: true, name: 'Bài mẫu: Đi hình vuông' },
  });

  if (!existing) {
    await prisma.project.create({
      data: {
        ownerId: teacher.id,
        name: 'Bài mẫu: Đi hình vuông',
        isTemplate: true,
        robotId: 'ino-bot-v1',
        scenarioId: 'line-follow',
        workspace: {},
      },
    });
  }

  console.log(`✅ Xong. Tài khoản demo: ${email} / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
