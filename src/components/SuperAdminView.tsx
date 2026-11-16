import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Check,
  Copy,
  DatabaseBackup,
  Edit3,
  ExternalLink,
  FileText,
  FolderTree,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Layout,
  LogOut,
  Megaphone,
  Menu,
  Navigation,
  Package,
  Palette,
  PanelBottom,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  AdminPermissionKey,
  AdminUserRecord,
  AuthUser,
  CmsConfig,
  CmsPageRecord,
  CmsVersionRecord,
  DbBusiness,
  DbOrder,
  DbProduct,
  MediaAsset,
  PlanTier,
  ProductReview,
  PublicCategory,
  SaasTenantRecord,
  SubscriptionPlanConfig,
} from "../types";
import { formatPKR } from "../utils/formatters";
import { AdminDesignPanels, DesignPanelTab } from "./admin/AdminDesignPanels";
import { AdminMediaLibrary, ImagePickerModal } from "./admin/AdminMediaLibrary";
import {
  AdminNotificationItem,
  AdminSystemPanels,
  AuditLogRow,
  ContactMessageRow,
  SystemPanelTab,
} from "./admin/AdminSystemPanels";
import { AdminVisualEditor } from "./admin/AdminVisualEditor";

interface SuperAdminViewProps {
  authToken: string;
  currentUser?: AuthUser | null;
  saasTenants?: SaasTenantRecord[];
  onToggleTenantStatus?: (id: string) => void;
  onChangeTenantPlan?: (id: string, plan: PlanTier) => void;
  plans?: SubscriptionPlanConfig[];
  onUpdatePlanPrice?: (tier: PlanTier, monthlyPricePkr: number) => void;
  cms: CmsConfig;
  onUpdateCms: (cms: CmsConfig) => void;
  onPublishCms: (publishedCms?: CmsConfig) => void;
  onRollbackCms: () => void;
  mediaAssets: MediaAsset[];
  onDeleteMedia?: (id: string) => { ok: boolean; error?: string };
  onCategoriesChanged: () => void;
  onOpenPublicSite: () => void;
  onOpenStoreSlug?: (slug: string) => void;
  onOpenCategorySlug: (slug: string) => void;
  onLogout?: () => void;
  onShowToast: (msg: string) => void;
}

type AdminTab =
  | "overview"
  | "visual-editor"
  | "sections"
  | "hero-slider"
  | "media"
  | "branding"
  | "navigation"
  | "footer"
  | "colors"
  | "typography"
  | "marquee"
  | "animations"
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "pages"
  | "settings"
  | "seo"
  | "notifications"
  | "team"
  | "activity"
  | "versions"
  | "backup";

interface AdminCustomerRow {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  created_at: string;
  order_count: number;
  total_spent: number;
}

interface OverviewAnalytics {
  dailySales: Array<{ label: string; sales: number; orders: number }>;
  monthlySales: Array<{ label: string; revenue: number; orders: number }>;
  categoryBreakdown: Array<{ name: string; slug: string; count: number }>;
  topProducts: Array<{
    product_id: string;
    product_name: string;
    units_sold: number;
    revenue: number;
  }>;
}

interface OverviewStats {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  lowStockProducts: number;
  publishedHeroBanners: number;
}

const SIZE_PRESETS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2-3Y",
  "4-5Y",
  "6-7Y",
  "8-9Y",
  "56cm",
  "57cm",
  "58cm",
  "59cm",
  "Free Size",
];

const SIDEBAR_GROUPS: Array<{
  group: string;
  items: Array<{
    id: AdminTab;
    label: string;
    perm: AdminPermissionKey;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}> = [
  {
    group: "Store Operations",
    items: [
      { id: "overview", label: "Dashboard Overview", perm: "overview", icon: BarChart3 },
      { id: "products", label: "Products", perm: "products_categories", icon: Package },
      { id: "categories", label: "Categories", perm: "products_categories", icon: FolderTree },
      { id: "orders", label: "Orders & Invoices", perm: "orders_customers", icon: ShoppingBag },
      { id: "customers", label: "Customers", perm: "orders_customers", icon: Users },
    ],
  },
  {
    group: "Visual Website Design",
    items: [
      { id: "visual-editor", label: "Live Visual Editor", perm: "visual_editor", icon: Layout },
      { id: "sections", label: "Homepage Sections", perm: "sections_pages", icon: Layers },
      { id: "hero-slider", label: "Hero Slider Manager", perm: "hero_media", icon: ImageIcon },
      { id: "media", label: "Media & Image Library", perm: "hero_media", icon: ImageIcon },
      { id: "branding", label: "Logo & Branding", perm: "branding_nav_footer", icon: Globe },
      { id: "navigation", label: "Header & Navigation", perm: "branding_nav_footer", icon: Navigation },
      { id: "footer", label: "Footer Manager", perm: "branding_nav_footer", icon: PanelBottom },
      { id: "colors", label: "Colors & Theme", perm: "colors_typography", icon: Palette },
      { id: "typography", label: "Fonts & Typography", perm: "colors_typography", icon: Type },
      { id: "marquee", label: "Marquee & Announcements", perm: "marquee_animations", icon: Megaphone },
      { id: "animations", label: "Animations & Effects", perm: "marquee_animations", icon: Sparkles },
    ],
  },
  {
    group: "Content & System",
    items: [
      { id: "pages", label: "Pages & Content", perm: "sections_pages", icon: FileText },
      { id: "settings", label: "Store Settings", perm: "settings_seo", icon: Settings },
      { id: "seo", label: "SEO & Social Tags", perm: "settings_seo", icon: Globe },
      { id: "notifications", label: "Notifications", perm: "overview", icon: Bell },
      { id: "team", label: "Admin Users & Roles", perm: "users_logs_backup", icon: Shield },
      { id: "activity", label: "Activity Logs", perm: "users_logs_backup", icon: Activity },
      { id: "versions", label: "Version History", perm: "visual_editor", icon: History },
      { id: "backup", label: "Backup & Restore", perm: "users_logs_backup", icon: DatabaseBackup },
    ],
  },
];

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  authToken,
  currentUser,
  cms,
  onUpdateCms,
  onPublishCms,
  onCategoriesChanged,
  onOpenPublicSite,
  onOpenCategorySlug,
  onLogout,
  onShowToast,
}) => {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Core SQLite datasets
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [businesses, setBusinesses] = useState<DbBusiness[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [pages, setPages] = useState<CmsPageRecord[]>([]);
  const [versions, setVersions] = useState<CmsVersionRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageRow[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const [stats, setStats] = useState<OverviewStats>({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    publishedHeroBanners: 0,
  });
  const [analytics, setAnalytics] = useState<OverviewAnalytics>({
    dailySales: [],
    monthlySales: [],
    categoryBreakdown: [],
    topProducts: [],
  });

  // Draft vs Published CMS state
  const [cmsDraft, setCmsDraft] = useState<CmsConfig>(cms);
  const [cmsPublished, setCmsPublished] = useState<CmsConfig>(cms);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublishModal, setConfirmPublishModal] = useState(false);
  const [publishNote, setPublishNote] = useState("");

  // Reusable Image Picker Modal state
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    title: string;
    category: MediaAsset["category"];
    onSelect: (url: string) => void;
  } | null>(null);

  // Product modal state
  const [productSearch, setProductSearch] = useState("");
  const [productCatFilter, setProductCatFilter] = useState("All");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pCategorySlug, setPCategorySlug] = useState("men");
  const [pSubcategory, setPSubcategory] = useState("");
  const [pDescription, setPDescription] = useState("");
  const [pCostPrice, setPCostPrice] = useState(0);
  const [pSellingPrice, setPSellingPrice] = useState(2500);
  const [pDiscountPrice, setPDiscountPrice] = useState<string>("");
  const [pStock, setPStock] = useState(20);
  const [pSizes, setPSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [pCustomSize, setPCustomSize] = useState("");
  const [pColorsInput, setPColorsInput] = useState("Crimson, Black");
  const [pFabric, setPFabric] = useState("100% Cotton");
  const [pSeason, setPSeason] = useState("All Season");
  const [pIsNew, setPIsNew] = useState(true);
  const [pIsBestSeller, setPIsBestSeller] = useState(false);
  const [pIsFeatured, setPIsFeatured] = useState(false);
  const [pPublished, setPPublished] = useState(true);
  const [pImages, setPImages] = useState<Array<{ url: string; isPrimary: boolean }>>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  // Category modal & safe delete
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cImage, setCImage] = useState("/src/assets/images/hero_clothing_store_1794817075010.jpg");
  const [cSubsText, setCSubsText] = useState("");
  const [cPublished, setCPublished] = useState(true);
  const [deleteCatTarget, setDeleteCatTarget] = useState<PublicCategory | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");

  // Order status filter & Invoice modal + Customer Search
  const [orderFilter, setOrderFilter] = useState("All");
  const [orderSearch, setOrderSearch] = useState("");
  const [invoiceOrder, setInvoiceOrder] = useState<DbOrder | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const userPerms = useMemo(() => {
    if (!currentUser || currentUser.adminRole === "super_admin" || !currentUser.permissions?.length) {
      return null; // Full super admin access
    }
    return new Set<AdminPermissionKey>(currentUser.permissions);
  }, [currentUser]);

  const hasPerm = (perm: AdminPermissionKey) => !userPerms || userPerms.has(perm);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    }),
    [authToken]
  );

  const hasUnpublishedDraft = useMemo(
    () => JSON.stringify(cmsDraft) !== JSON.stringify(cmsPublished),
    [cmsDraft, cmsPublished]
  );

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [ovRes, catRes, custRes, homeRes] = await Promise.all([
        fetch("/api/admin/overview", { headers: authHeaders }),
        fetch("/api/admin/categories", { headers: authHeaders }),
        fetch("/api/admin/customers", { headers: authHeaders }),
        fetch("/api/public/home"),
      ]);
      const ov = await ovRes.json();
      const catData = catRes.ok ? await catRes.json() : {};
      const custData = custRes.ok ? await custRes.json() : {};
      const homeData = homeRes.ok ? await homeRes.json() : {};

      if (ov.stats) setStats(ov.stats);
      if (ov.analytics) setAnalytics(ov.analytics);
      if (ov.businesses) setBusinesses(ov.businesses);
      if (ov.products) setProducts(ov.products);
      if (ov.orders) setOrders(ov.orders);
      if (ov.auditLogs) setAuditLogs(ov.auditLogs);
      if (ov.mediaAssets) setMediaAssets(ov.mediaAssets);
      if (ov.pages) setPages(ov.pages);
      if (ov.versions) setVersions(ov.versions);
      if (ov.adminUsers) setAdminUsers(ov.adminUsers);
      if (ov.notifications) setNotifications(ov.notifications);
      if (ov.contactMessages) setContactMessages(ov.contactMessages);
      if (homeData.reviews) setReviews(homeData.reviews);

      const pubCfg = ov.cmsPublished || ov.cms;
      const drfCfg = ov.cmsDraft || pubCfg;
      if (pubCfg) {
        setCmsPublished(pubCfg);
        onUpdateCms(pubCfg);
      }
      if (drfCfg) {
        setCmsDraft(drfCfg);
      }
      if (catData.categories) setCategories(catData.categories);
      if (custData.customers) setCustomers(custData.customers);
    } catch {
      onShowToast("Failed to synchronize Store Admin workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!userPerms) return;
    const allItems = SIDEBAR_GROUPS.flatMap((g) => g.items);
    const activeItem = allItems.find((it) => it.id === tab);
    if (!activeItem || !userPerms.has(activeItem.perm)) {
      const firstPermitted = allItems.find((it) => userPerms.has(it.perm));
      if (firstPermitted) setTab(firstPermitted.id);
    }
  }, [tab, userPerms]);

  const uploadImageFile = async (
    file: File,
    category: MediaAsset["category"] = "Content",
    altText?: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/api/uploads/image", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              dataUrl: String(reader.result || ""),
              fileName: file.name,
              category,
              altText: altText || file.name,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          if (data.asset) {
            setMediaAssets((prev) => [data.asset, ...prev]);
          }
          resolve(data.url);
        } catch (err: unknown) {
          onShowToast(err instanceof Error ? err.message : "Image upload failed.");
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const openImagePicker = (
    onPicked: (url: string) => void,
    category: MediaAsset["category"] = "Content",
    title = "Select or Upload Image"
  ) => {
    setPickerState({
      open: true,
      title,
      category,
      onSelect: onPicked,
    });
  };

  // --- Draft & Publish Handlers ---
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch("/api/admin/cms/draft", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ cms: cmsDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft.");
      if (data.cmsDraft) setCmsDraft(data.cmsDraft);
      onShowToast("Draft saved safely without changing the live public store.");
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublishLive = async (note?: string) => {
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/cms/publish", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ cms: cmsDraft, label: note?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish storefront.");
      setCmsDraft(data.cms);
      setCmsPublished(data.cms);
      onUpdateCms(data.cms);
      onPublishCms(data.cms);
      onCategoriesChanged();
      setConfirmPublishModal(false);
      setPublishNote("");
      await loadAllAdminData();
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  // --- Product Handlers ---
  const openCreateProduct = () => {
    setEditingProductId(null);
    setPName("");
    setPSku(`TS-${Math.floor(1000 + Math.random() * 8999)}`);
    const firstCat = categories[0]?.slug || "men";
    setPCategorySlug(firstCat);
    setPSubcategory(categories[0]?.subcategories?.[0] || "");
    setPDescription("");
    setPCostPrice(1500);
    setPSellingPrice(2800);
    setPDiscountPrice("");
    setPStock(25);
    setPSizes(["S", "M", "L", "XL"]);
    setPColorsInput("Crimson, Charcoal");
    setPFabric("100% Cotton");
    setPSeason("All Season");
    setPIsNew(true);
    setPIsBestSeller(false);
    setPIsFeatured(false);
    setPPublished(true);
    setPImages([
      { url: "/src/assets/images/prod_men_waistcoat_1794818534691.jpg", isPrimary: true },
    ]);
    setProductModalOpen(true);
  };

  const openEditProduct = (prod: DbProduct) => {
    setEditingProductId(prod.id);
    setPName(prod.name);
    setPSku(prod.sku);
    setPCategorySlug(prod.category_slug || "men");
    setPSubcategory(prod.subcategory || "");
    setPDescription(prod.description || "");
    setPCostPrice(prod.cost_price || 0);
    setPSellingPrice(prod.selling_price || 0);
    setPDiscountPrice(prod.discount_price ? String(prod.discount_price) : "");
    setPStock(prod.stock || 0);
    setPSizes(prod.sizes?.length ? prod.sizes : prod.variants || ["Standard"]);
    setPColorsInput((prod.colors || []).join(", "));
    setPFabric(prod.specs?.Fabric || "");
    setPSeason(prod.specs?.Season || "");
    setPIsNew(Boolean(prod.is_new_arrival));
    setPIsBestSeller(Boolean(prod.is_best_seller));
    setPIsFeatured(Boolean(prod.is_featured));
    setPPublished(Boolean(prod.published));
    setPImages(
      prod.images?.length
        ? prod.images.map((im) => ({ url: im.url, isPrimary: Boolean(im.is_primary) }))
        : [{ url: prod.primaryImage, isPrimary: true }]
    );
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const colorsArr = pColorsInput
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const payload = {
        name: pName.trim(),
        sku: pSku.trim(),
        brand: "THAR STYLE",
        categorySlug: pCategorySlug,
        category: categories.find((c) => c.slug === pCategorySlug)?.name || pCategorySlug,
        subcategory: pSubcategory.trim(),
        unit: "pcs",
        description: pDescription.trim(),
        costPrice: Number(pCostPrice) || 0,
        sellingPrice: Number(pSellingPrice) || 0,
        discountPrice: pDiscountPrice ? Number(pDiscountPrice) : null,
        stock: Number(pStock) || 0,
        published: pPublished,
        sizes: pSizes.length ? pSizes : ["Standard"],
        variants: pSizes.length ? pSizes : ["Standard"],
        colors: colorsArr.length ? colorsArr : ["Standard"],
        specs: {
          ...(pFabric.trim() ? { Fabric: pFabric.trim() } : {}),
          ...(pSeason.trim() ? { Season: pSeason.trim() } : {}),
        },
        isNewArrival: pIsNew,
        isBestSeller: pIsBestSeller,
        isFeatured: pIsFeatured,
        images: pImages,
      };

      const url = editingProductId
        ? `/api/business/biz-thar-style/products/${encodeURIComponent(editingProductId)}`
        : "/api/business/biz-thar-style/products";
      const res = await fetch(url, {
        method: editingProductId ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save garment.");
      setProductModalOpen(false);
      onShowToast(editingProductId ? "Product updated." : "New garment published to store.");
      await loadAllAdminData();
      onCategoriesChanged();
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : "Failed to save garment.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (pid: string, name: string) => {
    const res = await fetch(`/api/business/biz-thar-style/products/${encodeURIComponent(pid)}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== pid));
      onShowToast(`Deleted "${name}".`);
      onCategoriesChanged();
    }
  };

  const handleDuplicateProduct = async (pid: string) => {
    const res = await fetch(
      `/api/business/biz-thar-style/products/${encodeURIComponent(pid)}/duplicate`,
      { method: "POST", headers: authHeaders }
    );
    if (res.ok) {
      onShowToast("Product duplicated as draft.");
      await loadAllAdminData();
    }
  };

  const handleToggleProductPublish = async (prod: DbProduct) => {
    const next = !prod.published;
    const res = await fetch(`/api/admin/products/${encodeURIComponent(prod.id)}/moderate`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ published: next }),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, published: next } : p)));
      onShowToast(`${prod.name} ${next ? "published" : "hidden"}.`);
      onCategoriesChanged();
    }
  };

  // --- Category Handlers ---
  const openCreateCat = () => {
    setEditingCatId(null);
    setCName("");
    setCSlug("");
    setCDesc("");
    setCImage("/src/assets/images/hero_clothing_store_1794817075010.jpg");
    setCSubsText("");
    setCPublished(true);
    setCatModalOpen(true);
  };

  const openEditCat = (cat: PublicCategory) => {
    setEditingCatId(cat.id);
    setCName(cat.name);
    setCSlug(cat.slug);
    setCDesc(cat.description);
    setCImage(cat.image_url);
    setCSubsText((cat.subcategories || []).join(", "));
    setCPublished(Boolean(cat.published));
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const subcategories = cSubsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(
      editingCatId
        ? `/api/admin/categories/${encodeURIComponent(editingCatId)}`
        : "/api/admin/categories",
      {
        method: editingCatId ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: cName.trim(),
          slug: cSlug.trim(),
          description: cDesc.trim(),
          imageUrl: cImage,
          subcategories,
          published: cPublished,
          featured: true,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      onShowToast(data.error || "Could not save category.");
      return;
    }
    setCatModalOpen(false);
    onShowToast(editingCatId ? "Category updated." : "Category created.");
    await loadAllAdminData();
    onCategoriesChanged();
  };

  const handleMoveCategory = async (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const copy = [...categories];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setCategories(copy);
    await fetch("/api/admin/categories/reorder", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ orderedIds: copy.map((c) => c.id) }),
    });
    onCategoriesChanged();
  };

  const handleConfirmDeleteCat = async () => {
    if (!deleteCatTarget) return;
    const res = await fetch(`/api/admin/categories/${encodeURIComponent(deleteCatTarget.id)}`, {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ reassignCategoryId: reassignTargetId }),
    });
    const data = await res.json();
    if (!res.ok) {
      onShowToast(data.error || "Could not delete category.");
      return;
    }
    setDeleteCatTarget(null);
    onShowToast("Category deleted.");
    await loadAllAdminData();
    onCategoriesChanged();
  };

  // --- Order Status ---
  const handleUpdateOrder = async (orderId: string, status: string, paymentStatus?: string) => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status, paymentStatus }),
    });
    if (res.ok) {
      onShowToast(`Order updated -> ${status}`);
      await loadAllAdminData();
    }
  };

  // Filtered lists
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = productCatFilter === "All" || p.category_slug === productCatFilter;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.subcategory || "").toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, productSearch, productCatFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const statusOk = orderFilter === "All" || o.order_status === orderFilter;
      const qOk =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q);
      return statusOk && qOk;
    });
  }, [orders, orderFilter, orderSearch]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.mobile || "").includes(q)
    );
  }, [customers, customerSearch]);

  const quickJumpMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ id: AdminTab; label: string; group: string }> = [];
    SIDEBAR_GROUPS.forEach((grp) => {
      grp.items.forEach((it) => {
        if (hasPerm(it.perm) && it.label.toLowerCase().includes(q)) {
          results.push({ id: it.id, label: it.label, group: grp.group });
        }
      });
    });
    return results.slice(0, 6);
  }, [globalSearch, userPerms]);

  const selectedCatForProduct = categories.find((c) => c.slug === pCategorySlug);
  const designTabs = new Set<string>([
    "hero-slider",
    "branding",
    "navigation",
    "footer",
    "colors",
    "typography",
    "marquee",
    "animations",
    "sections",
  ]);
  const systemTabs = new Set<string>([
    "pages",
    "seo",
    "notifications",
    "team",
    "activity",
    "versions",
    "backup",
  ]);

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#141413] text-white">
      <div className="p-4 border-b border-[#2A2824] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {cmsDraft.logoSettings?.adminLogoUrl ? (
            <img
              src={cmsDraft.logoSettings.adminLogoUrl}
              alt="Admin Logo"
              className="h-8 w-8 rounded-lg object-contain bg-white/10 p-1 shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#9E2A2B] flex items-center justify-center font-display font-bold text-sm shrink-0">
              TS
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-[0.06em] uppercase truncate">
              {cmsDraft.brandName || "THAR STYLE"}
            </p>
            <p className="text-[10px] text-[#E6C994] truncate">
              Super Admin Control OS
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden rounded-lg p-1 text-[#C7BEB0] hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {SIDEBAR_GROUPS.map((grp) => {
          const visibleItems = grp.items.filter((it) => hasPerm(it.perm));
          if (visibleItems.length === 0) return null;
          return (
            <div key={grp.group} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#9A9287]">
                {grp.group}
              </p>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? "bg-[#9E2A2B] text-white"
                        : "text-[#D8D0C4] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === "notifications" && notifications.length > 0 && (
                      <span className="rounded-full bg-[#E6C994] px-1.5 py-0.2 text-[10px] font-bold text-[#141413]">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#2A2824] space-y-2 text-[11px]">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="font-bold text-white truncate">
            {currentUser?.fullName || "Store Super Admin"}
          </p>
          <p className="text-[10px] text-[#E6C994] uppercase tracking-wider">
            {currentUser?.adminRole || "super_admin"}
          </p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2 font-semibold text-[#E7E2DA] hover:bg-rose-600/20 hover:text-white cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );

  // Max value helpers for crisp SVG charts
  const maxDailySale = Math.max(1000, ...analytics.dailySales.map((d) => d.sales));
  const maxMonthlyRevenue = Math.max(1000, ...analytics.monthlySales.map((m) => m.revenue));
  const maxCatCount = Math.max(1, ...analytics.categoryBreakdown.map((c) => c.count));

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#141413] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen no-print">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-black/60 no-print">
          <aside className="w-72 h-full shadow-2xl">{renderSidebarContent()}</aside>
          <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-[#E7E1D8] bg-white px-4 py-3 lg:px-6 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden rounded-lg border border-[#DFD8CE] p-2 cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Global Quick Module Jump Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 text-[#8D857B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Jump to module (Hero, Fonts, Orders, SEO...)"
                  className="w-full rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] pl-8 pr-3 py-2 text-xs"
                />
                {quickJumpMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-[#E7E1D8] bg-white shadow-xl py-1 z-40">
                    {quickJumpMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setTab(m.id);
                          setGlobalSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#FAF8F5] flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-bold text-[#141413]">{m.label}</span>
                        <span className="text-[10px] text-[#8E6B35]">{m.group}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-lg px-2.5 py-1.5 font-bold ${
                  hasUnpublishedDraft
                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                }`}
              >
                {hasUnpublishedDraft
                  ? "Draft Unsaved/Unpublished"
                  : `Live v${cmsPublished.versionNumber}`}
              </span>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] bg-white px-3 py-1.5 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={() => setConfirmPublishModal(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#9E2A2B] px-3.5 py-1.5 font-bold text-white hover:bg-[#141413] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Publish
              </button>

              <button
                type="button"
                onClick={() => setTab("notifications")}
                className="relative rounded-lg border border-[#DFD8CE] p-2 hover:bg-[#FAF8F5] cursor-pointer"
                title="Notifications Center"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-[#9E2A2B] text-[10px] font-bold text-white flex items-center justify-center px-1">
                    {notifications.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenPublicSite}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-3 py-1.5 font-semibold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Live Store
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1520px] w-full mx-auto space-y-6">
          {loading && (
            <div className="rounded-xl border border-[#E7E1D8] bg-white p-4 text-xs text-[#5D574F]">
              Synchronizing THAR STYLE database & visual controls...
            </div>
          )}

          {/* 1. DASHBOARD OVERVIEW (10 KPIs + 4 Real Charts + Quick Actions) */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* 10 Real Database KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {[
                  { label: "Total Revenue", val: formatPKR(stats.totalRevenue), accent: "text-[#141413]" },
                  { label: "Total Orders", val: String(stats.totalOrders), accent: "text-[#9E2A2B]" },
                  { label: "Pending Orders", val: String(stats.pendingOrders), accent: "text-amber-700" },
                  { label: "Completed Orders", val: String(stats.completedOrders), accent: "text-emerald-700" },
                  { label: "Total Products", val: String(stats.totalProducts), accent: "text-[#141413]" },
                  { label: "Total Categories", val: String(stats.totalCategories), accent: "text-[#141413]" },
                  { label: "Registered Customers", val: String(stats.totalCustomers), accent: "text-[#141413]" },
                  { label: "Low Stock Alerts", val: String(stats.lowStockProducts), accent: stats.lowStockProducts > 0 ? "text-rose-700" : "text-emerald-700" },
                  { label: "Active Hero Banners", val: String(stats.publishedHeroBanners), accent: "text-[#8E6B35]" },
                  {
                    label: "Storefront Status",
                    val: hasUnpublishedDraft ? "Draft Pending" : `Live v${cmsPublished.versionNumber}`,
                    accent: hasUnpublishedDraft ? "text-amber-700" : "text-emerald-700",
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-2xl border border-[#E7E1D8] bg-white p-4">
                    <p className="text-[11px] font-medium text-[#5D574F]">{kpi.label}</p>
                    <p className={`mt-1 font-display text-xl font-bold tabular-nums ${kpi.accent}`}>
                      {kpi.val}
                    </p>
                  </div>
                ))}
              </div>

              {/* 4 Real SQLite Analytics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                {/* Daily Sales Bar Chart */}
                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#141413]">
                        Last 7 Days Sales (PKR)
                      </h3>
                      <p className="text-[11px] text-[#5D574F]">Live SQLite order totals</p>
                    </div>
                  </div>
                  <div className="h-44 flex items-end gap-2.5 pt-4 border-b border-[#F2EDE4] pb-2">
                    {analytics.dailySales.map((d) => {
                      const pct = Math.max(6, Math.round((d.sales / maxDailySale) * 100));
                      return (
                        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-semibold text-[#5D574F] tabular-nums">
                            {d.sales > 0 ? `${Math.round(d.sales / 1000)}k` : "0"}
                          </span>
                          <div
                            className="w-full max-w-[34px] rounded-t-lg bg-[#9E2A2B] transition-all"
                            style={{ height: `${pct}%` }}
                            title={`${d.label}: ${formatPKR(d.sales)} (${d.orders} orders)`}
                          />
                          <span className="text-[10px] font-bold text-[#141413]">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly Revenue Trend */}
                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#141413]">
                        Monthly Revenue Trend
                      </h3>
                      <p className="text-[11px] text-[#5D574F]">Aggregated non-cancelled orders</p>
                    </div>
                  </div>
                  <div className="h-44 flex items-end gap-3 pt-4 border-b border-[#F2EDE4] pb-2">
                    {analytics.monthlySales.length === 0 ? (
                      <div className="w-full text-center text-[#8D857B] self-center">
                        No monthly order history recorded yet.
                      </div>
                    ) : (
                      analytics.monthlySales.map((m) => {
                        const pct = Math.max(8, Math.round((m.revenue / maxMonthlyRevenue) * 100));
                        return (
                          <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                            <span className="text-[10px] font-semibold text-[#5D574F] tabular-nums">
                              {formatPKR(m.revenue)}
                            </span>
                            <div
                              className="w-full max-w-[44px] rounded-t-lg bg-[#141413]"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="text-[10px] font-bold text-[#141413]">{m.label}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Category Catalog Breakdown */}
                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
                  <h3 className="font-display text-base font-bold text-[#141413]">
                    Catalog Breakdown by Category
                  </h3>
                  <div className="space-y-2.5">
                    {analytics.categoryBreakdown.map((cat) => (
                      <div key={cat.slug} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#141413]">{cat.name}</span>
                          <span className="tabular-nums text-[#5D574F]">{cat.count} products</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F2EDE4] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#8E6B35]"
                            style={{ width: `${Math.max(5, Math.round((cat.count / maxCatCount) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Products */}
                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
                  <h3 className="font-display text-base font-bold text-[#141413]">
                    Top Selling & Highlighted Garments
                  </h3>
                  <div className="space-y-2">
                    {analytics.topProducts.map((tp) => (
                      <div
                        key={tp.product_id}
                        className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3.5 py-2.5 border border-[#F2EDE4]"
                      >
                        <div>
                          <p className="font-bold text-[#141413]">{tp.product_name}</p>
                          <p className="text-[11px] text-[#5D574F]">
                            {tp.units_sold} unit(s) ordered
                          </p>
                        </div>
                        <span className="font-bold tabular-nums text-[#9E2A2B]">
                          {formatPKR(tp.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                <div className="lg:col-span-5 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#141413]">
                    Quick Control Shortcuts
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTab("visual-editor")}
                      className="rounded-xl bg-[#141413] p-3 text-left font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
                    >
                      Open Live Visual Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("products");
                        openCreateProduct();
                      }}
                      className="rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-3 text-left font-bold hover:border-[#9E2A2B] cursor-pointer"
                    >
                      + Add New Garment
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("colors")}
                      className="rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-3 text-left font-bold hover:border-[#9E2A2B] cursor-pointer"
                    >
                      Theme Colors & Fonts
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("orders")}
                      className="rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-3 text-left font-bold hover:border-[#9E2A2B] cursor-pointer"
                    >
                      Manage Orders ({stats.pendingOrders} pending)
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-[#141413]">
                      Recent Store & CMS Activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab("activity")}
                      className="text-[#9E2A2B] font-semibold hover:underline cursor-pointer"
                    >
                      Full Audit Log →
                    </button>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {auditLogs.slice(0, 7).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between border-b border-[#F2EDE4] pb-1.5"
                      >
                        <div>
                          <span className="font-semibold text-[#141413]">{log.action}</span>{" "}
                          <span className="text-[#5D574F]">· {log.target}</span>
                        </div>
                        <span className="text-[11px] text-[#8D857B]">{log.actor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. LIVE VISUAL WEBSITE EDITOR */}
          {tab === "visual-editor" && (
            <AdminVisualEditor
              cmsDraft={cmsDraft}
              cmsPublished={cmsPublished}
              hasUnpublishedDraft={hasUnpublishedDraft}
              stores={businesses}
              products={products}
              categories={categories}
              reviews={reviews}
              currentUser={currentUser || null}
              savingDraft={savingDraft}
              publishing={publishing}
              onChangeDraft={setCmsDraft}
              onSaveDraft={handleSaveDraft}
              onPublishLive={() => handlePublishLive(publishNote)}
              onDiscardDraft={() => {
                setCmsDraft(cmsPublished);
                onShowToast("Reverted unsaved editor changes back to live published version.");
              }}
              onOpenImagePicker={openImagePicker}
              onShowToast={onShowToast}
            />
          )}

          {/* 3. MEDIA & IMAGE LIBRARY */}
          {tab === "media" && (
            <AdminMediaLibrary
              mediaAssets={mediaAssets}
              authToken={authToken}
              onRefreshMedia={loadAllAdminData}
              onUploadFile={uploadImageFile}
              onShowToast={onShowToast}
            />
          )}

          {/* 4. DESIGN & CUSTOMIZATION PANELS */}
          {designTabs.has(tab) && (
            <AdminDesignPanels
              activeSection={tab as DesignPanelTab}
              cmsDraft={cmsDraft}
              authToken={authToken}
              onChangeDraft={setCmsDraft}
              onSaveDraft={handleSaveDraft}
              onRequestPublish={() => setConfirmPublishModal(true)}
              onOpenImagePicker={openImagePicker}
              onUploadFile={uploadImageFile}
              onShowToast={onShowToast}
            />
          )}

          {/* 5. SYSTEM, CONTENT, RBAC, VERSIONS & BACKUP PANELS */}
          {systemTabs.has(tab) && (
            <AdminSystemPanels
              activeSection={tab as SystemPanelTab}
              authToken={authToken}
              cmsDraft={cmsDraft}
              pages={pages}
              versions={versions}
              adminUsers={adminUsers}
              auditLogs={auditLogs}
              notifications={notifications}
              contactMessages={contactMessages}
              onChangeDraft={setCmsDraft}
              onSaveDraft={handleSaveDraft}
              onRequestPublish={() => setConfirmPublishModal(true)}
              onRefreshAdminData={loadAllAdminData}
              onVersionRestored={(restoredCms) => {
                setCmsDraft(restoredCms);
                setCmsPublished(restoredCms);
                onUpdateCms(restoredCms);
                onPublishCms(restoredCms);
              }}
              onNavigateTab={(target) => setTab(target as AdminTab)}
              onOpenImagePicker={openImagePicker}
              onShowToast={onShowToast}
            />
          )}

          {/* 6. PRODUCTS MANAGER */}
          {tab === "products" && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E1D8] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product name, SKU, subcategory..."
                    className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 min-w-[220px]"
                  />
                  <select
                    value={productCatFilter}
                    onChange={(e) => setProductCatFilter(e.target.value)}
                    className="rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 font-medium"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={openCreateProduct}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>

              <div className="rounded-2xl border border-[#E7E1D8] bg-white overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#E7E1D8] bg-[#FAF8F5] text-[11px] uppercase tracking-wider text-[#5D574F]">
                    <tr>
                      <th className="p-3.5">Garment</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Sizes</th>
                      <th className="p-3.5">Price</th>
                      <th className="p-3.5">Stock</th>
                      <th className="p-3.5">Visibility</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EDE4]">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF8F5]/60">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.primaryImage}
                              alt={p.name}
                              className="h-12 w-10 rounded-lg object-cover border border-[#E7E1D8] shrink-0"
                            />
                            <div>
                              <p className="font-bold text-[#141413]">{p.name}</p>
                              <p className="text-[11px] text-[#8D857B] font-mono">{p.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-[#141413]">{p.category}</p>
                          <p className="text-[11px] text-[#8E6B35]">{p.subcategory}</p>
                        </td>
                        <td className="p-3.5 text-[#5D574F]">{(p.sizes || []).join(", ")}</td>
                        <td className="p-3.5 tabular-nums">
                          <p className="font-bold text-[#141413]">
                            {formatPKR(p.discount_price || p.selling_price)}
                          </p>
                          {p.discount_price && (
                            <p className="text-[11px] text-[#8D857B] line-through">
                              {formatPKR(p.selling_price)}
                            </p>
                          )}
                        </td>
                        <td className="p-3.5 tabular-nums font-semibold">
                          <span className={p.stock <= 5 ? "text-rose-700" : "text-emerald-700"}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleProductPublish(p)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                              p.published
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {p.published ? "Published" : "Hidden"}
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditProduct(p)}
                              className="rounded-lg border border-[#DFD8CE] p-1.5 hover:bg-[#FAF8F5] cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(p.id)}
                              className="rounded-lg border border-[#DFD8CE] p-1.5 hover:bg-[#FAF8F5] cursor-pointer"
                              title="Duplicate"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. CATEGORIES MANAGER */}
          {tab === "categories" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-2xl border border-[#E7E1D8] bg-white p-4">
                <div>
                  <h2 className="font-display text-base font-bold text-[#141413]">
                    Fashion Categories & Subcategories ({categories.length})
                  </h2>
                  <p className="text-[#5D574F]">
                    Reorder collections, pick category imagery from Media Library, and manage subcategories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateCat}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Category
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex gap-4 items-start justify-between"
                  >
                    <div className="flex gap-3.5 min-w-0">
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="h-16 w-16 rounded-xl object-cover border border-[#E7E1D8] shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-base font-bold text-[#141413] truncate">
                            {cat.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => onOpenCategorySlug(cat.slug)}
                            className="text-[11px] font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                          >
                            /{cat.slug}
                          </button>
                        </div>
                        <p className="text-[#5D574F] line-clamp-2">{cat.description}</p>
                        <p className="text-[11px] text-[#8E6B35]">
                          Subcategories: {(cat.subcategories || []).join(" · ") || "None"}
                        </p>
                        <p className="text-[11px] text-[#8D857B] tabular-nums">
                          {cat.product_count ?? 0} product(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCategory(idx, -1)}
                          className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === categories.length - 1}
                          onClick={() => handleMoveCategory(idx, 1)}
                          className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditCat(cat)}
                          className="rounded border border-[#DFD8CE] p-1 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteCatTarget(cat);
                            setReassignTargetId(categories.find((c) => c.id !== cat.id)?.id || "");
                          }}
                          className="rounded border border-rose-200 p-1 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. ORDERS & INVOICES */}
          {tab === "orders" && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E1D8] bg-white p-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "All",
                    "Pending",
                    "Accepted",
                    "Preparing",
                    "Dispatched",
                    "Delivered",
                    "Cancelled",
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderFilter(st)}
                      className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                        orderFilter === st
                          ? "bg-[#141413] text-white"
                          : "bg-[#FAF8F5] text-[#5D574F]"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order #, customer, phone..."
                  className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 min-w-[220px]"
                />
              </div>

              <div className="space-y-3">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDE4] pb-3">
                      <div>
                        <p className="font-display text-base font-bold text-[#141413]">
                          {ord.order_number} · {ord.customer_name}
                        </p>
                        <p className="text-[#5D574F]">
                          {new Date(ord.created_at).toLocaleString()} · {ord.customer_phone} ·{" "}
                          {ord.delivery_address}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={ord.order_status}
                          onChange={(e) =>
                            handleUpdateOrder(ord.id, e.target.value, ord.payment_status)
                          }
                          className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-2.5 py-1.5 font-semibold"
                        >
                          {[
                            "Pending",
                            "Accepted",
                            "Preparing",
                            "Dispatched",
                            "Delivered",
                            "Cancelled",
                            "Rejected",
                          ].map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>

                        <select
                          value={ord.payment_status}
                          onChange={(e) =>
                            handleUpdateOrder(ord.id, ord.order_status, e.target.value)
                          }
                          className="rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5 font-semibold"
                        >
                          <option value="PENDING_COD">Pending COD</option>
                          <option value="PENDING_PROVIDER">Pending Verification</option>
                          <option value="SETTLED">Paid / Settled</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setInvoiceOrder(ord)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#141413] px-3 py-1.5 font-semibold text-white hover:bg-[#9E2A2B] cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Invoice
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {ord.items.map((it) => (
                          <span
                            key={it.id}
                            className="rounded-lg bg-[#FAF8F5] border border-[#E7E1D8] px-2.5 py-1"
                          >
                            {it.product_name} ({it.variant_label}) × {it.quantity}
                          </span>
                        ))}
                      </div>
                      <span className="text-base font-extrabold tabular-nums text-[#141413]">
                        {formatPKR(ord.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. CUSTOMERS MANAGER */}
          {tab === "customers" && (
            <div className="space-y-4 text-xs">
              <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-[#141413]">
                    Registered Customers ({filteredCustomers.length})
                  </h2>
                  <p className="text-[#5D574F]">
                    View customer purchase totals and activate or suspend storefront accounts.
                  </p>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customer name, email, phone..."
                  className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 min-w-[240px]"
                />
              </div>

              <div className="rounded-2xl border border-[#E7E1D8] bg-white overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#E7E1D8] bg-[#FAF8F5] text-[11px] uppercase tracking-wider text-[#5D574F]">
                    <tr>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Contact</th>
                      <th className="p-3.5">Orders</th>
                      <th className="p-3.5">Total Spent</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EDE4]">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id}>
                        <td className="p-3.5 font-bold text-[#141413]">{c.full_name}</td>
                        <td className="p-3.5 text-[#5D574F]">
                          {c.email || "—"} {c.mobile ? `· ${c.mobile}` : ""}
                        </td>
                        <td className="p-3.5 tabular-nums">{c.order_count}</td>
                        <td className="p-3.5 tabular-nums font-bold">
                          {formatPKR(c.total_spent)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                              c.status === "active"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const next = c.status === "active" ? "suspended" : "active";
                              await fetch(`/api/admin/users/${encodeURIComponent(c.id)}`, {
                                method: "PATCH",
                                headers: authHeaders,
                                body: JSON.stringify({ status: next }),
                              });
                              loadAllAdminData();
                            }}
                            className="rounded-lg border border-[#DFD8CE] px-3 py-1 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                          >
                            {c.status === "active" ? "Suspend" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10. STORE SETTINGS */}
          {tab === "settings" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmPublishModal(true);
              }}
              className="space-y-5 text-xs"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 space-y-3">
                  <h2 className="font-display text-lg font-bold text-[#141413]">
                    Store Identity, Address & Contact
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Store Name</label>
                      <input
                        type="text"
                        value={cmsDraft.storeSettings.storeName}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            brandName: e.target.value,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              storeName: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Tagline</label>
                      <input
                        type="text"
                        value={cmsDraft.storeSettings.tagline}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            tagline: e.target.value,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              tagline: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">City / Region</label>
                    <input
                      type="text"
                      value={cmsDraft.storeSettings.cityLocation}
                      onChange={(e) =>
                        setCmsDraft({
                          ...cmsDraft,
                          storeSettings: {
                            ...cmsDraft.storeSettings,
                            cityLocation: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Street Address</label>
                    <input
                      type="text"
                      value={cmsDraft.storeSettings.address}
                      onChange={(e) =>
                        setCmsDraft({
                          ...cmsDraft,
                          storeSettings: {
                            ...cmsDraft.storeSettings,
                            address: e.target.value,
                          },
                        })
                      }
                      placeholder="Enter shop number / bazaar in Mithi, Tharparkar"
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={cmsDraft.storeSettings.phone}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              phone: e.target.value,
                            },
                          })
                        }
                        placeholder="+92 ..."
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">WhatsApp Number</label>
                      <input
                        type="text"
                        value={cmsDraft.storeSettings.whatsapp}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              whatsapp: e.target.value,
                            },
                          })
                        }
                        placeholder="+92 ..."
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Store Email</label>
                      <input
                        type="email"
                        value={cmsDraft.storeSettings.email}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              email: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Opening Hours</label>
                      <input
                        type="text"
                        value={cmsDraft.storeSettings.openingHours}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              openingHours: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Mon–Sun, 10 AM – 10 PM"
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Google Maps Embed URL</label>
                    <input
                      type="text"
                      value={cmsDraft.storeSettings.googleMapsEmbedUrl}
                      onChange={(e) =>
                        setCmsDraft({
                          ...cmsDraft,
                          storeSettings: {
                            ...cmsDraft.storeSettings,
                            googleMapsEmbedUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://www.google.com/maps/embed?..."
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 space-y-3">
                  <h2 className="font-display text-lg font-bold text-[#141413]">
                    Delivery, Payments & Social Links
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Delivery Fee (PKR)</label>
                      <input
                        type="number"
                        value={cmsDraft.storeSettings.deliveryFee}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              deliveryFee: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Free Shipping Over (PKR)</label>
                      <input
                        type="number"
                        value={cmsDraft.storeSettings.freeDeliveryThreshold}
                        onChange={(e) =>
                          setCmsDraft({
                            ...cmsDraft,
                            storeSettings: {
                              ...cmsDraft.storeSettings,
                              freeDeliveryThreshold: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="block font-semibold">Enabled Checkout Payment Methods</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: "cod", label: "Cash on Delivery (COD)" },
                          { key: "jazzcash", label: "JazzCash" },
                          { key: "easypaisa", label: "Easypaisa" },
                          { key: "bankTransfer", label: "Bank Transfer" },
                        ] as const
                      ).map((pm) => (
                        <label key={pm.key} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cmsDraft.storeSettings.paymentMethods[pm.key]}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                storeSettings: {
                                  ...cmsDraft.storeSettings,
                                  paymentMethods: {
                                    ...cmsDraft.storeSettings.paymentMethods,
                                    [pm.key]: e.target.checked,
                                  },
                                },
                              })
                            }
                          />
                          {pm.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["facebook", "instagram", "tiktok", "youtube"] as const).map((soc) => (
                      <div key={soc}>
                        <label className="block font-semibold mb-1 capitalize">{soc} URL</label>
                        <input
                          type="text"
                          value={cmsDraft.storeSettings.socialLinks?.[soc] || ""}
                          onChange={(e) =>
                            setCmsDraft({
                              ...cmsDraft,
                              storeSettings: {
                                ...cmsDraft.storeSettings,
                                socialLinks: {
                                  ...cmsDraft.storeSettings.socialLinks,
                                  [soc]: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder={`https://${soc}.com/...`}
                          className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#141413] py-3 font-bold text-[#141413] cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#9E2A2B] py-3 font-bold text-white hover:bg-[#141413] cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      Save & Publish Settings
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* REUSABLE IMAGE PICKER MODAL */}
      {pickerState && (
        <ImagePickerModal
          open={pickerState.open}
          title={pickerState.title}
          mediaAssets={mediaAssets}
          defaultCategory={pickerState.category}
          onClose={() => setPickerState(null)}
          onSelect={pickerState.onSelect}
          onUploadFile={uploadImageFile}
        />
      )}

      {/* CONFIRM PUBLISH LIVE MODAL */}
      {confirmPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                Publish Storefront Updates Live?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmPublishModal(false)}
                className="cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[#5D574F] leading-relaxed">
              Every visual, typography, color, layout, and store setting change in your draft will immediately become visible on the public THAR STYLE website, and a restorable version snapshot will be saved.
            </p>
            <div>
              <label className="block font-semibold mb-1">Version Snapshot Label (Optional)</label>
              <input
                type="text"
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                placeholder="e.g. Festive Eid Theme Update"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPublishModal(false)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={() => handlePublishLive(publishNote)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-5 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {publishing ? "Publishing..." : "Confirm & Publish Live"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT CREATE / EDIT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                {editingProductId ? "Edit Garment" : "Add New Garment"}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Product Name *</label>
                <input
                  required
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">SKU</label>
                <input
                  type="text"
                  value={pSku}
                  onChange={(e) => setPSku(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Category *</label>
                <select
                  value={pCategorySlug}
                  onChange={(e) => {
                    const nextSlug = e.target.value;
                    setPCategorySlug(nextSlug);
                    const cat = categories.find((c) => c.slug === nextSlug);
                    setPSubcategory(cat?.subcategories?.[0] || "");
                  }}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Subcategory</label>
                <input
                  list="subcat-suggestions"
                  type="text"
                  value={pSubcategory}
                  onChange={(e) => setPSubcategory(e.target.value)}
                  placeholder="e.g. Kurtas, Lawn Suits, Sindhi Ajrak"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
                <datalist id="subcat-suggestions">
                  {(selectedCatForProduct?.subcategories || []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold mb-1">Regular Price (PKR) *</label>
                <input
                  required
                  type="number"
                  value={pSellingPrice}
                  onChange={(e) => setPSellingPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sale Price (Optional)</label>
                <input
                  type="number"
                  value={pDiscountPrice}
                  onChange={(e) => setPDiscountPrice(e.target.value)}
                  placeholder="Leave blank"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Cost Price</label>
                <input
                  type="number"
                  value={pCostPrice}
                  onChange={(e) => setPCostPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Stock Quantity</label>
                <input
                  type="number"
                  value={pStock}
                  onChange={(e) => setPStock(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Description</label>
              <textarea
                rows={2}
                value={pDescription}
                onChange={(e) => setPDescription(e.target.value)}
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold">Available Sizes</label>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((sz) => {
                  const selected = pSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() =>
                        setPSizes((prev) =>
                          prev.includes(sz) ? prev.filter((x) => x !== sz) : [...prev, sz]
                        )
                      }
                      className={`rounded border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                        selected ? "border-[#141413] bg-[#141413] text-white" : "border-[#DFD8CE]"
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={pCustomSize}
                  onChange={(e) => setPCustomSize(e.target.value)}
                  placeholder="Add custom size..."
                  className="rounded-lg border border-[#DFD8CE] px-2.5 py-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (pCustomSize.trim() && !pSizes.includes(pCustomSize.trim())) {
                      setPSizes([...pSizes, pCustomSize.trim()]);
                      setPCustomSize("");
                    }
                  }}
                  className="rounded-lg border border-[#DFD8CE] px-2.5 py-1 font-semibold cursor-pointer"
                >
                  Add Size
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Colors (comma separated)</label>
                <input
                  type="text"
                  value={pColorsInput}
                  onChange={(e) => setPColorsInput(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Fabric Spec</label>
                <input
                  type="text"
                  value={pFabric}
                  onChange={(e) => setPFabric(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Season</label>
                <input
                  type="text"
                  value={pSeason}
                  onChange={(e) => setPSeason(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <input
                  type="checkbox"
                  checked={pPublished}
                  onChange={(e) => setPPublished(e.target.checked)}
                />
                Published
              </label>
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <input
                  type="checkbox"
                  checked={pIsNew}
                  onChange={(e) => setPIsNew(e.target.checked)}
                />
                New Arrival
              </label>
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <input
                  type="checkbox"
                  checked={pIsBestSeller}
                  onChange={(e) => setPIsBestSeller(e.target.checked)}
                />
                Best Seller
              </label>
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <input
                  type="checkbox"
                  checked={pIsFeatured}
                  onChange={(e) => setPIsFeatured(e.target.checked)}
                />
                Featured
              </label>
            </div>

            {/* Product Gallery with Media Library + Upload */}
            <div className="space-y-2 border-t border-[#F2EDE4] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Product Gallery Photos</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openImagePicker(
                        (url) =>
                          setPImages((prev) => [...prev, { url, isPrimary: prev.length === 0 }]),
                        "Products",
                        "Pick Product Photo from Media Library"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1 font-semibold cursor-pointer hover:bg-[#FAF8F5]"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Choose from Media Library
                  </button>
                  <label className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1 font-semibold cursor-pointer hover:bg-[#FAF8F5]">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadImageFile(f, "Products", pName || f.name);
                        if (url) {
                          setPImages((prev) => [...prev, { url, isPrimary: prev.length === 0 }]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {pImages.map((im, idx) => (
                  <div
                    key={`${im.url}-${idx}`}
                    className="relative h-20 w-16 rounded-lg overflow-hidden border border-[#E7E1D8]"
                  >
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setPImages((prev) =>
                          prev
                            .filter((_, i) => i !== idx)
                            .map((x, i) => ({ ...x, isPrimary: i === 0 }))
                        )
                      }
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-5 py-2 font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {savingProduct ? "Saving..." : "Save Garment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <form
            onSubmit={handleSaveCategory}
            className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-3 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-2.5">
              <h3 className="font-display text-lg font-bold">
                {editingCatId ? "Edit Category" : "Add Category"}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Name *</label>
                <input
                  required
                  type="text"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">URL Slug</label>
                <input
                  type="text"
                  value={cSlug}
                  onChange={(e) => setCSlug(e.target.value)}
                  placeholder="auto-generated"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Description</label>
              <textarea
                rows={2}
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Subcategories (comma separated)</label>
              <input
                type="text"
                value={cSubsText}
                onChange={(e) => setCSubsText(e.target.value)}
                placeholder="Shirts, Kurtas, Waistcoats, Shalwar Kameez"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={cImage}
                alt=""
                className="h-14 w-14 rounded-lg object-cover border border-[#E7E1D8]"
              />
              <button
                type="button"
                onClick={() =>
                  openImagePicker(
                    (url) => setCImage(url),
                    "Collections",
                    "Pick Category Image"
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Media Library
              </button>
              <label className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadImageFile(f, "Collections", cName || f.name);
                    if (url) setCImage(url);
                  }}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#141413] px-5 py-2 font-bold text-white cursor-pointer"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SAFE CATEGORY DELETE MODAL */}
      {deleteCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#141413]">
              Delete “{deleteCatTarget.name}”?
            </h3>
            {(deleteCatTarget.product_count ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-[#5D574F]">
                  This category contains <strong>{deleteCatTarget.product_count}</strong> product(s).
                  Select another category to safely reassign them before deletion:
                </p>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                >
                  {categories
                    .filter((c) => c.id !== deleteCatTarget.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="text-[#5D574F]">
                This category has no products and will be removed permanently.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCatTarget(null)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCat}
                className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE ORDER INVOICE MODAL */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E7E1D8] pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#141413]">
                  {cmsDraft.brandName || "THAR STYLE"}
                </h2>
                <p className="text-xs text-[#8E6B35]">
                  {cmsDraft.storeSettings.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"}
                </p>
                {cmsDraft.storeSettings.phone && (
                  <p className="text-xs text-[#5D574F]">Phone: {cmsDraft.storeSettings.phone}</p>
                )}
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-[#141413]">Invoice #{invoiceOrder.order_number}</p>
                <p className="text-[#5D574F]">
                  {new Date(invoiceOrder.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="text-xs space-y-1">
              <p>
                <strong>Customer:</strong> {invoiceOrder.customer_name} (
                {invoiceOrder.customer_phone})
              </p>
              <p>
                <strong>Delivery Address:</strong> {invoiceOrder.delivery_address}
              </p>
              <p>
                <strong>Payment:</strong> {invoiceOrder.payment_method} (
                {invoiceOrder.payment_status})
              </p>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E7E1D8] text-left text-[#5D574F]">
                  <th className="py-2">Garment</th>
                  <th>Variant</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EDE4]">
                {invoiceOrder.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 font-semibold">{it.product_name}</td>
                    <td className="text-[#5D574F]">{it.variant_label}</td>
                    <td className="text-right tabular-nums">{it.quantity}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatPKR(it.unit_price * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-[#E7E1D8] pt-3 text-xs space-y-1 text-right tabular-nums">
              <p>Subtotal: {formatPKR(invoiceOrder.subtotal)}</p>
              <p>Delivery Fee: {formatPKR(invoiceOrder.delivery_fee)}</p>
              <p className="text-base font-extrabold text-[#141413]">
                Grand Total: {formatPKR(invoiceOrder.total)}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 no-print">
              <button
                type="button"
                onClick={() => setInvoiceOrder(null)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
