import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  HealthCheckService,
  PrismaHealthIndicator} from '@nestjs/terminus';
import {
  HealthCheck,
  type HealthCheckResult,
} from '@nestjs/terminus';
import type { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators';
import type { PrismaService } from './common/services/prisma.service';
import type { RedisService } from './common/services/redis.service';

@ApiTags('System')
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(
    private readonly cfg: ConfigService,
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness + readiness check (DB + Redis)' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('postgres', this.prisma),
      async () => ({ redis: { status: (await this.redis.ping()) ? 'up' : 'down' } }),
    ]);
  }

  @Get('version')
  @Public()
  @ApiOperation({ summary: 'API metadata + version' })
  version(): { name: string; env: string; api_version: string } {
    return {
      name: this.cfg.get<string>('app.publicAppName') ?? 'MKT SEO AI',
      env: this.cfg.get<string>('app.env') ?? 'development',
      api_version: 'v1',
    };
  }
}
