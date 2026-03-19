-- Migration: 00156_phase1_drop_old_site_assets
-- Phase 1 of Asset Tracking Refactor: DROP old site_assets system.
-- DESTRUCTIVE: All site_assets and work_order_assets data will be lost.
-- Run backup before applying if you need to preserve existing data.

-- 1. Drop view first (depends on site_assets)
DROP VIEW IF EXISTS site_assets_detail CASCADE;

-- 2. Drop junction table (references site_assets)
DROP TABLE IF EXISTS work_order_assets CASCADE;

-- 3. Drop site_assets (triggers and RLS drop with table)
DROP TABLE IF EXISTS site_assets CASCADE;
