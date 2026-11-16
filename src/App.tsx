import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CloudOff,
  HardDrive,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import {
  INDUSTRY_PRESETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CMS_CONFIG,
  INITIAL_CUSTOMERS,
  INITIAL_EMPLOYEES,
  INITIAL_MEDIA_ASSETS,
  INITIAL_PAYMENTS,
  INITIAL_PLANS,
  INITIAL_RECOMMENDATIONS,
  INITIAL_SAAS_TENANTS,
  INITIAL_SUPPLIERS,
  INITIAL_TENANT,
  INITIAL_TRANSACTIONS,
} from "./data/seedData";
import { AccountingReportsView } from "./components/AccountingReportsView";
import { AiAgentsView } from "./components/AiAgentsView";
import { AuthViews } from "./components/AuthViews";
import { BranchesEmployeesView } from "./components/BranchesEmployeesView";
import { CategoryPageView } from "./components/CategoryPageView";
import { CustomerPortalView } from "./components/CustomerPortalView";
import { DashboardView } from "./components/DashboardView";
import { InventoryView } from "./components/InventoryView";
import { KhataView } from "./components/KhataView";
import { OnboardingWizardModal, UpgradePlanModal } from "./components/OnboardingWizardModal";
import { OnlineStoreManagerView } from "./components/OnlineStoreManagerView";
import { PaymentsView } from "./components/PaymentsView";
import { PosBillingView } from "./components/PosBillingView";
import { ProductDetailView } from "./components/ProductDetailView";
import { PublicFooter, PublicNavbar } from "./components/PublicNavbar";
import { PublicWebsiteView } from "./components/PublicWebsiteView";
import { SalesPurchasesView } from "./components/SalesPurchasesView";
import { Sidebar } from "./components/Sidebar";
import { StaticStorePages } from "./components/StaticStorePages";
import { StorefrontView } from "./components/StorefrontView";
import { SuperAdminView } from "./components/SuperAdminView";
import { TopBar } from "./components/TopBar";
import {
  AIRecommendation,
  AuditLogEntry,
  AuthUser,
  Branch,
  CartItem,
  CmsConfig,
  CmsPageRecord,
  Customer,
  DbBusiness,
  DbProduct,
  EmployeeRecord,
  IndustryType,
  Language,
  MediaAsset,
  NavTab,
  PaymentRequest,
  PlanTier,
  Product,
  ProductReview,
  PublicCategory,
  SaasTenantRecord,
  SaleItem,
  SubscriptionPlanConfig,
  Supplier,
  SyncEvent,
  TenantProfile,
  TransactionRecord,
} from "./types";
import { getCmsThemeStyleVars, loadGoogleAndCustomFonts } from "./utils/cmsTheme";
import {
  formatPKR,
  ParsedAICommandResult,
  parseOfflineCommand,
  speakUrduOrEnglish,
} from "./utils/formatters";

interface PersistedState {
  tenant: TenantProfile;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  transactions: TransactionRecord[];
  payments: PaymentRequest[];
  employees: EmployeeRecord[];
  auditLogs: AuditLogEntry[];
  recommendations: AIRecommendation[];
  syncQueue: SyncEvent[];
  lastSyncAt: string;
  totals: {
    sales: number;
    purchases: number;
    profit: number;
    customersCount: number;
  };
  saasTenants: SaasTenantRecord[];
  plans: SubscriptionPlanConfig[];
  cms: CmsConfig;
  cmsPrev: CmsConfig | null;
  mediaAssets: MediaAsset[];
}

const STORAGE_KEY = "thar_style_store_state_v1";
const AUTH_TOKEN_KEY = "ks_auth_token";
const CART_STORAGE_KEY = "ts_cart_v1";

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PersistedState;
    }
  } catch {
    // Fallback to seed data
  }
  return {
    tenant: INITIAL_TENANT,
    products: INDUSTRY_PRESETS.kiryana.products,
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    transactions: INITIAL_TRANSACTIONS,
    payments: INITIAL_PAYMENTS,
    employees: INITIAL_EMPLOYEES,
    auditLogs: INITIAL_AUDIT_LOGS,
    recommendations: INITIAL_RECOMMENDATIONS,
    syncQueue: [],
    lastSyncAt: "2 Jun, 2025 04:35 PM",
    totals: {
      sales: 185750,
      purchases: 120000,
      profit: 65750,
      customersCount: 1245,
    },
    saasTenants: INITIAL_SAAS_TENANTS,
    plans: INITIAL_PLANS,
    cms: INITIAL_CMS_CONFIG,
    cmsPrev: null,
    mediaAssets: INITIAL_MEDIA_ASSETS,
  };
}

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CartItem[];
  } catch {
    // ignore
  }
  return [];
}

export default function App() {
  const [state, setState] = useState<PersistedState>(loadInitialState);

  // URL Routing state
  const [routeUrl, setRouteUrl] = useState<string>(
    () => `${window.location.pathname}${window.location.search}`
  );
  const navigateTo = useCallback((path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setRouteUrl(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRouteUrl(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Auth & Multi-Tenant Business state
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<DbBusiness[]>([]);

  // Public homepage live SQLite data
  const [publicStores, setPublicStores] = useState<DbBusiness[]>([]);
  const [publicProducts, setPublicProducts] = useState<DbProduct[]>([]);
  const [publicCategories, setPublicCategories] = useState<PublicCategory[]>([]);
  const [publicReviews, setPublicReviews] = useState<ProductReview[]>([]);
  const [publicPages, setPublicPages] = useState<CmsPageRecord[]>([]);
  const [liveCms, setLiveCms] = useState<CmsConfig>(state.cms);

  // Sync dynamic CSS variables, Google/custom fonts, favicon, and SEO head tags when liveCms updates
  useEffect(() => {
    const vars = getCmsThemeStyleVars(liveCms) as Record<string, string>;
    Object.entries(vars).forEach(([key, val]) => {
      if (key.startsWith("--")) {
        document.documentElement.style.setProperty(key, val);
      }
    });
    loadGoogleAndCustomFonts(liveCms);

    const activeFavicon = liveCms.logoSettings?.faviconUrl || liveCms.faviconUrl;
    if (activeFavicon) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = activeFavicon;
    }

    const seo = liveCms.seoSettings;
    if (seo?.siteTitle) {
      document.title = seo.siteTitle;
    }
    const setMeta = (selector: string, attrName: "name" | "property", attrVal: string, content?: string) => {
      if (!content) return;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("meta[name='description']", "name", "description", seo?.metaDescription);
    setMeta("meta[name='keywords']", "name", "keywords", seo?.metaKeywords);
    setMeta("meta[property='og:title']", "property", "og:title", seo?.ogTitle || seo?.siteTitle);
    setMeta("meta[property='og:description']", "property", "og:description", seo?.ogDescription || seo?.metaDescription);
    setMeta(
      "meta[property='og:image']",
      "property",
      "og:image",
      seo?.ogImageUrl || liveCms.logoSettings?.socialShareImageUrl
    );
    setMeta(
      "meta[name='robots']",
      "name",
      "robots",
      seo?.robotsIndex === false ? "noindex, nofollow" : "index, follow"
    );
  }, [liveCms]);

  // Cart, Wishlist & Guest Auth Prompt
  const [cart, setCart] = useState<CartItem[]>(loadInitialCart);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [customerPortalTab, setCustomerPortalTab] = useState<
    "orders" | "cart" | "addresses" | "wishlist" | "profile"
  >("orders");
  const [guestPromptMsg, setGuestPromptMsg] = useState<string | null>(null);

  // Existing Business OS UI state
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [language, setLanguage] = useState<Language>("en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [inspectedRec, setInspectedRec] = useState<AIRecommendation | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Voice & AI assistant states
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceInput, setVoiceInput] = useState("");
  const [voiceResult, setVoiceResult] = useState<ParsedAICommandResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<
    Array<{ id: string; query: string; reply: string; time: string }>
  >([]);
  const [refreshingInsights, setRefreshingInsights] = useState(false);

  const recognitionRef = useRef<unknown>(null);

  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; detail: string; targetTab: NavTab; read: boolean }>
  >([
    {
      id: "n-1",
      title: "Cheeni Low Stock (5 kg left)",
      detail: "AI Forecast predicts stockout in 3 days. Tap to review PO.",
      targetTab: "inventory",
      read: false,
    },
    {
      id: "n-2",
      title: "Doodh Powder Expiring Soon",
      detail: "Batch B-2025-DP4 expires in 3 days.",
      targetTab: "inventory",
      read: false,
    },
    {
      id: "n-3",
      title: "Bilal Traders Overdue Khata",
      detail: "Rs. 42,000 overdue by 19 days.",
      targetTab: "khata",
      read: false,
    },
  ]);

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Persist offline-first local database on every state update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Fetch public home data (CMS, Stores, Products, Categories, Reviews)
  const fetchPublicHome = useCallback(async () => {
    try {
      const res = await fetch("/api/public/home");
      if (!res.ok) return;
      const data = await res.json();
      setPublicStores(data.stores || []);
      setPublicProducts(data.products || []);
      setPublicCategories(data.categories || []);
      setPublicReviews(data.reviews || []);
      setPublicPages(data.pages || []);
      if (data.cms) {
        setLiveCms(data.cms);
        setState((prev) => ({ ...prev, cms: data.cms }));
      }
    } catch {
      // offline fallback
    }
  }, []);

  useEffect(() => {
    fetchPublicHome();
  }, [fetchPublicHome, routeUrl]);

  // Restore user session on mount
  useEffect(() => {
    let active = true;
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    fetch("/api/auth/me", { headers })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.user) {
          setAuthUser(data.user);
          setOwnedBusinesses(data.businesses || []);
        } else {
          setAuthUser(null);
          setOwnedBusinesses([]);
          if (authToken) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setAuthToken(null);
          }
        }
      })
      .catch(() => {
        // ignore network errors
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });

    return () => {
      active = false;
    };
  }, [authToken]);

  // Load wishlist IDs when authenticated
  useEffect(() => {
    if (!authUser || !authToken) {
      setWishlistIds([]);
      return;
    }
    fetch("/api/customer/wishlist", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        setWishlistIds((d.items || []).map((it: DbProduct) => it.id));
      })
      .catch(() => {});
  }, [authUser, authToken]);

  // Parse path & query params
  const [pathname, searchPart] = useMemo(() => {
    const idx = routeUrl.indexOf("?");
    if (idx === -1) return [routeUrl || "/", ""];
    return [routeUrl.slice(0, idx) || "/", routeUrl.slice(idx + 1)];
  }, [routeUrl]);

  const queryParams = useMemo(() => new URLSearchParams(searchPart), [searchPart]);
  const activeBusiness = ownedBusinesses[0] || null;

  // Enforce protected route guards once authChecked === true
  useEffect(() => {
    if (!authChecked) return;

    if (pathname === "/super-admin" || pathname === "/admin") {
      if (!authUser) {
        navigateTo("/admin-login", true);
      } else if (authUser.role !== "super_admin") {
        navigateTo("/customer", true);
        showToastMsg("Store Admin privileges are required to access that workspace.");
      } else {
        setActiveTab("super-admin");
      }
    } else if (pathname === "/admin-login") {
      if (authUser?.role === "super_admin") {
        setActiveTab("super-admin");
        navigateTo("/super-admin", true);
      }
    } else if (pathname === "/login") {
      if (authUser?.role === "super_admin") {
        setActiveTab("super-admin");
        navigateTo("/super-admin", true);
      } else if (authUser?.role === "customer") {
        navigateTo("/customer", true);
      }
    } else if (pathname === "/dashboard") {
      if (!authUser) {
        navigateTo("/login", true);
      } else if (authUser.role === "customer") {
        navigateTo("/customer", true);
      } else if (authUser.role === "super_admin") {
        navigateTo("/super-admin", true);
      }
    } else if (pathname === "/customer") {
      if (!authUser) {
        navigateTo("/login", true);
      }
    }
  }, [authChecked, pathname, authUser, navigateTo, showToastMsg]);

  // Keep tenant header in Business OS synced with activeBusiness / authUser
  useEffect(() => {
    if (activeBusiness) {
      setState((prev) => ({
        ...prev,
        tenant: {
          ...prev.tenant,
          businessName: activeBusiness.name,
          city: activeBusiness.city,
          address: activeBusiness.address,
          phone: activeBusiness.phone,
          ownerName: authUser?.fullName || prev.tenant.ownerName,
        },
      }));
    } else if (authUser) {
      setState((prev) => ({
        ...prev,
        tenant: {
          ...prev.tenant,
          ownerName: authUser.fullName,
        },
      }));
    }
  }, [activeBusiness, authUser]);

  const handleAuthSuccess = useCallback(
    (payload: { token: string; user: AuthUser; businesses: DbBusiness[] }) => {
      localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
      setAuthToken(payload.token);
      setAuthUser(payload.user);
      setOwnedBusinesses(payload.businesses || []);

      if (payload.user.role === "super_admin") {
        setActiveTab("super-admin");
        navigateTo("/super-admin");
        showToastMsg(`Welcome back, ${payload.user.fullName} (THAR STYLE Admin).`);
      } else if (payload.user.role === "business_owner") {
        setActiveTab("dashboard");
        navigateTo("/dashboard");
        showToastMsg(`Welcome back, ${payload.user.fullName}!`);
      } else {
        navigateTo("/customer");
        showToastMsg(`Welcome to THAR STYLE, ${payload.user.fullName}!`);
      }
    },
    [navigateTo, showToastMsg]
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
    } catch {
      // continue clearing local session
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setOwnedBusinesses([]);
    setWishlistIds([]);
    setActiveTab("dashboard");
    navigateTo("/", true);
    showToastMsg("You have been logged out securely.");
  }, [authToken, navigateTo, showToastMsg]);

  // Cart & Wishlist Handlers
  const handleAddToCart = useCallback(
    (product: DbProduct, variantLabel?: string) => {
      const chosenVariant = variantLabel || product.variants[0] || "Standard";
      setCart((prev) => {
        const existing = prev.find(
          (c) => c.product.id === product.id && c.variantLabel === chosenVariant
        );
        if (existing) {
          return prev.map((c) =>
            c.product.id === product.id && c.variantLabel === chosenVariant
              ? { ...c, quantity: Math.min(product.stock, c.quantity + 1) }
              : c
          );
        }
        return [...prev, { product, quantity: 1, variantLabel: chosenVariant }];
      });
      setCartDrawerOpen(true);
      showToastMsg(`Added "${product.name}" to your cart.`);
    },
    [showToastMsg]
  );

  const handleUpdateCartQty = useCallback(
    (productId: string, variantLabel: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((it) =>
            it.product.id === productId && it.variantLabel === variantLabel
              ? { ...it, quantity: it.quantity + delta }
              : it
          )
          .filter((it) => it.quantity > 0)
      );
    },
    []
  );

  const handleClearCartForBusiness = useCallback((businessId: string) => {
    setCart((prev) => prev.filter((it) => it.product.business_id !== businessId));
  }, []);

  const handleToggleWishlist = useCallback(
    async (productId: string) => {
      if (!authUser || !authToken) {
        setGuestPromptMsg("Create your free account or log in to save favorite products.");
        return;
      }
      try {
        const res = await fetch("/api/customer/wishlist/toggle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (res.ok) {
          setWishlistIds((prev) =>
            data.saved ? [...prev, productId] : prev.filter((id) => id !== productId)
          );
          showToastMsg(data.saved ? "Saved to your wishlist." : "Removed from wishlist.");
        }
      } catch {
        // ignore
      }
    },
    [authUser, authToken, showToastMsg]
  );

  const totalCartCount = useMemo(
    () => cart.reduce((s, it) => s + it.quantity, 0),
    [cart]
  );

  const totalCartValue = useMemo(
    () =>
      cart.reduce((s, it) => {
        const p =
          it.product.discount_price && it.product.discount_price > 0
            ? it.product.discount_price
            : it.product.selling_price;
        return s + p * it.quantity;
      }, 0),
    [cart]
  );

  // Existing Business OS Logic
  const appendAudit = useCallback(
    (action: string, target: string, severity: AuditLogEntry["severity"] = "info"): AuditLogEntry => ({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actor: state.tenant.ownerName,
      role: "Owner",
      action,
      target,
      severity,
    }),
    [state.tenant.ownerName]
  );

  const handleSyncNow = useCallback(async () => {
    if (isOffline || state.syncQueue.length === 0) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: state.tenant.id,
          events: state.syncQueue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      const syncedSet = new Set<string>(data.syncedIds || []);
      const nowLabel = new Date().toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      setState((prev) => ({
        ...prev,
        syncQueue: prev.syncQueue.filter((e) => !syncedSet.has(e.idempotencyKey)),
        transactions: prev.transactions.map((tx) =>
          syncedSet.has(tx.idempotencyKey) ? { ...tx, status: "Completed" } : tx
        ),
        lastSyncAt: nowLabel,
      }));
      showToastMsg(
        `Synchronized ${syncedSet.size} offline record(s) without duplication (${data.duplicateCount || 0} duplicates prevented).`
      );
    } catch {
      showToastMsg("Sync failed — records remain safely queued in local offline database.");
    } finally {
      setIsSyncing(false);
    }
  }, [isOffline, state.syncQueue, state.tenant.id, showToastMsg]);

  const handleCompleteSale = useCallback(
    (payload: {
      items: SaleItem[];
      customerId?: string;
      customerName: string;
      paymentMethod: TransactionRecord["paymentMethod"];
      discount: number;
      taxRate: number;
      total: number;
      notes?: string;
    }): TransactionRecord => {
      const id = `S-2025-${Math.floor(1000 + Math.random() * 8999)}`;
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cogs = payload.items.reduce((s, it) => s + it.costPrice * it.quantity, 0);
      const netSaleProfit = Math.max(0, payload.total - cogs);
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const newTx: TransactionRecord = {
        id,
        idempotencyKey,
        type: "Sale",
        title: `Sale #${id}`,
        subtitle: `Today, ${nowStr}`,
        amount: payload.total,
        costAmount: cogs,
        paymentMethod: payload.paymentMethod,
        customerId: payload.customerId,
        customerName: payload.customerName,
        branchId: state.tenant.activeBranchId,
        items: payload.items,
        status: isOffline ? "Pending Sync" : "Completed",
        createdAt: new Date().toISOString(),
        notes: payload.notes,
      };

      setState((prev) => {
        const updatedProducts = prev.products.map((prod) => {
          const sold = payload.items.find((i) => i.productId === prod.id);
          return sold ? { ...prod, stock: Math.max(0, prod.stock - sold.quantity) } : prod;
        });

        const updatedCustomers =
          payload.paymentMethod === "Udhaar" && payload.customerId
            ? prev.customers.map((c) =>
                c.id === payload.customerId ? { ...c, khataBalance: c.khataBalance + payload.total } : c
              )
            : prev.customers;

        const nextSyncQueue = isOffline
          ? [
              ...prev.syncQueue,
              {
                idempotencyKey,
                type: "SALE" as const,
                summary: `${newTx.title} (${formatPKR(newTx.amount)})`,
                amount: newTx.amount,
                createdAt: newTx.createdAt,
                status: "PENDING" as const,
              },
            ]
          : prev.syncQueue;

        return {
          ...prev,
          products: updatedProducts,
          customers: updatedCustomers,
          transactions: [newTx, ...prev.transactions],
          syncQueue: nextSyncQueue,
          totals: {
            ...prev.totals,
            sales: prev.totals.sales + payload.total,
            profit: prev.totals.profit + netSaleProfit,
          },
          auditLogs: [
            appendAudit(
              isOffline ? "Recorded Offline Sale" : "Completed POS Sale",
              `${newTx.title} (${formatPKR(payload.total)})`
            ),
            ...prev.auditLogs,
          ],
        };
      });

      // Sync POS sale stock deduction with SQLite backend storefront catalog if online
      if (!isOffline && authToken && activeBusiness?.id) {
        fetch(`/api/business/${activeBusiness.id}/pos-sync-sale`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: payload.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
          }),
        }).catch(() => {});
      }

      showToastMsg(
        isOffline
          ? `Offline Sale ${id} saved locally and queued for sync.`
          : `Sale ${id} (${formatPKR(payload.total)}) recorded.`
      );
      return newTx;
    },
    [isOffline, state.tenant.activeBranchId, appendAudit, showToastMsg, authToken, activeBusiness]
  );

  const handleReverseSale = useCallback(
    (saleId: string) => {
      const target = state.transactions.find((t) => t.id === saleId && t.type === "Sale");
      if (!target || target.status === "Reversed") return;

      const revId = `RET-${Math.floor(1000 + Math.random() * 8999)}`;
      const reversalTx: TransactionRecord = {
        id: revId,
        idempotencyKey: `ret-${Date.now()}`,
        type: "Return",
        title: `Return for #${saleId}`,
        subtitle: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        amount: target.amount,
        paymentMethod: target.paymentMethod,
        customerId: target.customerId,
        customerName: target.customerName,
        branchId: target.branchId,
        status: isOffline ? "Pending Sync" : "Completed",
        createdAt: new Date().toISOString(),
        reversedRefId: saleId,
      };

      const profitDelta = Math.max(0, target.amount - (target.costAmount || 0));

      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => {
          const soldItem = target.items?.find((it) => it.productId === p.id);
          return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
        }),
        customers:
          target.paymentMethod === "Udhaar" && target.customerId
            ? prev.customers.map((c) =>
                c.id === target.customerId
                  ? { ...c, khataBalance: Math.max(0, c.khataBalance - target.amount) }
                  : c
              )
            : prev.customers,
        transactions: [
          reversalTx,
          ...prev.transactions.map((t) => (t.id === saleId ? { ...t, status: "Reversed" as const } : t)),
        ],
        totals: {
          ...prev.totals,
          sales: Math.max(0, prev.totals.sales - target.amount),
          profit: Math.max(0, prev.totals.profit - profitDelta),
        },
        auditLogs: [
          appendAudit("Approved Sales Return Reversal", `${revId} reversing ${saleId}`, "warning"),
          ...prev.auditLogs,
        ],
      }));

      showToastMsg(`Sales return ${revId} logged and inventory restored.`);
    },
    [state.transactions, isOffline, appendAudit, showToastMsg]
  );

  const handleCreatePurchase = useCallback(
    (payload: {
      productId: string;
      supplierId: string;
      quantity: number;
      unitCost: number;
      paymentMethod: "Cash" | "Udhaar" | "Bank";
    }) => {
      const prod = state.products.find((p) => p.id === payload.productId);
      const sup = state.suppliers.find((s) => s.id === payload.supplierId);
      const totalCost = payload.quantity * payload.unitCost;
      const id = `P-2025-${Math.floor(1000 + Math.random() * 8999)}`;
      const idempotencyKey = `po-${Date.now()}`;

      const poTx: TransactionRecord = {
        id,
        idempotencyKey,
        type: "Purchase",
        title: `Purchase #${id}`,
        subtitle: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        amount: totalCost,
        paymentMethod: payload.paymentMethod,
        supplierId: payload.supplierId,
        branchId: state.tenant.activeBranchId,
        status: isOffline ? "Pending Sync" : "Completed",
        createdAt: new Date().toISOString(),
        notes: `${payload.quantity} ${prod?.unit || "units"} ${prod?.name || ""} from ${sup?.name || "Supplier"}`,
      };

      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === payload.productId ? { ...p, stock: p.stock + payload.quantity } : p
        ),
        suppliers:
          payload.paymentMethod === "Udhaar"
            ? prev.suppliers.map((s) =>
                s.id === payload.supplierId ? { ...s, payableBalance: s.payableBalance + totalCost } : s
              )
            : prev.suppliers,
        transactions: [poTx, ...prev.transactions],
        totals: {
          ...prev.totals,
          purchases: prev.totals.purchases + totalCost,
        },
        auditLogs: [
          appendAudit("Received Purchase Order", `${poTx.title} (${formatPKR(totalCost)})`),
          ...prev.auditLogs,
        ],
      }));

      showToastMsg(`Restocked +${payload.quantity} ${prod?.unit || ""} of ${prod?.name || "item"}.`);
    },
    [state.products, state.suppliers, state.tenant.activeBranchId, isOffline, appendAudit, showToastMsg]
  );

  const handleRecordCustomerPayment = useCallback(
    (
      customerId: string,
      amount: number,
      method: "Cash" | "Raast QR" | "JazzCash" | "Easypaisa" | "Bank"
    ) => {
      const cust = state.customers.find((c) => c.id === customerId);
      if (!cust) return;

      const id = `PAY-2025-${Math.floor(1000 + Math.random() * 8999)}`;
      const idempotencyKey = `pay-${Date.now()}`;
      const tx: TransactionRecord = {
        id,
        idempotencyKey,
        type: "Payment",
        title: "Payment Received",
        subtitle: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        amount,
        paymentMethod: method,
        customerId,
        customerName: cust.name,
        branchId: state.tenant.activeBranchId,
        status: isOffline ? "Pending Sync" : "Completed",
        createdAt: new Date().toISOString(),
        notes: `Khata recovery from ${cust.name}`,
      };

      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId
            ? { ...c, khataBalance: Math.max(0, c.khataBalance - amount), overdueDays: 0 }
            : c
        ),
        transactions: [tx, ...prev.transactions],
        syncQueue: isOffline
          ? [
              ...prev.syncQueue,
              {
                idempotencyKey,
                type: "PAYMENT",
                summary: `Payment from ${cust.name} (${formatPKR(amount)})`,
                amount,
                createdAt: tx.createdAt,
                status: "PENDING",
              },
            ]
          : prev.syncQueue,
        auditLogs: [
          appendAudit("Recorded Khata Payment", `${cust.name} paid ${formatPKR(amount)} via ${method}`),
          ...prev.auditLogs,
        ],
      }));

      showToastMsg(`Recorded ${formatPKR(amount)} payment from ${cust.name}.`);
    },
    [state.customers, state.tenant.activeBranchId, isOffline, appendAudit, showToastMsg]
  );

  const handleAddExpense = useCallback(
    (title: string, amount: number, category: string) => {
      const id = `EXP-2025-${Math.floor(1000 + Math.random() * 8999)}`;
      const idempotencyKey = `exp-${Date.now()}`;
      const tx: TransactionRecord = {
        id,
        idempotencyKey,
        type: "Expense",
        title: `Expense: ${title}`,
        subtitle: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        amount,
        paymentMethod: "Cash",
        branchId: state.tenant.activeBranchId,
        status: isOffline ? "Pending Sync" : "Completed",
        createdAt: new Date().toISOString(),
        notes: category,
      };

      setState((prev) => ({
        ...prev,
        transactions: [tx, ...prev.transactions],
        totals: {
          ...prev.totals,
          profit: Math.max(0, prev.totals.profit - amount),
        },
        syncQueue: isOffline
          ? [
              ...prev.syncQueue,
              {
                idempotencyKey,
                type: "EXPENSE",
                summary: `${tx.title} (${formatPKR(amount)})`,
                amount,
                createdAt: tx.createdAt,
                status: "PENDING",
              },
            ]
          : prev.syncQueue,
      }));
      showToastMsg(`Expense "${title}" (${formatPKR(amount)}) logged.`);
    },
    [state.tenant.activeBranchId, isOffline, showToastMsg]
  );

  const handleSubmitVoiceCommand = useCallback(
    async (explicitCmd?: string) => {
      const text = (explicitCmd ?? voiceInput).trim();
      if (!text) return;

      setVoiceLoading(true);
      setVoiceError(null);

      try {
        let parsed: ParsedAICommandResult;

        if (isOffline) {
          parsed = parseOfflineCommand(text, {
            products: state.products,
            customers: state.customers,
            salesTotal: state.totals.sales,
            profitTotal: state.totals.profit,
          });
        } else {
          const res = await fetch("/api/ai/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command: text,
              language,
              context: {
                businessName: state.tenant.businessName,
                industry: state.tenant.industry,
                products: state.products,
                customers: state.customers.map((c) => ({
                  id: c.id,
                  name: c.name,
                  balance: c.khataBalance,
                })),
                totals: state.totals,
              },
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "AI command failed.");
          }
          parsed = data.result as ParsedAICommandResult;
        }

        setVoiceResult(parsed);
        const replyText = parsed.confirmationPrompt || parsed.spokenReply;
        speakUrduOrEnglish(replyText);
        setVoiceHistory((prev) => [
          {
            id: `vh-${Date.now()}`,
            query: text,
            reply: replyText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Could not process command.";
        setVoiceError(msg);
      } finally {
        setVoiceLoading(false);
      }
    },
    [voiceInput, isOffline, language, state.products, state.customers, state.totals, state.tenant]
  );

  const handleConfirmVoiceAction = useCallback(() => {
    if (!voiceResult) return;
    const ext = voiceResult.extracted || {};

    if (voiceResult.intent === "RECORD_PAYMENT") {
      const cust =
        state.customers.find((c) =>
          ext.customerName && c.name.toLowerCase().includes(ext.customerName.toLowerCase().split(" ")[0])
        ) || state.customers[0];
      const amt = ext.amount || 2000;
      handleRecordCustomerPayment(cust.id, amt, "Cash");
    } else if (voiceResult.intent === "CREATE_SALE") {
      const prod =
        state.products.find((p) =>
          ext.productName && p.name.toLowerCase().includes(ext.productName.toLowerCase().split(" ")[0])
        ) || state.products[0];
      const qty = ext.quantity || 1;
      const total = ext.amount || qty * prod.sellingPrice;
      handleCompleteSale({
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            quantity: qty,
            unit: prod.unit,
            unitPrice: prod.sellingPrice,
            costPrice: prod.costPrice,
          },
        ],
        customerName: ext.customerName || "Walk-in Customer",
        paymentMethod: "Cash",
        discount: 0,
        taxRate: 0,
        total,
      });
    } else if (voiceResult.intent === "ADD_EXPENSE") {
      handleAddExpense(ext.expenseCategory || "Shop Expense", ext.amount || 1000, "Operations");
    } else if (voiceResult.intent === "CREATE_PO") {
      const prod =
        state.products.find((p) =>
          ext.productName && p.name.toLowerCase().includes(ext.productName.toLowerCase().split(" ")[0])
        ) || state.products[0];
      handleCreatePurchase({
        productId: prod.id,
        supplierId: state.suppliers[0].id,
        quantity: ext.quantity || 10,
        unitCost: prod.costPrice,
        paymentMethod: "Bank",
      });
    }

    setVoiceResult(null);
    setVoiceInput("");
    speakUrduOrEnglish("Shukriya! Transaction record ho gayi hai.");
  }, [
    voiceResult,
    state.customers,
    state.products,
    state.suppliers,
    handleRecordCustomerPayment,
    handleCompleteSale,
    handleAddExpense,
    handleCreatePurchase,
  ]);

  const handleToggleMic = useCallback(() => {
    if (voiceListening) {
      try {
        (recognitionRef.current as { stop?: () => void })?.stop?.();
      } catch {
        // ignore
      }
      setVoiceListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError(
        "Live browser microphone recognition is unavailable in this browser. Type your Roman Urdu / English command below or use sample commands."
      );
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      rec.lang = language === "ur" ? "ur-PK" : "en-PK";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setVoiceInput(transcript);
          handleSubmitVoiceCommand(transcript);
        }
      };
      rec.onerror = () => setVoiceListening(false);
      rec.onend = () => setVoiceListening(false);
      recognitionRef.current = rec;
      setVoiceListening(true);
      setVoiceError(null);
      rec.start();
    } catch {
      setVoiceListening(false);
    }
  }, [voiceListening, language, handleSubmitVoiceCommand]);

  const quickSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ id: string; label: string; sub: string; tab: NavTab }> = [];

    for (const p of state.products) {
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) {
        results.push({
          id: p.id,
          label: p.name,
          sub: `${p.stock} ${p.unit} · ${formatPKR(p.sellingPrice)}`,
          tab: "inventory",
        });
      }
    }
    for (const c of state.customers) {
      if (c.name.toLowerCase().includes(q) || c.phone.includes(q)) {
        results.push({
          id: c.id,
          label: c.name,
          sub: `Khata Balance: ${formatPKR(c.khataBalance)}`,
          tab: "khata",
        });
      }
    }
    for (const t of state.transactions) {
      if (t.title.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          label: t.title,
          sub: `${formatPKR(t.amount)} · ${t.subtitle}`,
          tab: "sales",
        });
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, state.products, state.customers, state.transactions]);

  const handleSwitchIndustry = (ind: IndustryType) => {
    const preset = INDUSTRY_PRESETS[ind];
    setState((prev) => ({
      ...prev,
      tenant: {
        ...prev.tenant,
        businessName: preset.businessExample,
        city: preset.city,
        industry: ind,
        activeModules: preset.modules,
      },
      products: preset.products,
    }));
    showToastMsg(`Activated ${preset.label} modules & sample catalog (${preset.businessExample}).`);
  };

  const handleRefreshInsights = async () => {
    setRefreshingInsights(true);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: state.tenant.businessName,
          industry: state.tenant.industry,
          lowStockItems: state.products.filter((p) => p.stock <= p.minStock),
          overdueCustomers: state.customers.filter((c) => c.overdueDays > 0),
          salesTotal: state.totals.sales,
          profitTotal: state.totals.profit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not refresh AI insights.");
      const mapped: AIRecommendation[] = (data.insights || []).map(
        (item: Record<string, unknown>, idx: number) => ({
          id: `ai-rec-${Date.now()}-${idx}`,
          agent: String(item.agent || "AI Advisor"),
          title: String(item.title || "Business Insight"),
          summary: String(item.summary || ""),
          actionLabel: String(item.actionLabel || "Review"),
          confidence: Number(item.confidence || 85),
          dataPeriod: String(item.dataPeriod || "Last 30 days"),
          assumption: String(item.assumption || "Current run rate"),
          suggestedActionType: "PO",
          status: "pending",
        })
      );
      if (mapped.length > 0) {
        setState((prev) => ({ ...prev, recommendations: mapped }));
        showToastMsg("Updated predictive recommendations via Karobar Saathi AI.");
      }
    } catch (err: unknown) {
      showToastMsg(err instanceof Error ? err.message : "Failed to refresh AI insights.");
    } finally {
      setRefreshingInsights(false);
    }
  };

  const handleApproveRecommendation = (rec: AIRecommendation) => {
    if (rec.suggestedActionType === "PO" && rec.payload?.productId) {
      const prod = state.products.find((p) => p.id === rec.payload?.productId);
      if (prod) {
        handleCreatePurchase({
          productId: prod.id,
          supplierId: state.suppliers[0].id,
          quantity: rec.payload.quantity || 50,
          unitCost: prod.costPrice,
          paymentMethod: "Bank",
        });
      }
    } else if (rec.suggestedActionType === "KHATA_REMINDER") {
      setActiveTab("khata");
      showToastMsg("Opened Khata ledger for overdue customer follow-up.");
    } else if (rec.suggestedActionType === "EXPIRY_CHECK") {
      setActiveTab("inventory");
      showToastMsg("Opened Inventory batch expiry control.");
    }

    setState((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((r) =>
        r.id === rec.id ? { ...r, status: "approved" } : r
      ),
    }));
    setInspectedRec(null);
  };

  // Determine which top-level route view is active
  const isStorefrontSlug = pathname.startsWith("/store/") && pathname.length > "/store/".length;
  const storeSlug = isStorefrontSlug ? decodeURIComponent(pathname.slice("/store/".length)) : "";
  const isProductDetail = pathname.startsWith("/product/") && pathname.length > "/product/".length;
  const productDetailId = isProductDetail ? decodeURIComponent(pathname.slice("/product/".length)) : "";
  const isCategorySlug = pathname.startsWith("/category/") && pathname.length > "/category/".length;
  const categorySlug = isCategorySlug ? decodeURIComponent(pathname.slice("/category/".length)) : "";
  const isCategoriesDirectory = pathname === "/categories";
  const isCollectionPage =
    pathname === "/new-arrivals" ||
    pathname === "/best-sellers" ||
    pathname === "/sale" ||
    pathname === "/traditional-sindhi-collection" ||
    pathname === "/search";
  const isAboutPage = pathname === "/about";
  const isContactPage = pathname === "/contact";
  const isSizeGuidePage = pathname === "/size-guide";
  const isFaqPage = pathname === "/faq";
  const isPolicyPage =
    pathname === "/policy/return" ||
    pathname === "/policy/shipping" ||
    pathname === "/policy/privacy" ||
    pathname === "/policy/terms";
  const isCustomCmsPage = pathname.startsWith("/page/") && pathname.length > "/page/".length;
  const customPageSlug = isCustomCmsPage ? decodeURIComponent(pathname.slice("/page/".length)) : "";
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/admin-login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";
  const isCustomerPage = pathname === "/customer";
  const isStoreAdminRoute = pathname === "/super-admin" || pathname === "/admin";
  const isProtectedWorkspace = pathname === "/dashboard";

  // Slide-over Cart Drawer + Guest Auth Prompt + Toast Overlay shared across public views
  const publicOverlays = (
    <>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border border-[#2A2824] bg-[#141413] text-white px-4 py-3 text-xs font-semibold shadow-xl">
          <Check className="h-4 w-4 text-[#D8A85A] shrink-0" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-[#C7BEB0] hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Slide-over Shopping Bag Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E1D8]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[#9E2A2B]" />
                <h2 className="font-display text-base font-bold text-[#141413]">
                  Shopping Bag ({totalCartCount})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[#8D857B] hover:bg-[#FAF8F5] hover:text-[#141413] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <ShoppingCart className="h-10 w-10 text-[#C7BEB0] mx-auto" />
                  <p className="text-sm font-semibold text-[#141413]">Your shopping bag is empty</p>
                  <p className="text-xs text-[#5D574F]">
                    Explore Men&apos;s, Women&apos;s, Kids, Young Fashion, and Sindhi Ajrak & Topi collections.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const unitPrice =
                    item.product.discount_price && item.product.discount_price > 0
                      ? item.product.discount_price
                      : item.product.selling_price;
                  return (
                    <div
                      key={`${item.product.id}-${item.variantLabel}`}
                      className="flex items-center gap-3 rounded-xl border border-[#E7E1D8] p-3"
                    >
                      <img
                        src={item.product.primaryImage}
                        alt={item.product.name}
                        className="h-16 w-14 rounded-lg object-cover border border-[#E7E1D8] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#141413] truncate">{item.product.name}</p>
                        <p className="text-[11px] text-[#5D574F]">{item.variantLabel}</p>
                        <p className="text-xs font-bold text-[#9E2A2B] tabular-nums mt-0.5">
                          {formatPKR(unitPrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.product.id, item.variantLabel, -1)}
                          className="rounded-lg border border-[#DFD8CE] p-1 text-[#5D574F] hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="w-6 text-center text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.product.id, item.variantLabel, 1)}
                          className="rounded-lg border border-[#DFD8CE] p-1 text-[#5D574F] hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-[#E7E1D8] p-4 space-y-3 bg-[#FAF8F5]">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#5D574F]">Subtotal</span>
                  <span className="font-extrabold text-[#141413] tabular-nums">
                    {formatPKR(totalCartValue)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCartDrawerOpen(false);
                    if (!authUser) {
                      setGuestPromptMsg(
                        "Sign in or create your customer account to complete your THAR STYLE order and track delivery."
                      );
                    } else {
                      setCustomerPortalTab("cart");
                      navigateTo("/customer?tab=cart");
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#141413] px-4 py-3 text-sm font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional Login / Signup Dialog */}
      {guestPromptMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#9E2A2B]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#141413]">
                    Sign In Required to Continue
                  </h3>
                  <p className="text-xs text-[#8E6B35]">THAR STYLE · Mithi, Tharparkar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuestPromptMsg(null)}
                className="text-[#8D857B] hover:text-[#141413] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-[#3A3631] leading-relaxed">{guestPromptMsg}</p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setGuestPromptMsg(null);
                  navigateTo("/signup");
                }}
                className="rounded-lg bg-[#141413] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuestPromptMsg(null);
                  navigateTo("/login");
                }}
                className="rounded-lg border border-[#DFD8CE] bg-white px-4 py-2.5 text-xs font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Sign In
              </button>
            </div>
            <button
              type="button"
              onClick={() => setGuestPromptMsg(null)}
              className="w-full text-center text-xs text-[#5D574F] hover:text-[#141413] cursor-pointer"
            >
              Continue browsing THAR STYLE
            </button>
          </div>
        </div>
      )}
    </>
  );

  // 1. Dedicated Store Admin Dashboard (/super-admin or /admin)
  if (isStoreAdminRoute) {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-sm text-[#5D574F]">
          Loading THAR STYLE Admin...
        </div>
      );
    }
    if (!authUser || !authToken || authUser.role !== "super_admin") {
      return (
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-sm text-[#5D574F]">
          Redirecting to THAR STYLE Admin Sign-In...
        </div>
      );
    }
    return (
      <>
        <SuperAdminView
          authToken={authToken}
          currentUser={authUser}
          cms={state.cms}
          onUpdateCms={(updated) => setState((prev) => ({ ...prev, cms: updated }))}
          onPublishCms={(publishedCms) => {
            const nextCms: CmsConfig = publishedCms || {
              ...state.cms,
              status: "Published",
              versionNumber: state.cms.versionNumber + 1,
            };
            setState((prev) => ({
              ...prev,
              cmsPrev: prev.cms,
              cms: nextCms,
            }));
            setLiveCms(nextCms);
            fetchPublicHome();
            showToastMsg("THAR STYLE website & store settings published live.");
          }}
          onRollbackCms={() => {
            if (!state.cmsPrev) {
              showToastMsg("No previous published snapshot to roll back.");
              return;
            }
            const prevSnapshot = state.cmsPrev;
            setState((prev) => ({
              ...prev,
              cms: prevSnapshot,
              cmsPrev: null,
            }));
            setLiveCms(prevSnapshot);
            showToastMsg("Rolled back CMS to previous published version.");
          }}
          mediaAssets={state.mediaAssets}
          onCategoriesChanged={fetchPublicHome}
          onOpenPublicSite={() => navigateTo("/")}
          onOpenCategorySlug={(slug) => navigateTo(`/category/${slug}`)}
          onLogout={handleLogout}
          onShowToast={showToastMsg}
        />
        {publicOverlays}
      </>
    );
  }

  // 2. Public Product Detail Page (/product/:id)
  if (isProductDetail) {
    return (
      <>
        <ProductDetailView
          productId={productDetailId}
          cms={liveCms}
          allCategories={publicCategories}
          currentUser={authUser}
          cartCount={totalCartCount}
          wishlistIds={wishlistIds}
          onNavigateRoute={(path) => navigateTo(path)}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          onOpenCart={() => setCartDrawerOpen(true)}
          onLogout={handleLogout}
        />
        {publicOverlays}
      </>
    );
  }

  // 3. Public Storefront Route (/store/:slug)
  if (isStorefrontSlug) {
    return (
      <>
        <StorefrontView
          slug={storeSlug}
          cartCount={totalCartCount}
          wishlistIds={wishlistIds}
          onBackHome={() => navigateTo("/")}
          onOpenCart={() => setCartDrawerOpen(true)}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
        />
        {publicOverlays}
      </>
    );
  }

  // 4. Authentication Pages (/login, /admin-login, /signup, /forgot-password)
  if (isAuthPage) {
    const authMode =
      pathname === "/admin-login"
        ? "admin-login"
        : pathname === "/signup"
        ? "signup"
        : pathname === "/forgot-password"
        ? "forgot"
        : "login";
    return (
      <>
        <AuthViews
          mode={authMode}
          onBackPublic={() => navigateTo("/")}
          onSwitchMode={(m) =>
            navigateTo(
              m === "admin-login"
                ? "/admin-login"
                : m === "signup"
                ? "/signup"
                : m === "forgot"
                ? "/forgot-password"
                : "/login"
            )
          }
          onAuthSuccess={handleAuthSuccess}
        />
        {publicOverlays}
      </>
    );
  }

  // 5. Customer Portal Route (/customer)
  if (isCustomerPage) {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-sm text-[#5D574F]">
          Verifying your session...
        </div>
      );
    }
    if (!authUser || !authToken) {
      return null;
    }
    const urlTab = queryParams.get("tab");
    const effectiveTab =
      urlTab === "cart" || urlTab === "wishlist" || urlTab === "addresses" || urlTab === "profile" || urlTab === "orders"
        ? urlTab
        : customerPortalTab;
    return (
      <>
        <CustomerPortalView
          user={authUser}
          authToken={authToken}
          cart={cart}
          storeSettings={liveCms.storeSettings}
          initialTab={effectiveTab}
          onUpdateCartQty={handleUpdateCartQty}
          onClearCartForBusiness={handleClearCartForBusiness}
          onBackPublic={() => navigateTo("/")}
          onOpenStore={(slug) => navigateTo(`/store/${slug}`)}
          onOpenProduct={(pid) => navigateTo(`/product/${pid}`)}
          onLogout={handleLogout}
        />
        {publicOverlays}
      </>
    );
  }

  // 6. Protected Legacy Business Workspace (/dashboard)
  if (isProtectedWorkspace) {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-[#F3F6F8] flex items-center justify-center text-sm text-slate-500">
          Loading Workspace...
        </div>
      );
    }
    if (!authUser || !authToken) {
      return null;
    }

    return (
      <div className="min-h-screen flex bg-[#F3F6F8] text-slate-900">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === "super-admin") {
              if (authUser.role !== "super_admin") return;
              navigateTo("/super-admin");
            }
            setActiveTab(tab);
          }}
          language={language}
          plan={state.tenant.plan}
          validTill={state.tenant.planValidTill}
          onOpenUpgrade={() => setShowUpgrade(true)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          userRole={authUser.role}
          onGoPublicSite={() => navigateTo("/")}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            language={language}
            onToggleLanguage={setLanguage}
            tenant={state.tenant}
            onSelectBranch={(brId) =>
              setState((prev) => ({ ...prev, tenant: { ...prev.tenant, activeBranchId: brId } }))
            }
            onSwitchIndustry={handleSwitchIndustry}
            onOpenOnboarding={() => setShowOnboarding(true)}
            isOffline={isOffline}
            onToggleOffline={() => setIsOffline((prev) => !prev)}
            pendingSyncCount={state.syncQueue.length}
            isSyncing={isSyncing}
            onSyncNow={handleSyncNow}
            notifications={notifications}
            onMarkNotificationsRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
            }
            onNavigate={setActiveTab}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            quickSearchResults={quickSearchResults}
          />

          {toast && (
            <div className="mx-4 lg:mx-6 mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 no-print">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-700" />
                {toast}
              </span>
              <button type="button" onClick={() => setToast(null)} className="text-emerald-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <main className="flex-1 p-4 lg:p-5 max-w-[1440px] w-full mx-auto">
            {activeTab === "dashboard" && (
              <DashboardView
                language={language}
                ownerName={state.tenant.ownerName}
                totals={state.totals}
                products={state.products}
                transactions={state.transactions}
                recommendations={state.recommendations}
                onNavigate={setActiveTab}
                onQuickAddProduct={() => setActiveTab("inventory")}
                onQuickAddCustomer={() => setActiveTab("khata")}
                onQuickRecordPayment={() => setActiveTab("khata")}
                onOrderStock={(prod) => {
                  handleCreatePurchase({
                    productId: prod.id,
                    supplierId: state.suppliers[0].id,
                    quantity: 25,
                    unitCost: prod.costPrice,
                    paymentMethod: "Bank",
                  });
                }}
                onInspectRecommendation={(rec) => setInspectedRec(rec)}
                voiceListening={voiceListening}
                voiceLoading={voiceLoading}
                voiceInput={voiceInput}
                onVoiceInputChange={setVoiceInput}
                onToggleMic={handleToggleMic}
                onSubmitVoiceCommand={handleSubmitVoiceCommand}
                voiceResult={voiceResult}
                voiceError={voiceError}
                onConfirmVoiceAction={handleConfirmVoiceAction}
                onCancelVoiceAction={() => setVoiceResult(null)}
                onOpenUpgrade={() => setShowUpgrade(true)}
              />
            )}

            {(activeTab === "online-products" ||
              activeTab === "online-orders" ||
              activeTab === "store-settings") && (
              <OnlineStoreManagerView
                mode={activeTab}
                authToken={authToken}
                business={activeBusiness}
                onBusinessCreated={(biz) => {
                  setOwnedBusinesses((prev) => [biz, ...prev]);
                  fetchPublicHome();
                }}
                onBusinessUpdated={(biz) => {
                  setOwnedBusinesses((prev) => prev.map((b) => (b.id === biz.id ? biz : b)));
                  fetchPublicHome();
                }}
                onOpenPublicStore={(slug) => navigateTo(`/store/${slug}`)}
                onShowToast={showToastMsg}
              />
            )}

            {activeTab === "pos" && (
              <PosBillingView
                businessName={state.tenant.businessName}
                branchName={
                  state.tenant.branches.find((b) => b.id === state.tenant.activeBranchId)?.name ||
                  "Main Branch"
                }
                industry={state.tenant.industry}
                products={state.products}
                customers={state.customers}
                isOffline={isOffline}
                onCompleteSale={handleCompleteSale}
              />
            )}

            {(activeTab === "sales" || activeTab === "purchases") && (
              <SalesPurchasesView
                initialTab={activeTab}
                transactions={state.transactions}
                products={state.products}
                suppliers={state.suppliers}
                onReverseSale={handleReverseSale}
                onCreatePurchase={handleCreatePurchase}
              />
            )}

            {activeTab === "inventory" && (
              <InventoryView
                industry={state.tenant.industry}
                products={state.products}
                onAddProduct={(prod) => {
                  const newProd: Product = { ...prod, id: `prod-${Date.now()}` };
                  setState((prev) => ({ ...prev, products: [newProd, ...prev.products] }));
                  showToastMsg(`Added "${newProd.name}" to inventory.`);
                }}
                onAdjustStock={(productId, delta, reason) => {
                  setState((prev) => ({
                    ...prev,
                    products: prev.products.map((p) =>
                      p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p
                    ),
                    auditLogs: [
                      appendAudit(
                        `Stock Adjustment (${delta >= 0 ? "+" : ""}${delta})`,
                        `${prev.products.find((p) => p.id === productId)?.name} · ${reason}`,
                        "warning"
                      ),
                      ...prev.auditLogs,
                    ],
                  }));
                  showToastMsg(`Stock adjusted (${delta >= 0 ? "+" : ""}${delta}) · ${reason}`);
                }}
                onOpenPurchaseOrder={(prod) => {
                  handleCreatePurchase({
                    productId: prod.id,
                    supplierId: state.suppliers[0].id,
                    quantity: 20,
                    unitCost: prod.costPrice,
                    paymentMethod: "Bank",
                  });
                }}
              />
            )}

            {(activeTab === "khata" || activeTab === "customers" || activeTab === "suppliers") && (
              <KhataView
                mode={activeTab}
                customers={state.customers}
                suppliers={state.suppliers}
                onRecordCustomerPayment={handleRecordCustomerPayment}
                onAddCustomer={(cust) => {
                  const newCust: Customer = { ...cust, id: `cust-${Date.now()}` };
                  setState((prev) => ({
                    ...prev,
                    customers: [newCust, ...prev.customers],
                    totals: { ...prev.totals, customersCount: prev.totals.customersCount + 1 },
                  }));
                  showToastMsg(`Customer "${newCust.name}" added to Khata.`);
                }}
                onPaySupplier={(supplierId, amount) => {
                  setState((prev) => ({
                    ...prev,
                    suppliers: prev.suppliers.map((s) =>
                      s.id === supplierId
                        ? { ...s, payableBalance: Math.max(0, s.payableBalance - amount) }
                        : s
                    ),
                  }));
                  showToastMsg(`Paid ${formatPKR(amount)} to supplier.`);
                }}
              />
            )}

            {(activeTab === "accounting" || activeTab === "reports") && (
              <AccountingReportsView
                mode={activeTab}
                totals={state.totals}
                transactions={state.transactions}
                products={state.products}
                customers={state.customers}
                onAddExpense={handleAddExpense}
              />
            )}

            {activeTab === "payments" && (
              <PaymentsView
                businessName={state.tenant.businessName}
                isOffline={isOffline}
                payments={state.payments}
                onCreatePaymentRequest={(req) =>
                  setState((prev) => ({ ...prev, payments: [req, ...prev.payments] }))
                }
                onUpdatePaymentStatus={(id, status, trace) => {
                  setState((prev) => ({
                    ...prev,
                    payments: prev.payments.map((p) =>
                      p.id === id
                        ? {
                            ...p,
                            status,
                            providerTrace: trace,
                            settledAt: status === "SETTLED" ? new Date().toISOString() : undefined,
                          }
                        : p
                    ),
                  }));
                  showToastMsg(
                    status === "SETTLED"
                      ? `Payment ${id} verified & settled (${trace}).`
                      : `Payment ${id} marked failed.`
                  );
                }}
              />
            )}

            {activeTab === "ai-assistant" && (
              <AiAgentsView
                voiceListening={voiceListening}
                voiceLoading={voiceLoading}
                voiceInput={voiceInput}
                onVoiceInputChange={setVoiceInput}
                onToggleMic={handleToggleMic}
                onSubmitVoiceCommand={handleSubmitVoiceCommand}
                voiceResult={voiceResult}
                voiceError={voiceError}
                onConfirmVoiceAction={handleConfirmVoiceAction}
                onCancelVoiceAction={() => setVoiceResult(null)}
                voiceHistory={voiceHistory}
                recommendations={state.recommendations}
                onApproveRecommendation={handleApproveRecommendation}
                onDismissRecommendation={(id) =>
                  setState((prev) => ({
                    ...prev,
                    recommendations: prev.recommendations.map((r) =>
                      r.id === id ? { ...r, status: "dismissed" } : r
                    ),
                  }))
                }
                onRefreshInsights={handleRefreshInsights}
                refreshingInsights={refreshingInsights}
              />
            )}

            {(activeTab === "branches" || activeTab === "employees" || activeTab === "settings") && (
              <BranchesEmployeesView
                initialTab={activeTab}
                branches={state.tenant.branches}
                activeBranchId={state.tenant.activeBranchId}
                onSelectBranch={(brId) =>
                  setState((prev) => ({ ...prev, tenant: { ...prev.tenant, activeBranchId: brId } }))
                }
                onAddBranch={(br) => {
                  const newBr: Branch = { ...br, id: `br-${Date.now()}` };
                  setState((prev) => ({
                    ...prev,
                    tenant: {
                      ...prev.tenant,
                      branches: [...prev.tenant.branches, newBr],
                    },
                  }));
                  showToastMsg(`Branch "${newBr.name}" created.`);
                }}
                employees={state.employees}
                onTogglePermission={(empId, perm) => {
                  setState((prev) => ({
                    ...prev,
                    employees: prev.employees.map((e) =>
                      e.id === empId
                        ? { ...e, permissions: { ...e.permissions, [perm]: !e.permissions[perm] } }
                        : e
                    ),
                  }));
                }}
                auditLogs={state.auditLogs}
                onOpenOnboarding={() => setShowOnboarding(true)}
              />
            )}

            {activeTab === "super-admin" && authUser.role === "super_admin" && (
              <SuperAdminView
                authToken={authToken}
                currentUser={authUser}
                saasTenants={state.saasTenants}
                onToggleTenantStatus={(id) =>
                  setState((prev) => ({
                    ...prev,
                    saasTenants: prev.saasTenants.map((t) =>
                      t.id === id
                        ? { ...t, status: t.status === "Active" ? "Suspended" : "Active" }
                        : t
                    ),
                  }))
                }
                onChangeTenantPlan={(id, plan) => {
                  const planObj = state.plans.find((p) => p.tier === plan);
                  setState((prev) => ({
                    ...prev,
                    saasTenants: prev.saasTenants.map((t) =>
                      t.id === id ? { ...t, plan, mrr: planObj?.monthlyPricePkr || t.mrr } : t
                    ),
                  }));
                }}
                plans={state.plans}
                onUpdatePlanPrice={(tier, monthlyPricePkr) =>
                  setState((prev) => ({
                    ...prev,
                    plans: prev.plans.map((p) => (p.tier === tier ? { ...p, monthlyPricePkr } : p)),
                  }))
                }
                cms={state.cms}
                onUpdateCms={(updated) => setState((prev) => ({ ...prev, cms: updated }))}
                onPublishCms={(publishedCms) => {
                  const nextCms: CmsConfig = publishedCms || {
                    ...state.cms,
                    status: "Published",
                    versionNumber: state.cms.versionNumber + 1,
                  };
                  setState((prev) => ({
                    ...prev,
                    cmsPrev: prev.cms,
                    cms: nextCms,
                  }));
                  setLiveCms(nextCms);
                  fetchPublicHome();
                  showToastMsg("Website CMS changes published live.");
                }}
                onRollbackCms={() => {
                  if (!state.cmsPrev) {
                    showToastMsg("No previous published snapshot to roll back.");
                    return;
                  }
                  const prevSnapshot = state.cmsPrev;
                  setState((prev) => ({
                    ...prev,
                    cms: prevSnapshot,
                    cmsPrev: null,
                  }));
                  setLiveCms(prevSnapshot);
                  showToastMsg("Rolled back CMS to previous published version.");
                }}
                mediaAssets={state.mediaAssets}
                onDeleteMedia={(id) => {
                  const target = state.mediaAssets.find((m) => m.id === id);
                  if (target && target.usedIn.length > 0) {
                    return {
                      ok: false,
                      error: `Cannot delete "${target.name}" while referenced in: ${target.usedIn.join(", ")}. Replace it first.`,
                    };
                  }
                  setState((prev) => ({
                    ...prev,
                    mediaAssets: prev.mediaAssets.filter((m) => m.id !== id),
                  }));
                  return { ok: true };
                }}
                onCategoriesChanged={fetchPublicHome}
                onOpenPublicSite={() => navigateTo("/")}
                onOpenStoreSlug={(slug) => navigateTo(`/store/${slug}`)}
                onOpenCategorySlug={(slug) => navigateTo(`/category/${slug}`)}
                onShowToast={showToastMsg}
              />
            )}
          </main>

          {/* Bottom Workspace Footer Bar */}
          <footer className="border-t border-slate-200/80 bg-white px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-600 no-print">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setIsOffline((prev) => !prev)}
                className="inline-flex items-center gap-1.5 font-semibold hover:text-slate-900 cursor-pointer"
              >
                {isOffline ? (
                  <>
                    <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-amber-700">Offline Mode Active</span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">System Online</span>
                  </>
                )}
              </button>
              <span className="tabular-nums text-slate-500">
                Last Sync: {state.lastSyncAt}
                {state.syncQueue.length > 0 ? ` · ${state.syncQueue.length} pending` : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                Multi-Branch ({state.tenant.branches.length})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                Offline Mode Ready
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                Tenant Isolated & Audited
              </span>
            </div>
          </footer>
        </div>

        {/* AI Suggestion Approval Modal */}
        {inspectedRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-display text-base font-bold text-slate-900">
                  {inspectedRec.agent} — Approval Required
                </h3>
                <button type="button" onClick={() => setInspectedRec(null)} className="text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm font-bold text-slate-900">{inspectedRec.title}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{inspectedRec.summary}</p>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <p>Confidence: <strong className="tabular-nums">{inspectedRec.confidence}%</strong></p>
                <p>Data Window: {inspectedRec.dataPeriod}</p>
                <p>Assumption: {inspectedRec.assumption}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectedRec(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveRecommendation(inspectedRec)}
                  className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer"
                >
                  Approve & {inspectedRec.actionLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Tenant Onboarding Modal */}
        <OnboardingWizardModal
          open={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onRegisterBusiness={({ businessName, ownerName, city, phone, industry, plan }) => {
            const preset = INDUSTRY_PRESETS[industry];
            const newId = `ten-${Date.now().toString().slice(-4)}`;
            const planObj = state.plans.find((p) => p.tier === plan);
            setState((prev) => ({
              ...prev,
              tenant: {
                id: newId,
                businessName,
                ownerName,
                city,
                address: `Main Commercial Market, ${city}`,
                phone,
                industry,
                plan,
                planValidTill: "30 Jun 2026",
                activeModules: preset.modules,
                activeBranchId: "br-1",
                branches: [
                  {
                    id: "br-1",
                    name: `${businessName} Main Branch`,
                    city,
                    address: `Main Market, ${city}`,
                    manager: ownerName,
                    monthlySales: 0,
                    stockValue: preset.products.reduce((s, p) => s + p.stock * p.costPrice, 0),
                    active: true,
                  },
                ],
              },
              products: preset.products,
              saasTenants: [
                {
                  id: newId,
                  businessName,
                  ownerName,
                  city,
                  industry,
                  plan,
                  branchesCount: 1,
                  status: "Active",
                  mrr: planObj?.monthlyPricePkr || 1999,
                  joinedDate: "Today",
                  aiCallsThisMonth: 0,
                },
                ...prev.saasTenants,
              ],
            }));
            showToastMsg(`Registered "${businessName}" (${preset.label}) on ${plan} plan.`);
          }}
        />

        {/* Upgrade Plan Modal */}
        <UpgradePlanModal
          open={showUpgrade}
          currentPlan={state.tenant.plan}
          plans={state.plans}
          onClose={() => setShowUpgrade(false)}
          onSelectPlan={(tier) => {
            setState((prev) => ({
              ...prev,
              tenant: { ...prev.tenant, plan: tier },
            }));
            showToastMsg(`Subscription updated to ${tier} Plan.`);
          }}
        />
      </div>
    );
  }

  // 7. Public Category Directory (/categories), Dedicated Category (/category/:slug), Collections (/new-arrivals, /best-sellers, /sale, /traditional-sindhi-collection, /search)
  if (isCategoriesDirectory || isCategorySlug || isCollectionPage) {
    const colKey =
      pathname === "/new-arrivals"
        ? "new-arrivals"
        : pathname === "/best-sellers"
        ? "best-sellers"
        : pathname === "/sale"
        ? "sale"
        : pathname === "/traditional-sindhi-collection"
        ? "traditional-sindhi"
        : "search";
    return (
      <>
        <CategoryPageView
          mode={isCategoriesDirectory ? "directory" : isCategorySlug ? "detail" : "collection"}
          slug={categorySlug}
          collectionKey={isCollectionPage ? colKey : undefined}
          initialQuery={queryParams.get("q") || ""}
          initialSub={queryParams.get("sub") || ""}
          cms={liveCms}
          allCategories={publicCategories}
          currentUser={authUser}
          cartCount={totalCartCount}
          wishlistIds={wishlistIds}
          onNavigateRoute={(path) => {
            if (path === "/super-admin" || path === "/admin") setActiveTab("super-admin");
            if (path === "/dashboard") setActiveTab("dashboard");
            navigateTo(path);
          }}
          onOpenStore={(slug) => navigateTo(`/store/${slug}`)}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          onOpenCart={() => setCartDrawerOpen(true)}
          onLogout={handleLogout}
        />
        {publicOverlays}
      </>
    );
  }

  // 8. Static & CMS Store Pages (/about, /contact, /policy/*, /size-guide, /faq, /page/:slug)
  if (isAboutPage || isContactPage || isPolicyPage || isSizeGuidePage || isFaqPage || isCustomCmsPage) {
    const pageKind = isAboutPage
      ? "about"
      : isContactPage
      ? "contact"
      : isSizeGuidePage
      ? "size-guide"
      : isFaqPage
      ? "faq"
      : isCustomCmsPage
      ? "custom"
      : pathname === "/policy/return"
      ? "policy-return"
      : pathname === "/policy/shipping"
      ? "policy-shipping"
      : pathname === "/policy/privacy"
      ? "policy-privacy"
      : "policy-terms";
    return (
      <>
        <StaticStorePages
          page={pageKind}
          customSlug={customPageSlug}
          cmsPages={publicPages}
          cms={liveCms}
          allCategories={publicCategories}
          currentUser={authUser}
          cartCount={totalCartCount}
          wishlistCount={wishlistIds.length}
          onNavigateRoute={(path) => navigateTo(path)}
          onOpenCart={() => setCartDrawerOpen(true)}
          onLogout={handleLogout}
        />
        {publicOverlays}
      </>
    );
  }

  // 9. Clean 404 Not-Found Fallback for Invalid Public Routes
  if (pathname !== "/") {
    return (
      <>
        <div className="min-h-screen bg-[#FAF8F5] text-[#141413] flex flex-col">
          <PublicNavbar
            cms={liveCms}
            categories={publicCategories}
            currentUser={authUser}
            cartCount={totalCartCount}
            wishlistCount={wishlistIds.length}
            activePath={pathname}
            onNavigateRoute={(path) => navigateTo(path)}
            onOpenCart={() => setCartDrawerOpen(true)}
            onLogout={handleLogout}
          />
          <main className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h1 className="font-display text-3xl font-bold text-[#141413]">Page Not Found</h1>
            <p className="text-sm text-[#5D574F] max-w-md">
              The page <span className="font-mono font-semibold text-[#141413]">{pathname}</span> could not be found. Browse our latest THAR STYLE collections below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo("/")}
                className="rounded-lg bg-[#141413] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/categories")}
                className="rounded-lg border border-[#DFD8CE] bg-white px-5 py-2.5 text-xs font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Browse Collections
              </button>
            </div>
          </main>
          <PublicFooter cms={liveCms} categories={publicCategories} onNavigateRoute={(path) => navigateTo(path)} />
        </div>
        {publicOverlays}
      </>
    );
  }

  // 10. Public Homepage (/)
  return (
    <>
      <PublicWebsiteView
        cms={liveCms}
        stores={publicStores}
        products={publicProducts}
        categories={publicCategories}
        reviews={publicReviews}
        currentUser={authUser}
        cartCount={totalCartCount}
        wishlistIds={wishlistIds}
        initialSection="home"
        onNavigateRoute={(path) => {
          if (path === "/super-admin" || path === "/admin") setActiveTab("super-admin");
          if (path === "/dashboard") setActiveTab("dashboard");
          navigateTo(path);
        }}
        onOpenStore={(slug) => navigateTo(`/store/${slug}`)}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
        onOpenCart={() => setCartDrawerOpen(true)}
        onLogout={handleLogout}
      />
      {publicOverlays}
    </>
  );
}
