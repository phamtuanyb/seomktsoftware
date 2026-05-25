import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 12 — plugin registry (Phase 2 ready). */
@ApiTags('Plugins')
@ApiBearerAuth()
@Controller({ path: 'plugins', version: '1' })
export class PluginsController {
  @Get()
  @ApiOperation({ summary: 'List available plugins from the registry' })
  list(): never {
    throw new NotImplementedException('Pending Phase 2');
  }

  @Get('installed')
  @ApiOperation({ summary: 'List user-installed plugins' })
  installed(): never {
    throw new NotImplementedException('Pending Phase 2');
  }
}
