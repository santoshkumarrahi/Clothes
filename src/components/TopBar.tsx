import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CloudOff,
  Menu,
  PlusCircle,
  RefreshCw,
  Search,
  Store,
  Wifi,
  X,
} from "lucide-react";
import { ASSETS, INDUSTRY_PRESETS } from "../data/seedData";
import { TRANSLATIONS } from "../i18n/translations";
import { IndustryType, Language, NavTab, TenantProfile } from "../types";

interface TopBarProps {
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  tenant: TenantProfile;
  onSelectBranch: (branchId: string) => void;
  onSwitchIndustry: (industry: IndustryType) => void;
  onOpenOnboarding: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  notifications: Array<{ id: string; title: string; detail: string; targetTab: NavTab; read: boolean }>;
  onMarkNotificationsRead: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  quickSearchResults: Array<{ id: string; label: string; sub: string; tab: NavTab }>;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  onToggleLanguage,
  tenant,
  onSelectBranch,
  onSwitchIndustry,
  onOpenOnboarding,
  isOffline,
  onToggleOffline,
  pendingSyncCount,
  isSyncing,
  onSyncNow,
  notifications,
  onMarkNotificationsRead,
  onNavigate,
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  quickSearchResults,
}) => {
  const t = TRANSLATIONS[language];
  const [notifOpen, setNotifOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeBranch = tenant.branches.find((b) => b.id === tenant.activeBranchId) || tenant.branches[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F1") {
        e.preventDefault();
        onNavigate("pos");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNavigate]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 lg:px-6 no-print">
      {/* Left: Mobile Menu + Global Ctrl+K Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative flex-1">
          <div className="flex items-center rounded-xl border border-slate-200 bg-[#F6F8FA] px-3 py-2 focus-within:border-emerald-600 focus-within:bg-white transition-colors">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="ml-2.5 w-full bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                Ctrl + K
              </kbd>
            )}
          </div>

          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-40">
              {quickSearchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  No matching products, customers, or invoices for "{searchQuery}".
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {quickSearchResults.map((res) => (
                    <li key={res.id}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          onNavigate(res.tab);
                          onSearchChange("");
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-emerald-50/60 transition-colors"
                      >
                        <div>
                          <p className="text-[13px] font-medium text-slate-900">{res.label}</p>
                          <p className="text-[11px] text-slate-500">{res.sub}</p>
                        </div>
                        <span className="text-[11px] font-medium text-emerald-700 capitalize">{res.tab}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Offline Sync Control, Language Toggle, Notifications, Store & Profile */}
      <div className="flex items-center gap-3 lg:gap-4 shrink-0">
        {/* Functional Offline-First Mode & Sync Button */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleOffline}
            title="Toggle Offline-First Simulation (PRD Sec 9)"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isOffline
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70"
            }`}
          >
            {isOffline ? <CloudOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            <span>{isOffline ? t.offlineMode : "Online"}</span>
          </button>

          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isOffline || isSyncing}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="tabular-nums">Sync ({pendingSyncCount})</span>
            </button>
          )}
        </div>

        {/* EN | اردو Language Switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[12px] font-semibold">
          <button
            type="button"
            onClick={() => onToggleLanguage("en")}
            className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
              language === "en" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onToggleLanguage("ur")}
            className={`urdu-text rounded-md px-2 py-1 transition-colors cursor-pointer ${
              language === "ur" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            اردو
          </button>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((prev) => !prev);
              setStoreMenuOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl z-40 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-[13px] font-semibold text-slate-900">Alerts & Notifications</span>
                <button
                  type="button"
                  onClick={onMarkNotificationsRead}
                  className="text-[11px] font-medium text-emerald-700 hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              </div>
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(n.targetTab);
                        setNotifOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        !n.read ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <p className="text-[12.5px] font-semibold text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">{n.detail}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Store / Branch / Industry Switcher + Owner Profile */}
        <div className="relative flex items-center gap-2.5 pl-1">
          <button
            type="button"
            onClick={() => {
              setStoreMenuOpen((prev) => !prev);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <img
              src={ASSETS.storeFront}
              alt={tenant.businessName}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover border border-slate-200 bg-emerald-50 shrink-0"
            />
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-[13px] font-semibold text-slate-900 whitespace-nowrap max-w-[140px] truncate">
                {tenant.businessName}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                <span className="max-w-[120px] truncate">{activeBranch?.city || tenant.city}</span>
                <ChevronDown className="h-3 w-3" />
              </p>
            </div>
          </button>

          <img
            src={ASSETS.ownerAvatar}
            alt={tenant.ownerName}
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
          />

          {storeMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl z-40 overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                <p className="text-[12px] font-semibold text-slate-500">Active Branch</p>
                <div className="mt-1.5 space-y-1">
                  {tenant.branches.map((br) => (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => {
                        onSelectBranch(br.id);
                        setStoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                        br.id === tenant.activeBranchId
                          ? "bg-emerald-50 text-emerald-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Building2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">{br.name}</span>
                      </span>
                      {br.id === tenant.activeBranchId && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-[12px] font-semibold text-slate-500 mb-1.5">
                  Switch Industry Module Preset (Demo Multi-Industry)
                </p>
                <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                  {(Object.keys(INDUSTRY_PRESETS) as IndustryType[]).map((indKey) => {
                    const preset = INDUSTRY_PRESETS[indKey];
                    const active = tenant.industry === indKey;
                    return (
                      <button
                        key={indKey}
                        type="button"
                        onClick={() => {
                          onSwitchIndustry(indKey);
                          setStoreMenuOpen(false);
                        }}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                          active ? "bg-emerald-700 text-white font-semibold" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{preset.label}</span>
                        </span>
                        {active && <span className="text-[10px]">Active</span>}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenOnboarding();
                    setStoreMenuOpen(false);
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Register New Business</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
