import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# I will find the <!-- Users Table --> and replace everything up to the end of page-admin
# Actually, I'll extract the exact inner HTMLs of the card bodies to preserve them.

users_body_match = re.search(r'<tbody id="admin-users-body">.*?</tbody>', html, re.DOTALL)
activity_log_match = re.search(r'<div class="activity-log" id="admin-activity-log">.*?</div>', html, re.DOTALL)
agency_settings_match = re.search(r'<div class="agency-settings" id="admin-settings">.*?</div>\s*</div>\s*</div>', html, re.DOTALL)
push_config_match = re.search(r'<form id="push-config-form".*?</form>', html, re.DOTALL)

# For Thay IA, it's more complex, it has Provider Grid, Key Input, Model Config, Token Consumption, and Knowledge Base.
thay_ai_config_match = re.search(r'<div class="card-body">\s*<!-- Provider Selector -->.*?</div>\s*</div>\s*<!-- Token Consumption -->', html, re.DOTALL)
if thay_ai_config_match:
    thay_ai_config = thay_ai_config_match.group(0).replace('<!-- Token Consumption -->', '').strip()
    # Strip the leading <div class="card-body"> and trailing </div>
    thay_ai_config = re.sub(r'^<div class="card-body">', '', thay_ai_config).strip()
    thay_ai_config = re.sub(r'</div>$', '', thay_ai_config).strip()

token_consumption_match = re.search(r'<!-- Token Consumption -->.*?<div class="card-body">(.*?)</div>\s*</div>\s*</div>\s*<!-- Thay IA — Knowledge Base -->', html, re.DOTALL)
token_consumption = token_consumption_match.group(1).strip() if token_consumption_match else ""

knowledge_base_match = re.search(r'<!-- Thay IA — Knowledge Base -->.*?<div class="card-body">(.*?)</div>\s*</div>\s*</div>\s*</main>', html, re.DOTALL)
knowledge_base = knowledge_base_match.group(1).strip() if knowledge_base_match else ""

# Replace section from <!-- Users Table --> to end of #page-admin

new_html_block = f"""
        <!-- Admin Accordions Wrapper -->
        <div class="admin-accordions-wrapper" style="margin-top: var(--sp-5);">

          <!-- ACCORDION: Usuários do Sistema -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-users"></i></div>
                <div>
                  <h3>Usuários do Sistema</h3>
                  <span class="subtitle">Gerencie acessos e papéis</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding: 0;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Papel</th>
                    <th>Status</th>
                    <th>Último Login</th>
                    <th style="text-align:center; width:60px;">Ações</th>
                  </tr>
                </thead>
                {users_body_match.group(0)}
              </table>
            </div>
          </div>

          <!-- ACCORDION: Log de Atividades -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-clock-rotate-left"></i></div>
                <div>
                  <h3>Log de Atividades</h3>
                  <span class="subtitle">Histórico de ações no sistema</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body">
              {activity_log_match.group(0)}
            </div>
          </div>

          <!-- ACCORDION: Configurações da Agência -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-gear"></i></div>
                <div>
                  <h3>Configurações da Agência</h3>
                  <span class="subtitle">Preferências gerais do sistema</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body">
              <div class="agency-settings" id="admin-settings">
                <!-- Populated by admin.js -->
              </div>
            </div>
          </div>

          <!-- ACCORDION: Configurações de E-mail (Gmail) -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-envelope"></i></div>
                <div>
                  <h3>Configurações de E-mail</h3>
                  <span class="subtitle">Envio de propostas e alertas via Gmail</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding-bottom: 20px;">
              <div id="gmail-status-container" style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-hover); padding: 16px; border-radius: 8px; margin-bottom: 16px; margin-top: 16px;">
                <div>
                  <h4 style="margin: 0; color: var(--text-primary);"><i class="fab fa-google" style="color: #DB4437; margin-right: 8px;"></i>Integração Gmail</h4>
                  <span style="font-size: 13px; color: var(--stone-400);" id="gmail-status-text">Não conectado</span>
                </div>
                <button class="btn btn-outline" id="btn-connect-gmail" onclick="connectGmail()">Conectar Conta</button>
              </div>

              <div class="form-group">
                <label class="form-label">E-mail Remetente Padrão</label>
                <input type="email" class="form-input" id="email-sender" placeholder="contato@suaagencia.com">
              </div>
              
              <h4 style="margin-top: 24px; margin-bottom: 12px; font-size: 14px;">Gatilhos de Envio</h4>
              <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;"><input type="checkbox" id="trigger-new-traveler" checked> Novo Viajante Cadastrado</label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;"><input type="checkbox" id="trigger-itinerary-approved" checked> Roteiro Aprovado</label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;"><input type="checkbox" id="trigger-general" checked> Comunicações Gerais</label>
              </div>
              
              <button class="btn btn-primary" onclick="saveEmailConfig()" style="width: 100%;"><i class="fas fa-save"></i> Salvar Configurações de E-mail</button>
            </div>
          </div>

          <!-- ACCORDION: Notificações Push -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-bell"></i></div>
                <div>
                  <h3>Notificações Push (Firebase)</h3>
                  <span class="subtitle">Alertas via push para usuários</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding-bottom: 20px;">
              <div style="margin-top: 16px;">
                {push_config_match.group(0)}
              </div>
            </div>
          </div>

          <!-- ACCORDION: Thay IA Configuração -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-robot"></i></div>
                <div>
                  <h3>Thay IA — Configuração</h3>
                  <span class="subtitle">Modelos e Chaves de API</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding-bottom: 20px;">
              <div style="margin-top: 16px;">
                <div style="margin-bottom: 16px;">
                  <span class="ai-status-badge" id="ai-status-badge">
                    <span class="ai-status-dot"></span> Desconectada
                  </span>
                </div>
                {thay_ai_config}
              </div>
            </div>
          </div>

          <!-- ACCORDION: Consumo de Tokens -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-chart-bar"></i></div>
                <div>
                  <h3>Consumo de Tokens</h3>
                  <span class="subtitle">Estatísticas de uso da IA</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding-bottom: 20px;">
              <div style="margin-top: 16px;">
                {token_consumption}
              </div>
            </div>
          </div>

          <!-- ACCORDION: Base de Conhecimento Thay IA -->
          <div class="admin-accordion">
            <div class="admin-accordion-header" onclick="toggleAdminAccordion(this)">
              <div class="admin-accordion-title">
                <div class="admin-accordion-icon"><i class="fas fa-graduation-cap"></i></div>
                <div>
                  <h3>Base de Conhecimento — Thay IA</h3>
                  <span class="subtitle">Treine a Thay com informações da agência</span>
                </div>
              </div>
              <i class="fas fa-chevron-down admin-accordion-toggle"></i>
            </div>
            <div class="admin-accordion-body" style="padding-bottom: 20px;">
              <div style="margin-top: 16px;">
                {knowledge_base}
              </div>
            </div>
          </div>

        </div> <!-- /.admin-accordions-wrapper -->
      </div>
    </main>
"""

# Now we replace everything from <!-- Users Table --> to </main>
import re
start_pattern = r'<!-- Users Table -->.*?</main>'
new_html = re.sub(start_pattern, new_html_block, html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Refactored index.html")
