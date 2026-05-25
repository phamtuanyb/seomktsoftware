import { Controller, Get, NotImplementedException, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  @Get('me')
  @ApiOperation({ summary: 'Current user profile (mirrors /auth/me)' })
  getMe(): never {
    throw new NotImplementedException('Pending Sprint 2');
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile (name, phone, avatar, preferences)' })
  updateMe(): never {
    throw new NotImplementedException('Pending Sprint 2');
  }
}
