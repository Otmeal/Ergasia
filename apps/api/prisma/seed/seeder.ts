import { PrismaClient } from '@prisma/client';

export interface Seeder {
  name: string;
  /** true → run by the default orchestrator; must be idempotent (re-running adds no duplicates) */
  idempotent: boolean;
  run(prisma: PrismaClient): Promise<void>;
}
