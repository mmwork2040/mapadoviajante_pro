ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS crm_leads_archived_at_idx ON public.crm_leads (agency_id, archived_at);