import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { RobotConfig, ScenarioConfig } from '@ino/shared';

const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src/modules -> gốc dự án
const CONFIG_DIR = join(here, '..', '..', '..', '..', 'config');

/**
 * Cấu hình robot và kịch bản nằm ở file JSON trong /config, không nằm trong database.
 * Chúng thuộc về mã nguồn nên cần được quản lý phiên bản bằng Git — xem PTTK-02 mục 3.
 */
async function loadAll<T>(folder: string): Promise<T[]> {
  try {
    const dir = join(CONFIG_DIR, folder);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    return await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as T),
    );
  } catch {
    return [];
  }
}

export default async function configRoutes(app: FastifyInstance) {
  let robots: RobotConfig[] = [];
  let scenarios: ScenarioConfig[] = [];

  // Nạp một lần khi khởi động
  app.addHook('onReady', async () => {
    robots = await loadAll<RobotConfig>('robots');
    scenarios = await loadAll<ScenarioConfig>('scenarios');
    app.log.info(`Đã nạp ${robots.length} mẫu robot, ${scenarios.length} kịch bản`);
  });

  app.get('/robots', async () => ({ robots }));
  app.get('/scenarios', async () => ({ scenarios }));

  app.get('/templates', async () => {
    const templates = await app.prisma.project.findMany({
      where: { isTemplate: true },
      select: {
        id: true,
        name: true,
        robotId: true,
        scenarioId: true,
        thumbnail: true,
        isTemplate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { templates };
  });
}
