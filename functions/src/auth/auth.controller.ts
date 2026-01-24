import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

@Controller('auth')
export class AuthController {
  
  @Post('validate')
  async validateToken(@Body() _body: { token: string }) {
    // Valider que le token Firebase/Supabase est correct
    // Pour l'instant, juste un endpoint pour compatibilité
    return { valid: true, message: 'Token validation endpoint' };
  }

  @Post('logout')
  async logout() {
    // Endpoint pour nettoyage côté serveur si nécessaire
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getProfile(@Req() req: any) {
    return {
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.emailVerified,
      // Ajouter d'autres champs si nécessaire
    };
  }

  @Get('permissions')
  @UseGuards(FirebaseAuthGuard)
  async getPermissions(@Req() _req: any) {
    // Pour l'instant, permissions basiques
    // Peut être étendu avec des rôles depuis la base de données
    return {
      canRead: true,
      canWrite: true,
      canDelete: true,
      // Ajouter des permissions spécifiques si nécessaire
    };
  }

  @Get('profile')
  @UseGuards(FirebaseAuthGuard)
  async getFullProfile(@Req() req: any) {
    return {
      id: req.user.uid,
      email: req.user.email,
      fullName: req.user.email, // Pour l'instant, utiliser l'email
      // Ajouter d'autres champs depuis la base de données si nécessaire
    };
  }
}