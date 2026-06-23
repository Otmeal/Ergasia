## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Local-first sync API

- `GET /health` returns backend reachability status for the desktop app.
- `POST /sync` accepts queued local operations and applies them in order.
- The desktop app sends client-generated UUIDs so offline-created records keep the
  same IDs after sync.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Database seeding

Seed data lives in [`prisma/seed/`](prisma/seed). Each table has its own seeder
file and a `default` orchestrator ties them together. **No seeder ever wipes
data** — they only insert or upsert.

### Layout

| File                                | Table       | Re-run behaviour                                                                                                                                    |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/seed/tags.seeder.ts`        | `Tag`       | **Idempotent** — upserts by the unique `name`, so running it many times never creates duplicates.                                                   |
| `prisma/seed/work-blocks.seeder.ts` | `WorkBlock` | **Additive** — each run appends new rows. Safe to run on its own, repeatedly. Links to existing tags if any are present; it never creates tags.     |
| `prisma/seed/index.ts`              | —           | Orchestrator + CLI. With no argument it runs every idempotent (run-once) seeder, then seeds work blocks once. With a name it runs only that seeder. |
| `prisma/seed/seeder.ts`             | —           | The `Seeder` interface.                                                                                                                             |
| `prisma/seed/client.ts`             | —           | Builds a `PrismaClient` over the `@prisma/adapter-pg` driver, reading `DATABASE_URL`.                                                               |

### Prerequisites

The database must be running and migrated first:

```bash
# from the repo root
docker compose up -d   # start the postgres container
pnpm db:migrate        # apply migrations
```

### Commands

Run from the **repo root**:

```bash
# default run: all idempotent seeders (tags) + work blocks once
pnpm db:seed

# run a single seeder by name (repeatable)
pnpm db:seed:one tags
pnpm db:seed:one work-blocks
```

Or from inside `apps/api`:

```bash
pnpm run db:seed              # delegates to `prisma db seed`
pnpm run db:seed:one tags     # runs one seeder directly via ts-node
```

`prisma db seed` (and therefore `prisma migrate reset`) is wired to the default
orchestrator via the `migrations.seed` entry in
[`prisma.config.ts`](prisma.config.ts).

### Adding a seeder for a new table

1. Create `prisma/seed/<table>.seeder.ts` exporting a `Seeder`.
2. Set `idempotent: true` only if re-running it produces no duplicates
   (e.g. it upserts on a unique key); otherwise `false`.
3. Register it in the `REGISTRY` map in `prisma/seed/index.ts`.

The default orchestrator automatically runs every `idempotent` seeder; non-idempotent
ones are run individually (or explicitly invoked, like work blocks).

### Resetting the database (destructive)

> **Warning:** This permanently deletes ALL data in the database. The individual
> seeders never wipe data — only this reset does. Never run it against a
> production database. Use it for local development only.

The seeders are non-destructive by design, so re-running `work-blocks` keeps
appending rows. When you want a clean slate, use Prisma's reset, which **drops
the schema, re-applies every migration, and then runs the default seed
orchestrator** (because `migrations.seed` is configured):

```bash
# from the repo root
pnpm db:reset

# or from inside apps/api
pnpm run db:reset
```

What `prisma migrate reset` does, in order:

1. Drops the database / schema (all tables and rows are destroyed).
2. Re-creates the schema and re-applies all migrations in `prisma/migrations`.
3. Runs the default seed (`prisma/seed/index.ts`): idempotent seeders, then work blocks once.

To reset WITHOUT re-seeding afterwards, add the skip flag:

```bash
pnpm --filter api exec prisma migrate reset --skip-seed
```

Prisma prompts for confirmation before dropping data. In a non-interactive
context (CI, scripts) it will not proceed unless you also pass `--force`, which
skips that prompt — only add `--force` when you are certain the target database
is disposable.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
