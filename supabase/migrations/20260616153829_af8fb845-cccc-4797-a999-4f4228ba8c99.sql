
-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- Warehouses
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  max_daily INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon, authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);

-- Warehouse time slots (per warehouse)
CREATE TABLE public.warehouse_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  slot_time TEXT NOT NULL, -- 'HH:MM'
  weekday INTEGER, -- NULL = all days, 0=Sun..6=Sat
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_warehouse_slots_wh ON public.warehouse_slots(warehouse_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_slots TO anon, authenticated;
GRANT ALL ON public.warehouse_slots TO service_role;
ALTER TABLE public.warehouse_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.warehouse_slots FOR ALL USING (true) WITH CHECK (true);

-- Customer rules (rule engine)
CREATE TABLE public.customer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('port','warehouse','customs','inbound')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_rules_cust ON public.customer_rules(customer_id, rule_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_rules TO anon, authenticated;
GRANT ALL ON public.customer_rules TO service_role;
ALTER TABLE public.customer_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.customer_rules FOR ALL USING (true) WITH CHECK (true);

-- Holidays
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO anon, authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.holidays FOR ALL USING (true) WITH CHECK (true);

-- Containers (with dispatch info inline)
CREATE TABLE public.containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sbu TEXT,
  bl_no TEXT,
  item_no TEXT,
  batch TEXT,
  expiry DATE,
  container_no TEXT,
  shipment_mode TEXT,
  container_size TEXT,
  forwarder TEXT,
  etd DATE,
  eta DATE,
  customs_clear_date DATE,
  description TEXT,
  return_deadline DATE,
  port TEXT,
  -- dispatch fields
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  inbound_date DATE,
  inbound_time TEXT,
  dispatch_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (dispatch_status IN ('PENDING','AUTO','MANUAL')),
  delay_reason TEXT,
  lot_check TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_containers_eta ON public.containers(eta);
CREATE INDEX idx_containers_inbound ON public.containers(warehouse_id, inbound_date, inbound_time);
CREATE INDEX idx_containers_customer ON public.containers(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.containers TO anon, authenticated;
GRANT ALL ON public.containers TO service_role;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.containers FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_warehouses_upd BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customer_rules_upd BEFORE UPDATE ON public.customer_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_containers_upd BEFORE UPDATE ON public.containers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: 양지창고, PD창고
INSERT INTO public.warehouses (name, code, max_daily) VALUES
  ('양지창고','YANGJI', 8),
  ('PD창고','PD', 6);

INSERT INTO public.warehouse_slots (warehouse_id, slot_time)
SELECT id, t FROM public.warehouses, unnest(ARRAY['09:00','10:00','11:00','13:00','14:00','15:00']) t
WHERE name = '양지창고';

INSERT INTO public.warehouse_slots (warehouse_id, slot_time)
SELECT id, t FROM public.warehouses, unnest(ARRAY['09:00','09:30','10:00','10:30','13:00','13:30','14:00']) t
WHERE name = 'PD창고';
