-- QuoteReady schema. Idempotent: safe to run more than once in the Supabase SQL editor.
-- RLS on with no policies; access only through service_role from server-side code.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  standard text not null check (standard in ('ISO 4017', 'ISO 4014')),
  thread_size text not null check (thread_size in ('M8', 'M10', 'M12')),
  length_mm integer not null check (length_mm > 0),
  material_group text not null check (material_group in ('A2', 'A4', 'CARBON')),
  property_class text not null check (property_class in ('70', '80', '8.8')),
  finish text not null check (finish in ('plain', 'zinc')),
  price_pence integer not null check (price_pence >= 0),
  stock_qty integer not null check (stock_qty >= 0),
  lead_time_days integer not null check (lead_time_days >= 0),
  stock_as_of timestamptz not null,
  unique (standard, thread_size, length_mm, material_group, property_class, finish)
);

create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw_text text not null,
  status text not null default 'PENDING_ANALYSIS'
    check (status in ('PENDING_ANALYSIS', 'READY', 'CLARIFICATION', 'NO_MATCH', 'ERROR')),
  error_code text,
  client_hash text,
  warnings jsonb not null default '[]'::jsonb,
  model text,
  used_fallback boolean not null default false,
  latency_ms integer check (latency_ms >= 0),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  decision text check (decision in ('APPROVED', 'REJECTED')),
  decided_at timestamptz
);

create table if not exists public.quote_lines (
  id bigint generated always as identity primary key,
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  line_no integer not null check (line_no >= 1),
  outcome text not null check (outcome in ('READY', 'CLARIFICATION', 'NO_MATCH')),
  sku text,
  unit_price_pence integer check (unit_price_pence >= 0),
  quantity integer check (quantity >= 0),
  stock_snapshot integer check (stock_snapshot >= 0),
  lead_time_days integer check (lead_time_days >= 0),
  detail jsonb not null default '{}'::jsonb,
  unique (rfq_id, line_no),
  -- A gated line (CLARIFICATION or NO_MATCH) never carries a SKU, price, stock or lead time.
  constraint quote_lines_product_only_when_ready
    check (
      outcome = 'READY'
      or (sku is null and unit_price_pence is null and stock_snapshot is null and lead_time_days is null)
    )
);

alter table public.products enable row level security;
alter table public.rfqs enable row level security;
alter table public.quote_lines enable row level security;

revoke all on public.products, public.rfqs, public.quote_lines from anon, authenticated;
grant select, insert, update, delete on public.products, public.rfqs, public.quote_lines to service_role;
grant usage, select on all sequences in schema public to service_role;

notify pgrst, 'reload schema';

-- Verification: expect three rows, rls_enabled true for each.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('products', 'rfqs', 'quote_lines')
order by c.relname;
