import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/charges?branch_id=BRANCH_UUID
export async function GET(req: NextRequest) {
  const branch_id = req.nextUrl.searchParams.get("branch_id");
  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }
  const charges = await prisma.branch_charges.findMany({
    where: { branch_id, is_active: true },
    select: { type: true, amount: true },
  });
  return NextResponse.json({ charges });
}
