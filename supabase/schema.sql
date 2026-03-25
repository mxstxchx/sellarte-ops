-- ============================================================
-- SELLARTE OPS - SCHEMA
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: app_users
-- ============================================================
create table public.app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  role          text not null check (role in ('gerente', 'asesor', 'cargador', 'programador')),
  asesor_codigo integer,   -- código SIIGO del asesor (solo role='asesor')
  created_at    timestamptz default now()
);

alter table public.app_users enable row level security;

create policy "users: ver propio perfil"
  on public.app_users for select
  using (auth.uid() = id);

create policy "gerente: ver todos los perfiles"
  on public.app_users for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'gerente')
  );

-- ============================================================
-- TABLA: upload_batches
-- Cada vez que se suben los 5 archivos, se crea un batch.
-- ============================================================
create table public.upload_batches (
  id               uuid primary key default uuid_generate_v4(),
  uploaded_by      uuid not null references auth.users(id),
  uploaded_by_name text not null,
  fecha_datos      date not null,       -- fecha del reporte (tomada del encabezado SIIGO)
  total_pedidos    integer default 0,
  status           text not null default 'procesando'
                     check (status in ('procesando', 'ok', 'error')),
  error_msg        text,
  warnings         jsonb default '[]',  -- array de strings con advertencias del parser
  created_at       timestamptz default now()
);

alter table public.upload_batches enable row level security;

create policy "upload_batches: insertar (gerente y cargador)"
  on public.upload_batches for insert
  with check (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role in ('gerente', 'cargador'))
  );

create policy "upload_batches: select gerente"
  on public.upload_batches for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'gerente')
  );

create policy "upload_batches: select cargador (propios)"
  on public.upload_batches for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'cargador')
    and uploaded_by = auth.uid()
  );

create policy "upload_batches: select programador"
  on public.upload_batches for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'programador')
  );

create policy "upload_batches: update (para actualizar status)"
  on public.upload_batches for update
  using (uploaded_by = auth.uid());

-- ============================================================
-- TABLA: pedidos
-- Consolidado final tras cruzar los archivos de SIIGO.
-- El SEMÁFORO se calcula en tiempo real (fecha_pactada - HOY en días hábiles colombianos).
-- ============================================================
create table public.pedidos (
  id                    uuid primary key default uuid_generate_v4(),

  -- Origen
  empresa               text not null check (empresa in ('sllrt', 'rv')),

  -- Asesor (de informe_pendientes col A-B)
  asesor_codigo         integer not null,
  asesor_nombre         text not null,

  -- Cliente (de informe_pendientes col C-E)
  cliente_nit           bigint not null,
  cliente_sucursal      bigint not null default 0,
  cliente_nombre        text not null,

  -- Producto (de informe_pendientes col F-H)
  producto_codigo       text not null,
  referencia            text,
  descripcion           text,

  -- Pedido SIIGO (de informe_pendientes col I-K)
  comprobante           text,
  numero_siigo          text not null,   -- normalizado sin ceros iniciales
  sec                   integer not null default 1,

  -- Cantidades y valores (de informe_pendientes col L-Q)
  cantidad_pedida       numeric(12, 2) not null default 0,
  valor_pedido          numeric(14, 2) not null default 0,
  cantidad_entrega      numeric(12, 2) not null default 0,
  valor_entregado       numeric(14, 2) not null default 0,
  fecha_entrega_parcial date,            -- "0000/00/00" en SIIGO = null
  cantidad_pendiente    numeric(12, 2) not null default 0,

  -- Columnas enriquecidas (calculadas al procesar)
  valor_pendiente       numeric(14, 2) not null default 0,  -- (val_pedido / cant_pedida) × cant_pendiente
  linea                 text,                                -- de tabla CONVENCIONES_LÍNEA
  fecha_pedido          date,                                -- del auxiliar (col R)
  fecha_pactada         date,                                -- del auxiliar (col X) — base del semáforo
  pedido_vendedor       text,                                -- de Control de Pedidos (col A)

  -- Enriquecimiento de código de producto (pos 0-2 = TIPO_IP, pos 5-6 = CALIBRE)
  tipo_ip               text,
  tipo_ip_desc          text,
  calibre               text,
  calibre_desc          text,

  -- Metadata
  upload_batch_id       uuid not null references public.upload_batches(id) on delete cascade,
  created_at            timestamptz default now(),

  -- Unicidad dentro de un mismo batch
  unique (numero_siigo, sec, empresa, upload_batch_id)
);

create index idx_pedidos_asesor    on public.pedidos(asesor_codigo);
create index idx_pedidos_empresa   on public.pedidos(empresa);
create index idx_pedidos_fecha_pac on public.pedidos(fecha_pactada);
create index idx_pedidos_batch     on public.pedidos(upload_batch_id);
create index idx_pedidos_nit       on public.pedidos(cliente_nit);

alter table public.pedidos enable row level security;

-- Gerente: todos los pedidos
create policy "pedidos: gerente ve todo"
  on public.pedidos for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'gerente')
  );

-- Asesor: solo sus pedidos (por asesor_codigo)
create policy "pedidos: asesor ve los suyos"
  on public.pedidos for select
  using (
    exists (
      select 1 from public.app_users u
      where u.id = auth.uid()
        and u.role = 'asesor'
        and u.asesor_codigo = pedidos.asesor_codigo
    )
  );

-- Asesor: solo sus pedidos (por asesor_codigo) — ya existe arriba

-- Programador: todos los pedidos (semáforo/cantidades sin valores)
create policy "pedidos: programador ve todo"
  on public.pedidos for select
  using (
    exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'programador')
  );

-- Insert solo desde server (con service role / secret key en API Route)
create policy "pedidos: insert service role"
  on public.pedidos for insert
  with check (true);

-- ============================================================
-- TRIGGER: sincronizar app_users al crear usuario en auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.app_users (id, email, full_name, role, asesor_codigo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'asesor'),
    (new.raw_user_meta_data->>'asesor_codigo')::integer
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
