import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  Barcode,
  CheckCircle2,
  CloudOff,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  Utensils,
} from "lucide-react";
import { Customer, IndustryType, Product, SaleItem, TransactionRecord } from "../types";
import { formatPKR } from "../utils/formatters";

interface PosBillingViewProps {
  businessName: string;
  branchName: string;
  industry: IndustryType;
  products: Product[];
  customers: Customer[];
  isOffline: boolean;
  onCompleteSale: (payload: {
    items: SaleItem[];
    customerId?: string;
    customerName: string;
    paymentMethod: TransactionRecord["paymentMethod"];
    discount: number;
    taxRate: number;
    total: number;
    notes?: string;
  }) => TransactionRecord;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  businessName,
  branchName,
  industry,
  products,
  customers,
  isOffline,
  onCompleteSale,
}) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Array<SaleItem & { maxStock: number; imeiRequired?: boolean }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walk-in");
  const [paymentMethod, setPaymentMethod] = useState<TransactionRecord["paymentMethod"]>("Cash");
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [orderMode, setOrderMode] = useState<"Dine-In" | "Takeaway" | "Delivery">("Dine-In");
  const [tableNo, setTableNo] = useState("Table 04");
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<TransactionRecord | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === "All" || p.category === category;
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.genericName && p.genericName.toLowerCase().includes(q));
      return catOk && matchQ;
    });
  }, [products, category, search]);

  const addToCart = (product: Product) => {
    setBlockMessage(null);

    // PRD 6.3: Expired medicine blocking rule
    if (product.expiryDate && new Date(product.expiryDate).getTime() < Date.now()) {
      setBlockMessage(
        `Blocked: "${product.name}" (Batch ${product.batchNo || "N/A"}) expired on ${product.expiryDate} and cannot be sold.`
      );
      return;
    }

    if (product.stock <= 0) {
      setBlockMessage(`Out of stock: "${product.name}" has 0 ${product.unit} available.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unit: product.unit,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          maxStock: product.stock,
          imeiRequired: product.imeiRequired,
          imeiOrBatch: product.batchNo || "",
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const next = Math.min(item.maxStock, item.quantity + delta);
          return next <= 0 ? null : { ...item, quantity: next };
        })
        .filter(Boolean) as typeof prev
    );
  };

  const updateImei = (productId: string, val: string) => {
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, imeiOrBatch: val } : item))
    );
  };

  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const taxAmount = Math.round(((subtotal - discount) * taxRate) / 100);
  const grandTotal = Math.max(0, subtotal - discount + taxAmount);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const creditLimitWarning =
    paymentMethod === "Udhaar" &&
    selectedCustomer &&
    selectedCustomer.khataBalance + grandTotal > selectedCustomer.creditLimit;

  const isDigitalOfflineBlocked =
    isOffline && (paymentMethod === "Raast QR" || paymentMethod === "JazzCash" || paymentMethod === "Easypaisa");

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "Udhaar" && !selectedCustomer) {
      setBlockMessage("Please select a Khata customer for Udhaar (Credit) sales.");
      return;
    }

    const imeiMissing = cart.find((c) => c.imeiRequired && !c.imeiOrBatch?.trim());
    if (imeiMissing) {
      setBlockMessage(`Please enter IMEI / Serial number for ${imeiMissing.productName}.`);
      return;
    }

    const receipt = onCompleteSale({
      items: cart.map(({ maxStock: _m, imeiRequired: _ir, ...rest }) => rest),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name || "Walk-in Customer",
      paymentMethod,
      discount,
      taxRate,
      total: grandTotal,
      notes: industry === "restaurant" ? `${orderMode}${orderMode === "Dine-In" ? ` · ${tableNo}` : ""}` : undefined,
    });

    setLastReceipt(receipt);
    setCart([]);
    setDiscount(0);
    setBlockMessage(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Product Catalog & Barcode Search */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900">Smart POS Billing</h1>
              <p className="text-xs text-slate-500">
                {businessName} · {branchName}
                {isOffline ? " · Offline Queue Active" : ""}
              </p>
            </div>

            {industry === "restaurant" && (
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {(["Dine-In", "Takeaway", "Delivery"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setOrderMode(m)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      orderMode === m ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Scan barcode or search product / SKU / generic name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
              <Barcode className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            {industry === "restaurant" && orderMode === "Dine-In" && (
              <select
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
              >
                <option>Table 01</option>
                <option>Table 02</option>
                <option>Table 04</option>
                <option>Family Hall A</option>
              </select>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  category === cat
                    ? "bg-[#063B2B] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {blockMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{blockMessage}</span>
          </div>
        )}

        {/* Product Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProducts.map((p) => {
            const isExpired = p.expiryDate && new Date(p.expiryDate).getTime() < Date.now();
            const isLow = p.stock <= p.minStock;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  isExpired
                    ? "border-rose-200 bg-rose-50/50 opacity-80"
                    : "border-slate-200/80 bg-white hover:border-emerald-500 hover:shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{p.sku}</span>
                    <span className={isLow ? "font-semibold text-rose-600" : "text-slate-500"}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] font-bold text-slate-900 leading-snug">{p.name}</p>
                  {p.genericName && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.genericName}</p>
                  )}
                  {(p.size || p.color) && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[p.size && `Size ${p.size}`, p.color].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {p.expiryDate && (
                    <p className={`text-[11px] mt-1 font-medium ${isExpired ? "text-rose-700" : "text-amber-700"}`}>
                      {isExpired ? `Expired: ${p.expiryDate}` : `Exp: ${p.expiryDate}`}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[14px] font-bold text-emerald-700 tabular-nums">
                    {formatPKR(p.sellingPrice)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">/{p.unit}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Current Cart & Payment Settlement */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4.5 w-4.5 text-emerald-700" />
              <h2 className="font-display text-[15.5px] font-bold text-slate-900">Current Bill</h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-medium text-rose-600 hover:underline cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="mt-3">
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
              Customer (Walk-in or Digital Khata)
            </label>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="walk-in">Walk-in Customer (Cash Sale)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — Bal: {formatPKR(c.khataBalance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cart Items */}
          <div className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Tap products on the left to add items to bill
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{item.productName}</p>
                      <p className="text-[11.5px] text-slate-500 tabular-nums">
                        {formatPKR(item.unitPrice)} × {item.quantity} {item.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, -1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 text-xs font-bold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, 1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="w-20 text-right text-[13px] font-bold text-slate-900 tabular-nums">
                        {formatPKR(item.unitPrice * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, -item.quantity)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.imeiRequired && (
                    <input
                      type="text"
                      value={item.imeiOrBatch || ""}
                      onChange={(e) => updateImei(item.productId, e.target.value)}
                      placeholder="Enter 15-digit IMEI / Serial Number..."
                      className="w-full rounded-lg border border-amber-300 bg-amber-50/50 px-2.5 py-1 text-xs font-mono text-slate-900"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Discount & Tax */}
          <div className="mt-3 grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Discount (Rs.)</label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">GST / Tax (%)</label>
              <input
                type="number"
                min={0}
                max={25}
                value={taxRate}
                onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold tabular-nums"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="mt-3">
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Cash", "Udhaar", "Raast QR", "JazzCash", "Easypaisa", "Split"] as const).map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMethod(pm)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    paymentMethod === pm
                      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>

          {creditLimitWarning && (
            <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
              Credit limit alert: This sale pushes {selectedCustomer?.name} past their{" "}
              {formatPKR(selectedCustomer?.creditLimit || 0)} limit.
            </div>
          )}

          {isDigitalOfflineBlocked && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
              <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Offline Limitation: {paymentMethod} settlement cannot be verified without internet. Bill will remain{" "}
                <strong>Pending Provider</strong> until online confirmation (PRD 9.4).
              </span>
            </div>
          )}

          {/* Summary Totals & Checkout CTA */}
          <div className="mt-4 rounded-xl bg-slate-50 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums">{formatPKR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-semibold tabular-nums">- {formatPKR(discount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxRate}%)</span>
                <span className="font-semibold tabular-nums">{formatPKR(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="tabular-nums">{formatPKR(grandTotal)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleCheckout}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F7C58] px-4 py-3 text-sm font-bold text-white hover:bg-[#0B6648] disabled:opacity-45 transition-colors cursor-pointer"
          >
            {industry === "restaurant" ? <Utensils className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>
              {isOffline
                ? `Save Offline Sale (${formatPKR(grandTotal)})`
                : industry === "restaurant"
                ? `Generate KOT & Bill (${formatPKR(grandTotal)})`
                : `Complete Sale & Print Receipt (${formatPKR(grandTotal)})`}
            </span>
          </button>
        </div>

        {/* Printable Thermal Receipt Preview */}
        {lastReceipt && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800">
                Receipt Ready · {lastReceipt.id} ({lastReceipt.status})
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
            </div>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 font-mono text-[11px] text-slate-800 space-y-1">
              <p className="font-bold text-center">{businessName}</p>
              <p className="text-center text-slate-500">{branchName}</p>
              <p className="border-t border-dashed border-slate-300 pt-1">
                Inv: {lastReceipt.id} | {lastReceipt.paymentMethod}
              </p>
              <p>Customer: {lastReceipt.customerName}</p>
              <div className="border-y border-dashed border-slate-300 py-1 space-y-0.5">
                {lastReceipt.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {it.productName} ×{it.quantity}
                    </span>
                    <span>{formatPKR(it.unitPrice * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-xs pt-0.5">
                <span>TOTAL</span>
                <span>{formatPKR(lastReceipt.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
