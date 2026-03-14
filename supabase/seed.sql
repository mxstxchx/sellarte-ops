-- ============================================================
-- SEED: usuarios demo
-- Ejecutar en Supabase SQL Editor DESPUÉS del schema.sql
-- Contraseña para todos: Sellarte2024!
-- ============================================================

-- El trigger on_auth_user_created poblará app_users automáticamente.

DO $$
DECLARE
  uid uuid;
BEGIN

  -- GERENTE
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'gerente@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Gerente Demo","role":"gerente"}',
    NOW(), NOW(), '', '', '', '');

  -- CARGADOR
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'cargador@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cargador Demo","role":"cargador"}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 2 — VASQUEZ GARCIA JOSE ANTONIO
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'vasquez.jose@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jose Vasquez Garcia","role":"asesor","asesor_codigo":2}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 3 — CHAUTA LOPEZ CARLOS ALBERTO
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'chauta.carlos@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carlos Chauta Lopez","role":"asesor","asesor_codigo":3}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 5 — CANO GARZON MARIA NELLY
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'cano.nelly@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Maria Nelly Cano Garzon","role":"asesor","asesor_codigo":5}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 6 — CARDENAS ALDANA DIANA CAROLINA
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'cardenas.diana@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Diana Carolina Cardenas Aldana","role":"asesor","asesor_codigo":6}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 10 — YAYA MELO JAIME
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'yaya.jaime@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jaime Yaya Melo","role":"asesor","asesor_codigo":10}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 11 — FRANCO CAROLINA
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'franco.carolina@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carolina Franco","role":"asesor","asesor_codigo":11}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 17 — PARRA FUENTES LUIS FERNANDO
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'parra.fernando@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Luis Fernando Parra Fuentes","role":"asesor","asesor_codigo":17}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 18 — VASQUEZ FINO ANA MARIA
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'vasquez.ana@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ana Maria Vasquez Fino","role":"asesor","asesor_codigo":18}',
    NOW(), NOW(), '', '', '', '');

  -- ASESOR 19 — ROLDAN MARICELA
  uid := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'roldan.maricela@sellarte.com', crypt('Sellarte2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Maricela Roldan","role":"asesor","asesor_codigo":19}',
    NOW(), NOW(), '', '', '', '');

END $$;

-- ============================================================
-- VERIFICAR resultado
-- ============================================================
-- SELECT u.email, a.full_name, a.role, a.asesor_codigo
-- FROM auth.users u JOIN public.app_users a ON a.id = u.id
-- ORDER BY a.role, a.asesor_codigo;
