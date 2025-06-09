import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log for debugging
    console.log("Order API Body:", JSON.stringify(body, null, 2));
    console.log("products:", body.products);

    // Check if products is correct
    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json(
        { error: "No products array in request, or it's empty." },
        { status: 400 }
      );
    }

    // Test: print first product
    console.log("First product:", body.products[0]);

    // Calculate subtotal
    const subtotal = body.products.reduce(
      (sum: number, p: any) =>
        sum +
        (Number(p.price) || Number(p.unit_price) || 0) *
          (Number(p.qty || p.quantity) || 1),
      0
    );

    return NextResponse.json({
      ok: true,
      message: "Order received",
      subtotal,
      products: body.products,
      body,
    });
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json(
      { error: "Server error while creating order.", details: String(error) },
      { status: 500 }
    );
  }
}
