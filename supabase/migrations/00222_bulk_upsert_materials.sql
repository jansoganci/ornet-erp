-- Admin-only bulk upsert for materials import (partial unique index on code blocks ON CONFLICT).

CREATE OR REPLACE FUNCTION public.bulk_upsert_materials(p_rows JSONB)
RETURNS SETOF materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSONB;
  existing_id UUID;
  result materials%ROWTYPE;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_rows IS NULL THEN
    RAISE EXCEPTION 'bulk_upsert_materials: p_rows cannot be NULL';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'bulk_upsert_materials: p_rows must be a JSON array';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    SELECT id INTO existing_id FROM materials
    WHERE code = r->>'code' AND deleted_at IS NULL;

    IF existing_id IS NOT NULL THEN
      UPDATE materials
      SET
        name = COALESCE(r->>'name', name),
        description = COALESCE(r->>'description', description),
        unit = COALESCE(r->>'unit', unit),
        unit_price = COALESCE((r->>'unit_price')::DECIMAL, unit_price),
        cost_price = COALESCE((r->>'cost_price')::DECIMAL, cost_price),
        currency = COALESCE(r->>'currency', currency),
        is_active = COALESCE((r->>'is_active')::BOOLEAN, is_active)
      WHERE id = existing_id
      RETURNING * INTO result;
      RETURN NEXT result;
    ELSE
      INSERT INTO materials (code, name, description, unit, unit_price, cost_price, currency, is_active)
      VALUES (
        r->>'code',
        r->>'name',
        r->>'description',
        COALESCE(r->>'unit', 'adet'),
        COALESCE((r->>'unit_price')::DECIMAL, 0),
        (r->>'cost_price')::DECIMAL,
        COALESCE(r->>'currency', 'TRY'),
        COALESCE((r->>'is_active')::BOOLEAN, true)
      )
      RETURNING * INTO result;
      RETURN NEXT result;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_materials(JSONB) TO authenticated;
