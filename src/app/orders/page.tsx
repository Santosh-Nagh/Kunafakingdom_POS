// src/app/orders/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Branch = {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  gstin?: string;
  timezone?: string;
};
type Category = { id: string; name: string };
type Product = { id: string; name: string; unit_price: number; category_id: string; is_active: boolean };
type PaymentMethod = "Cash" | "Card" | "Upi" | "Swiggy" | "Zomato";

interface SelectedProduct extends Product {
  quantity: number;
}

const paymentMethods: PaymentMethod[] = ["Cash", "Card", "Upi", "Swiggy", "Zomato"];

export default function OrdersPage() {
  // Data loading
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // UI/Order state
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"%" | "₹">("%");
  const [discountCode, setDiscountCode] = useState<string>("");
  const [delivery, setDelivery] = useState<boolean>(false);
  const [packaging, setPackaging] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [aggregatorOrderId, setAggregatorOrderId] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  // UI: Search/filter
  const [search, setSearch] = useState("");

  // Invoice modal state
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Load branches, categories, products
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/branches").then(res => res.json()),
      fetch("/api/categories").then(res => res.json()),
      fetch("/api/products").then(res => res.json())
    ]).then(([branchesRaw, categoriesRaw, productsRaw]) => {
      const branchesArr = Array.isArray(branchesRaw)
        ? branchesRaw
        : (branchesRaw && branchesRaw.branches ? branchesRaw.branches : []);
      const categoriesArr = Array.isArray(categoriesRaw)
        ? categoriesRaw
        : (categoriesRaw && categoriesRaw.categories ? categoriesRaw.categories : []);
      const productsArr = Array.isArray(productsRaw)
        ? productsRaw
        : (productsRaw && productsRaw.products ? productsRaw.products : []);
      setBranches(branchesArr);
      setCategories(categoriesArr);
      setProducts(productsArr.filter((p: Product) => p.is_active));
      setLoading(false);
      // Load last selected branch if present
      const lastBranch = localStorage.getItem("selectedBranch");
      if (lastBranch && branchesArr.some((b: Branch) => b.id === lastBranch)) {
        setSelectedBranch(lastBranch);
      }
    });
  }, []);

  // --- Helper: Filter products by category/search
  const visibleProducts = products.filter(p =>
    (selectedCategory === "all" || p.category_id === selectedCategory) &&
    (p.name.toLowerCase().includes(search.toLowerCase()))
  );

  // --- Add/Remove/Update product
  const addProduct = (product: Product) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };
  const removeProduct = (productId: string) => setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  const setProductQuantity = (productId: string, qty: number) => setSelectedProducts(prev =>
    prev.map(p => p.id === productId ? { ...p, quantity: Math.max(1, qty) } : p)
  );

  // --- Charges/Discount/Total calculation
  const subtotal = selectedProducts.reduce((acc, p) => acc + p.unit_price * p.quantity, 0);
  const charges = (delivery ? 30 : 0) + (packaging ? 20 : 0);
  let discount = 0;
  if (discountType === "%" && discountValue > 0) discount = Math.round(subtotal * discountValue / 100);
  if (discountType === "₹" && discountValue > 0) discount = discountValue;
  if (discount > subtotal) discount = subtotal;
  const gst = Math.round((subtotal - discount) * 0.18);
  const total = Math.max(0, subtotal + charges - discount + gst);

  // --- Change calculation
  let change = 0;
  if (paymentMethod === "Cash" && cashAmount !== "" && cashAmount >= total) change = cashAmount - total;

  // --- Order validation before submit
  function validateOrder() {
    if (!selectedBranch) return "Please select a branch.";
    if (selectedProducts.length === 0) return "Please select at least one product.";
    if (customerPhone && !/^\d{10}$/.test(customerPhone)) return "Phone must be 10 digits.";
    if (paymentMethod === "Cash" && (cashAmount === "" || cashAmount < total)) return "Cash given is less than total.";
    return null;
  }

  // --- Handle print
  function handlePrint() {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
        .header { text-align: center; font-weight: bold; font-size: 24px; margin-bottom: 12px; }
        .subheader { text-align: center; color: #888; font-size: 14px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
        .totals td { font-weight: bold; }
        .invoice-footer { margin-top: 32px; text-align: center; font-size: 13px; color: #666; }
      </style>
    </head><body>${printContents}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  // --- Show Invoice Modal after successful order
  const handleShowInvoice = (data: any) => {
    setInvoiceData(data);
    setInvoiceOpen(true);
  };
  const handleInvoiceClose = () => {
    setInvoiceOpen(false);
    setInvoiceData(null);
    setOrderSuccess(false);
  };

  // --- Submit order to API
  async function handleSubmitOrder() {
    setOrderError(null);
    setOrderSuccess(false);
    const validationMsg = validateOrder();
    if (validationMsg) { setOrderError(validationMsg); return; }
    setSubmitting(true);

    const payload = {
      branch_id: selectedBranch,
      products: Array.isArray(selectedProducts)
        ? selectedProducts.map((p) => ({
            id: p.id,
            qty: p.quantity || 1,
            unit_price: p.unit_price || 0,
            discount_amt: 0,
          }))
        : [],
      charges: {
        delivery: delivery ? 30 : 0,
        packaging: packaging ? 20 : 0,
        other: 0,
      },
      discountValue: discountValue || 0,
      discountCode: discountCode || "",
      gst: gst || 0,
      total: total || 0,
      paymentMethod,
      cashGiven: paymentMethod === "Cash" ? cashAmount : undefined,
      changeGiven: paymentMethod === "Cash" ? change : undefined,
      customerName: customerName || "",
      customerPhone: customerPhone || "",
      aggregatorOrderId: aggregatorOrderId || "",
      orderNotes: orderNotes || "",
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setOrderError(err?.error || "Order failed. Try again.");
      } else {
        const data = await res.json();
        setOrderSuccess(true);
        // Reset order
        setSelectedProducts([]);
        setDiscountValue(0);
        setDiscountType("%");
        setDiscountCode("");
        setDelivery(false);
        setPackaging(false);
        setCustomerName("");
        setCustomerPhone("");
        setAggregatorOrderId("");
        setOrderNotes("");
        setPaymentMethod("Cash");
        setCashAmount("");
        // Show invoice
        handleShowInvoice(data.order);
      }
    } catch (err) {
      setOrderError("Order failed. Try again.");
    }
    setSubmitting(false);
  }

  // --- UI render
  return (
    <div className="w-full min-h-screen bg-[#092923] text-[#fbe16d] font-sans flex flex-col">
      {/* Header */}
      <nav className="w-full flex items-center px-8 py-4 bg-[#092923] border-b-[3px] border-[#fbe16d]">
        <img src="/Logo_Final_Final_Final.png" alt="logo" className="w-10 h-10 rounded-full mr-4" />
        <span className="text-3xl font-bold tracking-tight text-[#fbe16d]">Kunafa Kingdom</span>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center px-2 py-6">
        {loading ? (
          <div className="w-full flex items-center justify-center pt-24"><span>Loading...</span></div>
        ) : (
          <div className="flex flex-col md:flex-row w-full max-w-7xl gap-8">
            {/* Product selection */}
            <Card className="flex-1 bg-[#093427] border-none rounded-2xl shadow-xl p-6 min-h-[600px]">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <Select value={selectedBranch ?? ""} onValueChange={val => {
                  setSelectedBranch(val);
                  localStorage.setItem("selectedBranch", val);
                }}>
                  <SelectTrigger className="w-40 font-bold rounded-lg">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch =>
                      <SelectItem value={branch.id} key={branch.id}>{branch.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="flex-1 min-w-[180px] rounded-lg"
                />
                <Select value={selectedCategory} onValueChange={val => setSelectedCategory(val)}>
                  <SelectTrigger className="w-36 font-bold rounded-lg">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {categories.map(cat =>
                      <SelectItem value={cat.id} key={cat.id}>{cat.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {/* Product grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                {visibleProducts.length === 0 && <div className="text-lg text-[#fbe16d]/70 col-span-3">No products found.</div>}
                {visibleProducts.map(product => {
                  const selected = selectedProducts.find(p => p.id === product.id);
                  return (
                    <div key={product.id}
                      className={`flex flex-col bg-[#fbe16d]/10 border-2 border-[#fbe16d]/60 rounded-xl p-4 cursor-pointer shadow-md transition hover:scale-105`}
                      style={{ minHeight: 100 }}
                      onClick={() => addProduct(product)}
                      tabIndex={0}
                    >
                      <span className="font-bold text-lg text-[#fffde3]">{product.name}</span>
                      <span className="text-[#fbe16d] font-bold text-md mt-1 mb-1">₹{product.unit_price}</span>
                      {selected && (
                        <div className="mt-2">
                          <span className="bg-[#fbe16d] text-[#093427] px-2 py-1 rounded text-xs font-bold shadow">× {selected.quantity} added</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            {/* Order summary */}
            <Card className="w-full md:w-[370px] bg-[#fffde3] text-[#093427] rounded-2xl shadow-xl p-6 flex flex-col">
              <div className="text-xl font-bold text-[#d2b74c] mb-4">Current Order</div>
              {/* Products in order */}
              {selectedProducts.length === 0 ? (
                <div className="text-[#999] text-sm">No products selected.</div>
              ) : (
                selectedProducts.map(item =>
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-[#e3e3c3]">
                    <div className="flex flex-col flex-1">
                      <span className="font-bold">{item.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          className="rounded-full bg-[#fbe16d] text-[#093427] w-8 h-8 font-bold"
                          onClick={() => setProductQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          type="button"
                        >-</Button>
                        <span className="font-mono px-2">{item.quantity}</span>
                        <Button
                          className="rounded-full bg-[#fbe16d] text-[#093427] w-8 h-8 font-bold"
                          onClick={() => setProductQuantity(item.id, item.quantity + 1)}
                          type="button"
                        >+</Button>
                        <span className="ml-2 font-semibold">₹{item.unit_price * item.quantity}</span>
                        <Button
                          className="ml-3 text-red-500"
                          onClick={() => removeProduct(item.id)}
                          type="button"
                        >✗</Button>
                      </div>
                    </div>
                  </div>
                )
              )}
              {/* Charges/Discount */}
              <div className="flex flex-col gap-2 mt-4 mb-1">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={delivery} onChange={e => setDelivery(e.target.checked)} />
                  Delivery (₹30)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={packaging} onChange={e => setPackaging(e.target.checked)} />
                  Packaging (₹20)
                </label>
                <div className="flex gap-2 items-center">
                  <span>Discount</span>
                  <Input type="number" min={0} value={discountValue === 0 ? "" : discountValue}
                    className="w-16"
                    onChange={e => {
                      const val = e.target.value;
                      setDiscountValue(val === "" ? 0 : Math.max(0, Number(val)));
                    }} />
                  <Select value={discountType} onValueChange={val => setDiscountType(val as "%" | "₹")}>
                    <SelectTrigger className="w-16 h-8 rounded bg-white border border-[#d2b74c]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="%">%</SelectItem>
                      <SelectItem value="₹">₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={discountCode}
                    onChange={e => setDiscountCode(e.target.value)}
                    placeholder="Discount code (if any)"
                    className="ml-2 flex-1"
                  />
                </div>
              </div>
              {/* Optional Details */}
              <div className="mt-2 flex flex-col gap-2">
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer Name (optional)"
                  maxLength={50}
                />
                <Input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value.replace(/\D/, ""))}
                  maxLength={10}
                  placeholder="Phone (optional, 10 digits)"
                />
                <Input
                  value={aggregatorOrderId}
                  onChange={e => setAggregatorOrderId(e.target.value)}
                  placeholder="Aggregator Order ID (if Swiggy/Zomato)"
                />
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Comments / Special Instructions"
                  className="rounded border border-[#e3e3c3] px-2 py-1"
                  rows={2}
                />
              </div>
              {/* Payment */}
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  {paymentMethods.map(method =>
                    <Button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-full px-3 py-1 text-sm border
                        ${paymentMethod === method
                          ? "bg-[#fbe16d] text-[#093427] border-[#d2b74c] font-bold"
                          : "bg-[#fffde3] text-[#093427] border-[#d2b74c]/40"
                        }`}
                    >{method}</Button>
                  )}
                </div>
                {paymentMethod === "Cash" && (
                  <div className="flex items-center gap-2 mt-1">
                    <span>Cash Given</span>
                    <Input
                      type="number"
                      min={0}
                      value={cashAmount === "" ? "" : cashAmount}
                      onChange={e => {
                        const val = e.target.value;
                        setCashAmount(val === "" ? "" : Math.max(0, Number(val)));
                      }}
                      placeholder="Enter amount"
                      className="w-24"
                    />
                    <span className="ml-2">Change: <b>{cashAmount !== "" && cashAmount >= total ? cashAmount - total : 0}</b></span>
                  </div>
                )}
              </div>
              {/* Summary */}
              <div className="mt-5 text-right text-sm">
                <div>Subtotal <span className="float-right">₹{subtotal}</span></div>
                <div>Charges <span className="float-right">₹{charges}</span></div>
                <div>Discount <span className="float-right text-green-700">-₹{discount}</span></div>
                <div>GST (18%) <span className="float-right">₹{gst}</span></div>
                <div className="border-t border-[#e3e3c3] my-1"></div>
                <div className="text-lg font-bold text-[#093427]">Total <span className="float-right">₹{total}</span></div>
              </div>
              {/* Errors/Success */}
              {orderError && <div className="text-red-600 mt-2">{orderError}</div>}
              {orderSuccess && <div className="text-green-700 mt-2 font-semibold">Order placed! Showing invoice...</div>}
              {/* Submit */}
              <Button
                onClick={handleSubmitOrder}
                disabled={submitting || selectedProducts.length === 0}
                className="w-full mt-4 rounded-full py-3 text-lg font-bold bg-[#fbe16d] text-[#093427] hover:bg-[#ffe97a] transition"
              >{submitting ? "Processing..." : "Submit Order"}</Button>
              {selectedProducts.length > 0 && (
                <div className="text-center mt-2 underline text-sm cursor-pointer text-[#093427]" onClick={() => {
                  setSelectedProducts([]); setOrderError(null);
                }}>Clear</div>
              )}
            </Card>
          </div>
        )}
        {/* --- Invoice Modal --- */}
        <Dialog open={invoiceOpen} onOpenChange={handleInvoiceClose}>
  <DialogContent className="max-w-xl bg-white text-black p-8 rounded-2xl border-2 border-[#fbe16d] shadow-xl">
    {invoiceData ? (
      <div ref={printRef}>
        {/* Header */}
        <div className="flex flex-col items-center mb-3">
          <div className="text-2xl font-extrabold tracking-wide text-[#d2b74c] uppercase">Tax Invoice</div>
          <div className="text-xl font-bold tracking-wide text-[#093427] mt-1 mb-1">Kunafa Kingdom</div>
          <div className="text-sm text-gray-700 font-medium">
            {branches.find(b => b.id === invoiceData.branch_id)?.name ?? ""}
          </div>
          <div className="text-xs text-gray-500 mb-1">
            {branches.find(b => b.id === invoiceData.branch_id)?.address ?? ""}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            GSTIN: {branches.find(b => b.id === invoiceData.branch_id)?.gstin ?? "36CFVPG8105A1ZJ"}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            Phone: {branches.find(b => b.id === invoiceData.branch_id)?.contact ?? "9999999999"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
          Invoice #: {invoiceData.invoice_prefix ?? "KK-BRN"}-{invoiceData.invoice_number?.toString().padStart(5,"0") ?? ""}
            <span className="mx-1">|</span>
            Date: {invoiceData.created_at
              ? new Date(invoiceData.created_at).toLocaleString("en-IN", { hour12: true })
              : ""}
          </div>
        </div>
        <div className="border-b border-gray-300 my-2" />

        {/* Customer info */}
        <div className="mb-2 text-sm grid grid-cols-2">
          <div>
            <b>Customer:</b> {invoiceData.customer_name || "Walk-in"}<br />
            {invoiceData.customer_phone && <span><b>Phone:</b> {invoiceData.customer_phone}<br /></span>}
          </div>
          <div className="text-right">
            <b>Supply Type:</b> B2C<br />
            <b>Reverse Charge:</b> No<br />
          </div>
        </div>

        {/* Table of items */}
        <table className="w-full border text-xs my-2 border-collapse">
          <thead>
            <tr className="border-b bg-[#fbe16d]/40">
              <th align="left" className="py-1 font-semibold">Item</th>
              {/* Optional: <th align="center" className="font-semibold">HSN</th> */}
              <th align="center" className="font-semibold">Qty</th>
              <th align="center" className="font-semibold">Rate</th>
              <th align="center" className="font-semibold">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.order_items?.map((item: any) => (
              <tr key={item.id} className="border-b last:border-none">
                <td className="py-1">{products.find(p => p.id === item.product_id)?.name ?? item.product_id}</td>
                {/* <td align="center">{products.find(p => p.id === item.product_id)?.hsn ?? "--"}</td> */}
                <td align="center">{item.quantity}</td>
                <td align="center">₹{Number(item.unit_price).toFixed(2)}</td>
                <td align="center">₹{Number(item.unit_price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="mt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{(invoiceData.order_items?.reduce(
              (sum: number, item: any) => sum + Number(item.unit_price) * Number(item.quantity), 0) ?? 0).toFixed(2)}</span>
          </div>
          {invoiceData.order_charges?.filter((c: any) => Number(c.amount) > 0).map((c: any) => (
            <div key={c.id} className="flex justify-between">
              <span>{c.type[0].toUpperCase() + c.type.slice(1)}</span>
              <span>₹{Number(c.amount).toFixed(2)}</span>
            </div>
          ))}
          {invoiceData.order_charges?.every((c: any) => Number(c.amount) === 0) && (
            <div className="flex justify-between"><span>Charges</span><span>₹0.00</span></div>
          )}
          {invoiceData.order_coupons?.some((c: any) => Number(c.value) > 0) && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-₹{invoiceData.order_coupons?.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0).toFixed(2)}</span>
            </div>
          )}
          {/* GST Split: CGST+SGST each 9% */}
          {invoiceData.order_taxes?.length > 0 && (
            <>
              <div className="flex justify-between">
                <span>CGST (9%)</span>
                <span>₹{(Number(invoiceData.order_taxes[0].amount) / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (9%)</span>
                <span>₹{(Number(invoiceData.order_taxes[0].amount) / 2).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="border-t border-gray-400 my-1" />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>₹{Number(invoiceData.payments?.[0]?.amount ?? 0).toFixed(2)}</span>
          </div>
          <div className="mt-2 text-xs text-gray-600 text-right italic">
            Rupees in words: <b>{numberToWords(Number(invoiceData.payments?.[0]?.amount ?? 0)).replace(/\b(\w)/g, s => s.toUpperCase())} Only</b>
          </div>
        </div>

        {/* Payment info */}
        <div className="text-sm mt-2 mb-1">
          <b>Payment:</b> {invoiceData.payments?.[0]?.method || ""}
          {invoiceData.payments?.[0]?.method === "Cash" && invoiceData.payments?.[0]?.cash_given && (
            <>
              <span> | <b>Cash Given:</b> ₹{invoiceData.payments?.[0]?.cash_given} | <b>Change:</b> ₹{invoiceData.payments?.[0]?.change_given}</span>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-5 flex justify-center gap-4">
          <Button type="button" className="rounded px-8 py-2 bg-[#fbe16d] text-[#093427] text-base font-semibold shadow" onClick={handlePrint}>
            Print
          </Button>
          <Button type="button" className="rounded px-8 py-2 bg-[#d2b74c] text-[#093427] text-base font-semibold shadow" onClick={handleInvoiceClose}>
            Next Customer
          </Button>
        </div>
        <div className="mt-3 text-xs text-center text-gray-600 border-t pt-2">
          <div>Thank you for choosing Kunafa Kingdom!</div>
          <div>GST included as applicable. Subject to Hyderabad jurisdiction. This is a computer-generated invoice.</div>
        </div>
      </div>
    ) : (
      <div className="p-8 text-center text-gray-600">Loading invoice...</div>
    )}
  </DialogContent>
</Dialog>


      </main>
    </div>
  );
}

function numberToWords(num: number) {
  // Supports up to 9999999, quick & simple, can swap to npm 'number-to-words' if you want more
  if (num === 0) return "zero rupees";
  const a = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
  ];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function inWords(num: number): string {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "");
    if (num < 1000) return a[Math.floor(num / 100)] + " hundred" + (num % 100 ? " and " + inWords(num % 100) : "");
    if (num < 100000) return inWords(Math.floor(num / 1000)) + " thousand" + (num % 1000 ? " " + inWords(num % 1000) : "");
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + " lakh" + (num % 100000 ? " " + inWords(num % 100000) : "");
    return "";
  }
  return inWords(num) + " rupees";
}
