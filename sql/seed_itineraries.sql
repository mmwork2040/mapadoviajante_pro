-- ══════════════════════════════════════════════════════════════
-- SEED: Itineraries, Days, Activities & Vouchers
-- Maps to data.js ITINERARIES array (3 itineraries)
-- Run this in the Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_agency_id UUID;
  v_lucas_id UUID;
  v_ana_id UUID;
  v_pedro_id UUID;
  -- Lead IDs
  v_lead_santos UUID;
  v_lead_oliveira UUID;
  v_lead_roberto UUID;
  -- Itinerary IDs
  v_itin1 UUID;
  v_itin2 UUID;
  v_itin3 UUID;
  -- Day IDs (Itinerary 1: 5 days)
  v_d1_1 UUID;
  v_d1_2 UUID;
  v_d1_3 UUID;
  v_d1_4 UUID;
  v_d1_5 UUID;
  -- Day IDs (Itinerary 2: 3 days)
  v_d2_1 UUID;
  v_d2_2 UUID;
  v_d2_3 UUID;
BEGIN
  -- ── Get agency & members ──
  SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma agência encontrada.';
  END IF;

  SELECT id INTO v_lucas_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Lucas Felipe';
  SELECT id INTO v_ana_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Ana Costa';
  SELECT id INTO v_pedro_id FROM public.agency_members WHERE agency_id = v_agency_id AND name = 'Pedro Mendes';

  -- ── Get leads ──
  SELECT id INTO v_lead_santos FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Família Santos';
  SELECT id INTO v_lead_oliveira FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Casal Oliveira';
  SELECT id INTO v_lead_roberto FROM public.crm_leads WHERE agency_id = v_agency_id AND name = 'Roberto Almeida';

  -- ── Clear existing (idempotent) ──
  DELETE FROM public.crm_itinerary_activities WHERE day_id IN (
    SELECT d.id FROM public.crm_itinerary_days d
    JOIN public.crm_itineraries i ON d.itinerary_id = i.id
    WHERE i.agency_id = v_agency_id
  );
  DELETE FROM public.crm_itinerary_days WHERE itinerary_id IN (
    SELECT id FROM public.crm_itineraries WHERE agency_id = v_agency_id
  );
  DELETE FROM public.crm_vouchers WHERE itinerary_id IN (
    SELECT id FROM public.crm_itineraries WHERE agency_id = v_agency_id
  );
  DELETE FROM public.crm_itineraries WHERE agency_id = v_agency_id;

  -- ═══════════════════════════════════════════════════════════
  -- ITINERARY 1: Lisboa & Porto — Família Santos
  -- Status: sent (em andamento)
  -- 5 days, 12 activities, 6 vouchers
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.crm_itineraries (agency_id, lead_id, created_by, title, client_name, destination, start_date, end_date, passengers, budget, spent, status)
  VALUES (v_agency_id, v_lead_santos, v_lucas_id, 'Lisboa & Porto — Família Santos', 'Família Santos', 'Lisboa', '2025-07-15', '2025-07-25', 4, 18500, 14200, 'sent')
  RETURNING id INTO v_itin1;

  -- Days
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin1, 1, 'Dia 1', '2025-07-15', 1) RETURNING id INTO v_d1_1;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin1, 2, 'Dia 2', '2025-07-16', 2) RETURNING id INTO v_d1_2;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin1, 3, 'Dia 3', '2025-07-17', 3) RETURNING id INTO v_d1_3;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin1, 4, 'Dia 4', '2025-07-18', 4) RETURNING id INTO v_d1_4;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin1, 5, 'Dia 5', '2025-07-19', 5) RETURNING id INTO v_d1_5;

  -- Activities — Dia 1 (Voo de ida)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d1_1, 'flight', 'Voo LATAM LA8045', 'GRU → LIS • 10h30', '22:00', 4800, 'Aeroporto de Guarulhos', 1);

  -- Activities — Dia 2 (Lisboa - Belém)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d1_2, 'hotel', 'Hotel Pestana Palace', 'Check-in • R. Jau, Lisboa', '14:00', 1200, 'R. Jau 54, Lisboa', 1),
    (v_d1_2, 'activity', 'Tour Belém', 'Torre de Belém + Jerónimos', '16:00', 120, 'Belém, Lisboa', 2),
    (v_d1_2, 'restaurant', 'Restaurante Ramiro', 'Frutos do mar', '20:00', 280, 'Av. Almirante Reis 1, Lisboa', 3);

  -- Activities — Dia 3 (Sintra & Cascais)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d1_3, 'activity', 'Sintra & Cascais', 'Day trip com guia privado', '09:00', 450, 'Sintra / Cascais', 1),
    (v_d1_3, 'restaurant', 'Jantar em Cascais', 'Vista para o mar', '19:30', 200, 'Cascais', 2);

  -- Activities — Dia 4 (Transfer + Porto)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d1_4, 'transfer', 'Transfer Lisboa → Porto', 'Trem Alfa Pendular • 2h40', '08:00', 160, 'Estação Santa Apolónia → Campanhã', 1),
    (v_d1_4, 'hotel', 'Hotel The Yeatman', 'Check-in • Vila Nova de Gaia', '12:00', 1800, 'R. do Choupelo, Vila Nova de Gaia', 2),
    (v_d1_4, 'activity', 'Degustação de Vinhos', 'Caves do Porto', '15:00', 180, 'Vila Nova de Gaia', 3);

  -- Activities — Dia 5 (Porto)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d1_5, 'activity', 'Passeio de barco Douro', 'Cruzeiro 6 pontes', '10:00', 200, 'Rio Douro, Porto', 1),
    (v_d1_5, 'restaurant', 'Francesinha no Porto', 'Café Santiago', '13:00', 80, 'R. de Passos Manuel, Porto', 2);

  -- Vouchers — Itinerary 1
  INSERT INTO public.crm_vouchers (itinerary_id, name, category, confirmation_code, notes) VALUES
    (v_itin1, 'E-ticket LATAM LA8045.pdf', 'flight', 'LATAM-LA8045-SANTOS', 'Voo direto GRU→LIS, 4 passageiros'),
    (v_itin1, 'Reserva Pestana Palace.pdf', 'hotel', 'PP-2025-84721', '2 quartos duplos, café da manhã incluído'),
    (v_itin1, 'Reserva The Yeatman.pdf', 'hotel', 'YTM-2025-33109', 'Suite com vista para o Douro'),
    (v_itin1, 'Seguro Viagem - Allianz.pdf', 'insurance', 'ALZ-BR-99182', 'Cobertura completa incluindo COVID'),
    (v_itin1, 'Comprovante Transfer Porto.jpg', 'transfer', 'AP-TRANSFER-7812', 'Alfa Pendular, 4 assentos preferenciais'),
    (v_itin1, 'Tour Sintra - Confirmação.png', 'activity', 'SINTRA-TOUR-4401', 'Guia privado, van exclusiva para 4 pax');


  -- ═══════════════════════════════════════════════════════════
  -- ITINERARY 2: Curaçao All-Inclusive — Casal Oliveira
  -- Status: approved (venda fechada)
  -- 3 days, 5 activities, 3 vouchers
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.crm_itineraries (agency_id, lead_id, created_by, title, client_name, destination, start_date, end_date, passengers, budget, spent, status)
  VALUES (v_agency_id, v_lead_oliveira, v_ana_id, 'Curaçao All-Inclusive — Casal Oliveira', 'Casal Oliveira', 'Curaçao', '2025-08-01', '2025-08-08', 2, 12400, 12400, 'approved')
  RETURNING id INTO v_itin2;

  -- Days
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin2, 1, 'Dia 1', '2025-08-01', 1) RETURNING id INTO v_d2_1;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin2, 2, 'Dia 2', '2025-08-02', 2) RETURNING id INTO v_d2_2;
  INSERT INTO public.crm_itinerary_days (itinerary_id, day_number, label, date, sort_order) VALUES
    (v_itin2, 3, 'Dia 3', '2025-08-03', 3) RETURNING id INTO v_d2_3;

  -- Activities — Dia 1 (Chegada)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d2_1, 'flight', 'Voo Copa CM726', 'GRU → CUR (via PTY) • 9h20', '06:00', 3200, 'Aeroporto de Guarulhos', 1),
    (v_d2_1, 'hotel', 'Dreams Curaçao Resort', 'Check-in All-Inclusive', '16:00', 5600, 'Dreams Curaçao Resort, Spa & Casino', 2);

  -- Activities — Dia 2 (Praia)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d2_2, 'activity', 'Praia de Cas Abao', 'Snorkeling + almoço na praia', '09:00', 0, 'Cas Abao Beach', 1);

  -- Activities — Dia 3 (Willemstad)
  INSERT INTO public.crm_itinerary_activities (day_id, type, title, description, time_start, cost, location, sort_order) VALUES
    (v_d2_3, 'activity', 'Willemstad Tour', 'Punda + Otrobanda + Floating Market', '10:00', 80, 'Willemstad, Curaçao', 1),
    (v_d2_3, 'restaurant', 'Gouverneur de Rouville', 'Jantar com vista', '19:00', 180, 'Otrobanda, Willemstad', 2);

  -- Vouchers — Itinerary 2
  INSERT INTO public.crm_vouchers (itinerary_id, name, category, confirmation_code, notes) VALUES
    (v_itin2, 'E-ticket Copa CM726.pdf', 'flight', 'COPA-CM726-OLIVEIRA', 'GRU→PTY→CUR, 2 passageiros'),
    (v_itin2, 'Dreams Curaçao - Booking.pdf', 'hotel', 'DREAMS-CUR-2025-11204', 'All-Inclusive, Ocean View Room, 7 noites'),
    (v_itin2, 'Seguro Travel Ace.pdf', 'insurance', 'TACE-BR-44821', 'Cobertura COVID + esportes aquáticos');


  -- ═══════════════════════════════════════════════════════════
  -- ITINERARY 3: Peru Aventura — Roberto Almeida (Rascunho)
  -- Status: draft (sem dias/atividades ainda)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.crm_itineraries (agency_id, lead_id, created_by, title, client_name, destination, start_date, end_date, passengers, budget, spent, status)
  VALUES (v_agency_id, v_lead_roberto, v_lucas_id, 'Peru Aventura — Roberto Almeida', 'Roberto Almeida', 'Peru', '2025-09-10', '2025-09-20', 2, 15200, 0, 'draft')
  RETURNING id INTO v_itin3;

  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE 'Total: 3 itineraries, 8 days, 17 activities, 9 vouchers';
END $$;

-- Verify counts
SELECT 'Itineraries' as entity, count(*) as total FROM public.crm_itineraries
UNION ALL SELECT 'Days', count(*) FROM public.crm_itinerary_days
UNION ALL SELECT 'Activities', count(*) FROM public.crm_itinerary_activities
UNION ALL SELECT 'Vouchers', count(*) FROM public.crm_vouchers;
