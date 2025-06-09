import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient();

  // No auth/user check, just return all products
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category_id, unit_price, unit, made_to_order, is_active');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = createClient();

  // No user_uid field
  const newProduct = await request.json();

  const { data, error } = await supabase
    .from('products')
    .insert([newProduct])
    .select('id, name, category_id, unit_price, unit, made_to_order, is_active')
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data?.[0] || {});
}
