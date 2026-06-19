import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interface para as ações aceitas
interface Payload {
  action: 'exchange_code' | 'send';
  code?: string;
  redirect_uri?: string;
  to?: string;
  templateName?: string;
  variables?: Record<string, string>;
}

// Configurações CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const payload: Payload = await req.json()
    const { action } = payload

    const clientId = Deno.env.get('GMAIL_CLIENT_ID')
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error("Credenciais do Gmail não configuradas nos secrets.")
    }

    // ── AÇÃO 1: Trocar o código pelo Refresh Token (Uma vez) ──
    if (action === 'exchange_code') {
      const { code, redirect_uri } = payload
      if (!code || !redirect_uri) throw new Error("Faltando 'code' ou 'redirect_uri'")

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri,
          grant_type: "authorization_code"
        })
      })

      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) {
        throw new Error(`Google API Error: ${tokenData.error_description || tokenData.error}`)
      }

      if (!tokenData.refresh_token) {
        throw new Error("A autorização não retornou um refresh_token. O usuário precisa revogar o app e autorizar novamente.")
      }

      // Salvar refresh_token no banco
      await supabase
        .from('system_settings')
        .upsert({ key: 'gmail_refresh_token', value: tokenData.refresh_token })
      
      await supabase
        .from('system_settings')
        .upsert({ key: 'gmail_configured', value: true })

      return new Response(JSON.stringify({ success: true, message: "Gmail conectado com sucesso" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── AÇÃO 2: Enviar E-mail usando Template ──
    if (action === 'send') {
      const { to, templateName, variables = {} } = payload
      if (!to || !templateName) throw new Error("Faltando 'to' ou 'templateName'")

      // 1. Verificar se notificações estão ativadas no settings
      const { data: globalNotif } = await supabase.from('system_settings').select('value').eq('key', 'enable_email_notifications').single()
      if (globalNotif && globalNotif.value === false) {
        return new Response(JSON.stringify({ success: false, message: "E-mails globais desativados." }), { headers: corsHeaders })
      }

      // 2. Obter o refresh_token do banco
      const { data: tokenRecord } = await supabase.from('system_settings').select('value').eq('key', 'gmail_refresh_token').single()
      if (!tokenRecord || !tokenRecord.value) {
        throw new Error("Gmail não está conectado (refresh_token ausente).")
      }
      const refreshToken = tokenRecord.value

      // 3. Obter novo access_token usando refresh_token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error("Falha ao atualizar token de acesso do Gmail.")
      const accessToken = tokenData.access_token

      // 4. Montar o conteúdo do e-mail (Exemplo simplificado)
      // Aqui poderíamos puxar templates de system_settings, mas para facilitar vamos hardcodar exemplos ou construir baseado nos variables.
      let htmlBody = `<h1>Notificação: ${templateName}</h1><br/>`
      for (const [k, v] of Object.entries(variables)) {
        htmlBody += `<p><b>${k}:</b> ${v}</p>`
      }

      // Montar MIME RFC 2822
      const subject = "Agência de Viagens - Atualização"
      const message = [
        `To: ${to}`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        `Content-Type: text/html; charset="UTF-8"`,
        '',
        htmlBody
      ].join('\r\n')

      const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      // 5. Enviar via Gmail API
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedMessage })
      })

      if (!sendRes.ok) {
        const errorData = await sendRes.json()
        throw new Error(`Gmail Send Error: ${JSON.stringify(errorData)}`)
      }

      // 6. Log sucesso
      await supabase.from('email_logs').insert({
        recipient: to,
        template_name: templateName,
        status: 'success'
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error("Ação não reconhecida")

  } catch (error: any) {
    // Log erro
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
