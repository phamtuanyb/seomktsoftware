import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the password reset email' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty({
    example: 'NewP@ssw0rd123',
    description: 'Tối thiểu 8 ký tự, ≥1 chữ hoa, ≥1 chữ thường, ≥1 số.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có ≥1 chữ hoa, ≥1 chữ thường, ≥1 số',
  })
  password!: string;
}
