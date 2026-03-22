-- Migration: Create get_user_id() helper function
-- Issue: #282
-- Depends on: #36 (profiles table must exist)
-- Reference: ADR-005, ADR-002, ADR-012

-- Maps auth.uid() to profiles.id for use in RLS policies.
-- All RLS policies use get_user_id() instead of inlining the auth lookup,
-- providing a single point of change if the auth-to-profile mapping evolves.

CREATE OR REPLACE FUNCTION get_user_id() RETURNS uuid AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
