import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token issued at login' })
  @IsJWT({ message: 'Refresh token không hợp lệ' })
  refresh_token!: string;
}
