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

  // Tài khoản quản trị để thử trên máy dev — đổi mật khẩu trước khi chạy thật
  const adminEmail = 'admin@gmail.com';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      displayName: 'Quản trị viên',
      role: 'ADMIN',
      passwordHash: await hash('123456a'),
    },
  });

  console.log(`✅ Xong. Tài khoản demo: ${email} / demo1234 · Quản trị: ${adminEmail} / 123456a`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
