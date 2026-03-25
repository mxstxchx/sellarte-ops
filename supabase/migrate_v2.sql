-- ============================================================
-- SELLARTE OPS - MIGRACIÓN v2
-- Ejecutar en Supabase SQL Editor (después del schema.sql original)
-- ============================================================

-- 1. Agregar rol 'programador' al check constraint
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('gerente', 'asesor', 'cargador', 'programador'));

-- 2. Nuevas columnas en pedidos para enriquecimiento de código de producto
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS tipo_ip      text,
  ADD COLUMN IF NOT EXISTS tipo_ip_desc text,
  ADD COLUMN IF NOT EXISTS calibre      text,
  ADD COLUMN IF NOT EXISTS calibre_desc text;

-- 3. RLS: programador ve todos los pedidos
CREATE POLICY "pedidos: programador ve todo"
  ON public.pedidos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.app_users u
            WHERE u.id = auth.uid() AND u.role = 'programador')
  );

-- 4. RLS: programador ve todos los upload_batches (para cargar latest batch)
CREATE POLICY "upload_batches: select programador"
  ON public.upload_batches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.app_users u
            WHERE u.id = auth.uid() AND u.role = 'programador')
  );

-- ============================================================
-- VERIFICAR resultado
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'pedidos' AND column_name IN ('tipo_ip','tipo_ip_desc','calibre','calibre_desc');
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conrelid = 'public.app_users'::regclass;
