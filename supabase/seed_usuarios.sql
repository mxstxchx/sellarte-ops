-- ============================================================
-- SEED: usuarios reales de SELLARTE
-- Ejecutar en Supabase SQL Editor DESPUÉS de migrate_v2.sql
-- ⚠ Esto borra y recrea los usuarios por email — resetea contraseñas.
-- ⚠ Confirmar que los asesor_codigo corresponden a los códigos en SIIGO.
-- ============================================================

DO $$
DECLARE
  uid uuid;
BEGIN

  -- ── GERENTE ───────────────────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'gerencia@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'gerencia@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'gerencia@sellarte.com.co', crypt('Gerent3.SLL', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"nelly - ana maria","role":"gerente"}',
    NOW(), NOW(), '', '', '', '');

  -- ── CARGADOR ──────────────────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'documentos@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'documentos@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'documentos@sellarte.com.co', crypt('Carg4.SLL', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"nathaly - andres","role":"cargador"}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 3 — CHAUTA ─────────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'cchauta@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'cchauta@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'cchauta@sellarte.com.co', crypt('Asesor3', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"chauta","role":"asesor","asesor_codigo":3}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 4 — TATIANA ────────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'tatianadiaz@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'tatianadiaz@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'tatianadiaz@sellarte.com.co', crypt('Asesor4', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"tatiana","role":"asesor","asesor_codigo":4}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 6 — DIANA ──────────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'dianacardenas@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'dianacardenas@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'dianacardenas@sellarte.com.co', crypt('Asesor6', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"diana","role":"asesor","asesor_codigo":6}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 11 — CAROLINA ──────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'carolinafranco@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'carolinafranco@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'carolinafranco@sellarte.com.co', crypt('Asesor11', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"carolina","role":"asesor","asesor_codigo":11}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 17 — FERNANDO ──────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'lparra@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'lparra@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'lparra@sellarte.com.co', crypt('Asesor17', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"fernado","role":"asesor","asesor_codigo":17}',
    NOW(), NOW(), '', '', '', '');

  -- ── ASESOR 19 — MARICELA ──────────────────────────────────
  DELETE FROM public.app_users WHERE email = 'maricelaroldan@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'maricelaroldan@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'maricelaroldan@sellarte.com.co', crypt('Asesor19', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"maricela","role":"asesor","asesor_codigo":19}',
    NOW(), NOW(), '', '', '', '');

  -- ── PROGRAMADOR — PRODUCCIÓN (julie - julieth) ────────────
  -- Nota: email original tiene tilde (producción), se usa produccion para evitar encoding issues
  DELETE FROM public.app_users WHERE email = 'produccion@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'produccion@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'produccion@sellarte.com.co', crypt('Program4.P', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"julie - julieth","role":"programador"}',
    NOW(), NOW(), '', '', '', '');

  -- ── PROGRAMADOR — COMPRAS (diana - nelly) ─────────────────
  DELETE FROM public.app_users WHERE email = 'compras@sellarte.com.co';
  DELETE FROM auth.users       WHERE email = 'compras@sellarte.com.co';
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'compras@sellarte.com.co', crypt('Program4.C', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"diana - nelly","role":"programador"}',
    NOW(), NOW(), '', '', '', '');

END $$;

-- ============================================================
-- VERIFICAR resultado
-- ============================================================
-- SELECT u.email, a.full_name, a.role, a.asesor_codigo
-- FROM auth.users u JOIN public.app_users a ON a.id = u.id
-- ORDER BY a.role, a.asesor_codigo;
