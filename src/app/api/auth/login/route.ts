import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kunafasecret123'; // Change for production!

export async function POST(request: Request) {
  const body = await request.json();
  const { pin, name } = body; // Include name in destructuring

  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 });
  }

  const supabase = createClient();

  // Find user(s) with this PIN
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, role, pin_code')
    .eq('pin_code', pin);

  // Log raw DB output for debugging
  console.log("Supabase error:", error);
  console.log("Users returned:", users);

  if (error) {
    return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 500 });
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  let user;
  if (users.length === 1) {
    user = users[0];
  } else {
    // If multiple users have the same PIN, client must send name as well
    if (!name) {
      return NextResponse.json({ error: 'Multiple users found, please provide your name.' }, { status: 400 });
    }
    user = users.find((u: any) => u.name === name);
    if (!user) {
      return NextResponse.json({ error: 'User not found for this PIN' }, { status: 401 });
    }
  }

  // Create JWT session token
  const token = jwt.sign(
    {
      userId: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // Set cookie
  cookies().set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  // Success!
  return NextResponse.json({ ok: true, role: user.role, name: user.name });
}
