import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Sprint 12 — admin-only management. Section 9 (RBAC) + Section 16 (audit logs). */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
