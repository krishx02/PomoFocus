-- Migration: Create profile row automatically on user signup
-- Issue: #276
-- Reference: ADR-002, ADR-005
--
-- When a user signs up via Supabase Auth, a trigger creates
-- a corresponding profiles row. The display_name is read from
-- user_metadata (set during signUp). A username is generated
-- from the email prefix with a random suffix to ensure uniqueness.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _display_name text;
  _username     text;
  _base         text;
  _suffix       text;
BEGIN
  -- Extract display_name from user_metadata, fall back to email prefix
  _display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a username from the email prefix + random suffix
  _base := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  _suffix := lpad(floor(random() * 10000)::text, 4, '0');
  _username := _base || _suffix;

  INSERT INTO public.profiles (auth_user_id, display_name, username)
  VALUES (NEW.id, _display_name, _username);

  RETURN NEW;
END;
$$;

-- Trigger fires after a new row is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
