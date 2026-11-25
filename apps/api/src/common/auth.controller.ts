import { Controller, Post, Body, Get, Request, UseGuards } from '@nestjs/common';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ): Promise<Session | null> {
    return this.authService.login(email, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
async me(@Request() req: { user: any }) {
    return req.user;
  }
}