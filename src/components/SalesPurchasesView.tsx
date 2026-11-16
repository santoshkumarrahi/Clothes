import React, { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RotateCcw,
  ShoppingCart,
  X,
} from "lucide-react";
import { Product, Supplier, TransactionRecord } from "../types";
import { exportToCsv, formatPKR } from "../utils/formatters";

interface SalesPurchasesViewProps {
  initialTab: "sales" | "purchases";
  transactions: TransactionRecord[];
  products: Product[];
  suppliers: Supplier[];
  onReverseSale: (saleId: string) => void;
  onCreatePurchase: (payload: {
    productId: string;
    supplierId: string;
    quantity: number;
    unitCost: number;
    paymentMethod: "Cash" | "Udhaar" | "Bank";
  }) => void;
}

export const SalesPurchasesView: React.FC<SalesPurchasesViewProps> = ({
  initialTab,
  transactions,
  products,
  suppliers,
  onReverseSale,
  onCreatePurchase,
}) => {
  const [tab, setTab] = useState<"sales" | "purchases">(initialTab);
  const [filterType, setFilterType] = useState<"All" | "Sale" | "Return" | "Purchase">("All");
  const [showPoModal, setShowPoModal] = useState(false);

  const [poForm, setPoForm] = useState({
    productId: products[0]?.id || "",
    supplierId: suppliers[0]?.id || "",
    quantity: 20,
    unitCost: products[0]?.costPrice || 130,
    paymentMethod: "Bank" as "Cash" | "Udhaar" | "Bank",
  });

  const rows = transactions.filter((tx) => {
    if (tab === "sales") {
      if (filterType === "All") return tx.type === "Sale" || tx.type === "Return";
      return tx.type === filterType;
    }
    return tx.type === "Purchase";
  });

  const handlePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.productId || poForm.quantity <= 0) return;
    onCreatePurchase(poForm);
    setShowPoModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("sales")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === "sales" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Sales & Returns
            </button>
            <button
              type="button"
              onClick={() => setTab("purchases")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === "purchases" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Purchases & POs
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                `karobar-${tab}.csv`,
                ["ID", "Type", "Title", "Party", "Method", "Amount", "Status", "Time"],
                rows.map((r) => [
                  r.id,
                  r.type,
                  r.title,
                  r.customerName || "Supplier",
                  r.paymentMethod,
                  r.amount,
                  r.status,
                  r.subtitle,
                ])
              )
            }
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowPoModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Purchase Order
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        {tab === "sales" && (
          <div className="flex items-center gap-2 mb-3">
            {(["All", "Sale", "Return"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                  filterType === f ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Party / Notes</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {tx.type === "Sale" ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                      ) : tx.type === "Return" ? (
                        <RotateCcw className="h-4 w-4 text-rose-600" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4 text-violet-600" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{tx.title}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{tx.subtitle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    {tx.customerName || tx.notes || "Walk-in / Standard"}
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-slate-700">{tx.paymentMethod}</td>
                  <td className="py-3 px-3 text-xs">
                    <span
                      className={`font-semibold ${
                        tx.status === "Reversed"
                          ? "text-rose-600"
                          : tx.status === "Pending Sync"
                          ? "text-amber-600"
                          : "text-emerald-700"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums text-slate-900">
                    {tx.type === "Return" ? `- ${formatPKR(tx.amount)}` : formatPKR(tx.amount)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {tx.type === "Sale" && tx.status !== "Reversed" ? (
                      <button
                        type="button"
                        onClick={() => onReverseSale(tx.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Refund / Return
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Append-Only Logged</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                    <ShoppingCart className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                    No records found in this ledger view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Order Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handlePoSubmit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-base font-bold text-slate-900">Receive Purchase Order</h3>
              <button type="button" onClick={() => setShowPoModal(false)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product to Restock</label>
                <select
                  value={poForm.productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setPoForm({
                      ...poForm,
                      productId: e.target.value,
                      unitCost: p?.costPrice || poForm.unitCost,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                <select
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={poForm.quantity}
                    onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Cost (Rs.)</label>
                  <input
                    type="number"
                    min={1}
                    value={poForm.unitCost}
                    onChange={(e) => setPoForm({ ...poForm, unitCost: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Settlement</label>
                <select
                  value={poForm.paymentMethod}
                  onChange={(e) => setPoForm({ ...poForm, paymentMethod: e.target.value as "Cash" | "Udhaar" | "Bank" })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="Bank">Bank Transfer</option>
                  <option value="Cash">Cash Paid</option>
                  <option value="Udhaar">Supplier Credit (Payable)</option>
                </select>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex justify-between font-bold text-slate-900">
                <span>Total Purchase Invoice</span>
                <span className="tabular-nums">{formatPKR(poForm.quantity * poForm.unitCost)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Receive Goods & Update Stock
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
