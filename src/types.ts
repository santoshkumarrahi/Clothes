export type Language = "en" | "ur";

export type IndustryType =
  | "kiryana"
  | "pharmacy"
  | "electronics"
  | "clothing"
  | "restaurant"
  | "wholesale";

export type NavTab =
  | "dashboard"
  | "pos"
  | "sales"
  | "purchases"
  | "inventory"
  | "khata"
  | "customers"
  | "suppliers"
  | "accounting"
  | "payments"
  | "ai-assistant"
  | "reports"
  | "employees"
  | "branches"
  | "settings"
  | "online-products"
  | "online-orders"
  | "store-settings"
  | "super-admin";

export type PlanTier = "Starter" | "Business" | "Professional" | "Enterprise";

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  manager: string;
  monthlySales: number;
  stockValue: number;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  urduName?: string;
  category: string;
  unit: string;
  costPrice: number;
  wholesalePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  maxStock: number;
  branchId: string;
  batchNo?: string;
  expiryDate?: string;
  genericName?: string;
  requiresPrescription?: boolean;
  imeiRequired?: boolean;
  warrantyMonths?: number;
  size?: string;
  color?: string;
  designCode?: string;
  prepTimeMins?: number;
  moq?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  category: "Retail" | "Wholesale" | "VIP";
  khataBalance: number;
  creditLimit: number;
  overdueDays: number;
  loyaltyPoints: number;
  lastPurchaseDate: string;
  whatsappConsent: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  city: string;
  payableBalance: number;
  rating: number;
  leadTimeDays: number;
  categories: string[];
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  imeiOrBatch?: string;
}

export interface TransactionRecord {
  id: string;
  idempotencyKey: string;
  type: "Sale" | "Payment" | "Purchase" | "Expense" | "Return";
  title: string;
  subtitle: string;
  amount: number;
  costAmount?: number;
  paymentMethod: "Cash" | "Udhaar" | "Raast QR" | "JazzCash" | "Easypaisa" | "Bank" | "Split";
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  branchId: string;
  items?: SaleItem[];
  status: "Completed" | "Pending Sync" | "Pending Provider" | "Reversed";
  createdAt: string;
  notes?: string;
  reversedRefId?: string;
}

export interface PaymentRequest {
  id: string;
  method: "Raast P2M QR" | "JazzCash" | "Easypaisa" | "Bank Transfer" | "Card";
  amount: number;
  customerName: string;
  reference: string;
  status: "PENDING_PROVIDER" | "SETTLED" | "FAILED";
  createdAt: string;
  settledAt?: string;
  providerTrace?: string;
}

export interface SyncEvent {
  idempotencyKey: string;
  type: "SALE" | "PAYMENT" | "EXPENSE" | "STOCK_ADJUSTMENT" | "PURCHASE";
  summary: string;
  amount: number;
  createdAt: string;
  status: "PENDING" | "SYNCED" | "FAILED";
}

export interface EmployeeRecord {
  id: string;
  name: string;
  role: "Owner" | "Branch Manager" | "Accountant" | "Cashier" | "Inventory Manager" | "Salesperson";
  branchName: string;
  phone: string;
  active: boolean;
  permissions: {
    viewSales: boolean;
    createSales: boolean;
    viewProfit: boolean;
    manageStock: boolean;
    approveRefunds: boolean;
    exportReports: boolean;
    manageEmployees: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  severity: "info" | "warning" | "critical";
}

export interface AIRecommendation {
  id: string;
  agent: string;
  title: string;
  summary: string;
  actionLabel: string;
  confidence: number;
  dataPeriod: string;
  assumption: string;
  suggestedActionType: "PO" | "KHATA_REMINDER" | "EXPIRY_CHECK" | "PRICE_REVIEW";
  payload?: {
    productId?: string;
    productName?: string;
    quantity?: number;
    estimatedCost?: number;
    customerId?: string;
  };
  status: "pending" | "approved" | "dismissed";
}

export interface TenantProfile {
  id: string;
  businessName: string;
  ownerName: string;
  city: string;
  address: string;
  phone: string;
  industry: IndustryType;
  plan: PlanTier;
  planValidTill: string;
  activeModules: string[];
  branches: Branch[];
  activeBranchId: string;
}

export interface SaasTenantRecord {
  id: string;
  businessName: string;
  ownerName: string;
  city: string;
  industry: IndustryType;
  plan: PlanTier;
  branchesCount: number;
  status: "Active" | "Pending Approval" | "Suspended";
  mrr: number;
  joinedDate: string;
  aiCallsThisMonth: number;
}

export interface SubscriptionPlanConfig {
  tier: PlanTier;
  audience: string;
  monthlyPricePkr: number;
  annualPricePkr: number;
  branchLimit: number;
  userLimit: number;
  aiQueriesLimit: number;
  storageLimitGb: number;
  includedModules: string[];
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  mobileImageUrl?: string;
  focalPoint?: "center" | "top" | "bottom" | "left" | "right";
  objectFit?: "cover" | "contain";
  posX?: number;
  posY?: number;
  zoomPercent?: number;
  overlayOpacity?: number;
  textAlign?: "left" | "center" | "right";
  primaryCtaText: string;
  primaryCtaHref: string;
  secondaryCtaText: string;
  secondaryCtaHref: string;
  enabled: boolean;
  sortOrder: number;
}

export interface HeroSettingsConfig {
  heightDesktopPx: number;
  heightTabletPx?: number;
  heightMobilePx: number;
  widthMode?: "full" | "contained";
  maxWidthPct?: number;
  autoSlide: boolean;
  slideDurationMs: number;
  transitionEffect: "fade" | "slide" | "zoom";
}

export interface HeritageCollectionCard {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
}

export type HomepageSectionKey =
  | "categories"
  | "men_latest"
  | "women_latest"
  | "kids_fashion"
  | "young_fashion"
  | "sindhi_thari"
  | "ajrak_topi_special"
  | "new_arrivals"
  | "best_sellers"
  | "sale_offers"
  | "featured_products"
  | "why_shop_with_us"
  | "reviews"
  | "newsletter"
  | "custom";

export interface HomepageSectionConfig {
  id: string;
  key: HomepageSectionKey;
  title: string;
  subtitle: string;
  enabled: boolean;
  sortOrder: number;
  imageUrl?: string;
  backgroundColor?: string;
  ctaText?: string;
  ctaHref?: string;
  productTag?: "all" | "new" | "best" | "sale" | "featured" | "men" | "women" | "kids" | "young" | "sindhi" | "ajrak";
  collectionCards?: HeritageCollectionCard[];
  isSystem?: boolean;
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  subcategories: string[];
  sort_order: number;
  published: boolean;
  featured: boolean;
  product_count?: number;
  store_count?: number;
}

export interface StoreSettingsConfig {
  storeName: string;
  tagline: string;
  cityLocation: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  openingHours: string;
  googleMapsEmbedUrl: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  currency: string;
  returnPolicy: string;
  privacyPolicy: string;
  termsPolicy: string;
  aboutStory: string;
  paymentMethods: {
    cod: boolean;
    jazzcash: boolean;
    easypaisa: boolean;
    bankTransfer: boolean;
  };
  socialLinks: {
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
}

export interface LogoSettingsConfig {
  mainLogoUrl: string;
  headerLogoUrl: string;
  footerLogoUrl: string;
  mobileLogoUrl: string;
  faviconUrl: string;
  adminLogoUrl: string;
  socialShareImageUrl: string;
  logoWidthPx: number;
  logoHeightPx: number;
  logoAlignment: "left" | "center";
  logoPresentation: "transparent" | "boxed";
}

export interface ThemeColorsConfig {
  // Header
  headerBg: string;
  headerText: string;
  headerIcon: string;
  headerBorder: string;
  // Navigation
  navbarBg: string;
  navbarText: string;
  navbarHover: string;
  navbarActive: string;
  dropdownBg: string;
  dropdownText: string;
  dropdownHover: string;
  // Hero
  heroOverlay: string;
  heroTitle: string;
  heroSubtitle: string;
  heroButtonBg: string;
  heroButtonText: string;
  // Body
  pageBg: string;
  sectionBg: string;
  cardBg: string;
  primaryText: string;
  secondaryText: string;
  borderColor: string;
  // Buttons
  primaryButtonBg: string;
  primaryButtonHover: string;
  secondaryButtonBg: string;
  secondaryButtonHover: string;
  buttonText: string;
  // Footer
  footerBg: string;
  footerHeading: string;
  footerText: string;
  footerLinks: string;
  footerLinkHover: string;
  footerBorder: string;
  // Other / Badges
  saleBadge: string;
  discountBadge: string;
  priceText: string;
  ratingStars: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
}

export interface TypographyRoleConfig {
  fontFamily: string;
  desktopSizePx: number;
  tabletSizePx: number;
  mobileSizePx: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  fontStyle: "normal" | "italic";
  color: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: "left" | "center" | "right";
  textTransform: "none" | "uppercase" | "capitalize";
  textDecoration: "none" | "underline";
}

export interface TypographySettingsConfig {
  primary: TypographyRoleConfig;
  heading: TypographyRoleConfig;
  body: TypographyRoleConfig;
  navigation: TypographyRoleConfig;
  button: TypographyRoleConfig;
  productTitle: TypographyRoleConfig;
  price: TypographyRoleConfig;
  footer: TypographyRoleConfig;
  customFonts: Array<{ id: string; name: string; url: string; format: string }>;
}

export interface AnnouncementItem {
  id: string;
  text: string;
  linkHref: string;
  textColor: string;
  bgColor: string;
  fontSizePx: number;
  fontWeight: "500" | "600" | "700";
  mode: "scroll" | "static";
  scrollDirection: "left" | "right";
  scrollSpeedSec: number;
  enabled: boolean;
  startDate: string;
  endDate: string;
  showOnDesktop: boolean;
  showOnMobile: boolean;
}

export interface AnimationEffectConfig {
  enabled: boolean;
  type: "fade" | "slide" | "scale" | "lift" | "none";
  durationMs: number;
  delayMs: number;
}

export interface AnimationSettingsConfig {
  heroTransition: AnimationEffectConfig;
  productCardHover: AnimationEffectConfig;
  imageZoom: AnimationEffectConfig;
  buttonHover: AnimationEffectConfig;
  scrollReveal: AnimationEffectConfig;
  sectionEntrance: AnimationEffectConfig;
  marqueeMotion: AnimationEffectConfig;
  pageTransition: AnimationEffectConfig;
}

export interface NavigationSettingsConfig {
  headerHeightPx: number;
  stickyHeader: boolean;
  showSearchIcon: boolean;
  showWishlistIcon: boolean;
  showCartIcon: boolean;
  showAccountIcon: boolean;
  mobileMenuStyle: "drawer" | "accordion";
}

export interface FooterColumnConfig {
  id: string;
  title: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface FooterSettingsConfig {
  visible: boolean;
  aboutText: string;
  logoSizePx: number;
  showPaymentIcons: boolean;
  copyrightText: string;
  columns: FooterColumnConfig[];
}

export interface SeoSettingsConfig {
  siteTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  canonicalBaseUrl: string;
  robotsIndex: boolean;
}

export interface CmsPageRecord {
  id: string;
  slug: string;
  title: string;
  heading: string;
  subtitle: string;
  bodyHtml: string;
  imageUrl: string;
  ctaText: string;
  ctaHref: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  isSystem?: boolean;
  updatedAt: string;
}

export interface CmsVersionRecord {
  id: string;
  versionNumber: number;
  status: "Draft" | "Published" | "Archived";
  label: string;
  publishedBy: string;
  createdAt: string;
}

export type AdminStaffRole =
  | "super_admin"
  | "website_manager"
  | "content_manager"
  | "product_manager"
  | "order_manager";

export type AdminPermissionKey =
  | "overview"
  | "visual_editor"
  | "hero_media"
  | "branding_nav_footer"
  | "colors_typography"
  | "marquee_animations"
  | "sections_pages"
  | "products_categories"
  | "orders_customers"
  | "settings_seo"
  | "users_logs_backup";

export interface AdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  status: "active" | "suspended";
  adminRole: AdminStaffRole;
  permissions: AdminPermissionKey[];
  createdAt: string;
}

export interface CmsConfig {
  brandName: string;
  tagline: string;
  headerLogoUrl?: string;
  footerLogoUrl?: string;
  faviconUrl?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroCtaText: string;
  heroImage: string;
  heroSlides: HeroSlide[];
  heroSettings: HeroSettingsConfig;
  slideDurationMs: number;
  sections: HomepageSectionConfig[];
  featuredStoreIds: string[];
  maxTrendingProducts: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pageBg?: string;
  buttonBg?: string;
  buttonTextColor?: string;
  navbarBg: string;
  navbarTextColor: string;
  footerBg: string;
  footerTextColor: string;
  headingFont:
    | "Playfair Display"
    | "Cormorant Garamond"
    | "Plus Jakarta Sans"
    | "Outfit"
    | "Bricolage Grotesque"
    | "Manrope";
  bodyFont: "Plus Jakarta Sans" | "DM Sans" | "Public Sans";
  urduFont?: "Noto Nastaliq Urdu" | "Gulzar" | "IBM Plex Sans Arabic";
  stickyHeader: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  announcements: AnnouncementItem[];
  logoSettings: LogoSettingsConfig;
  themeColors: ThemeColorsConfig;
  typography: TypographySettingsConfig;
  navigationSettings: NavigationSettingsConfig;
  footerSettings: FooterSettingsConfig;
  animationSettings: AnimationSettingsConfig;
  seoSettings: SeoSettingsConfig;
  navLinks: Array<{ id: string; label: string; href: string; visible: boolean; openInNewTab?: boolean }>;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    seoTitle: string;
    published: boolean;
    updatedAt: string;
  }>;
  footerCopyright: string;
  storeSettings: StoreSettingsConfig;
  versionNumber: number;
  status: "Published" | "Draft";
  lastPublishedAt?: string;
  lastPublishedBy?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  category: "Logos" | "Hero" | "Collections" | "Products" | "Content";
  url: string;
  dimensions: string;
  fileSize?: string;
  mimeType?: string;
  uploadDate: string;
  altText: string;
  usedIn: string[];
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: "customer" | "business_owner" | "super_admin";
  adminRole?: AdminStaffRole;
  permissions?: AdminPermissionKey[];
  emailVerified: boolean;
  mobileVerified: boolean;
  status: string;
}

export interface DbBusiness {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  whatsapp?: string;
  description: string;
  logo_url: string;
  cover_url: string;
  hours: string;
  online_store_enabled: number;
  approval_status: "approved" | "pending" | "suspended";
  plan: string;
  product_count?: number;
  order_count?: number;
  owner_name?: string;
  owner_email?: string;
}

export interface DbProductImage {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductReview {
  id: string;
  product_id: string;
  product_name?: string;
  customer_name: string;
  city?: string;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
}

export interface DbProduct {
  id: string;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  business_city?: string;
  sku: string;
  barcode: string;
  name: string;
  brand?: string;
  specs?: Record<string, string>;
  category: string;
  category_slug?: string;
  subcategory?: string;
  unit: string;
  description: string;
  cost_price: number;
  selling_price: number;
  discount_price: number | null;
  stock: number;
  min_stock: number;
  published: boolean;
  active: boolean;
  variants: string[];
  sizes: string[];
  colors: string[];
  is_new_arrival?: boolean;
  is_featured?: boolean;
  is_best_seller?: boolean;
  rating?: number;
  review_count?: number;
  images: DbProductImage[];
  primaryImage: string;
  updated_at: string;
}

export interface CartItem {
  product: DbProduct;
  quantity: number;
  variantLabel: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  city: string;
  street_address: string;
  is_default: number;
}

export interface DbOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_label: string;
  quantity: number;
  unit_price: number;
  image_url: string;
}

export interface DbOrderHistory {
  id: string;
  status: string;
  note: string;
  actor: string;
  created_at: string;
}

export interface DbOrder {
  id: string;
  order_number: string;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  payment_method: string;
  payment_status: string;
  order_status: "Pending" | "Accepted" | "Preparing" | "Dispatched" | "Delivered" | "Cancelled" | "Rejected";
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  created_at: string;
  items: DbOrderItem[];
  history: DbOrderHistory[];
}
