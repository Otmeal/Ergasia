import type { Seeder } from './seeder';

export const workBlocksSeeder: Seeder = {
  name: 'work-blocks',
  idempotent: false, // additive; safe to run many times, each run appends rows
  async run(prisma) {
    const tags = await prisma.tag.findMany();
    for (let day = 0; day < 14; day++) {
      for (let i = 0; i < 3; i++) {
        const start = new Date();
        start.setDate(start.getDate() - day);
        start.setHours(9 + i * 3, 0, 0, 0);
        const end = new Date(start.getTime() + 90 * 60 * 1000);
        await prisma.workBlock.create({
          data: {
            title: `Session ${day}-${i}`,
            notes: i === 0 ? 'morning focus' : null,
            startedAt: start,
            endedAt: end,
            tags: tags.length
              ? { connect: [{ id: tags[(day + i) % tags.length].id }] }
              : undefined,
          },
        });
      }
    }
  },
};
