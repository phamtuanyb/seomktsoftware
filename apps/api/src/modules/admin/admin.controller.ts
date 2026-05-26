import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  ListUsersQueryDto,
  OverrideQuotaDto,
  OverrideSubscriptionDto,
  UpdateUserDto,
} from './dto/admin.dto';

/** Sprint 12 — admin-only management endpoints. RBAC via @Roles('admin'). */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Dashboard counts — users by plan, articles, publish jobs by status.',
  })
  stats() {
    return this.admin.getStats();
  }

  @Get('users')
  @ApiOperation({
    summary:
      'List users with stats (cursor pagination per Section 6, filter by role/plan/q substring).',
  })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User detail — profile + subscriptions + quotas + recent audit logs.' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Override role / force email_verified / soft-delete. Writes audit log.',
  })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.admin.updateUser(adminId, id, dto, {
      ip,
      ua: req.headers['user-agent'],
    });
  }

  @Post('users/:id/subscription')
  @ApiOperation({
    summary: 'Override plan/status/expires_at. Cancels prior active sub + creates a new one.',
  })
  overrideSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideSubscriptionDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.admin.overrideSubscription(adminId, id, dto, {
      ip,
      ua: req.headers['user-agent'],
    });
  }

  @Post('users/:id/quotas')
  @ApiOperation({ summary: 'Override quota limit + optional reset of used counter.' })
  overrideQuota(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideQuotaDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.admin.overrideQuota(adminId, id, dto, {
      ip,
      ua: req.headers['user-agent'],
    });
  }
}
