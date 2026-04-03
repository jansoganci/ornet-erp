/**
 * Financial Integrity Auditor Script
 * 
 * This script connects to Supabase using the Service Key to audit the 
 * financial consistency between operations (Work Orders/Proposals) 
 * and the ledger (Financial Transactions).
 * 
 * Usage:
 *   export SUPABASE_URL=your_url
 *   export SUPABASE_SERVICE_ROLE_KEY=your_service_key
 *   node audit-finance.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local if available
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.log('Please set them in your environment or .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runAudit() {
  console.log('🔍 Starting Financial Integrity Audit...');
  console.log(`📡 Connecting to: ${supabaseUrl}`);

  try {
    const { data, error } = await supabase
      .from('view_finance_health_check')
      .select('*');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('\n✅ PASS: No financial integrity issues found.');
      process.exit(0);
    }

    console.log(`\n❌ FAIL: Found ${data.length} problematic records.\n`);
    
    // Group by source type for better reporting
    const workOrders = data.filter(d => d.source_type === 'work_order');
    const proposals = data.filter(d => d.source_type === 'proposal');

    if (workOrders.length > 0) {
      console.log('--- WORK ORDERS ---');
      console.table(workOrders.map(wo => ({
        ID: wo.source_id.substring(0, 8) + '...',
        Ref: wo.reference_no,
        Date: wo.event_date,
        Income: wo.income_status,
        Expense: wo.expense_status
      })));
    }

    if (proposals.length > 0) {
      console.log('\n--- PROPOSALS ---');
      console.table(proposals.map(p => ({
        ID: p.source_id.substring(0, 8) + '...',
        Ref: p.reference_no,
        Date: p.event_date,
        Income: p.income_status,
        Expense: p.expense_status
      })));
    }

    console.log('\nSuggested Action: Check the triggers in 00186_fix_wo_and_proposal_finance_triggers.sql or manually fix these records.');
    process.exit(1);

  } catch (err) {
    console.error('❌ Audit failed with error:', err.message);
    process.exit(1);
  }
}

runAudit();
