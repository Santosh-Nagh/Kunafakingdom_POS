import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// You can change this mapping as needed for your branches!
const BRANCH_PREFIXES: Record<string, string> = {
  // "branch_id": "PREFIX"
  // Example (replace with your actual branch ids from DB):
  "Kompally-id-goes-here": "KK-KOM",
  "Banjara-id-goes-here": "KK-BAN",
  "Madhapur-id-goes-here": "KK-MAD"
};
// Or, fallback if not set:
const DEFAULT_PREFIX = "KK-UNK";

// Helper to remove undefined/null fields
const clean = (obj: any) =>
  Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json(
        { error: "No products array in request, or it's empty." },
        { status: 400 }
      );
    }

    // --- Step 1: Get current branch id and prefix ---
    const branchId = body.branch_id;
    let prefix = DEFAULT_PREFIX;
    // Try to fetch branch name for prefix if not mapped:
    if (branchId) {
      if (BRANCH_PREFIXES[branchId]) {
        prefix = BRANCH_PREFIXES[branchId];
      } else {
        const branch = await prisma.branches.findUnique({ where: { id: branchId } });
        if (branch?.name) {
          prefix = "KK-" + branch.name.slice(0, 3).toUpperCase();
        }
      }
    }

    // --- Step 2: Find last invoice_number for this branch ---
    let invoiceNumber = 1;
    if (branchId) {
      const lastOrder = await prisma.orders.findFirst({
        where: { branch_id: branchId, invoice_prefix: prefix },
        orderBy: { invoice_number: "desc" },
        select: { invoice_number: true }
      });
      if (lastOrder?.invoice_number && !isNaN(lastOrder.invoice_number)) {
        invoiceNumber = lastOrder.invoice_number + 1;
      }
    }

    // --- Step 3: Construct orderData as before, with new fields ---
    const orderData: any = {
      branches: { connect: { id: branchId } },
      source: "in_store",
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      aggregator_id: body.aggregatorOrderId,
      status: "completed",
      order_items: {
        create: body.products.map((p: any) =>
          clean({
            product_id: p.id,
            quantity: p.qty ?? p.quantity ?? 1,
            unit_price: p.unit_price ?? p.price ?? 0,
            discount_amt: p.discount_amt ?? 0,
          })
        ),
      },
      payments: {
        create: [
          clean({
            method: body.paymentMethod,
            amount: body.total,
            status: "paid",
            paid_at: new Date(),
            change_given: body.changeGiven,
            cash_given: body.cashGiven,
          }),
        ],
      },
      order_charges: body.charges
        ? {
            create: Object.entries(body.charges).map(([type, amount]: [string, any]) =>
              clean({
                type,
                amount: Number(amount) || 0,
              })
            ),
          }
        : undefined,
      order_taxes: body.gst
        ? {
            create: [
              clean({
                type: "GST",
                percent: 18,
                amount: Number(body.gst) || 0,
              }),
            ],
          }
        : undefined,
      order_coupons:
        body.discountValue || body.discountCode
          ? {
              create: [
                clean({
                  code: body.discountCode,
                  value: Number(body.discountValue) || 0,
                }),
              ],
            }
          : undefined,
      order_notes: body.orderNotes,
      created_at: new Date(),
      // --- Add these ---
      invoice_number: invoiceNumber,
      invoice_prefix: prefix
    };

    // Remove any undefined/null fields:
    Object.keys(orderData).forEach(
      (key) => (orderData[key] === undefined || orderData[key] === null) && delete orderData[key]
    );

    const newOrder = await prisma.orders.create({
      data: orderData,
      include: {
        order_items: true,
        payments: true,
        order_charges: true,
        order_taxes: true,
        order_coupons: true,
      },
    });

    return NextResponse.json({ ok: true, order: newOrder });
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json(
      { error: "Server error while creating order." },
      { status: 500 }
    );
  }
}
