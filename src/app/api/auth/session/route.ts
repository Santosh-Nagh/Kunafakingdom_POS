import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "kunafasecret123";

export async function GET() {
  const cookie = cookies().get("session");
  if (!cookie) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  try {
    const decoded: any = jwt.verify(cookie.value, JWT_SECRET);
    return NextResponse.json({
      userId: decoded.userId,
      name: decoded.name,
      role: decoded.role,
      email: decoded.email,
    });
  } catch (e) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
