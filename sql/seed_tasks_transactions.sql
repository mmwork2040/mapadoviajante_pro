-- ══════════════════════════════════════════════════════════════
-- SEED: Tasks & Transactions for CRM
-- Run this in the Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- First, let's get our agency_id and member IDs
-- We'll use CTEs for clarity

-- ── SEED TASKS ──────────────────────────────────────────────
-- Maps to data.js TASKS array (8 items)
DO $$
DECLARE
  v_agency_id UUID;
  v_lucas_id UUID;
  v_ana_id UUID;
  v_pedro_id UUID;
  v_juliana_id UUID;
  v_carlos_id UUID;
  -- Lead IDs
  v_lead_santos UUID;
  v_lead_oliveira UUID;
  v_lead_maria UUID;
  v_lead_roberto UUID;
  v_lead_ana UUID;
  v_lead_pedro UUID;
  v_lead_juliana UUID;
BEGIN
  -- Get agency (Select the first one since it's a single-tenant dev setup for now)
  SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;
  
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma agência encontrada na tabela agencies. Cadastre uma agência primeiro.';
  END IF;
  -- Get members
  SELECT id INTO v_lucas_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Lucas Felipe';
  SELECT id INTO v_ana_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Ana Costa';
  SELECT id INTO v_pedro_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Pedro Mendes';
  SELECT id INTO v_juliana_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Juliana Ferreira';
  SELECT id INTO v_carlos_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Carlos Souza';
  
  -- Get lead IDs by name
  SELECT id INTO v_lead_santos FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Família Santos';
  SELECT id INTO v_lead_oliveira FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Casal Oliveira';
  SELECT id INTO v_lead_maria FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Maria Silva';
  SELECT id INTO v_lead_roberto FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Roberto Almeida';
  SELECT id INTO v_lead_ana FROM public.crm_leads WHERE agency_id = v_agency_id AND name LIKE '%Ana Costa%';
  SELECT id INTO v_lead_pedro FROM public.crm_leads WHERE agency_id = v_agency_id AND name LIKE '%Pedro Mendes%';
  SELECT id INTO v_lead_juliana FROM public.crm_leads WHERE agency_id = v_agency_id AND name LIKE '%Juliana Ferreira%';

  -- Clear existing tasks (idempotent)
  DELETE FROM public.crm_tasks WHERE agency_id = v_agency_id;

  -- Insert tasks
  INSERT INTO public.crm_tasks (agency_id, assigned_to, created_by, lead_id, title, priority, due_date, completed, completed_at) VALUES
    (v_agency_id, v_lucas_id,   v_lucas_id, v_lead_santos,   'Check-in Família Santos — Voo LA8045 Lisboa',           'urgent',    (CURRENT_DATE + INTERVAL '1 day')::date,  false, NULL),
    (v_agency_id, v_juliana_id, v_ana_id,   v_lead_ana,      'Confirmar Hotel Marriott Aruba — Ana Costa',             'attention', (CURRENT_DATE + INTERVAL '2 days')::date, false, NULL),
    (v_agency_id, v_pedro_id,   v_lucas_id, v_lead_roberto,  'Follow-up Roberto Almeida — orçamento Peru',             'normal',    (CURRENT_DATE + INTERVAL '3 days')::date, false, NULL),
    (v_agency_id, v_pedro_id,   v_ana_id,   v_lead_oliveira, 'Enviar vouchers Casal Oliveira — Curaçao',               'urgent',    CURRENT_DATE,                             false, NULL),
    (v_agency_id, v_pedro_id,   v_lucas_id, v_lead_pedro,    'Montar roteiro Grécia — Pedro Mendes (6 pax)',           'attention', (CURRENT_DATE + INTERVAL '4 days')::date, false, NULL),
    (v_agency_id, v_juliana_id, v_pedro_id, v_lead_maria,    'Responder DM Instagram — Maria Silva',                   'normal',    CURRENT_DATE,                             false, NULL),
    (v_agency_id, v_juliana_id, v_lucas_id, v_lead_juliana,  'Verificar visto Maldivas — Juliana Ferreira',            'attention', (CURRENT_DATE + INTERVAL '5 days')::date, true,  (CURRENT_TIMESTAMP - INTERVAL '2 days')),
    (v_agency_id, v_lucas_id,   v_lucas_id, NULL,            'Atualizar planilha comissões — Maio',                    'normal',    (CURRENT_DATE + INTERVAL '7 days')::date, true,  (CURRENT_TIMESTAMP - INTERVAL '1 day'));

  RAISE NOTICE 'Tasks seeded: 8 rows';

  -- ── SEED TRANSACTIONS ───────────────────────────────────────
  -- Maps to data.js TRANSACTIONS array (12 items)
  -- Spread across last 6 months for chart data
  
  DELETE FROM public.crm_transactions WHERE agency_id = v_agency_id;

  INSERT INTO public.crm_transactions (agency_id, lead_id, type, amount, description, category, transaction_date, status, created_by) VALUES
    -- June 2025
    (v_agency_id, v_lead_oliveira, 'income',     12400, 'Pacote Curaçao — Casal Oliveira',       'pacote',    '2025-06-07', 'confirmed', v_ana_id),
    (v_agency_id, v_lead_oliveira, 'income',      1488, 'Comissão — Curaçao (12%)',              'comissao',  '2025-06-07', 'confirmed', v_ana_id),
    (v_agency_id, NULL,            'expense',      89,  'Software CRM — Mensalidade',            'software',  '2025-06-01', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',     450,  'Material marketing — Instagram Ads',     'marketing', '2025-06-01', 'confirmed', v_lucas_id),

    -- May 2025
    (v_agency_id, NULL,            'income',      6800, 'Pacote Noronha — Cliente antigo',        'pacote',    '2025-05-28', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',      1020, 'Comissão — Noronha (15%)',               'comissao',  '2025-05-28', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'expense',     199,  'Telefonia e internet',                   'operacional','2025-05-25', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',     350,  'Seguro viagem — reembolso',              'operacional','2025-05-20', 'confirmed', v_lucas_id),

    -- April 2025  (extra data for chart)
    (v_agency_id, NULL,            'income',     22000, 'Pacote Grécia — Grupo Amigos',           'pacote',    '2025-04-20', 'confirmed', v_ana_id),
    (v_agency_id, NULL,            'income',      2640, 'Comissão — Grécia (12%)',                'comissao',  '2025-04-20', 'confirmed', v_ana_id),
    (v_agency_id, NULL,            'income',      8500, 'Pacote Curaçao — Casal Martins',         'pacote',    '2025-04-10', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',      1020, 'Comissão — Curaçao (12%)',               'comissao',  '2025-04-10', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',      9800, 'Pacote Aruba — Lua de mel',              'pacote',    '2025-04-05', 'confirmed', v_juliana_id),
    (v_agency_id, NULL,            'expense',      89,  'Software CRM — Mensalidade',            'software',  '2025-04-01', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',     320,  'Instagram Ads',                          'marketing', '2025-04-01', 'confirmed', v_lucas_id),

    -- March 2025
    (v_agency_id, NULL,            'income',     11000, 'Pacote Lisboa — Viagem Solo',            'pacote',    '2025-03-22', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',      1320, 'Comissão — Lisboa (12%)',                'comissao',  '2025-03-22', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',     13600, 'Pacote Peru — Beatriz Rocha',            'pacote',    '2025-03-15', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'income',      1360, 'Comissão — Peru (10%)',                  'comissao',  '2025-03-15', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',      89,  'Software CRM — Mensalidade',            'software',  '2025-03-01', 'confirmed', v_lucas_id),

    -- February 2025
    (v_agency_id, NULL,            'income',     18500, 'Pacote Europa — Família Lima',           'pacote',    '2025-02-18', 'confirmed', v_ana_id),
    (v_agency_id, NULL,            'income',      2220, 'Comissão — Europa (12%)',                'comissao',  '2025-02-18', 'confirmed', v_ana_id),
    (v_agency_id, NULL,            'income',      9500, 'Pacote Noronha — Casal Neves',           'pacote',    '2025-02-08', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'income',      1425, 'Comissão — Noronha (15%)',               'comissao',  '2025-02-08', 'confirmed', v_pedro_id),
    (v_agency_id, NULL,            'expense',      89,  'Software CRM — Mensalidade',            'software',  '2025-02-01', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',     280,  'Instagram Ads',                          'marketing', '2025-02-01', 'confirmed', v_lucas_id),

    -- January 2025
    (v_agency_id, NULL,            'income',     15000, 'Pacote Maldivas — Aniversário',          'pacote',    '2025-01-25', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'income',      1800, 'Comissão — Maldivas (12%)',              'comissao',  '2025-01-25', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'income',      8200, 'Pacote Peru — Aventura',                 'pacote',    '2025-01-12', 'confirmed', v_juliana_id),
    (v_agency_id, NULL,            'income',       820, 'Comissão — Peru (10%)',                  'comissao',  '2025-01-12', 'confirmed', v_juliana_id),
    (v_agency_id, NULL,            'expense',      89,  'Software CRM — Mensalidade',            'software',  '2025-01-01', 'confirmed', v_lucas_id),
    (v_agency_id, NULL,            'expense',     450,  'Material gráfico',                       'marketing', '2025-01-05', 'confirmed', v_lucas_id);

  RAISE NOTICE 'Transactions seeded: 32 rows';
END $$;

-- Verify counts
SELECT 'Tasks' as entity, count(*) as total FROM public.crm_tasks
UNION ALL
SELECT 'Transactions', count(*) FROM public.crm_transactions;
