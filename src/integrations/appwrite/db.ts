// Cliente de dados e de sessão do navegador (Appwrite).
import { appwriteDb } from '@/integrations/appwrite/bridge';

export const db = appwriteDb as any;
