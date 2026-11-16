import React from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ChevronRight,
  CreditCard,
  Crown,
  FileText,
  Globe,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Language, NavTab, PlanTier } from "../types";
import { TRANSLATIONS } from "../i18n/translations";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  language: Language;
  plan: PlanTier;
  validTill: string;
  onOpenUpgrade: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userRole?: "customer" | "business_owner" | "super_admin";
  onGoPublicSite?: () => void;
  onLogout?: () => void;
}

interface NavItemConfig {
  id: NavTab;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  hasSubmenu?: boolean;
  dividerAbove?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: "dashboard", labelKey: "dashboard", icon: Home },
  { id: "pos", labelKey: "pos", icon: Receipt, hasSubmenu: true },
  { id: "sales", labelKey: "sales", icon: BarChart3, hasSubmenu: true },
  { id: "purchases", labelKey: "purchases", icon: ShoppingCart, hasSubmenu: true },
  { id: "inventory", labelKey: "inventory", icon: Package, hasSubmenu: true },
  { id: "online-products", labelKey: "onlineProducts", icon: Store, dividerAbove: true },
  { id: "online-orders", labelKey: "onlineOrders", icon: ShoppingBag },
  { id: "store-settings", labelKey: "storeSettings", icon: Globe },
  { id: "khata", labelKey: "khata", icon: BookOpen, hasSubmenu: true, dividerAbove: true },
  { id: "customers", labelKey: "customers", icon: Users },
  { id: "suppliers", labelKey: "suppliers", icon: Truck },
  { id: "accounting", labelKey: "accounting", icon: LayoutGrid, hasSubmenu: true },
  { id: "payments", labelKey: "payments", icon: CreditCard, hasSubmenu: true },
  { id: "ai-assistant", labelKey: "aiAssistant", icon: Bot },
  { id: "reports", labelKey: "reports", icon: FileText, hasSubmenu: true },
  { id: "employees", labelKey: "employees", icon: ShoppingBag, hasSubmenu: true },
  { id: "branches", labelKey: "branches", icon: Building2 },
  { id: "settings", labelKey: "settings", icon: Settings },
  { id: "super-admin", labelKey: "superAdmin", icon: ShieldCheck, dividerAbove: true, adminOnly: true },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  language,
  plan,
  validTill,
  onOpenUpgrade,
  mobileOpen,
  onCloseMobile,
  userRole = "business_owner",
  onGoPublicSite,
  onLogout,
}) => {
  const t = TRANSLATIONS[language];

  const content = (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-[#063B2B] text-white select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => {
            onSelectTab("dashboard");
            onCloseMobile();
          }}
          className="flex flex-col items-center w-full text-center group focus:outline-none"
        >
          {/* Custom Handshake + Upward Growth Chart SVG Emblem */}
          <div className="mb-1.5 flex h-12 w-14 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 64 48" className="h-9 w-11" fill="none" aria-hidden="true">
              <path
                d="M14 26L22 18L30 22L46 10"
                stroke="#34D399"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M40 10H46V16"
                stroke="#34D399"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 31C20 27 25 27 28 30L32 34L38 29C40 27 44 27 47 30L50 33"
                stroke="#F8FAFC"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M23 36L28 40C30 42 33 42 35 40L42 34"
                stroke="#A7F3D0"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight text-white whitespace-nowrap">
            Karobar Saathi AI
          </span>
          <span className="text-[11px] font-medium text-emerald-200/80 whitespace-nowrap">
            {t.tagline}
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-lg p-1.5 text-emerald-200 hover:bg-white/10"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5" aria-label="Primary Sidebar Navigation">
        {NAV_ITEMS.filter((item) => !item.adminOnly || userRole === "super_admin").map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <React.Fragment key={item.id}>
              {item.dividerAbove && <div className="my-2 border-t border-white/10" />}
              <button
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-gradient-to-r from-[#137B58] to-[#1A9A6E] text-white shadow-sm"
                    : "text-emerald-100/85 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-emerald-300/80"}`} />
                  <span className="truncate">{t[item.labelKey] || item.labelKey}</span>
                </span>
                {item.hasSubmenu && (
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                      isActive ? "text-white translate-x-0.5" : "text-emerald-300/50"
                    }`}
                  />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Subscription Plan Card & Account Actions */}
      <div className="p-3 pt-2 space-y-2">
        <div className="rounded-2xl border border-emerald-400/20 bg-[#084936] p-3 text-center">
          <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
            <Crown className="h-4 w-4" />
          </div>
          <p className="text-[12.5px] font-semibold text-white whitespace-nowrap">
            {plan === "Professional" ? t.proPlanActive : `${plan} Plan Active`}
          </p>
          <p className="mt-0.5 text-[10.5px] text-emerald-200/75 tabular-nums whitespace-nowrap">
            Valid Till: {validTill}
          </p>
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#17996B] to-[#24B47E] px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:brightness-110 transition-all whitespace-nowrap cursor-pointer"
          >
            {t.upgradePlan}
          </button>
        </div>

        {(onGoPublicSite || onLogout) && (
          <div className="grid grid-cols-2 gap-1.5">
            {onGoPublicSite && (
              <button
                type="button"
                onClick={onGoPublicSite}
                className="flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-[11.5px] font-medium text-emerald-100 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Globe className="h-3.5 w-3.5" />
                Public Site
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center justify-center gap-1 rounded-xl border border-rose-400/25 bg-rose-500/10 px-2 py-1.5 text-[11.5px] font-medium text-rose-200 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0 z-30">{content}</div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
