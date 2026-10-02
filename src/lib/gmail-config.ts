import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

export type EmailProvider = "gmail" | "appwrite";

export interface EmailConfig {
  enabled: boolean;
  provider: EmailProvider;
  
  // Informações de exibição e remetente
  senderName: string;
  replyTo: string;
  defaultSubject: string;
  signature: string;

  // Configuração Gmail (SMTP com Senha de Aplicativo)
  gmailUser: string;
  gmailAppPassword: string;
  gmailSmtpHost: string;
  gmailSmtpPort: number;

  // Configuração Appwrite (Messaging API ou SMTP)
  appwriteMode: "messaging" | "smtp";
  appwriteEndpoint: string;
  appwriteProjectId: string;
  appwriteApiKey: string;
  appwriteSenderEmail: string;
  appwriteSmtpHost: string;
  appwriteSmtpPort: number;
  appwriteSmtpUser: string;
  appwriteSmtpPassword: string;
}

// Retrocompatibilidade
export type GmailConfig = EmailConfig;

export const DEFAULT_CONFIG: EmailConfig = {
  enabled: false,
  provider: "gmail",
  senderName: "O Segredo do Viajante",
  replyTo: "",
  defaultSubject: "Sobre sua viagem",
  signature: "Atenciosamente,\nEquipe O Segredo do Viajante",

  gmailUser: "",
  gmailAppPassword: "",
  gmailSmtpHost: "smtp.gmail.com",
  gmailSmtpPort: 465,

  appwriteMode: "messaging",
  appwriteEndpoint: "https://appwrite.agenc-ia.net/v1",
  appwriteProjectId: "6abdb8190017d98565f5",
  appwriteApiKey: "",
  appwriteSenderEmail: "",
  appwriteSmtpHost: "",
  appwriteSmtpPort: 587,
  appwriteSmtpUser: "",
  appwriteSmtpPassword: "",
};

export async function getGmailConfig(): Promise<EmailConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "gmail" } });
    if (!value) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(value) as Partial<EmailConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveGmailConfig(config: EmailConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "gmail", value: JSON.stringify(config) } });
}
