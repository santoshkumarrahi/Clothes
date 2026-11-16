import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  QrCode,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PaymentRequest } from "../types";
import { formatPKR } from "../utils/formatters";

interface PaymentsViewProps {
  businessName: string;
  isOffline: boolean;
  payments: PaymentRequest[];
  onCreatePaymentRequest: (req: PaymentRequest) => void;
  onUpdatePaymentStatus: (id: string, status: "SETTLED" | "FAILED", trace?: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  businessName,
  isOffline,
  payments,
  onCreatePaymentRequest,
  onUpdatePaymentStatus,
}) => {
  const [method, setMethod] = useState<PaymentRequest["method"]>("Raast P2M QR");
  const [amount, setAmount] = useState(3500);
  const [customerName, setCustomerName] = useState("Ali Raza");
  const [loading, setLoading] = useState(false);
  const [activeQr, setActiveQr] = useState<PaymentRequest | null>(payments[1] || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isOffline) {
      setErrorMsg(
        "Cannot initiate live Raast/Wallet settlement while Offline. Use Cash or Udhaar in POS, or reconnect to verify provider status (PRD 9.4)."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount, customerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment initiation failed.");
      onCreatePaymentRequest(data.payment);
      setActiveQr(data.payment);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to initiate payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string, outcome: "SETTLED" | "FAILED") => {
    if (isOffline) {
      setErrorMsg("Provider confirmation requires active internet connection.");
      return;
    }
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, outcome }),
      });
      const data = await res.json();
      onUpdatePaymentStatus(id, data.status, data.providerTrace);
      if (activeQr?.id === id) {
        setActiveQr({ ...activeQr, status: data.status, providerTrace: data.providerTrace });
      }
    } catch {
      setErrorMsg("Could not reach payment provider verification endpoint.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900">
            Digital Payments & Settlement Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Raast P2M QR, JazzCash, Easypaisa & Bank Transfers · Provider-verified settlement only
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl">
          <ShieldCheck className="h-4 w-4" />
          Pending until Provider Confirmation
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Generate Request */}
        <form
          onSubmit={handleInitiate}
          className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3"
        >
          <h2 className="font-display text-base font-bold text-slate-900">Generate Payment Request</h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Provider / Channel</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRequest["method"])}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="Raast P2M QR">Raast P2M QR</option>
                <option value="JazzCash">JazzCash Merchant</option>
                <option value="Easypaisa">Easypaisa Merchant</option>
                <option value="Bank Transfer">IBFT Bank Transfer</option>
                <option value="Card">Card Payment Link</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer / Payer</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount (PKR)</label>
              <input
                type="number"
                min={50}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-bold tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0F7C58] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0B6648] disabled:opacity-50 cursor-pointer"
          >
            {isOffline ? "Offline (Online Required for QR)" : loading ? "Creating Request..." : "Generate Dynamic QR / Link"}
          </button>
        </form>

        {/* Active Dynamic QR Preview */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row items-center gap-5">
          {activeQr ? (
            <>
              <div className="flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <QrCode className="h-24 w-24 text-slate-900" />
                <span className="mt-1 font-mono text-[10px] text-slate-500">{activeQr.reference}</span>
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <p className="text-slate-500 font-medium">{businessName} · {activeQr.method}</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{formatPKR(activeQr.amount)}</p>
                <p className="text-slate-600">Payer: <strong>{activeQr.customerName}</strong></p>
                <p className="flex items-center gap-1.5 font-semibold">
                  Status:{" "}
                  {activeQr.status === "SETTLED" ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed Settled ({activeQr.providerTrace})
                    </span>
                  ) : activeQr.status === "FAILED" ? (
                    <span className="text-rose-600 inline-flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Failed / Expired
                    </span>
                  ) : (
                    <span className="text-amber-700 inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Awaiting Provider Webhook
                    </span>
                  )}
                </p>

                {activeQr.status === "PENDING_PROVIDER" && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleVerify(activeQr.id, "SETTLED")}
                      disabled={isOffline}
                      className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                    >
                      Verify Provider Settlement
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify(activeQr.id, "FAILED")}
                      disabled={isOffline}
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      Mark Failed
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="w-full py-10 text-center text-xs text-slate-500">
              <CloudOff className="mx-auto h-7 w-7 text-slate-300 mb-2" />
              Create a payment request to display Raast / Wallet QR.
            </div>
          )}
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Payment Reconciliation Ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-2 px-3">Reference</th>
                <th className="py-2 px-3">Channel</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Provider Status</th>
                <th className="py-2 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{p.reference}</td>
                  <td className="py-2.5 px-3 font-medium">{p.method}</td>
                  <td className="py-2.5 px-3 text-slate-600">{p.customerName}</td>
                  <td className="py-2.5 px-3 text-xs font-semibold">
                    {p.status === "SETTLED" ? (
                      <span className="text-emerald-700">Settled · {p.providerTrace}</span>
                    ) : p.status === "FAILED" ? (
                      <span className="text-rose-600">Failed</span>
                    ) : (
                      <span className="text-amber-700">Pending Provider</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{formatPKR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
