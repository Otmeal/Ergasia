import type { Seeder } from './seeder';

const TAGS = [
  { name: 'Deep Work', color: '#4F46E5' },
  { name: 'Meetings', color: '#F59E0B' },
  { name: 'Admin', color: '#6B7280' },
  { name: 'Learning', color: '#10B981' },
  { name: 'Break', color: '#EF4444' },
];

export const tagsSeeder: Seeder = {
  name: 'tags',
  idempotent: true,
  async run(prisma) {
    for (const t of TAGS) {
      await prisma.tag.upsert({
        where: { name: t.name },
        update: t,
        create: t,
      });
    }
  },
};
