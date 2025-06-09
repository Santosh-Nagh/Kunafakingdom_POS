import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const orderData: any = {
      branches: { connect: { id: body.branch_id } },
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
      order_notes: body.orderNotes, // <-- MATCH YOUR PRISMA COLUMN
      created_at: new Date(),
    };

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
