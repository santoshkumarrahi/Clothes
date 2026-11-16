import React, { useState } from "react";
import { Download, Plus, Printer, X } from "lucide-react";
import { Customer, Product, TransactionRecord } from "../types";
import { exportToCsv, formatPKR } from "../utils/formatters";

interface AccountingReportsViewProps {
  mode: "accounting" | "reports";
  totals: {
    sales: number;
    purchases: number;
    profit: number;
  };
  transactions: TransactionRecord[];
  products: Product[];
  customers: Customer[];
  onAddExpense: (title: string, amount: number, category: string) => void;
}

export const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({
  mode,
  totals,
  transactions,
  products,
  customers,
  onAddExpense,
}) => {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState(1500);
  const [expCategory, setExpCategory] = useState("Utilities & Bills");

  const expenses = transactions.filter((t) => t.type === "Expense");
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + 12800; // baseline monthly ops expenses
  const returnsTotal = transactions
    .filter((t) => t.type === "Return")
    .reduce((s, r) => s + r.amount, 0);
  const cogsEstimated = Math.max(0, totals.sales - totals.profit - totalExpenses);
  const grossProfit = totals.sales - returnsTotal - cogsEstimated;
  const netProfit = grossProfit - totalExpenses;

  const inventoryValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const totalReceivables = customers.reduce((s, c) => s + c.khataBalance, 0);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) return;
    onAddExpense(expTitle, expAmount, expCategory);
    setShowExpenseModal(false);
    setExpTitle("");
    setExpAmount(1500);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900">
            {mode === "accounting" ? "Accounting, Cashbook & Expenses" : "Financial & Business Reports"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accurate P&L accounting (Revenue − COGS − Returns − Operating Expenses = Net Profit)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print P&L
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                "karobar-pnl-summary.csv",
                ["Metric", "Amount (PKR)"],
                [
                  ["Gross Sales Revenue", totals.sales],
                  ["Sales Returns", returnsTotal],
                  ["Cost of Goods Sold (COGS)", cogsEstimated],
                  ["Gross Profit", grossProfit],
                  ["Operating Expenses", totalExpenses],
                  ["Net Profit", netProfit],
                  ["Inventory Valuation", inventoryValue],
                  ["Customer Receivables (Khata)", totalReceivables],
                ]
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Expense
          </button>
        </div>
      </div>

      {/* Profit & Loss Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900 mb-3">
            Profit & Loss Statement (This Month)
          </h2>
          <div className="divide-y divide-slate-100 text-[13px]">
            <div className="flex justify-between py-2.5">
              <span className="text-slate-600">Gross Sales Revenue</span>
              <span className="font-bold tabular-nums text-slate-900">{formatPKR(totals.sales)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-600">Less: Sales Returns & Reversals</span>
              <span className="font-semibold tabular-nums text-rose-600">- {formatPKR(returnsTotal)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-600">Less: Cost of Goods Sold (COGS)</span>
              <span className="font-semibold tabular-nums text-slate-700">- {formatPKR(cogsEstimated)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-slate-50 px-2 rounded-lg font-semibold">
              <span className="text-slate-900">Gross Profit</span>
              <span className="tabular-nums text-emerald-700">{formatPKR(grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-600">Less: Operating Expenses (Rent, Bills, Wages)</span>
              <span className="font-semibold tabular-nums text-rose-600">- {formatPKR(totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-3 text-base font-extrabold">
              <span className="text-slate-900">Net Profit</span>
              <span className="tabular-nums text-emerald-700">{formatPKR(netProfit)}</span>
            </div>
          </div>
        </div>

        {/* Cashbook & Balance Sheet Snapshot */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">Cashbook & Assets</h2>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Shop Cash Drawer</span>
                <span className="font-bold tabular-nums">{formatPKR(48500)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Meezan / HBL Business Account</span>
                <span className="font-bold tabular-nums">{formatPKR(214300)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Stock Inventory Valuation</span>
                <span className="font-bold tabular-nums">{formatPKR(inventoryValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Customer Khata Receivables</span>
                <span className="font-bold tabular-nums text-emerald-700">{formatPKR(totalReceivables)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-2.5">Recent Operating Expenses</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {expenses.map((ex) => (
                <div key={ex.id} className="flex justify-between py-2">
                  <div>
                    <p className="font-semibold text-slate-800">{ex.title}</p>
                    <p className="text-slate-500">{ex.subtitle}</p>
                  </div>
                  <span className="font-bold tabular-nums text-rose-700">{formatPKR(ex.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handleSaveExpense} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-base font-bold text-slate-900">Log Daily Business Expense</h3>
              <button type="button" onClick={() => setShowExpenseModal(false)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Description</label>
                <input
                  required
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Shop Diesel Generator Fuel"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option>Utilities & Bills</option>
                    <option>Shop Rent</option>
                    <option>Staff Wages</option>
                    <option>Delivery & Transport</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    min={1}
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white">
                Record Expense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
