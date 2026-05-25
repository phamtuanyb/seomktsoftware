import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { uuidv7 } from 'uuidv7';

/**
 * Section 7 — UUID v7 strategy: app-layer generation. We extend PrismaClient.create
 * to inject `id = uuidv7()` when the caller omits it. Sortable-by-time IDs help
 * cursor pagination (Section 6) and audit log scanning (Section 17).
 *
 * Multi-tenant: callers MUST always filter by `user_id` (principle 5). Enforcing
 * that here would be a foot-gun for admin/system writes — leave to feature services.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /**
   * Returns a client extension that auto-injects UUID v7 ids on create / createMany
   * whenever the caller has not supplied one. Use this when you need the typed
   * extended client (e.g. `this.prisma.withUuidV7().user.create(...)`).
   */
  withUuidV7(): ReturnType<typeof this.$extends> {
    return this.$extends({
      query: {
        $allModels: {
          async create({ args, query }) {
            const data = args.data as Record<string, unknown>;
            if (data && data['id'] == null) {
              data['id'] = uuidv7();
            }
            return query(args);
          },
          async createMany({ args, query }) {
            const raw = args.data as Record<string, unknown> | Record<string, unknown>[];
            const rows = Array.isArray(raw) ? raw : [raw];
            for (const row of rows) {
              if (row && row['id'] == null) row['id'] = uuidv7();
            }
            return query(args);
          },
        },
      },
    });
  }

  /** Helper used by integration tests to truncate every user table. */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('truncateAll() refused — NODE_ENV=production');
    }
    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `;
    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE`);
    }
  }
}
