import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "kunafasecret123";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;

  if (request.nextUrl.pathname === "/login" && session) {
    try {
      const user: any = jwt.verify(session, JWT_SECRET);

      // Redirect to dashboard based on role
      if (user.role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (user.role === "helper") {
        return NextResponse.redirect(new URL("/orders", request.url));
      }
    } catch (e) {
      // Invalid session, do nothing
    }
  }
  // For all other cases, continue as normal
  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
