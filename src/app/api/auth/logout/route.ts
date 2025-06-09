import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expire immediately
  });
  return NextResponse.json({ ok: true });
}
