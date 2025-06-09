// src/app/orders/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Branch = { id: string; name: string };
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

  // --- Load branches, categories, products
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/branches").then(res => res.json()),
      fetch("/api/categories").then(res => res.json()),
      fetch("/api/products").then(res => res.json())
    ]).then(([branchesRaw, categoriesRaw, productsRaw]) => {
      // --- Fix: Always handle array/object for all API responses ---
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
        setTimeout(() => setOrderSuccess(false), 2000);
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
              {orderSuccess && <div className="text-green-700 mt-2 font-semibold">Order placed! Ready for next customer.</div>}
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
      </main>
    </div>
  );
}
