import React, { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  MessageSquare,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { Customer, Supplier } from "../types";
import { formatPKR } from "../utils/formatters";

interface KhataViewProps {
  mode: "khata" | "customers" | "suppliers";
  customers: Customer[];
  suppliers: Supplier[];
  onRecordCustomerPayment: (customerId: string, amount: number, method: "Cash" | "Raast QR" | "JazzCash" | "Easypaisa" | "Bank") => void;
  onAddCustomer: (customer: Omit<Customer, "id">) => void;
  onPaySupplier: (supplierId: string, amount: number) => void;
}

export const KhataView: React.FC<KhataViewProps> = ({
  mode,
  customers,
  suppliers,
  onRecordCustomerPayment,
  onAddCustomer,
  onPaySupplier,
}) => {
  const [tab, setTab] = useState<"customers" | "suppliers">(mode === "suppliers" ? "suppliers" : "customers");
  const [search, setSearch] = useState("");
  const [payTarget, setPayTarget] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<"Cash" | "Raast QR" | "JazzCash" | "Easypaisa" | "Bank">("Cash");
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);
  const [reminderSentToast, setReminderSentToast] = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCust, setNewCust] = useState({
    name: "",
    phone: "+92 300 ",
    city: "Lahore",
    category: "Retail" as Customer["category"],
    creditLimit: 15000,
    khataBalance: 0,
  });

  const totalReceivable = customers.reduce((s, c) => s + c.khataBalance, 0);
  const totalPayable = suppliers.reduce((s, sup) => s + sup.payableBalance, 0);
  const overdueCount = customers.filter((c) => c.overdueDays > 7 && c.khataBalance > 0).length;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.city.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    onAddCustomer({
      ...newCust,
      overdueDays: 0,
      loyaltyPoints: 0,
      lastPurchaseDate: new Date().toISOString().slice(0, 10),
      whatsappConsent: true,
    });
    setShowAddCustomer(false);
    setNewCust({ name: "", phone: "+92 300 ", city: "Lahore", category: "Retail", creditLimit: 15000, khataBalance: 0 });
  };

  return (
    <div className="space-y-4">
      {/* Top Khata Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Customer Receivables (Lena Hai)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">{formatPKR(totalReceivable)}</p>
          <p className="mt-1 text-[11.5px] text-slate-500">{overdueCount} accounts overdue &gt; 7 days</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Supplier Payables (Dena Hai)</p>
          <p className="mt-1 text-2xl font-bold text-rose-600 tabular-nums">{formatPKR(totalPayable)}</p>
          <p className="mt-1 text-[11.5px] text-slate-500">{suppliers.length} active suppliers</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Net Khata Position</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              {formatPKR(totalReceivable - totalPayable)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCustomer(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </button>
        </div>
      </div>

      {reminderSentToast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-700" />
            {reminderSentToast}
          </span>
          <button type="button" onClick={() => setReminderSentToast(null)} className="text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Ledger Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => setTab("customers")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === "customers" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Customer Khata ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("suppliers")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === "suppliers" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Supplier Khata ({suppliers.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or city..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        {tab === "customers" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Category · City</th>
                  <th className="py-2.5 px-3">Credit Utilization</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredCustomers.map((c) => {
                  const pct = Math.min(100, Math.round((c.khataBalance / Math.max(1, c.creditLimit)) * 100));
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-[11.5px] text-slate-500 font-mono">{c.phone}</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {c.category} · {c.city}
                        {c.overdueDays > 7 && c.khataBalance > 0 && (
                          <span className="block text-[11px] font-semibold text-rose-600">
                            <AlertCircle className="inline h-3 w-3 mr-1" />
                            Overdue {c.overdueDays} days
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 w-48">
                        <div className="flex justify-between text-[11px] text-slate-500 tabular-nums mb-1">
                          <span>{pct}%</span>
                          <span>Limit {formatPKR(c.creditLimit)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 80 ? "bg-rose-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-slate-900">
                        {formatPKR(c.khataBalance)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPayTarget(c);
                              setPayAmount(Math.min(c.khataBalance, 5000) || 1000);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0F7C58] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Receive
                          </button>
                          <button
                            type="button"
                            onClick={() => setReminderCustomer(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Remind
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Categories · Lead Time</th>
                  <th className="py-2.5 px-3 text-right">Payable Balance</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{sup.name}</p>
                      <p className="text-[11.5px] text-slate-500">
                        {sup.company} · {sup.phone}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      {sup.categories.join(", ")} · {sup.leadTimeDays}d delivery
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-rose-700">
                      {formatPKR(sup.payableBalance)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={sup.payableBalance <= 0}
                        onClick={() => onPaySupplier(sup.id, Math.min(sup.payableBalance, 10000))}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                      >
                        Pay Rs. 10,000
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Customer Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-display text-base font-bold text-slate-900">
                Receive Khata Payment
              </h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Customer: <strong>{payTarget.name}</strong> · Outstanding:{" "}
              <strong className="tabular-nums text-rose-700">{formatPKR(payTarget.khataBalance)}</strong>
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount Received (Rs.)</label>
                <input
                  type="number"
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="Cash">Cash</option>
                  <option value="Raast QR">Raast QR</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="Easypaisa">Easypaisa</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (payAmount > 0) {
                    onRecordCustomerPayment(payTarget.id, payAmount, payMethod);
                    setPayTarget(null);
                  }
                }}
                className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Consent Statement Reminder Modal */}
      {reminderCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Digital Khata Statement Reminder
              </h3>
              <button type="button" onClick={() => setReminderCustomer(null)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-slate-800 space-y-1.5">
              <p className="font-semibold text-emerald-900">Message Preview (Urdu / Roman Urdu):</p>
              <p>
                Assalam-o-Alaikum {reminderCustomer.name} Sahib, aap ke account mein{" "}
                <strong>{formatPKR(reminderCustomer.khataBalance)}</strong> ka khata balance baqi hai.
                Barah-e-karam jald adaigi farma kar mashkoor farmayein. Shukriya — Ali General Store.
              </p>
            </div>
            {!reminderCustomer.whatsappConsent && (
              <p className="text-[11.5px] font-medium text-amber-700">
                Note: Customer has not opted into WhatsApp marketing; use SMS/Print statement only.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReminderCustomer(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setReminderSentToast(
                    `Statement reminder logged for ${reminderCustomer.name} (${reminderCustomer.phone}).`
                  );
                  setReminderCustomer(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Send Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handleAddCustSubmit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-base font-bold text-slate-900">Add New Customer Khata</h3>
              <button type="button" onClick={() => setShowAddCustomer(false)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Full Name</label>
                <input
                  required
                  type="text"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  placeholder="e.g. Nadeem Karyana Store"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    required
                    type="text"
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newCust.city}
                    onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={newCust.creditLimit}
                    onChange={(e) => setNewCust({ ...newCust, creditLimit: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Udhaar (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={newCust.khataBalance}
                    onChange={(e) => setNewCust({ ...newCust, khataBalance: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCustomer(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
