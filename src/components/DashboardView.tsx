import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  AudioWaveform,
  BookOpen,
  Check,
  CheckCircle2,
  CreditCard,
  FileBarChart2,
  Info,
  Mic,
  MicOff,
  PackagePlus,
  Send,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { ASSETS, CHART_SERIES_DATA } from "../data/seedData";
import { TRANSLATIONS } from "../i18n/translations";
import {
  AIRecommendation,
  Language,
  NavTab,
  Product,
  TransactionRecord,
} from "../types";
import { formatPKR, ParsedAICommandResult } from "../utils/formatters";

interface DashboardViewProps {
  language: Language;
  ownerName: string;
  totals: {
    sales: number;
    purchases: number;
    profit: number;
    customersCount: number;
  };
  products: Product[];
  transactions: TransactionRecord[];
  recommendations: AIRecommendation[];
  onNavigate: (tab: NavTab) => void;
  onQuickAddProduct: () => void;
  onQuickAddCustomer: () => void;
  onQuickRecordPayment: () => void;
  onOrderStock: (product: Product) => void;
  onInspectRecommendation: (rec: AIRecommendation) => void;
  // Voice assistant props
  voiceListening: boolean;
  voiceLoading: boolean;
  voiceInput: string;
  onVoiceInputChange: (val: string) => void;
  onToggleMic: () => void;
  onSubmitVoiceCommand: (cmd?: string) => void;
  voiceResult: ParsedAICommandResult | null;
  voiceError: string | null;
  onConfirmVoiceAction: () => void;
  onCancelVoiceAction: () => void;
  onOpenUpgrade: () => void;
}

const SPARKLINE_PATHS = {
  sales: "M0 28 C12 24, 20 14, 34 18 C46 21, 56 8, 70 12 C82 15, 92 4, 108 6",
  purchases: "M0 28 C14 25, 24 18, 38 14 C50 11, 62 19, 76 12 C88 7, 98 9, 108 4",
  profit: "M0 29 C16 26, 26 20, 40 16 C52 13, 66 17, 78 9 C90 4, 98 6, 108 3",
  customers: "M0 28 C14 26, 24 19, 38 20 C52 21, 62 11, 76 13 C88 15, 96 6, 108 4",
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  language,
  ownerName,
  totals,
  products,
  transactions,
  recommendations,
  onNavigate,
  onQuickAddProduct,
  onQuickAddCustomer,
  onQuickRecordPayment,
  onOrderStock,
  onInspectRecommendation,
  voiceListening,
  voiceLoading,
  voiceInput,
  onVoiceInputChange,
  onToggleMic,
  onSubmitVoiceCommand,
  voiceResult,
  voiceError,
  onConfirmVoiceAction,
  onCancelVoiceAction,
  onOpenUpgrade,
}) => {
  const t = TRANSLATIONS[language];
  const [chartRange, setChartRange] = useState<keyof typeof CHART_SERIES_DATA>("This Month");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [perfRange, setPerfRange] = useState("This Month");

  const primarySuggestion =
    recommendations.find((r) => r.status === "pending") || recommendations[0];

  const stockAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      product: Product;
      title: string;
      subtitle: string;
      severity: "critical" | "warning" | "info";
      buttonLabel: string;
    }> = [];

    for (const p of products) {
      if (p.expiryDate && new Date(p.expiryDate).getTime() - Date.now() < 7 * 86400000) {
        alerts.push({
          id: `exp-${p.id}`,
          product: p,
          title: p.name.split(" (")[0],
          subtitle:
            new Date(p.expiryDate).getTime() < Date.now()
              ? `Expired (${p.expiryDate})`
              : "Expiring in 3 days",
          severity: "warning",
          buttonLabel: "Check",
        });
      } else if (p.stock <= 5) {
        alerts.push({
          id: `low-${p.id}`,
          product: p,
          title: `${p.name.split(" (")[0]} (Low Stock)`,
          subtitle: `Only ${p.stock} ${p.unit} remaining`,
          severity: "critical",
          buttonLabel: "Order",
        });
      } else if (p.stock < p.minStock) {
        alerts.push({
          id: `min-${p.id}`,
          product: p,
          title: p.name.split(" (")[0],
          subtitle: "Stock below minimum",
          severity: "info",
          buttonLabel: "Restock",
        });
      }
    }
    return alerts.slice(0, 3);
  }, [products]);

  const series = CHART_SERIES_DATA[chartRange];
  const chartMax = Math.max(...series.sales, ...series.purchases, 200000);

  const buildSvgPoints = (values: number[], width: number, height: number) => {
    const padX = 24;
    const padY = 16;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    return values.map((val, idx) => {
      const x = padX + (idx / Math.max(1, values.length - 1)) * usableW;
      const y = padY + usableH - (val / chartMax) * usableH;
      return { x, y, val };
    });
  };

  const smoothLinePath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return "";
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, "");
  };

  const salesPts = buildSvgPoints(series.sales, 460, 195);
  const purchasePts = buildSvgPoints(series.purchases, 460, 195);
  const profitPts = buildSvgPoints(series.profit, 460, 195);

  const growthPercent = perfRange === "This Month" ? 78 : perfRange === "This Week" ? 84 : 72;
  const ringRadius = 40;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - growthPercent / 100);

  return (
    <div className="space-y-4">
      {/* 1. Welcome Hero Banner with Minar-e-Pakistan Backdrop + AI Suggestion */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-900/15 bg-[#063B2B] shadow-xs">
        <img
          src={ASSETS.heroLahore}
          alt="Lahore commercial skyline backdrop"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#053527]/95 via-[#074B37]/80 to-[#0C6A4E]/45" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-5 lg:px-7">
          <div className="max-w-xl">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              {t.welcomeBack} <span className="text-amber-300">{ownerName}!</span>
            </h1>
            <p className="mt-1 text-[13.5px] text-emerald-50/90 font-medium">{t.welcomeSub}</p>
          </div>

          {primarySuggestion && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white/97 px-4 py-3.5 shadow-sm border border-white/80 max-w-xl backdrop-blur-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[12.5px] font-bold text-slate-900">{t.aiSuggestion}</p>
                  <p className="text-[12.5px] text-slate-600 leading-snug mt-0.5">
                    {primarySuggestion.title}. {primarySuggestion.actionLabel}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onInspectRecommendation(primarySuggestion)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F7C58] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#0B6648] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.viewDetails}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 2. 4 KPI Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-slate-500 truncate">{t.totalSales}</p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {formatPKR(totals.sales)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 tabular-nums">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>12.5%</span>
              </p>
            </div>
          </div>
          <svg viewBox="0 0 110 34" className="h-9 w-20 shrink-0" aria-hidden="true">
            <path d={SPARKLINE_PATHS.sales} fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Total Purchases */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-slate-500 truncate">{t.totalPurchases}</p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {formatPKR(totals.purchases)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 tabular-nums">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>8.3%</span>
              </p>
            </div>
          </div>
          <svg viewBox="0 0 110 34" className="h-9 w-20 shrink-0" aria-hidden="true">
            <path d={SPARKLINE_PATHS.purchases} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Net Profit */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-slate-500 truncate">{t.netProfit}</p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {formatPKR(totals.profit)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 tabular-nums">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>15.8%</span>
              </p>
            </div>
          </div>
          <svg viewBox="0 0 110 34" className="h-9 w-20 shrink-0" aria-hidden="true">
            <path d={SPARKLINE_PATHS.profit} fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Customers */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-slate-500 truncate">{t.customersCount}</p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {totals.customersCount.toLocaleString("en-PK")}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 tabular-nums">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>10.2%</span>
              </p>
            </div>
          </div>
          <svg viewBox="0 0 110 34" className="h-9 w-20 shrink-0" aria-hidden="true">
            <path d={SPARKLINE_PATHS.customers} fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      {/* 3. Middle Row: Business Overview Chart + Stock Alerts + AI Voice Assistant */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Business Overview Multi-Series Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileBarChart2 className="h-4.5 w-4.5 text-emerald-700" />
              <h2 className="font-display text-[15.5px] font-bold text-slate-900">
                {t.businessOverview}
              </h2>
            </div>

            <select
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value as keyof typeof CHART_SERIES_DATA)}
              aria-label="Chart time period"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-700 focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              <option value="This Month">This Month</option>
              <option value="This Week">This Week</option>
              <option value="Last 6 Months">Last 6 Months</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-center gap-5 text-[12px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Sales
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              Purchases
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
              Profit
            </span>
          </div>

          <div className="relative mt-2 flex-1 min-h-[210px]">
            <svg viewBox="0 0 460 215" className="w-full h-full overflow-visible">
              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 16 + (195 - 32) * (1 - ratio);
                const labelVal = Math.round((chartMax * ratio) / 1000);
                return (
                  <g key={idx}>
                    <line x1="24" y1={y} x2="444" y2={y} stroke="#EEF2F6" strokeWidth="1" />
                    <text x="16" y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
                      {labelVal === 0 ? "0" : `${labelVal}k`}
                    </text>
                  </g>
                );
              })}

              {/* Smooth Lines */}
              <path d={smoothLinePath(salesPts)} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" />
              <path d={smoothLinePath(purchasePts)} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
              <path d={smoothLinePath(profitPts)} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" />

              {/* Data Points + Hover Regions */}
              {series.labels.map((lbl, idx) => {
                const sp = salesPts[idx];
                const pp = purchasePts[idx];
                const prp = profitPts[idx];
                return (
                  <g
                    key={lbl}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {hoveredIdx === idx && (
                      <line x1={sp.x} y1="12" x2={sp.x} y2="185" stroke="#CBD5E1" strokeDasharray="3 3" />
                    )}
                    <circle cx={sp.x} cy={sp.y} r={hoveredIdx === idx ? 5 : 3.5} fill="#16A34A" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={pp.x} cy={pp.y} r={hoveredIdx === idx ? 5 : 3.5} fill="#2563EB" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={prp.x} cy={prp.y} r={hoveredIdx === idx ? 5 : 3.5} fill="#7C3AED" stroke="#fff" strokeWidth="1.5" />
                    <text x={sp.x} y="206" textAnchor="middle" className="fill-slate-500 text-[10.5px]">
                      {lbl}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && (
              <div className="pointer-events-none absolute top-1 right-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-md tabular-nums">
                <p className="font-bold text-slate-900">{series.labels[hoveredIdx]}</p>
                <p className="text-emerald-700">Sales: {formatPKR(series.sales[hoveredIdx])}</p>
                <p className="text-blue-700">Purchases: {formatPKR(series.purchases[hoveredIdx])}</p>
                <p className="text-violet-700">Profit: {formatPKR(series.profit[hoveredIdx])}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
              <h2 className="font-display text-[15.5px] font-bold text-slate-900">{t.stockAlerts}</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("inventory")}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-emerald-700 cursor-pointer"
            >
              <span>{t.viewAll}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {stockAlerts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl bg-emerald-50/60 p-6 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 mb-2" />
                <p className="text-[13px] font-semibold text-slate-900">All Stock Levels Healthy</p>
                <p className="text-[12px] text-slate-500 mt-0.5">No low-stock or near-expiry items detected.</p>
              </div>
            ) : (
              stockAlerts.map((alert) => {
                const isCritical = alert.severity === "critical";
                const isWarning = alert.severity === "warning";
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 border ${
                      isCritical
                        ? "bg-rose-50/70 border-rose-100"
                        : isWarning
                        ? "bg-amber-50/70 border-amber-100"
                        : "bg-sky-50/70 border-sky-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isCritical
                            ? "bg-rose-100 text-rose-600"
                            : isWarning
                            ? "bg-amber-100 text-amber-600"
                            : "bg-sky-100 text-sky-600"
                        }`}
                      >
                        {isCritical || isWarning ? (
                          <AlertTriangle className="h-4.5 w-4.5" />
                        ) : (
                          <Info className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{alert.title}</p>
                        <p className="text-[12px] text-slate-600 truncate">{alert.subtitle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOrderStock(alert.product)}
                      className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isCritical
                          ? "bg-rose-600 hover:bg-rose-700"
                          : isWarning
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {alert.buttonLabel}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* AI Voice Assistant Card */}
        <div className="lg:col-span-3 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#063B2B] via-[#084A36] to-[#0A5A42] p-4 text-white flex flex-col justify-between">
          <img
            src={ASSETS.aiAssistant}
            alt="Karobar Saathi AI Voice Assistant"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute -right-4 bottom-0 h-[82%] w-[58%] object-cover object-top opacity-90 mask-image-gradient"
            style={{
              WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <AudioWaveform className="h-4 w-4" />
              </span>
              <span className="text-[13.5px] font-bold tracking-tight">{t.aiVoiceTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("ai-assistant")}
              className="text-[11px] font-medium text-emerald-200 hover:text-white underline-offset-2 hover:underline cursor-pointer"
            >
              Open Full
            </button>
          </div>

          <div className="relative z-10 my-3 max-w-[78%]">
            <div className="rounded-2xl rounded-bl-xs bg-white/95 px-3.5 py-2.5 text-[12px] font-medium text-slate-800 shadow-sm leading-snug">
              {voiceResult ? (
                <p>{voiceResult.confirmationPrompt || voiceResult.spokenReply}</p>
              ) : voiceError ? (
                <p className="text-rose-700">{voiceError}</p>
              ) : (
                <p>{t.aiGreeting}</p>
              )}
            </div>

            {voiceResult?.requiresConfirmation && (
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onConfirmVoiceAction}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-400 cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={onCancelVoiceAction}
                  className="rounded-lg bg-slate-900/70 px-2.5 py-1 text-[11.5px] font-medium text-slate-200 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2.5 mt-auto">
            <button
              type="button"
              onClick={onToggleMic}
              aria-label="Activate Voice Assistant"
              className={`flex h-13 w-13 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                voiceListening
                  ? "border-rose-300 bg-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.65)] scale-105"
                  : "border-emerald-300/70 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-emerald-400"
              }`}
            >
              {voiceListening ? <MicOff className="h-5.5 w-5.5 text-white" /> : <Mic className="h-5.5 w-5.5 text-white" />}
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitVoiceCommand();
              }}
              className="w-full flex items-center gap-1.5 rounded-xl bg-black/35 border border-white/15 px-2.5 py-1.5 backdrop-blur-xs"
            >
              <input
                type="text"
                value={voiceInput}
                onChange={(e) => onVoiceInputChange(e.target.value)}
                placeholder={voiceListening ? "Listening..." : t.voiceHint}
                className="w-full bg-transparent text-[11.5px] text-white placeholder:text-emerald-100/70 focus:outline-none"
              />
              <button
                type="submit"
                disabled={voiceLoading || !voiceInput.trim()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                aria-label="Send voice command"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 4. Bottom Row: Recent Transactions + Quick Actions + Business Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Recent Transactions */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-[15.5px] font-bold text-slate-900">
              {t.recentTransactions}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("sales")}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-emerald-700 cursor-pointer"
            >
              <span>{t.viewAll}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {transactions.slice(0, 4).map((tx) => {
              const badgeStyles =
                tx.type === "Sale"
                  ? "bg-emerald-50 text-emerald-700"
                  : tx.type === "Payment"
                  ? "bg-sky-50 text-sky-700"
                  : tx.type === "Purchase"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-amber-50 text-amber-700";

              const iconBox =
                tx.type === "Sale"
                  ? "bg-emerald-100 text-emerald-700"
                  : tx.type === "Payment"
                  ? "bg-sky-100 text-sky-700"
                  : tx.type === "Purchase"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-amber-100 text-amber-700";

              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBox}`}>
                      {tx.type === "Sale" ? (
                        <ShoppingCart className="h-4 w-4" />
                      ) : tx.type === "Payment" ? (
                        <CreditCard className="h-4 w-4" />
                      ) : tx.type === "Purchase" ? (
                        <BookOpen className="h-4 w-4" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{tx.title}</p>
                      <p className="text-[11.5px] text-slate-500 tabular-nums truncate">
                        {tx.subtitle}
                        {tx.status === "Pending Sync" ? " · Queued Offline" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13.5px] font-bold text-slate-900 tabular-nums">
                      {formatPKR(tx.amount)}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeStyles}`}>
                      {tx.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions 6-Tile Grid */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3.5">
            <Zap className="h-4.5 w-4.5 text-amber-500" />
            <h2 className="font-display text-[15.5px] font-bold text-slate-900">{t.quickActions}</h2>
          </div>

          <div className="grid grid-cols-3 gap-2.5 flex-1">
            <button
              type="button"
              onClick={() => onNavigate("pos")}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <ShoppingCart className="h-5.5 w-5.5 text-emerald-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.newSale}</span>
            </button>

            <button
              type="button"
              onClick={onQuickAddProduct}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <PackagePlus className="h-5.5 w-5.5 text-blue-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.addProduct}</span>
            </button>

            <button
              type="button"
              onClick={onQuickAddCustomer}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-violet-50/80 hover:bg-violet-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <UserPlus className="h-5.5 w-5.5 text-violet-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.addCustomer}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("reports")}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <FileBarChart2 className="h-5.5 w-5.5 text-amber-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.viewReports}</span>
            </button>

            <button
              type="button"
              onClick={onQuickRecordPayment}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-teal-50/80 hover:bg-teal-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <Wallet className="h-5.5 w-5.5 text-teal-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.recordPayment}</span>
            </button>

            <button
              type="button"
              onClick={onToggleMic}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 p-3 text-center transition-colors cursor-pointer"
            >
              <Mic className="h-5.5 w-5.5 text-rose-600" />
              <span className="text-[12px] font-semibold text-slate-800 leading-tight">{t.voiceCommand}</span>
            </button>
          </div>
        </div>

        {/* Business Performance + Upgrade Banner */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-[14.5px] font-bold text-slate-900 truncate">
                {t.businessPerformance}
              </h2>
              <select
                value={perfRange}
                onChange={(e) => setPerfRange(e.target.value)}
                aria-label="Performance period"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                <option value="This Month">This Month</option>
                <option value="This Week">This Week</option>
                <option value="Quarter">Quarter</option>
              </select>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke="#E2E8F0" strokeWidth="8" />
                  <circle
                    cx="48"
                    cy="48"
                    r={ringRadius}
                    fill="none"
                    stroke="#0F7C58"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-[18px] font-extrabold text-slate-900 leading-none tabular-nums">
                    {growthPercent}%
                  </p>
                  <p className="text-[10.5px] font-medium text-slate-500 mt-0.5">{t.growth}</p>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-[12px] font-medium text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {t.salesTarget}
                  </span>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {t.profitTarget}
                  </span>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {t.customerGrowth}
                  </span>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-[#063B2B] to-[#0C6449] px-4 py-3.5 text-white flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-[13.5px] font-bold text-amber-300 leading-tight">
                {t.growTitle}
              </p>
              <p className="text-[11.5px] text-emerald-100/90 mt-0.5">{t.growSub}</p>
            </div>
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-[11.5px] font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.upgradeNow}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
