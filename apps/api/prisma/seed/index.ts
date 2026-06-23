import { createPrisma } from './client';
import type { Seeder } from './seeder';
import { tagsSeeder } from './tags.seeder';
import { workBlocksSeeder } from './work-blocks.seeder';

const REGISTRY: Record<string, Seeder> = {
  [tagsSeeder.name]: tagsSeeder,
  [workBlocksSeeder.name]: workBlocksSeeder,
};

async function main() {
  const prisma = createPrisma();
  const arg = process.argv[2]; // a seeder name, or empty for the default run

  try {
    if (arg) {
      const s = REGISTRY[arg];
      if (!s) {
        throw new Error(`unknown seeder: ${arg}`);
      }
      await s.run(prisma);
      console.log(`seeded: ${s.name}`);
    } else {
      // default: run every idempotent (run-once-safe) seeder first
      for (const s of Object.values(REGISTRY).filter((x) => x.idempotent)) {
        await s.run(prisma);
        console.log(`seeded: ${s.name}`);
      }
      // then seed work blocks once
      await workBlocksSeeder.run(prisma);
      console.log(`seeded: ${workBlocksSeeder.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
