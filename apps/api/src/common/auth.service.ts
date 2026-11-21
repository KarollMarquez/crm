import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    // Usar Supabase Auth para login con email/contraseña
    const { data, error } = await this.supabase.getClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new UnauthorizedException('Credenciales inválidas');

    // Retornar el token de sesión de Supabase
    return data.session;
  }

  async validateUser(userId: string) {
    // Retornar datos del usuario con su organization_id
    const { data } = await this.supabase.getClient()
      .from('users')
      .select('*, organizations(name, plan)')
      .eq('id', userId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      organizationId: data.organization_id,
    };
  }

  async refreshSession(refreshToken: string) {
    const { data, error } = await this.supabase.getClient().auth.refreshSession({ refresh_token: refreshToken });

    if (error) throw new UnauthorizedException('Token de actualización inválido');

    return data.session;
  }
}