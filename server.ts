import express, { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import {
  ALL_ADMIN_PERMISSIONS,
  buildDefaultCmsConfig,
  db,
  hashPassword,
  initDatabase,
  syncNormalizedCmsTables,
  UPLOADS_DIR,
  verifyPassword,
} from "./db.ts";

dotenv.config();
initDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

// Track idempotent offline sync keys in-memory for the active session
const syncedIdempotencyKeys = new Set<string>();
const paymentRegistry = new Map<
  string,
  {
    id: string;
    method: string;
    amount: number;
    customerName: string;
    reference: string;
    status: "PENDING_PROVIDER" | "SETTLED" | "FAILED";
    createdAt: string;
    settledAt?: string;
  }
>();

// Basic rate limiter for auth routes
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    authAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 40) return false;
  entry.count += 1;
  return true;
}

interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  role: "customer" | "business_owner" | "super_admin";
  adminRole?: string;
  permissions?: string[];
  emailVerified: boolean;
  mobileVerified: boolean;
  status: string;
}

interface AuthedRequest extends Request {
  authUser?: AuthUser;
  authToken?: string;
}

function getAdminAccessForUser(userId: string, role: AuthUser["role"], fallbackAdminRole?: string) {
  if (role !== "super_admin") {
    return { adminRole: undefined, permissions: [] as string[] };
  }
  const row = db
    .prepare("SELECT admin_role, permissions_json FROM admin_permissions WHERE user_id = ?")
    .get(userId) as { admin_role: string; permissions_json: string } | undefined;

  const adminRole = row?.admin_role || fallbackAdminRole || "super_admin";
  if (adminRole === "super_admin") {
    return { adminRole: "super_admin", permissions: [...ALL_ADMIN_PERMISSIONS] as string[] };
  }
  let perms: string[] = [];
  try {
    const parsed = JSON.parse(row?.permissions_json || "[]");
    if (Array.isArray(parsed)) perms = parsed.map(String);
  } catch {
    perms = [];
  }
  return { adminRole, permissions: perms };
}

function getAuthUserFromRequest(req: Request): { user: AuthUser; token: string } | null {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie || "";
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    const match = cookieHeader.match(/(?:^|;\s*)ks_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.token, s.expires_at, u.id, u.full_name, u.email, u.mobile, u.role, u.admin_role, u.email_verified, u.mobile_verified, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | {
        token: string;
        expires_at: string;
        id: string;
        full_name: string;
        email: string | null;
        mobile: string | null;
        role: AuthUser["role"];
        admin_role?: string;
        email_verified: number;
        mobile_verified: number;
        status: string;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  const access = getAdminAccessForUser(row.id, row.role, row.admin_role);

  return {
    token,
    user: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile,
      role: row.role,
      adminRole: access.adminRole,
      permissions: access.permissions,
      emailVerified: Boolean(row.email_verified),
      mobileVerified: Boolean(row.mobile_verified),
      status: row.status,
    },
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = getAuthUserFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }
  if (session.user.status === "suspended") {
    return res.status(403).json({ error: "Account is suspended. Contact platform support." });
  }
  req.authUser = session.user;
  req.authToken = session.token;
  return next();
}

function requireRole(...roles: AuthUser["role"][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this resource." });
    }
    return next();
  };
}

function requirePermission(...anyOfPermissions: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.authUser.role !== "super_admin") {
      return res.status(403).json({ error: "Store Admin access required." });
    }
    if (req.authUser.adminRole === "super_admin") {
      return next();
    }
    const userPerms = req.authUser.permissions || [];
    const allowed = anyOfPermissions.some((p) => userPerms.includes(p));
    if (!allowed) {
      return res.status(403).json({
        error: `Access denied. Required permission: ${anyOfPermissions.join(" or ")}.`,
      });
    }
    return next();
  };
}

function createSession(userId: string, rememberMe = true): string {
  const token = crypto.randomBytes(32).toString("hex");
  const ttlMs = rememberMe ? 30 * 86400_000 : 86400_000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, expiresAt, new Date().toISOString());
  return token;
}

function writeAudit(actor: string, role: string, action: string, target: string, severity = "info") {
  db.prepare(
    "INSERT INTO audit_logs (id, actor, role, action, target, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(`aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, actor, role, action, target, severity, new Date().toISOString());
}

function getOwnedBusinesses(userId: string) {
  return db.prepare("SELECT * FROM businesses WHERE owner_id = ? ORDER BY created_at DESC").all(userId);
}

function sanitizeCmsHtml(rawHtml: string): string {
  return String(rawHtml || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function mergeCmsWithDefaults(rawCms: Record<string, unknown> | null) {
  const defaults = buildDefaultCmsConfig();
  if (!rawCms) return defaults;
  const rawSettings = (rawCms.storeSettings || {}) as Partial<typeof defaults.storeSettings>;
  const rawHeroSettings = (rawCms.heroSettings || {}) as Partial<typeof defaults.heroSettings>;
  const rawLogoSettings = (rawCms.logoSettings || {}) as Partial<typeof defaults.logoSettings>;
  const rawThemeColors = (rawCms.themeColors || {}) as Partial<typeof defaults.themeColors>;
  const rawTypography = (rawCms.typography || {}) as Partial<typeof defaults.typography>;
  const rawNavSettings = (rawCms.navigationSettings || {}) as Partial<typeof defaults.navigationSettings>;
  const rawFooterSettings = (rawCms.footerSettings || {}) as Partial<typeof defaults.footerSettings>;
  const rawAnimations = (rawCms.animationSettings || {}) as Partial<typeof defaults.animationSettings>;
  const rawSeo = (rawCms.seoSettings || {}) as Partial<typeof defaults.seoSettings>;

  return {
    ...defaults,
    ...rawCms,
    heroSlides: (
      Array.isArray(rawCms.heroSlides) && rawCms.heroSlides.length > 0
        ? (rawCms.heroSlides as Array<Record<string, unknown>>)
        : (defaults.heroSlides as unknown as Array<Record<string, unknown>>)
    ).map((sl) => ({
      ...sl,
      enabled: sl.enabled !== false,
      objectFit: (sl.objectFit as "cover" | "contain") || "cover",
      posX: Number(sl.posX ?? 50),
      posY: Number(sl.posY ?? (sl.focalPoint === "top" ? 16 : sl.focalPoint === "bottom" ? 85 : 50)),
      zoomPercent: Number(sl.zoomPercent ?? 100),
    })) as typeof defaults.heroSlides,
    heroSettings: {
      ...defaults.heroSettings,
      ...rawHeroSettings,
    },
    sections: (
      Array.isArray(rawCms.sections) && rawCms.sections.length > 0
        ? rawCms.sections
        : defaults.sections
    ).map((sec: Record<string, unknown>) => {
      if (sec.key === "sindhi_thari") {
        const defSindhi = defaults.sections.find((s) => s.key === "sindhi_thari");
        return {
          ...sec,
          ctaText: sec.ctaText || defSindhi?.ctaText || "Explore Collection",
          ctaHref: sec.ctaHref || defSindhi?.ctaHref || "/traditional-sindhi-collection",
          collectionCards:
            Array.isArray(sec.collectionCards) && sec.collectionCards.length > 0
              ? sec.collectionCards
              : defSindhi?.collectionCards || [],
        };
      }
      return sec;
    }),
    navLinks:
      Array.isArray(rawCms.navLinks) && rawCms.navLinks.length > 0
        ? rawCms.navLinks
        : defaults.navLinks,
    announcements:
      Array.isArray(rawCms.announcements) && rawCms.announcements.length > 0
        ? rawCms.announcements
        : defaults.announcements,
    pages:
      Array.isArray(rawCms.pages) && rawCms.pages.length > 0
        ? rawCms.pages
        : defaults.pages,
    featuredStoreIds: Array.isArray(rawCms.featuredStoreIds) ? rawCms.featuredStoreIds : [],
    maxTrendingProducts: Number(rawCms.maxTrendingProducts) || defaults.maxTrendingProducts,
    slideDurationMs: Number(rawHeroSettings.slideDurationMs || rawCms.slideDurationMs) || defaults.slideDurationMs,
    logoSettings: {
      ...defaults.logoSettings,
      ...rawLogoSettings,
    },
    themeColors: {
      ...defaults.themeColors,
      ...rawThemeColors,
    },
    typography: {
      primary: { ...defaults.typography.primary, ...(rawTypography.primary || {}) },
      heading: { ...defaults.typography.heading, ...(rawTypography.heading || {}) },
      body: { ...defaults.typography.body, ...(rawTypography.body || {}) },
      navigation: { ...defaults.typography.navigation, ...(rawTypography.navigation || {}) },
      button: { ...defaults.typography.button, ...(rawTypography.button || {}) },
      productTitle: { ...defaults.typography.productTitle, ...(rawTypography.productTitle || {}) },
      price: { ...defaults.typography.price, ...(rawTypography.price || {}) },
      footer: { ...defaults.typography.footer, ...(rawTypography.footer || {}) },
      customFonts: Array.isArray(rawTypography.customFonts)
        ? rawTypography.customFonts
        : defaults.typography.customFonts,
    },
    navigationSettings: {
      ...defaults.navigationSettings,
      ...rawNavSettings,
    },
    footerSettings: {
      ...defaults.footerSettings,
      ...rawFooterSettings,
      columns:
        Array.isArray(rawFooterSettings.columns) && rawFooterSettings.columns.length > 0
          ? rawFooterSettings.columns
          : defaults.footerSettings.columns,
    },
    animationSettings: {
      heroTransition: { ...defaults.animationSettings.heroTransition, ...(rawAnimations.heroTransition || {}) },
      productCardHover: { ...defaults.animationSettings.productCardHover, ...(rawAnimations.productCardHover || {}) },
      imageZoom: { ...defaults.animationSettings.imageZoom, ...(rawAnimations.imageZoom || {}) },
      buttonHover: { ...defaults.animationSettings.buttonHover, ...(rawAnimations.buttonHover || {}) },
      scrollReveal: { ...defaults.animationSettings.scrollReveal, ...(rawAnimations.scrollReveal || {}) },
      sectionEntrance: { ...defaults.animationSettings.sectionEntrance, ...(rawAnimations.sectionEntrance || {}) },
      marqueeMotion: { ...defaults.animationSettings.marqueeMotion, ...(rawAnimations.marqueeMotion || {}) },
      pageTransition: { ...defaults.animationSettings.pageTransition, ...(rawAnimations.pageTransition || {}) },
    },
    seoSettings: {
      ...defaults.seoSettings,
      ...rawSeo,
    },
    storeSettings: {
      ...defaults.storeSettings,
      ...rawSettings,
      paymentMethods: {
        ...defaults.storeSettings.paymentMethods,
        ...(rawSettings.paymentMethods || {}),
      },
      socialLinks: {
        ...defaults.storeSettings.socialLinks,
        ...(rawSettings.socialLinks || {}),
      },
    },
  };
}

function getCmsConfigByKey(key: "public_cms" | "draft_cms") {
  const cmsRow = db.prepare("SELECT json_value FROM cms_state WHERE key = ?").get(key) as
    | { json_value: string }
    | undefined;
  let rawCms: Record<string, unknown> | null = null;
  try {
    rawCms = cmsRow ? (JSON.parse(cmsRow.json_value) as Record<string, unknown>) : null;
  } catch {
    rawCms = null;
  }
  return rawCms ? mergeCmsWithDefaults(rawCms) : null;
}

function getLiveCmsConfig() {
  return getCmsConfigByKey("public_cms") || mergeCmsWithDefaults(null);
}

function computeMediaAssetsWithUsage() {
  const cms = getLiveCmsConfig();
  const draftCms = getCmsConfigByKey("draft_cms");
  const mediaRows = db
    .prepare("SELECT * FROM media_assets ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;

  const cats = db.prepare("SELECT name, image_url FROM categories").all() as Array<{
    name: string;
    image_url: string;
  }>;
  const prodImgs = db
    .prepare(
      "SELECT pi.url, p.name FROM product_images pi JOIN products p ON p.id = pi.product_id"
    )
    .all() as Array<{ url: string; name: string }>;
  const pages = db.prepare("SELECT title, image_url FROM cms_pages").all() as Array<{
    title: string;
    image_url: string;
  }>;

  const findUsage = (url: string): string[] => {
    const used: string[] = [];
    const checkCms = (
      targetCms: {
        heroSlides: Array<Record<string, unknown>>;
        sections: Array<Record<string, unknown>>;
        logoSettings?: Record<string, unknown>;
        headerLogoUrl?: string;
        footerLogoUrl?: string;
        faviconUrl?: string;
        seoSettings?: Record<string, unknown>;
      },
      suffix = ""
    ) => {
      targetCms.heroSlides.forEach((sl) => {
        if (sl.imageUrl === url || sl.mobileImageUrl === url) {
          used.push(`Hero Slider: ${sl.title || sl.id}${suffix}`);
        }
      });
      targetCms.sections.forEach((sec) => {
        if (sec.imageUrl === url) used.push(`Section: ${sec.title}${suffix}`);
        if (Array.isArray(sec.collectionCards)) {
          (sec.collectionCards as Array<Record<string, unknown>>).forEach((card) => {
            if (card.imageUrl === url) {
              used.push(`Heritage Card: ${card.title || card.id}${suffix}`);
            }
          });
        }
      });
      const lg = targetCms.logoSettings;
      if (lg?.mainLogoUrl === url) used.push(`Main Logo${suffix}`);
      if (lg?.headerLogoUrl === url || targetCms.headerLogoUrl === url) used.push(`Header Logo${suffix}`);
      if (lg?.footerLogoUrl === url || targetCms.footerLogoUrl === url) used.push(`Footer Logo${suffix}`);
      if (lg?.mobileLogoUrl === url) used.push(`Mobile Logo${suffix}`);
      if (lg?.faviconUrl === url || targetCms.faviconUrl === url) used.push(`Favicon${suffix}`);
      if (lg?.adminLogoUrl === url) used.push(`Admin Logo${suffix}`);
      if (lg?.socialShareImageUrl === url || targetCms.seoSettings?.ogImageUrl === url) {
        used.push(`Social Share / SEO OG Image${suffix}`);
      }
    };
    checkCms(cms, "");
    if (draftCms) checkCms(draftCms, " (Draft)");
    cats.forEach((c) => {
      if (c.image_url === url) used.push(`Category: ${c.name}`);
    });
    prodImgs.forEach((pi) => {
      if (pi.url === url) used.push(`Product: ${pi.name}`);
    });
    pages.forEach((pg) => {
      if (pg.image_url === url) used.push(`Page: ${pg.title}`);
    });
    return Array.from(new Set(used));
  };

  return mediaRows.map((row) => {
    const url = String(row.url);
    return {
      id: String(row.id),
      name: String(row.name),
      category: String(row.category || "Content"),
      url,
      dimensions: String(row.dimensions || "Auto"),
      fileSize: String(row.file_size || ""),
      mimeType: String(row.mime_type || "image/jpeg"),
      uploadDate: String(row.created_at || "").slice(0, 10),
      altText: String(row.alt_text || ""),
      usedIn: findUsage(url),
    };
  });
}

function resolveCategoryMeta(categoryInput?: string, categorySlugInput?: string) {
  const bySlug = categorySlugInput
    ? (db.prepare("SELECT id, slug, name FROM categories WHERE lower(slug) = lower(?)").get(categorySlugInput.trim()) as
        | { id: string; slug: string; name: string }
        | undefined)
    : undefined;
  if (bySlug) return bySlug;

  const clean = (categoryInput || "").trim();
  if (!clean) return { id: "cat-men", slug: "men", name: "Men" };

  const byName = db
    .prepare("SELECT id, slug, name FROM categories WHERE lower(name) = lower(?) OR lower(slug) = lower(?)")
    .get(clean, clean) as { id: string; slug: string; name: string } | undefined;
  if (byName) return byName;

  const fallbackSlug = clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { id: "", slug: fallbackSlug, name: clean };
}

function parseJsonArray(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getPublishedCategoriesWithCounts() {
  const rows = db
    .prepare(
      `SELECT id, slug, name, description, image_url, subcategories_json, sort_order, published, featured
       FROM categories
       WHERE published = 1
       ORDER BY sort_order ASC, name ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const countStmt = db.prepare(
    `SELECT COUNT(*) as product_count, COUNT(DISTINCT p.business_id) as store_count
     FROM products p
     JOIN businesses b ON b.id = p.business_id
     WHERE p.published = 1 AND p.active = 1
       AND b.approval_status = 'approved' AND b.online_store_enabled = 1
       AND (lower(p.category_slug) = lower(?) OR lower(p.category) = lower(?))`
  );

  return rows.map((c) => {
    const counts = countStmt.get(String(c.slug), String(c.name)) as {
      product_count: number;
      store_count: number;
    };
    return {
      ...c,
      subcategories: parseJsonArray(c.subcategories_json),
      published: Boolean(c.published),
      featured: Boolean(c.featured),
      product_count: counts?.product_count || 0,
      store_count: counts?.store_count || 0,
    };
  });
}

type HydratedProduct = Record<string, unknown> & {
  published: boolean;
  active: boolean;
  brand: string;
  category_slug: string;
  subcategory: string;
  specs: Record<string, string>;
  variants: string[];
  sizes: string[];
  colors: string[];
  is_new_arrival: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  rating: number;
  review_count: number;
  images: Array<{ id: string; url: string; is_primary: boolean; sort_order: number }>;
  primaryImage: string;
};

function hydrateProducts(rows: Array<Record<string, unknown>>): HydratedProduct[] {
  const getImgs = db.prepare(
    "SELECT id, url, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC"
  );
  return rows.map((p) => {
    const images = getImgs.all(String(p.id)) as Array<{
      id: string;
      url: string;
      is_primary: number;
      sort_order: number;
    }>;
    const variants = parseJsonArray(p.variants_json);
    const sizes = parseJsonArray(p.sizes_json);
    const colors = parseJsonArray(p.colors_json);
    let specs: Record<string, string> = {};
    try {
      specs = JSON.parse(String(p.specs_json || "{}"));
    } catch {
      specs = {};
    }
    return {
      ...p,
      published: Boolean(p.published),
      active: Boolean(p.active),
      brand: String(p.brand || "THAR STYLE"),
      category_slug: String(p.category_slug || ""),
      subcategory: String(p.subcategory || ""),
      specs,
      variants,
      sizes: sizes.length > 0 ? sizes : variants,
      colors,
      is_new_arrival: Boolean(p.is_new_arrival),
      is_featured: Boolean(p.is_featured),
      is_best_seller: Boolean(p.is_best_seller),
      rating: Number(p.rating || 4.8),
      review_count: Number(p.review_count || 0),
      images: images.map((im) => ({ ...im, is_primary: Boolean(im.is_primary) })),
      primaryImage: images[0]?.url || "/src/assets/images/prod_women_suit_1794818535930.jpg",
    };
  });
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

app.post("/api/auth/register", (req, res) => {
  if (!checkRateLimit(req.ip || "local")) {
    return res.status(429).json({ error: "Too many attempts. Please wait a minute." });
  }

  const {
    fullName,
    method,
    email,
    countryCode,
    mobile,
    password,
    accountType,
    acceptTerms,
  } = req.body as {
    fullName?: string;
    method: "email" | "mobile";
    email?: string;
    countryCode?: string;
    mobile?: string;
    password?: string;
    accountType?: "customer" | "business_owner";
    acceptTerms?: boolean;
  };

  if (!fullName?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: "Full name and a password of at least 6 characters are required." });
  }
  if (!acceptTerms) {
    return res.status(400).json({ error: "You must accept the Terms of Service and Privacy Policy." });
  }

  // Never allow public signup as super_admin
  const role: "customer" | "business_owner" =
    accountType === "business_owner" ? "business_owner" : "customer";

  const cleanEmail = email?.trim().toLowerCase() || null;
  const cleanMobile = mobile ? `${countryCode || "+92"}${mobile.replace(/^0+/, "").replace(/\s+/g, "")}` : null;

  if (method === "email" && (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (method === "mobile" && (!mobile || mobile.replace(/\D/g, "").length < 9)) {
    return res.status(400).json({ error: "Please enter a valid mobile number." });
  }

  if (cleanEmail) {
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (exists) return res.status(409).json({ error: "An account with this email already exists." });
  }
  if (cleanMobile) {
    const exists = db.prepare("SELECT id FROM users WHERE mobile = ?").get(cleanMobile);
    if (exists) return res.status(409).json({ error: "An account with this mobile number already exists." });
  }

  const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, full_name, email, mobile, password_hash, role, email_verified, mobile_verified, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'active', ?)`
  ).run(userId, fullName.trim(), cleanEmail, cleanMobile, hashPassword(password), role, now);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const target = method === "email" ? (cleanEmail as string) : (cleanMobile as string);

  db.prepare(
    `INSERT INTO verification_codes (id, user_id, channel, target, code, expires_at, used)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(`ver-${Date.now()}`, userId, method, target, otp, expiresAt);

  writeAudit(fullName.trim(), role, "User Registered (Pending Verification)", target);

  return res.status(201).json({
    requiresVerification: true,
    channel: method,
    target,
    userId,
    // Provided in sandbox so user can verify without external SMTP/SMS gateway
    sandboxOtpPreview: otp,
    message: `Verification code sent to ${target}.`,
  });
});

app.post("/api/auth/verify", (req, res) => {
  const { target, code, channel } = req.body as {
    target: string;
    code: string;
    channel: "email" | "mobile";
  };

  if (!target || !code) {
    return res.status(400).json({ error: "Target and verification code are required." });
  }

  const rec = db
    .prepare(
      `SELECT * FROM verification_codes
       WHERE target = ? AND channel = ? AND code = ? AND used = 0
       ORDER BY expires_at DESC LIMIT 1`
    )
    .get(target.trim().toLowerCase(), channel, code.trim()) as
    | { id: string; user_id: string; expires_at: string }
    | undefined;

  const recExact =
    rec ||
    (db
      .prepare(
        `SELECT * FROM verification_codes
         WHERE target = ? AND channel = ? AND code = ? AND used = 0
         ORDER BY expires_at DESC LIMIT 1`
      )
      .get(target.trim(), channel, code.trim()) as
      | { id: string; user_id: string; expires_at: string }
      | undefined);

  if (!recExact) {
    return res.status(400).json({ error: "Invalid verification code." });
  }
  if (new Date(recExact.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Verification code expired. Please request a new code." });
  }

  db.prepare("UPDATE verification_codes SET used = 1 WHERE id = ?").run(recExact.id);
  if (channel === "email") {
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(recExact.user_id);
  } else {
    db.prepare("UPDATE users SET mobile_verified = 1 WHERE id = ?").run(recExact.user_id);
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(recExact.user_id) as {
    id: string;
    full_name: string;
    email: string | null;
    mobile: string | null;
    role: AuthUser["role"];
    admin_role?: string;
    email_verified: number;
    mobile_verified: number;
    status: string;
  };

  const token = createSession(user.id, true);
  res.setHeader("Set-Cookie", `ks_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  const access = getAdminAccessForUser(user.id, user.role, user.admin_role);

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      adminRole: access.adminRole,
      permissions: access.permissions,
      emailVerified: Boolean(user.email_verified),
      mobileVerified: Boolean(user.mobile_verified),
      status: user.status,
    },
    businesses: getOwnedBusinesses(user.id),
  });
});

app.post("/api/auth/resend-otp", (req, res) => {
  const { target, channel } = req.body as { target: string; channel: "email" | "mobile" };
  const user = db
    .prepare("SELECT id FROM users WHERE email = ? OR mobile = ?")
    .get(target.trim().toLowerCase(), target.trim()) as { id: string } | undefined;

  if (!user) return res.status(404).json({ error: "Account not found." });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare(
    `INSERT INTO verification_codes (id, user_id, channel, target, code, expires_at, used)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(`ver-${Date.now()}`, user.id, channel, target.trim(), otp, new Date(Date.now() + 15 * 60_000).toISOString());

  return res.json({ ok: true, sandboxOtpPreview: otp, message: `New OTP sent to ${target}.` });
});

app.post("/api/auth/login", (req, res) => {
  if (!checkRateLimit(req.ip || "local")) {
    return res.status(429).json({ error: "Too many login attempts. Please wait a minute." });
  }

  const { identifier, password, rememberMe } = req.body as {
    identifier?: string;
    password?: string;
    rememberMe?: boolean;
  };

  if (!identifier?.trim() || !password) {
    return res.status(400).json({ error: "Email or mobile number and password are required." });
  }

  const clean = identifier.trim();
  const normalizedPhone = clean.startsWith("03") ? `+92${clean.slice(1)}` : clean;

  const user = db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?) OR mobile = ? OR mobile = ?")
    .get(clean, clean, normalizedPhone) as
    | {
        id: string;
        full_name: string;
        email: string | null;
        mobile: string | null;
        password_hash: string;
        role: AuthUser["role"];
        admin_role?: string;
        email_verified: number;
        mobile_verified: number;
        status: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email/mobile or password." });
  }

  if (user.status === "suspended") {
    return res.status(403).json({ error: "This account has been suspended by platform administration." });
  }

  if (!user.email_verified && !user.mobile_verified) {
    const target = user.email || user.mobile || "";
    const channel = user.email ? "email" : "mobile";
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    db.prepare(
      `INSERT INTO verification_codes (id, user_id, channel, target, code, expires_at, used)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(`ver-${Date.now()}`, user.id, channel, target, otp, new Date(Date.now() + 15 * 60_000).toISOString());

    return res.status(403).json({
      error: "Account not verified yet. Please enter your verification code.",
      requiresVerification: true,
      channel,
      target,
      sandboxOtpPreview: otp,
    });
  }

  const token = createSession(user.id, Boolean(rememberMe));
  const maxAge = rememberMe ? 2592000 : 86400;
  res.setHeader("Set-Cookie", `ks_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);

  writeAudit(user.full_name, user.role, "Signed In", user.email || user.mobile || user.id);
  const access = getAdminAccessForUser(user.id, user.role, user.admin_role);

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      adminRole: access.adminRole,
      permissions: access.permissions,
      emailVerified: Boolean(user.email_verified),
      mobileVerified: Boolean(user.mobile_verified),
      status: user.status,
    },
    businesses: getOwnedBusinesses(user.id),
  });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const { identifier } = req.body as { identifier?: string };
  if (!identifier?.trim()) return res.status(400).json({ error: "Email or mobile is required." });

  const clean = identifier.trim();
  const normalizedPhone = clean.startsWith("03") ? `+92${clean.slice(1)}` : clean;
  const user = db
    .prepare("SELECT id, email, mobile FROM users WHERE lower(email) = lower(?) OR mobile = ? OR mobile = ?")
    .get(clean, clean, normalizedPhone) as { id: string; email: string | null; mobile: string | null } | undefined;

  if (!user) {
    return res.status(404).json({ error: "No account found matching that email or mobile number." });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const target = user.email || user.mobile || clean;
  db.prepare(
    `INSERT INTO verification_codes (id, user_id, channel, target, code, expires_at, used)
     VALUES (?, ?, 'password_reset', ?, ?, ?, 0)`
  ).run(`rst-${Date.now()}`, user.id, target, otp, new Date(Date.now() + 15 * 60_000).toISOString());

  return res.json({
    ok: true,
    target,
    sandboxOtpPreview: otp,
    message: `Single-use password reset code generated for ${target}.`,
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { target, code, newPassword } = req.body as {
    target?: string;
    code?: string;
    newPassword?: string;
  };
  if (!target || !code || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Valid reset code and new password (min 6 chars) required." });
  }

  const rec = db
    .prepare(
      `SELECT * FROM verification_codes
       WHERE target = ? AND channel = 'password_reset' AND code = ? AND used = 0
       ORDER BY expires_at DESC LIMIT 1`
    )
    .get(target.trim(), code.trim()) as { id: string; user_id: string; expires_at: string } | undefined;

  if (!rec || new Date(rec.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired reset code." });
  }

  db.prepare("UPDATE verification_codes SET used = 1 WHERE id = ?").run(rec.id);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), rec.user_id);
  // Invalidate existing sessions on password reset
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(rec.user_id);

  return res.json({ ok: true, message: "Password updated successfully. You may now log in." });
});

app.post("/api/auth/logout", (req: AuthedRequest, res) => {
  const session = getAuthUserFromRequest(req);
  if (session) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(session.token);
  }
  res.setHeader("Set-Cookie", "ks_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const session = getAuthUserFromRequest(req);
  if (!session) {
    return res.json({ user: null, businesses: [] });
  }
  return res.json({
    user: session.user,
    businesses: getOwnedBusinesses(session.user.id),
  });
});

// ==========================================
// 2. PERSISTENT IMAGE UPLOAD STORAGE
// ==========================================

app.post("/api/uploads/image", requireAuth, (req: AuthedRequest, res) => {
  const { dataUrl, fileName, category, altText, dimensions } = req.body as {
    dataUrl?: string;
    fileName?: string;
    category?: "Logos" | "Hero" | "Collections" | "Products" | "Content";
    altText?: string;
    dimensions?: string;
  };
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "Valid base64 image data URL required." });
  }

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon));base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: "Only PNG, JPG, WebP, SVG, and ICO images are permitted." });
  }

  const mime = match[1].toLowerCase();
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
    ? "webp"
    : mime.includes("svg")
    ? "svg"
    : mime.includes("icon")
    ? "ico"
    : "jpg";
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image file size must be under 5 MB." });
  }

  const safeSlug = (fileName || "img").replace(/[^a-z0-9_-]/gi, "_").slice(0, 28);
  const outName = `${safeSlug}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
  const outPath = path.join(UPLOADS_DIR, outName);

  fs.writeFileSync(outPath, buffer);
  const publicUrl = `/uploads/${outName}`;
  const mediaId = `med-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
  const sizeLabel =
    buffer.length >= 1024 * 1024
      ? `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(buffer.length / 1024))} KB`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO media_assets (id, name, category, url, dimensions, file_size, mime_type, alt_text, used_in_json, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`
  ).run(
    mediaId,
    fileName || outName,
    category || "Content",
    publicUrl,
    dimensions || "Auto",
    sizeLabel,
    mime,
    altText || fileName || outName,
    req.authUser!.fullName,
    now
  );

  return res.status(201).json({
    url: publicUrl,
    asset: {
      id: mediaId,
      name: fileName || outName,
      category: category || "Content",
      url: publicUrl,
      dimensions: dimensions || "Auto",
      fileSize: sizeLabel,
      mimeType: mime,
      uploadDate: now.slice(0, 10),
      altText: altText || fileName || outName,
      usedIn: [],
    },
  });
});

app.post(
  "/api/uploads/font",
  requireAuth,
  requirePermission("colors_typography", "visual_editor"),
  (req: AuthedRequest, res) => {
    const { dataUrl, fileName, fontName } = req.body as {
      dataUrl?: string;
      fileName?: string;
      fontName?: string;
    };
    if (!dataUrl || !dataUrl.includes(";base64,")) {
      return res.status(400).json({ error: "Valid base64 font file is required." });
    }
    const cleanFile = (fileName || "custom-font.woff2").toLowerCase();
    const ext = cleanFile.endsWith(".woff2")
      ? "woff2"
      : cleanFile.endsWith(".woff")
      ? "woff"
      : cleanFile.endsWith(".ttf")
      ? "ttf"
      : cleanFile.endsWith(".otf")
      ? "otf"
      : "";
    if (!ext) {
      return res.status(400).json({ error: "Supported font formats: .woff2, .woff, .ttf, .otf" });
    }
    const base64Part = dataUrl.split(";base64,")[1] || "";
    const buffer = Buffer.from(base64Part, "base64");
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: "Font file size must be under 4 MB." });
    }
    const fontsDir = path.join(UPLOADS_DIR, "fonts");
    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
    const safeSlug = (fontName || cleanFile.replace(/\.\w+$/, "")).replace(/[^a-z0-9_-]/gi, "_").slice(0, 28);
    const outName = `${safeSlug}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(fontsDir, outName), buffer);
    const publicUrl = `/uploads/fonts/${outName}`;
    const displayName = (fontName || cleanFile.replace(/\.\w+$/, "")).trim() || "CustomFont";
    const id = `font-${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO custom_fonts (id, name, url, format, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, displayName, publicUrl, ext === "ttf" ? "truetype" : ext === "otf" ? "opentype" : ext, now);

    writeAudit(req.authUser!.fullName, "super_admin", "Uploaded Custom Font", displayName);
    return res.status(201).json({
      font: {
        id,
        name: displayName,
        url: publicUrl,
        format: ext === "ttf" ? "truetype" : ext === "otf" ? "opentype" : ext,
      },
    });
  }
);

// ==========================================
// 3. PUBLIC WEBSITE & STOREFRONT ROUTES (NO AUTH REQUIRED)
// ==========================================

app.get("/api/public/home", (_req, res) => {
  const cms = getLiveCmsConfig();

  const stores = db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id AND p.published = 1 AND p.active = 1) as product_count
       FROM businesses b
       WHERE b.approval_status = 'approved' AND b.online_store_enabled = 1
       ORDER BY b.created_at DESC`
    )
    .all();

  const rawProducts = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.published = 1 AND p.active = 1 AND b.approval_status = 'approved' AND b.online_store_enabled = 1
       ORDER BY p.is_featured DESC, p.updated_at DESC
       LIMIT 100`
    )
    .all() as Array<Record<string, unknown>>;

  const products = hydrateProducts(rawProducts);
  const categories = getPublishedCategoriesWithCounts();
  const reviews = db
    .prepare(
      `SELECT r.*, p.name as product_name
       FROM product_reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC
       LIMIT 12`
    )
    .all()
    .map((r) => ({ ...r, verified_purchase: Boolean((r as Record<string, unknown>).verified_purchase) }));

  const pages = db
    .prepare("SELECT * FROM cms_pages WHERE published = 1 ORDER BY id ASC")
    .all()
    .map((pg: Record<string, unknown>) => ({
      id: pg.id,
      slug: pg.slug,
      title: pg.title,
      heading: pg.heading,
      subtitle: pg.subtitle,
      bodyHtml: pg.body_html,
      imageUrl: pg.image_url,
      ctaText: pg.cta_text,
      ctaHref: pg.cta_href,
      seoTitle: pg.seo_title,
      seoDescription: pg.seo_description,
      published: Boolean(pg.published),
      isSystem: Boolean(pg.is_system),
      updatedAt: pg.updated_at,
    }));

  return res.json({ cms, stores, products, categories, reviews, pages });
});

app.get("/api/public/pages/:slug", (req, res) => {
  const pg = db
    .prepare("SELECT * FROM cms_pages WHERE lower(slug) = lower(?) AND published = 1")
    .get(req.params.slug) as Record<string, unknown> | undefined;
  if (!pg) return res.status(404).json({ error: "Page not found." });
  return res.json({
    page: {
      id: pg.id,
      slug: pg.slug,
      title: pg.title,
      heading: pg.heading,
      subtitle: pg.subtitle,
      bodyHtml: pg.body_html,
      imageUrl: pg.image_url,
      ctaText: pg.cta_text,
      ctaHref: pg.cta_href,
      seoTitle: pg.seo_title,
      seoDescription: pg.seo_description,
      published: Boolean(pg.published),
      isSystem: Boolean(pg.is_system),
      updatedAt: pg.updated_at,
    },
  });
});

app.get("/api/public/categories", (_req, res) => {
  return res.json({ categories: getPublishedCategoriesWithCounts() });
});

app.get("/api/public/categories/:slug", (req, res) => {
  const cat = db
    .prepare("SELECT * FROM categories WHERE lower(slug) = lower(?) AND published = 1")
    .get(req.params.slug) as Record<string, unknown> | undefined;

  if (!cat) {
    return res.status(404).json({ error: "Category not found." });
  }

  const q = String(req.query.q || "").trim().toLowerCase();
  const subFilter = String(req.query.sub || "").trim().toLowerCase();
  const sizeFilter = String(req.query.size || "").trim().toLowerCase();
  const colorFilter = String(req.query.color || "").trim().toLowerCase();
  const brandFilter = String(req.query.brand || "").trim().toLowerCase();
  const storeIdFilter = String(req.query.storeId || "").trim();
  const inStockOnly = String(req.query.inStock || "") === "true" || String(req.query.inStock || "") === "1";
  const sort = String(req.query.sort || "newest");

  const rawAll = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.published = 1 AND p.active = 1
         AND b.approval_status = 'approved' AND b.online_store_enabled = 1
         AND (lower(p.category_slug) = lower(?) OR lower(p.category) = lower(?))
       ORDER BY p.updated_at DESC`
    )
    .all(String(cat.slug), String(cat.name)) as Array<Record<string, unknown>>;

  const allHydrated = hydrateProducts(rawAll);

  const categorySubs = parseJsonArray(cat.subcategories_json);
  const productSubs = allHydrated.map((p) => p.subcategory).filter(Boolean);
  const subcategories = Array.from(new Set([...categorySubs, ...productSubs]));

  const sizes = Array.from(
    new Set(allHydrated.flatMap((p) => p.sizes || []).filter(Boolean))
  );
  const colors = Array.from(
    new Set(allHydrated.flatMap((p) => p.colors || []).filter(Boolean))
  );
  const brands = Array.from(
    new Set(allHydrated.map((p) => String(p.brand || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  let filtered = allHydrated.filter((p) => {
    const prodName = String((p as Record<string, unknown>).name || "");
    const prodDesc = String((p as Record<string, unknown>).description || "");
    const prodBrand = String(p.brand || "");
    const prodStock = Number((p as Record<string, unknown>).stock || 0);
    const prodBizId = String((p as Record<string, unknown>).business_id || "");

    const matchQ =
      !q ||
      prodName.toLowerCase().includes(q) ||
      prodDesc.toLowerCase().includes(q) ||
      prodBrand.toLowerCase().includes(q) ||
      p.subcategory.toLowerCase().includes(q) ||
      Object.values(p.specs || {}).some((v) => String(v).toLowerCase().includes(q));

    const matchSub =
      !subFilter ||
      subFilter === "all" ||
      p.subcategory.toLowerCase() === subFilter ||
      p.subcategory.toLowerCase().replace(/[^a-z0-9]+/g, "-") === subFilter;
    const matchSize =
      !sizeFilter ||
      sizeFilter === "all" ||
      p.sizes.some((s) => s.toLowerCase() === sizeFilter);
    const matchColor =
      !colorFilter ||
      colorFilter === "all" ||
      p.colors.some((c) => c.toLowerCase() === colorFilter);
    const matchBrand = !brandFilter || brandFilter === "all" || prodBrand.toLowerCase() === brandFilter;
    const matchStore = !storeIdFilter || storeIdFilter === "all" || prodBizId === storeIdFilter;
    const matchStock = !inStockOnly || prodStock > 0;
    return matchQ && matchSub && matchSize && matchColor && matchBrand && matchStore && matchStock;
  });

  if (sort === "price-asc") {
    filtered = [...filtered].sort((a, b) => {
      const pa = Number((a as Record<string, unknown>).discount_price || (a as Record<string, unknown>).selling_price || 0);
      const pb = Number((b as Record<string, unknown>).discount_price || (b as Record<string, unknown>).selling_price || 0);
      return pa - pb;
    });
  } else if (sort === "price-desc") {
    filtered = [...filtered].sort((a, b) => {
      const pa = Number((a as Record<string, unknown>).discount_price || (a as Record<string, unknown>).selling_price || 0);
      const pb = Number((b as Record<string, unknown>).discount_price || (b as Record<string, unknown>).selling_price || 0);
      return pb - pa;
    });
  } else if (sort === "name-asc") {
    filtered = [...filtered].sort((a, b) =>
      String((a as Record<string, unknown>).name || "").localeCompare(String((b as Record<string, unknown>).name || ""))
    );
  } else if (sort === "rating") {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  }

  return res.json({
    category: {
      ...cat,
      subcategories,
      published: Boolean(cat.published),
      featured: Boolean(cat.featured),
      product_count: allHydrated.length,
      store_count: 1,
    },
    products: filtered,
    totalProductsInCategory: allHydrated.length,
    subcategories,
    sizes,
    colors,
    brands,
    stores: [],
    categories: getPublishedCategoriesWithCounts(),
  });
});

app.get("/api/public/products", (req, res) => {
  const collection = String(req.query.collection || "").trim().toLowerCase();
  const q = String(req.query.q || "").trim().toLowerCase();
  const categorySlug = String(req.query.category || "").trim().toLowerCase();
  const subFilter = String(req.query.sub || "").trim().toLowerCase();
  const sizeFilter = String(req.query.size || "").trim().toLowerCase();
  const colorFilter = String(req.query.color || "").trim().toLowerCase();
  const sort = String(req.query.sort || "newest");

  const rawAll = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.published = 1 AND p.active = 1 AND b.approval_status = 'approved' AND b.online_store_enabled = 1
       ORDER BY p.updated_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  let list = hydrateProducts(rawAll).filter((p) => {
    if (collection === "new-arrivals" && !p.is_new_arrival) return false;
    if (collection === "best-sellers" && !p.is_best_seller) return false;
    if (collection === "featured" && !p.is_featured) return false;
    if (
      collection === "traditional-sindhi" &&
      p.category_slug !== "traditional-sindhi-wear" &&
      p.category_slug !== "ajrak-collection" &&
      p.category_slug !== "sindhi-topi"
    ) {
      return false;
    }
    if (collection === "sale") {
      const dp = Number((p as Record<string, unknown>).discount_price || 0);
      const sp = Number((p as Record<string, unknown>).selling_price || 0);
      if (!(dp > 0 && dp < sp)) return false;
    }
    if (categorySlug && categorySlug !== "all" && p.category_slug.toLowerCase() !== categorySlug) return false;
    if (subFilter && subFilter !== "all" && p.subcategory.toLowerCase() !== subFilter) return false;
    if (sizeFilter && sizeFilter !== "all" && !p.sizes.some((s) => s.toLowerCase() === sizeFilter)) return false;
    if (colorFilter && colorFilter !== "all" && !p.colors.some((c) => c.toLowerCase() === colorFilter)) return false;
    if (q) {
      const name = String((p as Record<string, unknown>).name || "").toLowerCase();
      const desc = String((p as Record<string, unknown>).description || "").toLowerCase();
      const cat = String((p as Record<string, unknown>).category || "").toLowerCase();
      if (!name.includes(q) && !desc.includes(q) && !cat.includes(q) && !p.subcategory.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (sort === "price-asc") {
    list = [...list].sort(
      (a, b) =>
        Number((a as Record<string, unknown>).discount_price || (a as Record<string, unknown>).selling_price || 0) -
        Number((b as Record<string, unknown>).discount_price || (b as Record<string, unknown>).selling_price || 0)
    );
  } else if (sort === "price-desc") {
    list = [...list].sort(
      (a, b) =>
        Number((b as Record<string, unknown>).discount_price || (b as Record<string, unknown>).selling_price || 0) -
        Number((a as Record<string, unknown>).discount_price || (a as Record<string, unknown>).selling_price || 0)
    );
  } else if (sort === "name-asc") {
    list = [...list].sort((a, b) =>
      String((a as Record<string, unknown>).name || "").localeCompare(String((b as Record<string, unknown>).name || ""))
    );
  }

  return res.json({ products: list });
});

app.get("/api/public/products/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND p.published = 1 AND p.active = 1`
    )
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    return res.status(404).json({ error: "Product not found." });
  }

  const product = hydrateProducts([row])[0];
  const reviews = db
    .prepare("SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC")
    .all(req.params.id)
    .map((r) => ({ ...r, verified_purchase: Boolean((r as Record<string, unknown>).verified_purchase) }));

  const relatedRaw = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.id != ? AND p.published = 1 AND p.active = 1 AND p.category_slug = ?
       ORDER BY p.is_featured DESC, p.updated_at DESC
       LIMIT 4`
    )
    .all(req.params.id, product.category_slug) as Array<Record<string, unknown>>;

  const cms = getLiveCmsConfig();
  return res.json({
    product,
    reviews,
    relatedProducts: hydrateProducts(relatedRaw),
    storeSettings: cms.storeSettings,
  });
});

app.post("/api/public/products/:id/reviews", (req, res) => {
  const { customerName, city, rating, comment } = req.body as {
    customerName?: string;
    city?: string;
    rating?: number;
    comment?: string;
  };
  if (!customerName?.trim() || !comment?.trim()) {
    return res.status(400).json({ error: "Your name and review comment are required." });
  }
  const prod = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!prod) return res.status(404).json({ error: "Product not found." });

  const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
  const now = new Date().toISOString();
  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  db.prepare(
    `INSERT INTO product_reviews (id, product_id, customer_name, city, rating, comment, verified_purchase, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, req.params.id, customerName.trim(), (city || "Mithi, Tharparkar").trim(), cleanRating, comment.trim(), now);

  db.prepare(
    `UPDATE products
     SET review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ?),
         rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = ?), 5.0)
     WHERE id = ?`
  ).run(req.params.id, req.params.id, req.params.id);

  const reviews = db
    .prepare("SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC")
    .all(req.params.id)
    .map((r) => ({ ...r, verified_purchase: Boolean((r as Record<string, unknown>).verified_purchase) }));

  return res.status(201).json({ reviews });
});

app.post("/api/public/newsletter", (req, res) => {
  const { email } = req.body as { email?: string };
  const cleanEmail = email?.trim().toLowerCase() || "";
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO newsletter_subscribers (id, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).run(`sub-${Date.now()}`, cleanEmail, now);

  return res.status(201).json({ ok: true, message: "Thank you for subscribing to THAR STYLE updates." });
});

app.post("/api/public/contact", (req, res) => {
  const { name, email, phone, subject, message } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  };
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO contact_messages (id, name, email, phone, subject, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `msg-${Date.now()}`,
    name.trim(),
    email.trim(),
    (phone || "").trim(),
    (subject || "Store Inquiry").trim(),
    message.trim(),
    now
  );
  return res.status(201).json({ ok: true, message: "Your message has been received by THAR STYLE Mithi." });
});

app.get("/api/public/offers", (_req, res) => {
  const raw = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM products p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.published = 1 AND p.active = 1
         AND b.approval_status = 'approved' AND b.online_store_enabled = 1
         AND p.discount_price IS NOT NULL AND p.discount_price > 0 AND p.discount_price < p.selling_price
       ORDER BY ((p.selling_price - p.discount_price) * 1.0 / p.selling_price) DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return res.json({ products: hydrateProducts(raw) });
});

app.get("/api/public/stores", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const city = String(req.query.city || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();

  const stores = db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id AND p.published = 1 AND p.active = 1) as product_count
       FROM businesses b
       WHERE b.approval_status = 'approved' AND b.online_store_enabled = 1
       ORDER BY b.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const filtered = stores.filter((s) => {
    const matchQ =
      !q ||
      String(s.name).toLowerCase().includes(q) ||
      String(s.description).toLowerCase().includes(q) ||
      String(s.category).toLowerCase().includes(q);
    const matchCity = !city || city === "all" || String(s.city).toLowerCase().includes(city);
    const matchCat = !category || category === "all" || String(s.category).toLowerCase().includes(category);
    return matchQ && matchCity && matchCat;
  });

  return res.json({ stores: filtered });
});

app.get("/api/public/stores/:slug", (req, res) => {
  const store = db
    .prepare(
      `SELECT * FROM businesses WHERE slug = ? AND approval_status = 'approved' AND online_store_enabled = 1`
    )
    .get(req.params.slug) as Record<string, unknown> | undefined;

  if (!store) {
    return res.status(404).json({ error: "Storefront not found or currently offline." });
  }

  const rawProducts = db
    .prepare(
      `SELECT p.*, ? as business_name, ? as business_slug, ? as business_city
       FROM products p
       WHERE p.business_id = ? AND p.published = 1 AND p.active = 1
       ORDER BY p.updated_at DESC`
    )
    .all(String(store.name), String(store.slug), String(store.city), String(store.id)) as Array<
    Record<string, unknown>
  >;

  return res.json({ store, products: hydrateProducts(rawProducts) });
});

// ==========================================
// 4. CUSTOMER PORTAL ROUTES (CUSTOMER / AUTHED)
// ==========================================

app.get("/api/customer/addresses", requireAuth, (req: AuthedRequest, res) => {
  const addresses = db
    .prepare("SELECT * FROM customer_addresses WHERE user_id = ? ORDER BY is_default DESC")
    .all(req.authUser!.id);
  return res.json({ addresses });
});

app.post("/api/customer/addresses", requireAuth, (req: AuthedRequest, res) => {
  const { label, recipient, phone, city, streetAddress } = req.body as {
    label: string;
    recipient: string;
    phone: string;
    city: string;
    streetAddress: string;
  };
  if (!recipient || !phone || !city || !streetAddress) {
    return res.status(400).json({ error: "All address fields are required." });
  }
  const id = `addr-${Date.now()}`;
  db.prepare(
    `INSERT INTO customer_addresses (id, user_id, label, recipient, phone, city, street_address, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(id, req.authUser!.id, label || "Home", recipient, phone, city, streetAddress);
  const addresses = db.prepare("SELECT * FROM customer_addresses WHERE user_id = ?").all(req.authUser!.id);
  return res.status(201).json({ addresses });
});

app.delete("/api/customer/addresses/:id", requireAuth, (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM customer_addresses WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.authUser!.id
  );
  return res.json({ ok: true });
});

app.get("/api/customer/wishlist", requireAuth, (req: AuthedRequest, res) => {
  const raw = db
    .prepare(
      `SELECT p.*, b.name as business_name, b.slug as business_slug, b.city as business_city
       FROM wishlists w
       JOIN products p ON p.id = w.product_id
       JOIN businesses b ON b.id = p.business_id
       WHERE w.user_id = ?`
    )
    .all(req.authUser!.id) as Array<Record<string, unknown>>;
  return res.json({ items: hydrateProducts(raw) });
});

app.post("/api/customer/wishlist/toggle", requireAuth, (req: AuthedRequest, res) => {
  const { productId } = req.body as { productId: string };
  const exists = db
    .prepare("SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ?")
    .get(req.authUser!.id, productId);
  if (exists) {
    db.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").run(req.authUser!.id, productId);
    return res.json({ saved: false });
  }
  db.prepare("INSERT INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)").run(
    req.authUser!.id,
    productId,
    new Date().toISOString()
  );
  return res.json({ saved: true });
});

app.get("/api/customer/orders", requireAuth, (req: AuthedRequest, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, b.name as business_name, b.slug as business_slug
       FROM orders o
       JOIN businesses b ON b.id = o.business_id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`
    )
    .all(req.authUser!.id) as Array<Record<string, unknown>>;

  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const getHist = db.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC");

  const hydrated = orders.map((o) => ({
    ...o,
    items: getItems.all(String(o.id)),
    history: getHist.all(String(o.id)),
  }));

  return res.json({ orders: hydrated });
});

app.post("/api/customer/orders", requireAuth, (req: AuthedRequest, res) => {
  const { businessId, items, deliveryAddress, customerPhone, paymentMethod, notes } = req.body as {
    businessId: string;
    items: Array<{ productId: string; quantity: number; variantLabel?: string }>;
    deliveryAddress: string;
    customerPhone: string;
    paymentMethod: string;
    notes?: string;
  };

  if (!businessId || !Array.isArray(items) || items.length === 0 || !deliveryAddress) {
    return res.status(400).json({ error: "Store, items, and delivery address are required." });
  }

  const biz = db
    .prepare("SELECT * FROM businesses WHERE id = ? AND approval_status = 'approved' AND online_store_enabled = 1")
    .get(businessId) as { id: string; name: string } | undefined;

  if (!biz) {
    return res.status(404).json({ error: "This store is not currently accepting online orders." });
  }

  // Validate stock atomically
  let subtotal = 0;
  const resolvedItems: Array<{
    productId: string;
    name: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string;
  }> = [];

  for (const reqItem of items) {
    const prod = db
      .prepare("SELECT * FROM products WHERE id = ? AND business_id = ? AND published = 1 AND active = 1")
      .get(reqItem.productId, businessId) as
      | {
          id: string;
          name: string;
          selling_price: number;
          discount_price: number | null;
          stock: number;
        }
      | undefined;

    if (!prod) {
      return res.status(400).json({ error: "One of the items in your cart is no longer available." });
    }
    if (reqItem.quantity <= 0 || prod.stock < reqItem.quantity) {
      return res.status(409).json({
        error: `Insufficient stock for "${prod.name}". Available: ${prod.stock}.`,
      });
    }

    const price = prod.discount_price && prod.discount_price > 0 ? prod.discount_price : prod.selling_price;
    subtotal += price * reqItem.quantity;

    const imgRow = db
      .prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC LIMIT 1")
      .get(prod.id) as { url: string } | undefined;

    resolvedItems.push({
      productId: prod.id,
      name: prod.name,
      variantLabel: reqItem.variantLabel || "Standard",
      quantity: reqItem.quantity,
      unitPrice: price,
      imageUrl: imgRow?.url || "/src/assets/images/product_grocery_staples_1794815928934.jpg",
    });
  }

  const cms = getLiveCmsConfig();
  const baseFee = Number(cms.storeSettings?.deliveryFee ?? 200);
  const freeAt = Number(cms.storeSettings?.freeDeliveryThreshold ?? 5000);
  const deliveryFee = subtotal >= freeAt ? 0 : baseFee;
  const total = subtotal + deliveryFee;
  const orderId = `ord-${Date.now()}`;
  const orderNumber = `TS-ORD-${Math.floor(10000 + Math.random() * 89999)}`;
  const now = new Date().toISOString();
  const paymentStatus = paymentMethod === "Cash on Delivery" ? "PENDING_COD" : "PENDING_PROVIDER";

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO orders (id, order_number, business_id, customer_id, customer_name, customer_phone, delivery_address, payment_method, payment_status, order_status, subtotal, delivery_fee, total, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      orderNumber,
      businessId,
      req.authUser!.id,
      req.authUser!.fullName,
      customerPhone || req.authUser!.mobile || "+92 300 0000000",
      deliveryAddress,
      paymentMethod || "Cash on Delivery",
      paymentStatus,
      subtotal,
      deliveryFee,
      total,
      notes || "",
      now
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, product_name, variant_label, quantity, unit_price, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const deductStock = db.prepare(
      "UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?"
    );

    for (const item of resolvedItems) {
      insertItem.run(
        `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        item.productId,
        item.name,
        item.variantLabel,
        item.quantity,
        item.unitPrice,
        item.imageUrl
      );
      deductStock.run(item.quantity, now, item.productId, item.quantity);
    }

    db.prepare(
      `INSERT INTO order_status_history (id, order_id, status, note, actor, created_at)
       VALUES (?, ?, 'Pending', 'Order placed online at THAR STYLE', ?, ?)`
    ).run(`osh-${Date.now()}`, orderId, req.authUser!.fullName, now);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return res.status(201).json({
    order: { id: orderId, orderNumber, total, orderStatus: "Pending", paymentStatus },
  });
});

app.post("/api/customer/orders/:id/cancel", requireAuth, (req: AuthedRequest, res) => {
  const order = db
    .prepare("SELECT * FROM orders WHERE id = ? AND customer_id = ?")
    .get(req.params.id, req.authUser!.id) as
    | { id: string; order_number: string; order_status: string }
    | undefined;

  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }
  if (order.order_status !== "Pending" && order.order_status !== "Accepted") {
    return res.status(400).json({ error: `Order cannot be cancelled once it is ${order.order_status}.` });
  }

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE orders SET order_status = 'Cancelled' WHERE id = ?").run(order.id);
    db.prepare(
      "INSERT INTO order_status_history (id, order_id, status, note, actor, created_at) VALUES (?, ?, 'Cancelled', 'Cancelled by customer before dispatch', ?, ?)"
    ).run(`osh-${Date.now()}`, order.id, req.authUser!.fullName, now);

    const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(order.id) as Array<{
      product_id: string;
      quantity: number;
    }>;
    const restore = db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?");
    for (const it of items) {
      restore.run(it.quantity, now, it.product_id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return res.json({ ok: true, status: "Cancelled" });
});

// ==========================================
// 5. BUSINESS OWNER & PRODUCT / ORDER ROUTES
// ==========================================

app.post("/api/business/register", requireAuth, (req: AuthedRequest, res) => {
  const { name, category, city, address, phone, whatsapp, description, logoUrl, coverUrl, plan } = req.body as {
    name: string;
    category: string;
    city: string;
    address: string;
    phone: string;
    whatsapp?: string;
    description?: string;
    logoUrl?: string;
    coverUrl?: string;
    plan?: string;
  };

  if (!name?.trim() || !city?.trim()) {
    return res.status(400).json({ error: "Business name and city are required." });
  }

  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slugExists = db.prepare("SELECT 1 FROM businesses WHERE slug = ?").get(baseSlug);
  const slug = slugExists ? `${baseSlug}-${Math.floor(100 + Math.random() * 899)}` : baseSlug;

  const id = `biz-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO businesses (id, owner_id, slug, name, category, city, address, phone, whatsapp, description, logo_url, cover_url, hours, online_store_enabled, approval_status, plan, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '9:00 AM - 10:30 PM', 1, 'approved', ?, ?)`
  ).run(
    id,
    req.authUser!.id,
    slug,
    name.trim(),
    category || "Kiryana / General Store",
    city.trim(),
    address || `Main Market, ${city}`,
    phone || req.authUser!.mobile || "+92 300 0000000",
    whatsapp || phone || "",
    description || `${name.trim()} — Verified local storefront powered by Karobar Saathi AI.`,
    logoUrl || "/src/assets/images/store_ali_general_1794814699279.jpg",
    coverUrl || "/src/assets/images/hero_lahore_emerald_1794814698018.jpg",
    plan || "Professional",
    now
  );

  // Upgrade customer role to business_owner if needed
  if (req.authUser!.role === "customer") {
    db.prepare("UPDATE users SET role = 'business_owner' WHERE id = ?").run(req.authUser!.id);
  }

  writeAudit(req.authUser!.fullName, "business_owner", "Registered Business Storefront", `/store/${slug}`);

  const business = db.prepare("SELECT * FROM businesses WHERE id = ?").get(id);
  return res.status(201).json({ business, storefrontPath: `/store/${slug}` });
});

app.get("/api/business/my", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const businesses =
    req.authUser!.role === "super_admin"
      ? db.prepare("SELECT * FROM businesses ORDER BY created_at DESC").all()
      : getOwnedBusinesses(req.authUser!.id);
  return res.json({ businesses });
});

app.patch("/api/business/:id/settings", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(req.params.id) as
    | { id: string; owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized business access." });
  }

  const { name, description, address, phone, whatsapp, hours, onlineStoreEnabled, logoUrl, coverUrl } = req.body;
  db.prepare(
    `UPDATE businesses
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         address = COALESCE(?, address),
         phone = COALESCE(?, phone),
         whatsapp = COALESCE(?, whatsapp),
         hours = COALESCE(?, hours),
         online_store_enabled = COALESCE(?, online_store_enabled),
         logo_url = COALESCE(?, logo_url),
         cover_url = COALESCE(?, cover_url)
     WHERE id = ?`
  ).run(
    name ?? null,
    description ?? null,
    address ?? null,
    phone ?? null,
    whatsapp ?? null,
    hours ?? null,
    typeof onlineStoreEnabled === "boolean" ? (onlineStoreEnabled ? 1 : 0) : null,
    logoUrl ?? null,
    coverUrl ?? null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM businesses WHERE id = ?").get(req.params.id);
  return res.json({ business: updated });
});

app.get("/api/business/:id/products", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Tenant isolation violation blocked." });
  }

  const rows = db
    .prepare("SELECT * FROM products WHERE business_id = ? ORDER BY updated_at DESC")
    .all(req.params.id) as Array<Record<string, unknown>>;
  return res.json({ products: hydrateProducts(rows) });
});

app.post("/api/business/:id/products", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }

  const {
    name,
    sku,
    barcode,
    brand,
    specs,
    category,
    categorySlug,
    subcategory,
    unit,
    description,
    costPrice,
    sellingPrice,
    discountPrice,
    stock,
    minStock,
    published,
    variants,
    sizes,
    colors,
    isNewArrival,
    isFeatured,
    isBestSeller,
    images,
  } = req.body as {
    name: string;
    sku?: string;
    barcode?: string;
    brand?: string;
    specs?: Record<string, string>;
    category?: string;
    categorySlug?: string;
    subcategory?: string;
    unit?: string;
    description?: string;
    costPrice: number;
    sellingPrice: number;
    discountPrice?: number | null;
    stock: number;
    minStock?: number;
    published?: boolean;
    variants?: string[];
    sizes?: string[];
    colors?: string[];
    isNewArrival?: boolean;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    images?: Array<{ url: string; isPrimary?: boolean }>;
  };

  if (!name?.trim() || sellingPrice <= 0) {
    return res.status(400).json({ error: "Product name and selling price are required." });
  }

  const catMeta = resolveCategoryMeta(category, categorySlug);
  const pid = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const finalSizes = Array.isArray(sizes) && sizes.length > 0 ? sizes : Array.isArray(variants) ? variants : ["S", "M", "L", "XL"];
  const finalColors = Array.isArray(colors) && colors.length > 0 ? colors : ["Standard"];

  db.prepare(
    `INSERT INTO products (
      id, business_id, sku, barcode, name, brand, specs_json,
      category, category_slug, subcategory, unit, description,
      cost_price, selling_price, discount_price, stock, min_stock,
      published, active, variants_json, sizes_json, colors_json,
      is_new_arrival, is_featured, is_best_seller, rating, review_count, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 5.0, 0, ?)`
  ).run(
    pid,
    req.params.id,
    sku || `TS-${Math.floor(1000 + Math.random() * 8999)}`,
    barcode || `896500${Math.floor(1000 + Math.random() * 8999)}`,
    name.trim(),
    (brand || "THAR STYLE").trim(),
    JSON.stringify(specs || {}),
    catMeta.name,
    catMeta.slug,
    (subcategory || "").trim(),
    unit || "pcs",
    description || "",
    Number(costPrice) || 0,
    Number(sellingPrice),
    discountPrice ? Number(discountPrice) : null,
    Number(stock) || 0,
    Number(minStock) || 5,
    published === false ? 0 : 1,
    JSON.stringify(variants && variants.length > 0 ? variants : finalSizes),
    JSON.stringify(finalSizes),
    JSON.stringify(finalColors),
    isNewArrival ? 1 : 0,
    isFeatured ? 1 : 0,
    isBestSeller ? 1 : 0,
    now
  );

  const imgList =
    images && images.length > 0
      ? images
      : [{ url: "/src/assets/images/prod_women_suit_1794818535930.jpg", isPrimary: true }];

  const insImg = db.prepare(
    "INSERT INTO product_images (id, product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  imgList.forEach((im, idx) => {
    insImg.run(`img-${Date.now()}-${idx}`, pid, im.url, im.isPrimary || idx === 0 ? 1 : 0, idx);
  });

  const created = db.prepare("SELECT * FROM products WHERE id = ?").get(pid) as Record<string, unknown>;
  return res.status(201).json({ product: hydrateProducts([created])[0] });
});

app.put("/api/business/:id/products/:pid", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }

  const {
    name,
    sku,
    brand,
    specs,
    category,
    categorySlug,
    subcategory,
    unit,
    description,
    costPrice,
    sellingPrice,
    discountPrice,
    stock,
    minStock,
    published,
    active,
    variants,
    sizes,
    colors,
    isNewArrival,
    isFeatured,
    isBestSeller,
    images,
  } = req.body;

  const catMeta = category || categorySlug ? resolveCategoryMeta(category, categorySlug) : null;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE products
     SET name = COALESCE(?, name),
         sku = COALESCE(?, sku),
         brand = COALESCE(?, brand),
         specs_json = COALESCE(?, specs_json),
         category = COALESCE(?, category),
         category_slug = COALESCE(?, category_slug),
         subcategory = COALESCE(?, subcategory),
         unit = COALESCE(?, unit),
         description = COALESCE(?, description),
         cost_price = COALESCE(?, cost_price),
         selling_price = COALESCE(?, selling_price),
         discount_price = ?,
         stock = COALESCE(?, stock),
         min_stock = COALESCE(?, min_stock),
         published = COALESCE(?, published),
         active = COALESCE(?, active),
         variants_json = COALESCE(?, variants_json),
         sizes_json = COALESCE(?, sizes_json),
         colors_json = COALESCE(?, colors_json),
         is_new_arrival = COALESCE(?, is_new_arrival),
         is_featured = COALESCE(?, is_featured),
         is_best_seller = COALESCE(?, is_best_seller),
         updated_at = ?
     WHERE id = ? AND business_id = ?`
  ).run(
    name ?? null,
    sku ?? null,
    typeof brand === "string" ? brand : null,
    specs ? JSON.stringify(specs) : null,
    catMeta ? catMeta.name : null,
    catMeta ? catMeta.slug : null,
    typeof subcategory === "string" ? subcategory : null,
    unit ?? null,
    description ?? null,
    typeof costPrice === "number" ? costPrice : null,
    typeof sellingPrice === "number" ? sellingPrice : null,
    discountPrice ? Number(discountPrice) : null,
    typeof stock === "number" ? stock : null,
    typeof minStock === "number" ? minStock : null,
    typeof published === "boolean" ? (published ? 1 : 0) : null,
    typeof active === "boolean" ? (active ? 1 : 0) : null,
    variants ? JSON.stringify(variants) : sizes ? JSON.stringify(sizes) : null,
    sizes ? JSON.stringify(sizes) : null,
    colors ? JSON.stringify(colors) : null,
    typeof isNewArrival === "boolean" ? (isNewArrival ? 1 : 0) : null,
    typeof isFeatured === "boolean" ? (isFeatured ? 1 : 0) : null,
    typeof isBestSeller === "boolean" ? (isBestSeller ? 1 : 0) : null,
    now,
    req.params.pid,
    req.params.id
  );

  if (Array.isArray(images)) {
    db.prepare("DELETE FROM product_images WHERE product_id = ?").run(req.params.pid);
    const insImg = db.prepare(
      "INSERT INTO product_images (id, product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)"
    );
    images.forEach((im: { url: string; isPrimary?: boolean }, idx: number) => {
      insImg.run(`img-${Date.now()}-${idx}`, req.params.pid, im.url, im.isPrimary || idx === 0 ? 1 : 0, idx);
    });
  }

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.pid) as Record<string, unknown>;
  return res.json({ product: hydrateProducts([updated])[0] });
});

app.post("/api/business/:id/products/:pid/duplicate", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const existing = db
    .prepare("SELECT * FROM products WHERE id = ? AND business_id = ?")
    .get(req.params.pid, req.params.id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: "Product not found." });

  const newId = `prod-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO products (
      id, business_id, sku, barcode, name, brand, specs_json, category, category_slug, subcategory,
      unit, description, cost_price, selling_price, discount_price, stock, min_stock,
      published, active, variants_json, sizes_json, colors_json, is_new_arrival, is_featured, is_best_seller, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId,
    req.params.id,
    `${String(existing.sku)}-COPY`,
    String(existing.barcode || ""),
    `${String(existing.name)} (Copy)`,
    String(existing.brand || "THAR STYLE"),
    String(existing.specs_json || "{}"),
    String(existing.category || "Men"),
    String(existing.category_slug || "men"),
    String(existing.subcategory || ""),
    String(existing.unit || "pcs"),
    String(existing.description || ""),
    Number(existing.cost_price || 0),
    Number(existing.selling_price || 0),
    existing.discount_price != null ? Number(existing.discount_price) : null,
    Number(existing.stock || 0),
    Number(existing.min_stock || 5),
    String(existing.variants_json || "[]"),
    String(existing.sizes_json || "[]"),
    String(existing.colors_json || "[]"),
    Number(existing.is_new_arrival || 0),
    Number(existing.is_featured || 0),
    Number(existing.is_best_seller || 0),
    now
  );

  const imgs = db.prepare("SELECT * FROM product_images WHERE product_id = ?").all(req.params.pid) as Array<{
    url: string;
    is_primary: number;
    sort_order: number;
  }>;
  const insImg = db.prepare(
    "INSERT INTO product_images (id, product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  imgs.forEach((im, idx) => {
    insImg.run(`img-${Date.now()}-${idx}`, newId, im.url, im.is_primary, im.sort_order);
  });

  const created = db.prepare("SELECT * FROM products WHERE id = ?").get(newId) as Record<string, unknown>;
  return res.status(201).json({ product: hydrateProducts([created])[0] });
});

app.delete("/api/business/:id/products/:pid", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }
  db.prepare("DELETE FROM products WHERE id = ? AND business_id = ?").run(req.params.pid, req.params.id);
  return res.json({ ok: true });
});

// Sync POS Sale with authoritative SQLite Product Stock (PRD Section 10)
app.post("/api/business/:id/pos-sync-sale", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const { items } = req.body as { items: Array<{ productId: string; quantity: number }> };
  if (!Array.isArray(items)) return res.status(400).json({ error: "Items array required." });

  const now = new Date().toISOString();
  const stmt = db.prepare("UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ? AND business_id = ?");
  for (const it of items) {
    stmt.run(it.quantity, now, it.productId, req.params.id);
  }
  return res.json({ ok: true });
});

app.get("/api/business/:id/orders", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }

  const orders = db
    .prepare("SELECT * FROM orders WHERE business_id = ? ORDER BY created_at DESC")
    .all(req.params.id) as Array<Record<string, unknown>>;

  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const getHist = db.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC");

  return res.json({
    orders: orders.map((o) => ({
      ...o,
      items: getItems.all(String(o.id)),
      history: getHist.all(String(o.id)),
    })),
  });
});

app.patch("/api/business/:id/orders/:oid/status", requireAuth, requireRole("business_owner", "super_admin"), (req: AuthedRequest, res) => {
  const biz = db.prepare("SELECT owner_id FROM businesses WHERE id = ?").get(req.params.id) as
    | { owner_id: string }
    | undefined;
  if (!biz) return res.status(404).json({ error: "Business not found." });
  if (biz.owner_id !== req.authUser!.id && req.authUser!.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized." });
  }

  const { status, note } = req.body as {
    status: "Accepted" | "Preparing" | "Dispatched" | "Delivered" | "Cancelled" | "Rejected";
    note?: string;
  };
  const order = db
    .prepare("SELECT * FROM orders WHERE id = ? AND business_id = ?")
    .get(req.params.oid, req.params.id) as { id: string; order_status: string; order_number: string } | undefined;

  if (!order) return res.status(404).json({ error: "Order not found." });

  const now = new Date().toISOString();
  db.prepare("UPDATE orders SET order_status = ? WHERE id = ?").run(status, order.id);
  db.prepare(
    "INSERT INTO order_status_history (id, order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(`osh-${Date.now()}`, order.id, status, note || `Order marked ${status}`, req.authUser!.fullName, now);

  // Restore stock if order is cancelled or rejected from an active state
  if ((status === "Cancelled" || status === "Rejected") && order.order_status !== "Cancelled" && order.order_status !== "Rejected") {
    const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(order.id) as Array<{
      product_id: string;
      quantity: number;
    }>;
    const restore = db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?");
    for (const it of items) {
      restore.run(it.quantity, now, it.product_id);
    }
  }

  writeAudit(req.authUser!.fullName, req.authUser!.role, `Updated Order ${order.order_number}`, `Status -> ${status}`);
  return res.json({ ok: true, status });
});

// ==========================================
// 6. PROTECTED SUPER ADMIN ROUTES
// ==========================================

app.get("/api/admin/overview", requireAuth, requireRole("super_admin"), (_req, res) => {
  const businesses = db
    .prepare(
      `SELECT b.*, u.full_name as owner_name, u.email as owner_email,
              (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) as product_count,
              (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id) as order_count
       FROM businesses b
       JOIN users u ON u.id = b.owner_id
       ORDER BY b.created_at DESC`
    )
    .all();

  const users = db
    .prepare("SELECT id, full_name, email, mobile, role, admin_role, email_verified, mobile_verified, status, created_at FROM users ORDER BY created_at DESC")
    .all();

  const products = hydrateProducts(
    db
      .prepare(
        `SELECT p.*, b.name as business_name, b.slug as business_slug
         FROM products p
         JOIN businesses b ON b.id = p.business_id
         ORDER BY p.updated_at DESC`
      )
      .all() as Array<Record<string, unknown>>
  );

  const categories = getPublishedCategoriesWithCounts();
  const allCategoriesCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;

  const auditLogs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80").all();
  const cmsPublished = getLiveCmsConfig();
  const cmsDraft = getCmsConfigByKey("draft_cms") || cmsPublished;
  const hasUnpublishedDraft = JSON.stringify(cmsDraft) !== JSON.stringify(cmsPublished);

  const ordersRaw = db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;
  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const getHist = db.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC");
  const orders = ordersRaw.map((o) => ({
    ...o,
    items: getItems.all(String(o.id)),
    history: getHist.all(String(o.id)),
  }));

  const customerCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get() as { c: number }).c;
  const activeOrders = ordersRaw.filter((o) => o.order_status !== "Cancelled" && o.order_status !== "Rejected");
  const pendingOrdersCount = ordersRaw.filter(
    (o) => o.order_status === "Pending" || o.order_status === "Accepted" || o.order_status === "Preparing"
  ).length;
  const completedOrdersCount = ordersRaw.filter((o) => o.order_status === "Delivered").length;
  const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const lowStockList = products.filter((p) => Number((p as Record<string, unknown>).stock || 0) <= Number((p as Record<string, unknown>).min_stock || 5));
  const publishedHeroBanners = (cmsPublished.heroSlides || []).filter((s) => s.enabled !== false).length;

  // Real Analytics computed from SQLite tables
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyMap = new Map<string, { label: string; sales: number; orders: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { label: dayNames[d.getDay()], sales: 0, orders: 0 });
  }
  activeOrders.forEach((o) => {
    const key = String(o.created_at || "").slice(0, 10);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.sales += Number(o.total || 0);
      bucket.orders += 1;
    }
  });
  const dailySales = Array.from(dailyMap.values());

  const monthMap = new Map<string, { label: string; revenue: number; orders: number }>();
  activeOrders.forEach((o) => {
    const dt = new Date(String(o.created_at || new Date().toISOString()));
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const label = dt.toLocaleString("en-US", { month: "short", year: "2-digit" });
    const prev = monthMap.get(key) || { label, revenue: 0, orders: 0 };
    prev.revenue += Number(o.total || 0);
    prev.orders += 1;
    monthMap.set(key, prev);
  });
  const monthlySales = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  const categoryBreakdown = categories.map((c) => {
    const catRec = c as Record<string, unknown>;
    const count = products.filter(
      (p) =>
        String(p.category_slug || "").toLowerCase() === String(catRec.slug || "").toLowerCase() ||
        String((p as Record<string, unknown>).category || "").toLowerCase() === String(catRec.name || "").toLowerCase()
    ).length;
    return { name: String(catRec.name || ""), slug: String(catRec.slug || ""), count };
  });

  const orderItemRows = db
    .prepare(
      `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as units_sold, SUM(oi.quantity * oi.unit_price) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.order_status NOT IN ('Cancelled', 'Rejected')
       GROUP BY oi.product_id, oi.product_name
       ORDER BY units_sold DESC, revenue DESC
       LIMIT 6`
    )
    .all() as Array<{ product_id: string; product_name: string; units_sold: number; revenue: number }>;

  const topProducts =
    orderItemRows.length > 0
      ? orderItemRows
      : products.slice(0, 5).map((p) => ({
          product_id: String((p as Record<string, unknown>).id),
          product_name: String((p as Record<string, unknown>).name),
          units_sold: 0,
          revenue: Number((p as Record<string, unknown>).selling_price || 0),
        }));

  const versions = db
    .prepare(
      "SELECT id, version_number, status, label, published_by, created_at FROM cms_versions ORDER BY version_number DESC LIMIT 30"
    )
    .all()
    .map((v: Record<string, unknown>) => ({
      id: String(v.id),
      versionNumber: Number(v.version_number),
      status: String(v.status),
      label: String(v.label),
      publishedBy: String(v.published_by),
      createdAt: String(v.created_at),
    }));

  const mediaAssets = computeMediaAssetsWithUsage();

  const pages = db
    .prepare("SELECT * FROM cms_pages ORDER BY is_system DESC, title ASC")
    .all()
    .map((pg: Record<string, unknown>) => ({
      id: String(pg.id),
      slug: String(pg.slug),
      title: String(pg.title),
      heading: String(pg.heading),
      subtitle: String(pg.subtitle || ""),
      bodyHtml: String(pg.body_html || ""),
      imageUrl: String(pg.image_url || ""),
      ctaText: String(pg.cta_text || ""),
      ctaHref: String(pg.cta_href || ""),
      seoTitle: String(pg.seo_title || ""),
      seoDescription: String(pg.seo_description || ""),
      published: Boolean(pg.published),
      isSystem: Boolean(pg.is_system),
      updatedAt: String(pg.updated_at || ""),
    }));

  const contactMessages = db
    .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 25")
    .all() as Array<Record<string, unknown>>;

  const adminUsersRaw = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.status, u.admin_role, u.created_at, ap.permissions_json
       FROM users u
       LEFT JOIN admin_permissions ap ON ap.user_id = u.id
       WHERE u.role = 'super_admin'
       ORDER BY u.created_at ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const adminUsers = adminUsersRaw.map((au) => {
    const access = getAdminAccessForUser(String(au.id), "super_admin", String(au.admin_role || "super_admin"));
    return {
      id: String(au.id),
      fullName: String(au.full_name),
      email: String(au.email || ""),
      mobile: au.mobile ? String(au.mobile) : null,
      status: String(au.status || "active"),
      adminRole: access.adminRole || "super_admin",
      permissions: access.permissions,
      createdAt: String(au.created_at || ""),
    };
  });

  const notifications = [
    ...lowStockList.slice(0, 5).map((p) => ({
      id: `notif-stock-${String((p as Record<string, unknown>).id)}`,
      type: "stock" as const,
      title: `Low Stock: ${String((p as Record<string, unknown>).name)}`,
      detail: `${Number((p as Record<string, unknown>).stock || 0)} units left (min ${Number((p as Record<string, unknown>).min_stock || 5)}).`,
      targetTab: "products",
      createdAt: String((p as Record<string, unknown>).updated_at || new Date().toISOString()),
    })),
    ...ordersRaw
      .filter((o) => o.order_status === "Pending")
      .slice(0, 5)
      .map((o) => ({
        id: `notif-ord-${String(o.id)}`,
        type: "order" as const,
        title: `New Pending Order #${String(o.order_number)}`,
        detail: `${String(o.customer_name)} · Rs. ${Number(o.total || 0).toLocaleString()}`,
        targetTab: "orders",
        createdAt: String(o.created_at || new Date().toISOString()),
      })),
    ...contactMessages.slice(0, 5).map((m) => ({
      id: `notif-msg-${String(m.id)}`,
      type: "message" as const,
      title: `Inquiry from ${String(m.name)}`,
      detail: String(m.subject || m.message || "").slice(0, 80),
      targetTab: "notifications",
      createdAt: String(m.created_at || new Date().toISOString()),
    })),
  ];

  const customFonts = db.prepare("SELECT id, name, url, format FROM custom_fonts ORDER BY created_at DESC").all();

  return res.json({
    stats: {
      totalProducts: products.length,
      totalCategories: allCategoriesCount,
      totalOrders: orders.length,
      pendingOrders: pendingOrdersCount,
      completedOrders: completedOrdersCount,
      totalCustomers: customerCount,
      totalRevenue,
      lowStockProducts: lowStockList.length,
      publishedHeroBanners,
    },
    analytics: {
      dailySales,
      monthlySales,
      categoryBreakdown,
      topProducts,
    },
    businesses,
    users,
    products,
    orders,
    auditLogs,
    cms: cmsPublished,
    cmsDraft,
    cmsPublished,
    hasUnpublishedDraft,
    versions,
    mediaAssets,
    pages,
    contactMessages,
    adminUsers,
    notifications,
    customFonts,
  });
});

app.get("/api/admin/orders", requireAuth, requirePermission("orders_customers"), (_req, res) => {
  const ordersRaw = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const getHist = db.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC");
  return res.json({
    orders: ordersRaw.map((o) => ({
      ...o,
      items: getItems.all(String(o.id)),
      history: getHist.all(String(o.id)),
    })),
  });
});

app.patch("/api/admin/orders/:id/status", requireAuth, requirePermission("orders_customers"), (req: AuthedRequest, res) => {
  const { status, paymentStatus, note } = req.body as {
    status?: string;
    paymentStatus?: string;
    note?: string;
  };
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as
    | { id: string; order_status: string; payment_status: string; order_number: string }
    | undefined;
  if (!order) return res.status(404).json({ error: "Order not found." });

  const now = new Date().toISOString();
  const nextStatus = status || order.order_status;
  const nextPayment = paymentStatus || order.payment_status;

  db.prepare("UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?").run(
    nextStatus,
    nextPayment,
    order.id
  );
  db.prepare(
    "INSERT INTO order_status_history (id, order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    `osh-${Date.now()}`,
    order.id,
    nextStatus,
    note || `Order updated to ${nextStatus} (Payment: ${nextPayment})`,
    req.authUser!.fullName,
    now
  );

  if (
    (nextStatus === "Cancelled" || nextStatus === "Rejected") &&
    order.order_status !== "Cancelled" &&
    order.order_status !== "Rejected"
  ) {
    const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(order.id) as Array<{
      product_id: string;
      quantity: number;
    }>;
    const restore = db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?");
    for (const it of items) {
      restore.run(it.quantity, now, it.product_id);
    }
  }

  writeAudit(req.authUser!.fullName, req.authUser!.adminRole || "super_admin", `Updated Order ${order.order_number}`, `${nextStatus} / ${nextPayment}`);
  return res.json({ ok: true, status: nextStatus, paymentStatus: nextPayment });
});

app.get("/api/admin/customers", requireAuth, requirePermission("orders_customers"), (_req, res) => {
  const customers = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.role, u.status, u.created_at,
              COUNT(o.id) as order_count,
              COALESCE(SUM(o.total), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON o.customer_id = u.id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();
  return res.json({ customers });
});

app.patch("/api/admin/businesses/:id", requireAuth, requirePermission("settings_seo"), (req: AuthedRequest, res) => {
  const { approvalStatus, plan, onlineStoreEnabled } = req.body as {
    approvalStatus?: "approved" | "pending" | "suspended";
    plan?: string;
    onlineStoreEnabled?: boolean;
  };
  db.prepare(
    `UPDATE businesses
     SET approval_status = COALESCE(?, approval_status),
         plan = COALESCE(?, plan),
         online_store_enabled = COALESCE(?, online_store_enabled)
     WHERE id = ?`
  ).run(
    approvalStatus ?? null,
    plan ?? null,
    typeof onlineStoreEnabled === "boolean" ? (onlineStoreEnabled ? 1 : 0) : null,
    req.params.id
  );
  writeAudit(req.authUser!.fullName, "super_admin", "Updated Business Tenant", `${req.params.id} -> ${approvalStatus || plan || "updated"}`);
  const updated = db.prepare("SELECT * FROM businesses WHERE id = ?").get(req.params.id);
  return res.json({ business: updated });
});

app.patch("/api/admin/users/:id", requireAuth, requirePermission("orders_customers", "users_logs_backup"), (req: AuthedRequest, res) => {
  const { status, role } = req.body as { status?: "active" | "suspended"; role?: AuthUser["role"] };
  db.prepare(
    `UPDATE users SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?`
  ).run(status ?? null, role ?? null, req.params.id);
  writeAudit(req.authUser!.fullName, req.authUser!.adminRole || "super_admin", "Updated User Access", `${req.params.id} -> ${status || role}`);
  return res.json({ ok: true });
});

app.patch("/api/admin/products/:id/moderate", requireAuth, requirePermission("products_categories"), (req: AuthedRequest, res) => {
  const { published, active } = req.body as { published?: boolean; active?: boolean };
  db.prepare(
    `UPDATE products SET published = COALESCE(?, published), active = COALESCE(?, active) WHERE id = ?`
  ).run(
    typeof published === "boolean" ? (published ? 1 : 0) : null,
    typeof active === "boolean" ? (active ? 1 : 0) : null,
    req.params.id
  );
  writeAudit(req.authUser!.fullName, "super_admin", "Moderated Product", req.params.id);
  return res.json({ ok: true });
});

// Save CMS Draft WITHOUT changing live public website
app.post(
  "/api/admin/cms/draft",
  requireAuth,
  requirePermission(
    "visual_editor",
    "hero_media",
    "branding_nav_footer",
    "colors_typography",
    "marquee_animations",
    "sections_pages",
    "settings_seo"
  ),
  (req: AuthedRequest, res) => {
    const { cms } = req.body as { cms: Record<string, unknown> };
    if (!cms) return res.status(400).json({ error: "CMS payload required." });
    const merged = {
      ...mergeCmsWithDefaults(cms),
      status: "Draft" as const,
    };
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO cms_state (key, json_value, updated_at) VALUES ('draft_cms', ?, ?) ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at"
    ).run(JSON.stringify(merged), now);
    writeAudit(req.authUser!.fullName, req.authUser!.adminRole || "super_admin", "Saved Website Draft", `Version ${merged.versionNumber}`);
    return res.json({ ok: true, cmsDraft: merged });
  }
);

function publishCmsPayload(cms: Record<string, unknown>, actorName: string, actorRole: string, label?: string) {
  const currentPub = getLiveCmsConfig();
  const nextVersion = Math.max(Number(currentPub.versionNumber || 1), Number((cms.versionNumber as number) || 1)) + 1;
  const now = new Date().toISOString();
  const merged = {
    ...mergeCmsWithDefaults(cms),
    versionNumber: nextVersion,
    status: "Published" as const,
    lastPublishedAt: now,
    lastPublishedBy: actorName,
  };
  const serialized = JSON.stringify(merged);

  db.prepare(
    "INSERT INTO cms_state (key, json_value, updated_at) VALUES ('public_cms', ?, ?) ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at"
  ).run(serialized, now);
  db.prepare(
    "INSERT INTO cms_state (key, json_value, updated_at) VALUES ('draft_cms', ?, ?) ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at"
  ).run(serialized, now);

  db.prepare(
    `INSERT INTO cms_versions (id, version_number, status, label, published_by, config_json, created_at)
     VALUES (?, ?, 'Published', ?, ?, ?, ?)`
  ).run(
    `ver-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    nextVersion,
    label?.trim() || `Published Storefront v${nextVersion}`,
    actorName,
    serialized,
    now
  );

  syncNormalizedCmsTables(merged as unknown as Parameters<typeof syncNormalizedCmsTables>[0]);

  const st = merged.storeSettings;
  if (st) {
    db.prepare(
      `UPDATE businesses
       SET name = ?, city = ?, address = ?, phone = ?, whatsapp = ?, hours = ?, description = ?
       WHERE id = 'biz-thar-style'`
    ).run(
      st.storeName || merged.brandName || "THAR STYLE",
      st.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan",
      st.address || "",
      st.phone || "",
      st.whatsapp || "",
      st.openingHours || "",
      st.aboutStory || ""
    );
  }

  writeAudit(actorName, actorRole, "Published Website & Store Settings Update", `Version v${nextVersion}`);
  return merged;
}

app.patch(
  "/api/admin/cms",
  requireAuth,
  requirePermission(
    "visual_editor",
    "hero_media",
    "branding_nav_footer",
    "colors_typography",
    "marquee_animations",
    "sections_pages",
    "settings_seo"
  ),
  (req: AuthedRequest, res) => {
    const { cms, label } = req.body as { cms: Record<string, unknown>; label?: string };
    if (!cms) return res.status(400).json({ error: "CMS payload required." });
    const published = publishCmsPayload(cms, req.authUser!.fullName, req.authUser!.adminRole || "super_admin", label);
    return res.json({ ok: true, cms: published });
  }
);

app.post(
  "/api/admin/cms/publish",
  requireAuth,
  requirePermission(
    "visual_editor",
    "hero_media",
    "branding_nav_footer",
    "colors_typography",
    "marquee_animations",
    "sections_pages",
    "settings_seo"
  ),
  (req: AuthedRequest, res) => {
    const { cms, label } = req.body as { cms?: Record<string, unknown>; label?: string };
    const source = cms || (getCmsConfigByKey("draft_cms") as unknown as Record<string, unknown>);
    if (!source) return res.status(400).json({ error: "No CMS configuration to publish." });
    const published = publishCmsPayload(source, req.authUser!.fullName, req.authUser!.adminRole || "super_admin", label);
    return res.json({ ok: true, cms: published });
  }
);

app.get("/api/admin/cms/versions", requireAuth, requireRole("super_admin"), (_req, res) => {
  const versions = db
    .prepare(
      "SELECT id, version_number, status, label, published_by, created_at FROM cms_versions ORDER BY version_number DESC LIMIT 40"
    )
    .all()
    .map((v: Record<string, unknown>) => ({
      id: String(v.id),
      versionNumber: Number(v.version_number),
      status: String(v.status),
      label: String(v.label),
      publishedBy: String(v.published_by),
      createdAt: String(v.created_at),
    }));
  return res.json({ versions });
});

app.post(
  "/api/admin/cms/versions/:id/restore",
  requireAuth,
  requirePermission("visual_editor", "users_logs_backup"),
  (req: AuthedRequest, res) => {
    const row = db.prepare("SELECT * FROM cms_versions WHERE id = ?").get(req.params.id) as
      | { id: string; version_number: number; label: string; config_json: string }
      | undefined;
    if (!row) return res.status(404).json({ error: "Version snapshot not found." });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.config_json) as Record<string, unknown>;
    } catch {
      return res.status(500).json({ error: "Corrupted version snapshot." });
    }

    const restored = publishCmsPayload(
      parsed,
      req.authUser!.fullName,
      req.authUser!.adminRole || "super_admin",
      `Restored from v${row.version_number}`
    );
    writeAudit(req.authUser!.fullName, "super_admin", "Restored Website Version", `Restored v${row.version_number} -> v${restored.versionNumber}`, "warning");
    return res.json({ ok: true, cms: restored });
  }
);

// Media Library CRUD
app.get("/api/admin/media", requireAuth, requireRole("super_admin"), (_req, res) => {
  return res.json({ mediaAssets: computeMediaAssetsWithUsage() });
});

app.put("/api/admin/media/:id", requireAuth, requirePermission("hero_media", "visual_editor"), (req: AuthedRequest, res) => {
  const { name, category, altText } = req.body as { name?: string; category?: string; altText?: string };
  db.prepare(
    `UPDATE media_assets SET name = COALESCE(?, name), category = COALESCE(?, category), alt_text = COALESCE(?, alt_text) WHERE id = ?`
  ).run(name ?? null, category ?? null, altText ?? null, req.params.id);
  return res.json({ ok: true, mediaAssets: computeMediaAssetsWithUsage() });
});

app.delete("/api/admin/media/:id", requireAuth, requirePermission("hero_media", "visual_editor"), (req: AuthedRequest, res) => {
  const force = String(req.query.force || "") === "true";
  const all = computeMediaAssetsWithUsage();
  const target = all.find((m) => m.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Media asset not found." });
  if (target.usedIn.length > 0 && !force) {
    return res.status(409).json({
      error: `This image is currently used in: ${target.usedIn.join(", ")}. Confirm forced delete or replace it first.`,
      usedIn: target.usedIn,
      inUse: true,
    });
  }
  db.prepare("DELETE FROM media_assets WHERE id = ?").run(req.params.id);
  if (target.url.startsWith("/uploads/")) {
    const filePath = path.join(UPLOADS_DIR, path.basename(target.url));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore fs cleanup issues
      }
    }
  }
  writeAudit(req.authUser!.fullName, "super_admin", "Deleted Media Asset", target.name, "warning");
  return res.json({ ok: true });
});

// Store Pages CMS CRUD
app.get("/api/admin/pages", requireAuth, requireRole("super_admin"), (_req, res) => {
  const pages = db
    .prepare("SELECT * FROM cms_pages ORDER BY is_system DESC, title ASC")
    .all()
    .map((pg: Record<string, unknown>) => ({
      id: String(pg.id),
      slug: String(pg.slug),
      title: String(pg.title),
      heading: String(pg.heading),
      subtitle: String(pg.subtitle || ""),
      bodyHtml: String(pg.body_html || ""),
      imageUrl: String(pg.image_url || ""),
      ctaText: String(pg.cta_text || ""),
      ctaHref: String(pg.cta_href || ""),
      seoTitle: String(pg.seo_title || ""),
      seoDescription: String(pg.seo_description || ""),
      published: Boolean(pg.published),
      isSystem: Boolean(pg.is_system),
      updatedAt: String(pg.updated_at || ""),
    }));
  return res.json({ pages });
});

app.post("/api/admin/pages", requireAuth, requirePermission("sections_pages", "visual_editor"), (req: AuthedRequest, res) => {
  const { title, slug, heading, subtitle, bodyHtml, imageUrl, ctaText, ctaHref, seoTitle, seoDescription, published } =
    req.body as Record<string, unknown>;
  if (!String(title || "").trim() || !String(slug || "").trim()) {
    return res.status(400).json({ error: "Page title and slug are required." });
  }
  const cleanSlug = String(slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  const exists = db.prepare("SELECT id FROM cms_pages WHERE lower(slug) = lower(?)").get(cleanSlug);
  if (exists) return res.status(409).json({ error: `Page with slug "${cleanSlug}" already exists.` });

  const id = `page-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO cms_pages (id, slug, title, heading, subtitle, body_html, image_url, cta_text, cta_href, seo_title, seo_description, published, is_system, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    cleanSlug,
    String(title).trim(),
    String(heading || title).trim(),
    String(subtitle || ""),
    sanitizeCmsHtml(String(bodyHtml || "")),
    String(imageUrl || ""),
    String(ctaText || ""),
    String(ctaHref || ""),
    String(seoTitle || title).trim(),
    String(seoDescription || ""),
    published === false ? 0 : 1,
    now
  );
  writeAudit(req.authUser!.fullName, "super_admin", "Created CMS Page", cleanSlug);
  return res.status(201).json({ ok: true, id });
});

app.put("/api/admin/pages/:id", requireAuth, requirePermission("sections_pages", "visual_editor"), (req: AuthedRequest, res) => {
  const existing = db.prepare("SELECT * FROM cms_pages WHERE id = ?").get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "Page not found." });

  const { title, heading, subtitle, bodyHtml, imageUrl, ctaText, ctaHref, seoTitle, seoDescription, published } =
    req.body as Record<string, unknown>;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE cms_pages
     SET title = COALESCE(?, title),
         heading = COALESCE(?, heading),
         subtitle = COALESCE(?, subtitle),
         body_html = COALESCE(?, body_html),
         image_url = COALESCE(?, image_url),
         cta_text = COALESCE(?, cta_text),
         cta_href = COALESCE(?, cta_href),
         seo_title = COALESCE(?, seo_title),
         seo_description = COALESCE(?, seo_description),
         published = COALESCE(?, published),
         updated_at = ?
     WHERE id = ?`
  ).run(
    typeof title === "string" ? title.trim() : null,
    typeof heading === "string" ? heading.trim() : null,
    typeof subtitle === "string" ? subtitle : null,
    typeof bodyHtml === "string" ? sanitizeCmsHtml(bodyHtml) : null,
    typeof imageUrl === "string" ? imageUrl : null,
    typeof ctaText === "string" ? ctaText : null,
    typeof ctaHref === "string" ? ctaHref : null,
    typeof seoTitle === "string" ? seoTitle : null,
    typeof seoDescription === "string" ? seoDescription : null,
    typeof published === "boolean" ? (published ? 1 : 0) : null,
    now,
    req.params.id
  );

  // Also sync key policy / about fields into public_cms.storeSettings for backwards compatibility
  if (existing.slug === "about-us" && typeof bodyHtml === "string") {
    const live = getLiveCmsConfig();
    live.storeSettings.aboutStory = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    db.prepare("UPDATE cms_state SET json_value = ?, updated_at = ? WHERE key = 'public_cms'").run(
      JSON.stringify(live),
      now
    );
  }

  writeAudit(req.authUser!.fullName, "super_admin", "Updated CMS Page", String(existing.title));
  return res.json({ ok: true });
});

app.delete("/api/admin/pages/:id", requireAuth, requirePermission("sections_pages"), (req: AuthedRequest, res) => {
  const existing = db.prepare("SELECT is_system, title FROM cms_pages WHERE id = ?").get(req.params.id) as
    | { is_system: number; title: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: "Page not found." });
  if (existing.is_system) {
    return res.status(400).json({ error: "Core store pages cannot be deleted, but you can toggle visibility off." });
  }
  db.prepare("DELETE FROM cms_pages WHERE id = ?").run(req.params.id);
  writeAudit(req.authUser!.fullName, "super_admin", "Deleted Custom CMS Page", existing.title, "warning");
  return res.json({ ok: true });
});

// Admin Team & RBAC Permissions CRUD
app.get("/api/admin/team", requireAuth, requirePermission("users_logs_backup"), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.status, u.admin_role, u.created_at
       FROM users u
       WHERE u.role = 'super_admin'
       ORDER BY u.created_at ASC`
    )
    .all() as Array<Record<string, unknown>>;
  return res.json({
    adminUsers: rows.map((r) => {
      const access = getAdminAccessForUser(String(r.id), "super_admin", String(r.admin_role || "super_admin"));
      return {
        id: String(r.id),
        fullName: String(r.full_name),
        email: String(r.email || ""),
        mobile: r.mobile ? String(r.mobile) : null,
        status: String(r.status || "active"),
        adminRole: access.adminRole,
        permissions: access.permissions,
        createdAt: String(r.created_at || ""),
      };
    }),
  });
});

app.post("/api/admin/team", requireAuth, requirePermission("users_logs_backup"), (req: AuthedRequest, res) => {
  const { fullName, email, mobile, password, adminRole, permissions } = req.body as {
    fullName?: string;
    email?: string;
    mobile?: string;
    password?: string;
    adminRole?: string;
    permissions?: string[];
  };
  if (!fullName?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: "Full name, valid email, and password (min 6 chars) are required." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(cleanEmail)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const id = `usr-adm-${Date.now()}`;
  const now = new Date().toISOString();
  const safeRole = adminRole || "website_manager";
  const permList =
    safeRole === "super_admin"
      ? [...ALL_ADMIN_PERMISSIONS]
      : Array.isArray(permissions)
      ? permissions
      : ["overview", "visual_editor"];

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO users (id, full_name, email, mobile, password_hash, role, admin_role, email_verified, mobile_verified, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'super_admin', ?, 1, 1, 'active', ?)`
    ).run(id, fullName.trim(), cleanEmail, mobile?.trim() || null, hashPassword(password), safeRole, now);

    db.prepare(
      `INSERT INTO admin_permissions (user_id, admin_role, permissions_json, updated_at)
       VALUES (?, ?, ?, ?)`
    ).run(id, safeRole, JSON.stringify(permList), now);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  writeAudit(req.authUser!.fullName, "super_admin", "Created Admin Staff Account", `${cleanEmail} (${safeRole})`);
  return res.status(201).json({ ok: true, id });
});

app.patch("/api/admin/team/:id", requireAuth, requirePermission("users_logs_backup"), (req: AuthedRequest, res) => {
  const { fullName, status, adminRole, permissions } = req.body as {
    fullName?: string;
    status?: "active" | "suspended";
    adminRole?: string;
    permissions?: string[];
  };
  if (req.params.id === req.authUser!.id && status === "suspended") {
    return res.status(400).json({ error: "You cannot suspend your own active admin session." });
  }
  const now = new Date().toISOString();
  if (fullName || status || adminRole) {
    db.prepare(
      `UPDATE users SET full_name = COALESCE(?, full_name), status = COALESCE(?, status), admin_role = COALESCE(?, admin_role) WHERE id = ? AND role = 'super_admin'`
    ).run(fullName?.trim() || null, status || null, adminRole || null, req.params.id);
  }
  if (adminRole || Array.isArray(permissions)) {
    const existing = db
      .prepare("SELECT admin_role, permissions_json FROM admin_permissions WHERE user_id = ?")
      .get(req.params.id) as { admin_role: string; permissions_json: string } | undefined;
    const nextRole = adminRole || existing?.admin_role || "website_manager";
    const nextPerms =
      nextRole === "super_admin"
        ? [...ALL_ADMIN_PERMISSIONS]
        : Array.isArray(permissions)
        ? permissions
        : parseJsonArray(existing?.permissions_json);
    db.prepare(
      `INSERT INTO admin_permissions (user_id, admin_role, permissions_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET admin_role = excluded.admin_role, permissions_json = excluded.permissions_json, updated_at = excluded.updated_at`
    ).run(req.params.id, nextRole, JSON.stringify(nextPerms), now);
  }
  writeAudit(req.authUser!.fullName, "super_admin", "Updated Admin Staff Permissions", req.params.id);
  return res.json({ ok: true });
});

app.delete("/api/admin/team/:id", requireAuth, requirePermission("users_logs_backup"), (req: AuthedRequest, res) => {
  if (req.params.id === req.authUser!.id || req.params.id === "usr-super-admin") {
    return res.status(400).json({ error: "Primary Super Admin or current active user cannot be deleted." });
  }
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'super_admin'").run(req.params.id);
  writeAudit(req.authUser!.fullName, "super_admin", "Removed Admin Staff Account", req.params.id, "warning");
  return res.json({ ok: true });
});

// Backup & Restore JSON Export / Import
app.get("/api/admin/backup", requireAuth, requirePermission("users_logs_backup"), (req: AuthedRequest, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    exportedBy: req.authUser!.fullName,
    store: "THAR STYLE · Mithi, Tharparkar",
    schemaVersion: 1,
    publicCms: getLiveCmsConfig(),
    draftCms: getCmsConfigByKey("draft_cms") || getLiveCmsConfig(),
    categories: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all(),
    pages: db.prepare("SELECT * FROM cms_pages").all(),
    mediaAssets: db.prepare("SELECT * FROM media_assets").all(),
    customFonts: db.prepare("SELECT * FROM custom_fonts").all(),
  };
  writeAudit(req.authUser!.fullName, "super_admin", "Exported Storefront Backup", "JSON Snapshot");
  return res.json({ backup });
});

app.post("/api/admin/restore", requireAuth, requirePermission("users_logs_backup"), (req: AuthedRequest, res) => {
  const { backup } = req.body as {
    backup?: {
      publicCms?: Record<string, unknown>;
      draftCms?: Record<string, unknown>;
      pages?: Array<Record<string, unknown>>;
    };
  };
  if (!backup || !backup.publicCms) {
    return res.status(400).json({ error: "Invalid backup JSON: missing publicCms object." });
  }

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    if (Array.isArray(backup.pages)) {
      const upPage = db.prepare(
        `INSERT INTO cms_pages (id, slug, title, heading, subtitle, body_html, image_url, cta_text, cta_href, seo_title, seo_description, published, is_system, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           heading = excluded.heading,
           subtitle = excluded.subtitle,
           body_html = excluded.body_html,
           image_url = excluded.image_url,
           cta_text = excluded.cta_text,
           cta_href = excluded.cta_href,
           seo_title = excluded.seo_title,
           seo_description = excluded.seo_description,
           published = excluded.published,
           updated_at = excluded.updated_at`
      );
      for (const pg of backup.pages) {
        upPage.run(
          String(pg.id),
          String(pg.slug),
          String(pg.title || ""),
          String(pg.heading || ""),
          String(pg.subtitle || ""),
          sanitizeCmsHtml(String(pg.body_html || pg.bodyHtml || "")),
          String(pg.image_url || pg.imageUrl || ""),
          String(pg.cta_text || pg.ctaText || ""),
          String(pg.cta_href || pg.ctaHref || ""),
          String(pg.seo_title || pg.seoTitle || ""),
          String(pg.seo_description || pg.seoDescription || ""),
          pg.published === false || pg.published === 0 ? 0 : 1,
          pg.is_system || pg.isSystem ? 1 : 0,
          now
        );
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const published = publishCmsPayload(
    backup.publicCms,
    req.authUser!.fullName,
    "super_admin",
    "Backup JSON Restore"
  );
  writeAudit(req.authUser!.fullName, "super_admin", "Restored Storefront From JSON Backup", `Version v${published.versionNumber}`, "warning");
  return res.json({ ok: true, cms: published });
});

// Super Admin Category Management CRUD + Safe Reassignment Delete
app.get("/api/admin/categories", requireAuth, requirePermission("products_categories", "sections_pages"), (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM categories ORDER BY sort_order ASC, name ASC")
    .all() as Array<Record<string, unknown>>;
  const countStmt = db.prepare(
    `SELECT COUNT(*) as product_count, COUNT(DISTINCT p.business_id) as store_count
     FROM products p
     WHERE lower(p.category_slug) = lower(?) OR lower(p.category) = lower(?)`
  );
  const categories = rows.map((c) => {
    const counts = countStmt.get(String(c.slug), String(c.name)) as {
      product_count: number;
      store_count: number;
    };
    return {
      ...c,
      subcategories: parseJsonArray(c.subcategories_json),
      published: Boolean(c.published),
      featured: Boolean(c.featured),
      product_count: counts?.product_count || 0,
      store_count: counts?.store_count || 0,
    };
  });
  return res.json({ categories });
});

app.post("/api/admin/categories", requireAuth, requirePermission("products_categories"), (req: AuthedRequest, res) => {
  const { name, slug, description, imageUrl, subcategories, published, featured, sortOrder } = req.body as {
    name?: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
    subcategories?: string[];
    published?: boolean;
    featured?: boolean;
    sortOrder?: number;
  };
  if (!name?.trim()) {
    return res.status(400).json({ error: "Category name is required." });
  }
  const cleanSlug = (slug?.trim() || name.trim())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanSlug) {
    return res.status(400).json({ error: "A valid URL slug is required." });
  }
  const exists = db.prepare("SELECT id FROM categories WHERE lower(slug) = lower(?)").get(cleanSlug);
  if (exists) {
    return res.status(409).json({ error: `A category with slug "${cleanSlug}" already exists.` });
  }

  const maxSortRow = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as m FROM categories").get() as { m: number };
  const id = `cat-${cleanSlug}-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO categories (id, slug, name, description, image_url, subcategories_json, sort_order, published, featured, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    cleanSlug,
    name.trim(),
    (description || "").trim(),
    imageUrl || "/src/assets/images/hero_clothing_store_1794817075010.jpg",
    JSON.stringify(Array.isArray(subcategories) ? subcategories : []),
    typeof sortOrder === "number" ? sortOrder : (maxSortRow?.m || 0) + 1,
    published === false ? 0 : 1,
    featured ? 1 : 0,
    now
  );

  writeAudit(req.authUser!.fullName, "super_admin", "Created Category", `/category/${cleanSlug}`);
  const created = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as Record<string, unknown>;
  return res.status(201).json({
    category: {
      ...created,
      subcategories: parseJsonArray(created.subcategories_json),
      published: Boolean(created.published),
      featured: Boolean(created.featured),
      product_count: 0,
      store_count: 0,
    },
  });
});

app.patch("/api/admin/categories/reorder", requireAuth, requirePermission("products_categories"), (req: AuthedRequest, res) => {
  const { orderedIds } = req.body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: "orderedIds array is required." });
  }
  const upd = db.prepare("UPDATE categories SET sort_order = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    orderedIds.forEach((cid, idx) => {
      upd.run(idx + 1, String(cid));
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  writeAudit(req.authUser!.fullName, "super_admin", "Reordered Categories", `${orderedIds.length} categories`);
  return res.json({ ok: true });
});

app.put("/api/admin/categories/:id", requireAuth, requirePermission("products_categories"), (req: AuthedRequest, res) => {
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id) as
    | { id: string; slug: string; name: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: "Category not found." });

  const { name, slug, description, imageUrl, subcategories, published, featured, sortOrder } = req.body as {
    name?: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
    subcategories?: string[];
    published?: boolean;
    featured?: boolean;
    sortOrder?: number;
  };

  const nextSlug = slug
    ? slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : existing.slug;

  if (nextSlug !== existing.slug) {
    const clash = db
      .prepare("SELECT id FROM categories WHERE lower(slug) = lower(?) AND id != ?")
      .get(nextSlug, existing.id);
    if (clash) {
      return res.status(409).json({ error: `Slug "${nextSlug}" is already used by another category.` });
    }
  }

  const nextName = name?.trim() || existing.name;
  db.prepare(
    `UPDATE categories
     SET name = ?,
         slug = ?,
         description = COALESCE(?, description),
         image_url = COALESCE(?, image_url),
         subcategories_json = COALESCE(?, subcategories_json),
         published = COALESCE(?, published),
         featured = COALESCE(?, featured),
         sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(
    nextName,
    nextSlug,
    typeof description === "string" ? description : null,
    typeof imageUrl === "string" && imageUrl ? imageUrl : null,
    Array.isArray(subcategories) ? JSON.stringify(subcategories) : null,
    typeof published === "boolean" ? (published ? 1 : 0) : null,
    typeof featured === "boolean" ? (featured ? 1 : 0) : null,
    typeof sortOrder === "number" ? sortOrder : null,
    existing.id
  );

  if (nextSlug !== existing.slug || nextName !== existing.name) {
    db.prepare(
      "UPDATE products SET category = ?, category_slug = ? WHERE lower(category_slug) = lower(?) OR lower(category) = lower(?)"
    ).run(nextName, nextSlug, existing.slug, existing.name);
  }

  writeAudit(req.authUser!.fullName, "super_admin", "Updated Category", `${nextName} (/category/${nextSlug})`);
  const updated = db.prepare("SELECT * FROM categories WHERE id = ?").get(existing.id) as Record<string, unknown>;
  return res.json({
    category: {
      ...updated,
      subcategories: parseJsonArray(updated.subcategories_json),
      published: Boolean(updated.published),
      featured: Boolean(updated.featured),
    },
  });
});

app.delete("/api/admin/categories/:id", requireAuth, requirePermission("products_categories"), (req: AuthedRequest, res) => {
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id) as
    | { id: string; slug: string; name: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: "Category not found." });

  const countRow = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM products WHERE lower(category_slug) = lower(?) OR lower(category) = lower(?)"
    )
    .get(existing.slug, existing.name) as { cnt: number };

  const reassignId =
    String((req.body as { reassignCategoryId?: string } | undefined)?.reassignCategoryId || req.query.reassignCategoryId || "").trim();

  if (countRow.cnt > 0) {
    if (!reassignId || reassignId === existing.id) {
      return res.status(409).json({
        error: `This category has ${countRow.cnt} product(s). Please select a target category to reassign those products before deleting.`,
        productCount: countRow.cnt,
        requiresReassignment: true,
      });
    }
    const targetCat = db.prepare("SELECT * FROM categories WHERE id = ?").get(reassignId) as
      | { id: string; slug: string; name: string }
      | undefined;
    if (!targetCat) {
      return res.status(400).json({ error: "Target reassignment category not found." });
    }

    db.exec("BEGIN");
    try {
      db.prepare(
        "UPDATE products SET category = ?, category_slug = ? WHERE lower(category_slug) = lower(?) OR lower(category) = lower(?)"
      ).run(targetCat.name, targetCat.slug, existing.slug, existing.name);
      db.prepare("DELETE FROM categories WHERE id = ?").run(existing.id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    writeAudit(
      req.authUser!.fullName,
      "super_admin",
      "Deleted Category With Safe Product Reassignment",
      `${existing.name} -> ${targetCat.name} (${countRow.cnt} products)`
    );
    return res.json({ ok: true, reassignedCount: countRow.cnt, targetCategory: targetCat.name });
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(existing.id);
  writeAudit(req.authUser!.fullName, "super_admin", "Deleted Empty Category", existing.name);
  return res.json({ ok: true, reassignedCount: 0 });
});

// ==========================================
// 7. EXISTING AI, SYNC & DIGITAL PAYMENT ROUTES
// ==========================================

app.post("/api/ai/command", async (req, res) => {
  try {
    const { command, language, context } = req.body as {
      command: string;
      language?: string;
      context?: {
        businessName?: string;
        industry?: string;
        products?: Array<{ id: string; name: string; unit: string; sellingPrice: number; stock: number }>;
        customers?: Array<{ id: string; name: string; balance: number }>;
        totals?: { sales: number; purchases: number; profit: number };
      };
    };

    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Command text is required." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured in environment secrets. Please set GEMINI_API_KEY in Settings > Secrets.",
      });
    }

    const productSummary = (context?.products || [])
      .slice(0, 30)
      .map((p) => `${p.name} (${p.stock} ${p.unit}, Rs.${p.sellingPrice})`)
      .join("; ");

    const customerSummary = (context?.customers || [])
      .slice(0, 20)
      .map((c) => `${c.name} (Udhaar: Rs.${c.balance})`)
      .join("; ");

    const systemInstruction = `You are Karobar Saathi AI, a bilingual Pakistani business assistant fluent in Roman Urdu, Urdu script, English, and basic Punjabi business terms (cheeni=sugar, atta=flour, doodh=milk, munafa=profit, udhaar=credit, khata=ledger, rupay/rs=PKR).
Analyze the user's command for "${context?.businessName || "Ali General Store"}" (${context?.industry || "Kiryana / General Store"}).
Available products: ${productSummary || "Cheeni, Atta, Doodh Powder, Cooking Oil, Mobile Charger"}.
Known customers: ${customerSummary || "Ali Raza, Bilal Traders, Usman Ahmed"}.
Current totals: Sales Rs.${context?.totals?.sales ?? 185750}, Purchases Rs.${context?.totals?.purchases ?? 120000}, Net Profit Rs.${context?.totals?.profit ?? 65750}.
Preferred reply style: ${language === "ur" ? "Urdu / Roman Urdu polite" : "Clear Roman Urdu + English business style"}.
CRITICAL FINANCIAL SAFETY RULE: Any transaction that changes financial or stock state (CREATE_SALE, RECORD_PAYMENT, ADD_EXPENSE, CREATE_PO) MUST set requiresConfirmation = true and ask a clear confirmation question in confirmationPrompt with the exact Rs. amount, customer/product, and quantity.`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: command,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              description:
                "One of: CREATE_SALE, RECORD_PAYMENT, ADD_EXPENSE, CHECK_STOCK, CHECK_KHATA, PROFIT_REPORT, CREATE_PO, GENERAL_ADVICE",
            },
            confidence: { type: Type.NUMBER, description: "0 to 1 confidence score" },
            requiresConfirmation: { type: Type.BOOLEAN },
            confirmationPrompt: {
              type: Type.STRING,
              description: "Exact confirmation question in Roman Urdu/English before executing financial transaction",
            },
            spokenReply: {
              type: Type.STRING,
              description: "Helpful concise reply to read aloud or show to the business owner",
            },
            extracted: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                customerName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                expenseCategory: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
              },
            },
          },
          required: ["intent", "confidence", "requiresConfirmation", "spokenReply"],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim());
    return res.json({ result: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process AI command.";
    console.error("AI Command Error:", message);
    return res.status(500).json({ error: message });
  }
});

app.post("/api/ai/insights", async (req, res) => {
  try {
    const { businessName, industry, lowStockItems, overdueCustomers, salesTotal, profitTotal } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured in Settings > Secrets.",
      });
    }

    const prompt = `Business: ${businessName} (${industry}).
Sales this month: Rs.${salesTotal}, Net Profit: Rs.${profitTotal}.
Low stock items: ${JSON.stringify(lowStockItems || [])}.
Overdue Khata customers: ${JSON.stringify(overdueCustomers || [])}.
Generate 3 actionable Pakistani business recommendations (stock reorder, udhaar recovery, or margin optimization). Include confidence percentage (65-95), dataPeriod, and assumption for each.`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              agent: { type: Type.STRING },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              actionLabel: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              dataPeriod: { type: Type.STRING },
              assumption: { type: Type.STRING },
            },
            required: ["agent", "title", "summary", "actionLabel", "confidence", "dataPeriod", "assumption"],
          },
        },
      },
    });

    const insights = JSON.parse((response.text ?? "[]").trim());
    return res.json({ insights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate AI insights.";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/sync", (req, res) => {
  const { tenantId, events } = req.body as {
    tenantId: string;
    events: Array<{ idempotencyKey: string; type: string; createdAt: string }>;
  };

  if (!tenantId || !Array.isArray(events)) {
    return res.status(400).json({ error: "Invalid sync payload." });
  }

  const syncedIds: string[] = [];
  let duplicateCount = 0;

  for (const evt of events) {
    const key = `${tenantId}:${evt.idempotencyKey}`;
    if (syncedIdempotencyKeys.has(key)) {
      duplicateCount += 1;
    } else {
      syncedIdempotencyKeys.add(key);
    }
    syncedIds.push(evt.idempotencyKey);
  }

  return res.json({
    syncedIds,
    duplicateCount,
    serverTimestamp: new Date().toISOString(),
  });
});

app.post("/api/payments/initiate", (req, res) => {
  const { method, amount, customerName } = req.body as {
    method: string;
    amount: number;
    customerName: string;
  };

  if (!method || !amount || amount <= 0) {
    return res.status(400).json({ error: "Valid payment method and positive amount required." });
  }

  const id = `PAY-${Date.now().toString().slice(-6)}`;
  const prefix = method.includes("Raast") ? "RAAST-PK" : method.includes("Jazz") ? "JC" : "EP";
  const reference = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

  const record = {
    id,
    method,
    amount,
    customerName: customerName || "Walk-in Customer",
    reference,
    status: "PENDING_PROVIDER" as const,
    createdAt: new Date().toISOString(),
  };

  paymentRegistry.set(id, record);
  return res.json({ payment: record });
});

app.post("/api/payments/verify", (req, res) => {
  const { id, outcome } = req.body as { id: string; outcome?: "SETTLED" | "FAILED" };
  const existing = paymentRegistry.get(id);

  if (!existing) {
    const newStatus = outcome === "FAILED" ? "FAILED" : "SETTLED";
    return res.json({
      id,
      status: newStatus,
      settledAt: newStatus === "SETTLED" ? new Date().toISOString() : undefined,
      providerTrace: `PRV-${Math.floor(10000000 + Math.random() * 90000000)}`,
    });
  }

  existing.status = outcome === "FAILED" ? "FAILED" : "SETTLED";
  if (existing.status === "SETTLED") {
    existing.settledAt = new Date().toISOString();
  }
  paymentRegistry.set(id, existing);

  return res.json({
    ...existing,
    providerTrace: `PRV-${Math.floor(10000000 + Math.random() * 90000000)}`,
  });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Karobar Saathi AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
