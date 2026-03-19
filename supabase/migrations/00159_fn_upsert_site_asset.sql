-- Migration: 00159_fn_upsert_site_asset
-- RPC for manual upsert of site_assets (used by bulk add, Excel import).

CREATE OR REPLACE FUNCTION fn_upsert_site_asset(
  p_site_id UUID,
  p_equipment_name TEXT,
  p_quantity INT DEFAULT 1,
  p_installation_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO site_assets (site_id, equipment_name, quantity, installation_date)
  VALUES (p_site_id, TRIM(p_equipment_name), GREATEST(1, p_quantity), p_installation_date)
  ON CONFLICT (site_id, equipment_name) DO UPDATE SET
    quantity = site_assets.quantity + EXCLUDED.quantity,
    installation_date = LEAST(COALESCE(site_assets.installation_date, EXCLUDED.installation_date), EXCLUDED.installation_date)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_site_assets_batch(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO site_assets (site_id, equipment_name, quantity, installation_date)
    VALUES (
      (v_item->>'site_id')::UUID,
      TRIM(v_item->>'equipment_name'),
      GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1)),
      CASE WHEN v_item->>'installation_date' <> '' AND v_item->>'installation_date' IS NOT NULL
      THEN (v_item->>'installation_date')::DATE ELSE NULL END
    )
    ON CONFLICT (site_id, equipment_name) DO UPDATE SET
      quantity = site_assets.quantity + EXCLUDED.quantity,
      installation_date = LEAST(COALESCE(site_assets.installation_date, EXCLUDED.installation_date), EXCLUDED.installation_date);
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_upsert_site_asset(UUID, TEXT, INT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_upsert_site_assets_batch(JSONB) TO authenticated;

COMMENT ON FUNCTION fn_upsert_site_asset(UUID, TEXT, INT, DATE) IS
  'Upsert site_asset: add or increment quantity. Used by bulk add and Excel import.';
COMMENT ON FUNCTION fn_upsert_site_assets_batch(JSONB) IS
  'Batch upsert site_assets from JSON array. Each item: {site_id, equipment_name, quantity?, installation_date?}.';
