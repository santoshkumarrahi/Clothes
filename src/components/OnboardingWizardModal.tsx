import React, { useState } from "react";
import { Check, Store, X } from "lucide-react";
import { INDUSTRY_PRESETS } from "../data/seedData";
import { IndustryType, PlanTier, SubscriptionPlanConfig } from "../types";
import { formatPKR } from "../utils/formatters";

interface OnboardingWizardModalProps {
  open: boolean;
  onClose: () => void;
  onRegisterBusiness: (payload: {
    businessName: string;
    ownerName: string;
    city: string;
    phone: string;
    industry: IndustryType;
    plan: PlanTier;
  }) => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  open,
  onClose,
  onRegisterBusiness,
}) => {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [city, setCity] = useState("Lahore, Pakistan");
  const [phone, setPhone] = useState("+92 300 ");
  const [industry, setIndustry] = useState<IndustryType>("pharmacy");
  const [plan, setPlan] = useState<PlanTier>("Professional");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim()) return;
    onRegisterBusiness({ businessName, ownerName, city, phone, industry, plan });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Register New Business Tenant & Activate Industry Pack
              </h2>
              <p className="text-xs text-slate-500">
                Same unified platform — dynamically configures modules & sample catalog for your industry
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Business Name</label>
            <input
              required
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Rehman Medical Store"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Owner Full Name</label>
            <input
              required
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Tariq Mahmood"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
            <input
              required
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">City</label>
            <input
              required
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Select Business Category (Auto-configures Industry Modules)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(INDUSTRY_PRESETS) as IndustryType[]).map((key) => {
              const preset = INDUSTRY_PRESETS[key];
              const selected = industry === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIndustry(key)}
                  className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    selected
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{preset.label}</span>
                    {selected && <Check className="h-4 w-4 text-emerald-700" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Subscription Plan</label>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(["Starter", "Business", "Professional", "Enterprise"] as PlanTier[]).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setPlan(tier)}
                className={`rounded-xl border py-2 font-semibold cursor-pointer ${
                  plan === tier
                    ? "border-emerald-700 bg-[#063B2B] text-white"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-[#0F7C58] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            Launch Business Workspace
          </button>
        </div>
      </form>
    </div>
  );
};

interface UpgradePlanModalProps {
  open: boolean;
  currentPlan: PlanTier;
  plans: SubscriptionPlanConfig[];
  onClose: () => void;
  onSelectPlan: (tier: PlanTier) => void;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  open,
  currentPlan,
  plans,
  onClose,
  onSelectPlan,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Karobar Saathi AI Subscription Plans
            </h2>
            <p className="text-xs text-slate-500">
              Scale branches, employees, and Urdu AI voice queries anytime. Export business data anytime.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => {
            const isCurrent = p.tier === currentPlan;
            return (
              <div
                key={p.tier}
                className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 ${
                  isCurrent ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-slate-900">{p.tier}</h3>
                  <p className="text-[11px] text-slate-500">{p.audience}</p>
                  <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {formatPKR(p.monthlyPricePkr)}
                    <span className="text-xs font-normal text-slate-500">/mo</span>
                  </p>
                  <div className="text-[11.5px] text-slate-600 space-y-1 pt-2 border-t border-slate-100 tabular-nums">
                    <p>Up to {p.branchLimit} branches</p>
                    <p>Up to {p.userLimit} staff users</p>
                    <p>{p.aiQueriesLimit.toLocaleString()} AI queries/mo</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    onSelectPlan(p.tier);
                    onClose();
                  }}
                  className={`w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-emerald-100 text-emerald-800 cursor-default"
                      : "bg-[#0F7C58] text-white hover:bg-[#0B6648]"
                  }`}
                >
                  {isCurrent ? "Current Plan" : `Switch to ${p.tier}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
