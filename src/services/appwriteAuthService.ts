import { account, ID } from '@/integrations/appwrite/client';

export const SUPER_ADMIN_EMAILS = [
  'celiogomesalves@gmail.com',
  'lukasgabriel1036@gmail.com'
];

export function checkIsSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export interface AppwriteUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  role: 'super_admin' | 'owner' | 'admin' | 'gerente' | 'consultor';
}

export const appwriteAuthService = {
  async login(email: string, password: string): Promise<AppwriteUser> {
    const cleanEmail = email.trim().toLowerCase();
    
    // Tenta encerrar sessão anterior pendente para evitar conflito
    try {
      await account.deleteSession('current');
    } catch {
      // Sem sessão ativa prévia
    }

    try {
      await account.createEmailPasswordSession(cleanEmail, password);
      const user = await account.get();
      const isSuper = checkIsSuperAdmin(user.email);

      const appUser: AppwriteUser = {
        id: user.$id,
        name: user.name || (isSuper ? 'Super Administrador' : 'Consultor'),
        email: user.email,
        isSuperAdmin: isSuper,
        role: isSuper ? 'super_admin' : 'admin',
      };

      localStorage.setItem('mapapro_user_session', JSON.stringify(appUser));
      return appUser;
    } catch (err: any) {
      console.error('[Appwrite Auth Login Error]:', err);
      if (err.code === 401 || err.type === 'user_invalid_credentials') {
        throw new Error('E-mail ou senha incorretos. Por favor, verifique a senha digitada.');
      }
      if (err.code === 429 || err.type === 'general_rate_limit_exceeded') {
        throw new Error('Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.');
      }
      throw new Error(err.message || 'Erro ao conectar ao servidor de autenticação.');
    }
  },

  async register(name: string, email: string, password: string): Promise<AppwriteUser> {
    const cleanEmail = email.trim().toLowerCase();
    const isSuper = checkIsSuperAdmin(cleanEmail);

    try {
      await account.create(ID.unique(), cleanEmail, password, name.trim());
      await account.createEmailPasswordSession(cleanEmail, password);
      const user = await account.get();

      const appUser: AppwriteUser = {
        id: user.$id,
        name: user.name || name.trim(),
        email: user.email,
        isSuperAdmin: isSuper,
        role: isSuper ? 'super_admin' : 'admin',
      };

      localStorage.setItem('mapapro_user_session', JSON.stringify(appUser));
      return appUser;
    } catch (err: any) {
      console.error('[Appwrite Register Error]:', err);

      if (err.code === 409 || err.type === 'user_already_exists') {
        // Tenta autenticar automaticamente se o usuário já existe
        try {
          try {
            await account.deleteSession('current');
          } catch {
            // sem sessão
          }
          await account.createEmailPasswordSession(cleanEmail, password);
          const user = await account.get();
          const superAdminStatus = checkIsSuperAdmin(user.email);

          const appUser: AppwriteUser = {
            id: user.$id,
            name: user.name || name.trim() || 'Usuário',
            email: user.email,
            isSuperAdmin: superAdminStatus,
            role: superAdminStatus ? 'super_admin' : 'admin',
          };

          localStorage.setItem('mapapro_user_session', JSON.stringify(appUser));
          return appUser;
        } catch (loginErr: any) {
          throw new Error('Este e-mail já está cadastrado no sistema. Por favor, faça login com sua senha.');
        }
      }

      if (err.code === 400 && err.message?.includes('Password')) {
        throw new Error('A senha informada deve ter pelo menos 8 caracteres seguros.');
      }

      throw new Error(err.message || 'Erro ao cadastrar novo usuário.');
    }
  },

  loginWithGoogle(): void {
    const successUrl = `${window.location.origin}/`;
    const failureUrl = `${window.location.origin}/auth?error=oauth_failed`;
    account.createOAuth2Session('google' as any, successUrl, failureUrl);
  },

  async logout(): Promise<void> {
    try {
      await account.deleteSession('current');
    } catch (err) {
      console.warn('[Appwrite Logout]:', err);
    } finally {
      localStorage.removeItem('mapapro_user_session');
    }
  },

  async getCurrentUser(): Promise<AppwriteUser | null> {
    try {
      const user = await account.get();
      const isSuper = checkIsSuperAdmin(user.email);
      return {
        id: user.$id,
        name: user.name || (isSuper ? 'Super Administrador' : 'Consultor'),
        email: user.email,
        isSuperAdmin: isSuper,
        role: isSuper ? 'super_admin' : 'admin',
      };
    } catch {
      return null;
    }
  },

  async requestPasswordRecovery(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;

    try {
      await account.createRecovery(cleanEmail, redirectUrl);
    } catch (err: any) {
      console.error('[Appwrite Recovery Error]:', err);
      if (err.code === 404 || err.type === 'user_not_found') {
        throw new Error('Nenhum usuário cadastrado encontrado com este e-mail.');
      }
      throw new Error(err.message || 'Erro ao enviar e-mail de recuperação.');
    }
  },

  async confirmPasswordRecovery(userId: string, secret: string, newPassword: string): Promise<void> {
    try {
      await account.updateRecovery(userId, secret, newPassword);
    } catch (err: any) {
      console.error('[Appwrite Confirm Recovery Error]:', err);
      throw new Error(err.message || 'Erro ao redefinir a senha. O link pode ter expirado ou ser inválido.');
    }
  },
};
