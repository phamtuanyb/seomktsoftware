import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../services/token.service';

/** Section 9 — validates the access token signature + populates req.user. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('jwt.secret') ?? 'dev_secret_change_me',
    });
  }

  validate(payload: TokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      plan: payload.plan,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
