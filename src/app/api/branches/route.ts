import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient();

  // Select all necessary fields for branch info
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, gstin, contact, timezone');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
