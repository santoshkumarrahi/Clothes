import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
export const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "karobar.db"));

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      mobile TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'business_owner', 'super_admin')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      mobile_verified INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('email', 'mobile', 'password_reset')),
      target TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      description TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      cover_url TEXT NOT NULL,
      hours TEXT NOT NULL DEFAULT '10:00 AM - 10:00 PM',
      online_store_enabled INTEGER NOT NULL DEFAULT 1,
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('approved', 'pending', 'suspended')),
      plan TEXT NOT NULL DEFAULT 'Professional',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      subcategories_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT 'THAR STYLE',
      specs_json TEXT NOT NULL DEFAULT '{}',
      category TEXT NOT NULL,
      category_slug TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      discount_price REAL,
      stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 5,
      published INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      variants_json TEXT NOT NULL DEFAULT '[]',
      sizes_json TEXT NOT NULL DEFAULT '[]',
      colors_json TEXT NOT NULL DEFAULT '[]',
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_best_seller INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 4.8,
      review_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      url TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Mithi, Tharparkar',
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      recipient TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      street_address TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      business_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING_COD',
      order_status TEXT NOT NULL DEFAULT 'Pending',
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 200,
      total REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_label TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      image_url TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cms_state (
      key TEXT PRIMARY KEY,
      json_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS website_settings (
      id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      city_location TEXT NOT NULL,
      seo_json TEXT NOT NULL,
      store_settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS theme_settings (
      id TEXT PRIMARY KEY,
      colors_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS typography_settings (
      id TEXT PRIMARY KEY,
      typography_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS navigation_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      links_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS footer_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logo_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hero_slides (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      mobile_image_url TEXT NOT NULL DEFAULT '',
      focal_point TEXT NOT NULL DEFAULT 'center',
      overlay_opacity INTEGER NOT NULL DEFAULT 65,
      text_align TEXT NOT NULL DEFAULT 'left',
      primary_cta_text TEXT NOT NULL,
      primary_cta_href TEXT NOT NULL,
      secondary_cta_text TEXT NOT NULL,
      secondary_cta_href TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      dimensions TEXT NOT NULL DEFAULT 'Auto',
      file_size TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      alt_text TEXT NOT NULL DEFAULT '',
      used_in_json TEXT NOT NULL DEFAULT '[]',
      uploaded_by TEXT NOT NULL DEFAULT 'Store Admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      link_href TEXT NOT NULL DEFAULT '',
      text_color TEXT NOT NULL DEFAULT '#FFFFFF',
      bg_color TEXT NOT NULL DEFAULT '#9E2A2B',
      font_size_px INTEGER NOT NULL DEFAULT 12,
      font_weight TEXT NOT NULL DEFAULT '600',
      mode TEXT NOT NULL DEFAULT 'scroll',
      scroll_direction TEXT NOT NULL DEFAULT 'left',
      scroll_speed_sec INTEGER NOT NULL DEFAULT 22,
      enabled INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      show_on_desktop INTEGER NOT NULL DEFAULT 1,
      show_on_mobile INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS animation_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS homepage_sections (
      id TEXT PRIMARY KEY,
      section_key TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS cms_pages (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      heading TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      cta_text TEXT NOT NULL DEFAULT '',
      cta_href TEXT NOT NULL DEFAULT '',
      seo_title TEXT NOT NULL DEFAULT '',
      seo_description TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 1,
      is_system INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cms_versions (
      id TEXT PRIMARY KEY,
      version_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Published',
      label TEXT NOT NULL,
      published_by TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_permissions (
      user_id TEXT PRIMARY KEY,
      admin_role TEXT NOT NULL DEFAULT 'super_admin',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_fonts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'woff2',
      created_at TEXT NOT NULL
    );
  `);

  const safeAlters = [
    "ALTER TABLE categories ADD COLUMN subcategories_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT 'THAR STYLE'",
    "ALTER TABLE products ADD COLUMN specs_json TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE products ADD COLUMN category_slug TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE products ADD COLUMN subcategory TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE products ADD COLUMN sizes_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE products ADD COLUMN colors_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE products ADD COLUMN is_new_arrival INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN is_best_seller INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN rating REAL NOT NULL DEFAULT 4.8",
    "ALTER TABLE products ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN admin_role TEXT NOT NULL DEFAULT 'super_admin'",
    "ALTER TABLE hero_slides ADD COLUMN object_fit TEXT NOT NULL DEFAULT 'cover'",
    "ALTER TABLE hero_slides ADD COLUMN pos_x INTEGER NOT NULL DEFAULT 50",
    "ALTER TABLE hero_slides ADD COLUMN pos_y INTEGER NOT NULL DEFAULT 20",
    "ALTER TABLE hero_slides ADD COLUMN zoom_percent INTEGER NOT NULL DEFAULT 100",
  ];
  for (const sql of safeAlters) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists
    }
  }

  migrateToTharStyleStore();
  migrateToTharStyleV2();
  seedSuperAdminEnhancements();
}

export function buildDefaultCmsConfig() {
  return {
    brandName: "THAR STYLE",
    tagline: "Fashion for Every Generation",
    headerLogoUrl: "",
    footerLogoUrl: "",
    faviconUrl: "",
    heroTitle: "Style That Defines You",
    heroSubtitle: "THAR STYLE · Mithi, Tharparkar",
    heroDescription:
      "Discover curated Men's, Women's, Kids, Young Fashion, and authentic Sindhi & Thari heritage apparel crafted with care in Tharparkar.",
    heroCtaText: "Shop Now",
    heroImage: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
    heroSettings: {
      heightDesktopPx: 580,
      heightTabletPx: 500,
      heightMobilePx: 440,
      widthMode: "full",
      maxWidthPct: 100,
      autoSlide: true,
      slideDurationMs: 5500,
      transitionEffect: "fade",
    },
    slideDurationMs: 5500,
    heroSlides: [
      {
        id: "slide-men",
        title: "Style That Defines You",
        subtitle: "Men's Collection",
        description:
          "Explore tailored cotton kurtas, structured waistcoats, crisp shirts, and classic Shalwar Kameez crafted for everyday dignity and festive poise.",
        imageUrl: "/src/assets/images/thar_hero_men_1794818533982.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 16,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Shop Men's Fashion",
        primaryCtaHref: "/category/men",
        secondaryCtaText: "Explore New Arrivals",
        secondaryCtaHref: "/new-arrivals",
        enabled: true,
        sortOrder: 1,
      },
      {
        id: "slide-women",
        title: "Elegance in Every Outfit",
        subtitle: "Women's Collection",
        description:
          "Discover embroidered 2-piece & 3-piece lawn suits, graceful kurtis, flowing dupattas, and traditional Sindhi dresses inspired by Thari artistry.",
        imageUrl: "/src/assets/images/thar_hero_women_1794818535484.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 16,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Shop Women's Wear",
        primaryCtaHref: "/category/women",
        secondaryCtaText: "View Seasonal Sale",
        secondaryCtaHref: "/sale",
        enabled: true,
        sortOrder: 2,
      },
      {
        id: "slide-sindhi",
        title: "Celebrate the Beauty of Sindhi Culture",
        subtitle: "Traditional Sindhi & Thari Heritage",
        description:
          "Discover authentic hand-block-printed Ajrak shawls, intricate mirrorwork Sindhi Topi, and cultural gift ensembles from Mithi, Tharparkar.",
        imageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
        mobileImageUrl: "",
        focalPoint: "center",
        objectFit: "cover",
        posX: 50,
        posY: 50,
        zoomPercent: 100,
        overlayOpacity: 58,
        textAlign: "left",
        primaryCtaText: "Explore Collection",
        primaryCtaHref: "/traditional-sindhi-collection",
        secondaryCtaText: "Ajrak Collection",
        secondaryCtaHref: "/category/ajrak-collection",
        enabled: true,
        sortOrder: 3,
      },
      {
        id: "slide-kids",
        title: "Little Styles, Big Smiles",
        subtitle: "Kids Fashion Collection",
        description:
          "Soft breathable cottons, playful everyday outfits, and embroidered festive kurta sets and frocks designed for comfort and joy.",
        imageUrl: "/src/assets/images/thar_hero_kids_1794818534679.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 18,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Shop Kids Fashion",
        primaryCtaHref: "/category/kids",
        secondaryCtaText: "Best Sellers",
        secondaryCtaHref: "/best-sellers",
        enabled: true,
        sortOrder: 4,
      },
      {
        id: "slide-young",
        title: "Your Style. Your Identity.",
        subtitle: "Young Fashion & Streetwear",
        description:
          "Modern silhouettes, relaxed overshirts, denim essentials, and contemporary casual fits made for campus, city, and weekend style.",
        imageUrl: "/src/assets/images/thar_hero_young_1794818534339.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 16,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Explore Young Fashion",
        primaryCtaHref: "/category/young-fashion",
        secondaryCtaText: "Shop New Arrivals",
        secondaryCtaHref: "/new-arrivals",
        enabled: true,
        sortOrder: 5,
      },
      {
        id: "slide-festive",
        title: "Festive & Bridal Couture",
        subtitle: "Wedding & Eid Season",
        description:
          "Hand-embellished bridal lehngas, tailored ivory sherwanis, and luminous festive attire crafted for memorable family celebrations.",
        imageUrl: "/src/assets/images/hero_festive_bridal_collection_1794821581556.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 15,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Shop Festive Suits",
        primaryCtaHref: "/category/women",
        secondaryCtaText: "Men's Formal Wear",
        secondaryCtaHref: "/category/men",
        enabled: true,
        sortOrder: 6,
      },
      {
        id: "slide-winter-menswear",
        title: "Winter Shawls & Classic Kurtas",
        subtitle: "Mithi Winter Edit",
        description:
          "Fine camel Pashmina wool shawls paired with tailored cotton-wool Shalwar Kameez crafted for crisp Tharparkar desert evenings.",
        imageUrl: "/src/assets/images/hero_winter_shawl_menswear_1794821582077.jpg",
        mobileImageUrl: "",
        focalPoint: "top",
        objectFit: "cover",
        posX: 50,
        posY: 14,
        zoomPercent: 100,
        overlayOpacity: 55,
        textAlign: "left",
        primaryCtaText: "Shop Winter Menswear",
        primaryCtaHref: "/category/men",
        secondaryCtaText: "Traditional Sindhi Wear",
        secondaryCtaHref: "/traditional-sindhi-collection",
        enabled: true,
        sortOrder: 7,
      },
    ],
    sections: [
      {
        id: "sec-categories",
        key: "categories",
        title: "Shop by Category",
        subtitle: "Curated fashion for Men, Women, Kids, Young Trendsetters, and Traditional Sindhi Heritage.",
        enabled: true,
        sortOrder: 1,
        isSystem: true,
      },
      {
        id: "sec-men",
        key: "men_latest",
        title: "Men's Latest Collection",
        subtitle: "Tailored Shalwar Kameez, wool-blend waistcoats, crisp shirts, and classic menswear.",
        enabled: true,
        sortOrder: 2,
        isSystem: true,
      },
      {
        id: "sec-women",
        key: "women_latest",
        title: "Women's Latest Collection",
        subtitle: "Embroidered 3-piece lawn suits, daily kurtis, formal ensembles, and hand-stitched Sindhi dresses.",
        enabled: true,
        sortOrder: 3,
        isSystem: true,
      },
      {
        id: "sec-kids",
        key: "kids_fashion",
        title: "Kids Fashion Collection",
        subtitle: "Breathable everyday essentials and embroidered festive wear for boys, girls, and toddlers.",
        enabled: true,
        sortOrder: 4,
        isSystem: true,
      },
      {
        id: "sec-young",
        key: "young_fashion",
        title: "Young Fashion Collection",
        subtitle: "Modern streetwear, relaxed overshirts, denim staples, and seasonal campus-ready outfits.",
        enabled: true,
        sortOrder: 5,
        isSystem: true,
      },
      {
        id: "sec-sindhi",
        key: "sindhi_thari",
        title: "Traditional Sindhi & Thari Collection",
        subtitle: "Celebrate centuries-old block printing, mirrorwork Sindhi Topi, embroidered traditional dresses, and authentic Thari desert fashion from Mithi.",
        enabled: true,
        sortOrder: 6,
        ctaText: "Explore Collection",
        ctaHref: "/traditional-sindhi-collection",
        collectionCards: [
          {
            id: "tc-ajrak",
            title: "Sindhi Ajrak",
            subtitle: "Double-block madder crimson & indigo cotton shawls",
            imageUrl: "/src/assets/images/sindhi_ajrak_collection_card_1794821582353.jpg",
            href: "/category/ajrak-collection",
          },
          {
            id: "tc-topi",
            title: "Sindhi Topi",
            subtitle: "Hand-stitched silk thread & shisha mirrorwork caps",
            imageUrl: "/src/assets/images/sindhi_topi_craft_card_1794821583404.jpg",
            href: "/category/sindhi-topi",
          },
          {
            id: "tc-dresses",
            title: "Traditional Dresses",
            subtitle: "Embroidered Sindhi gaj & Ajrak-bordered festive wear",
            imageUrl: "/src/assets/images/sindhi_traditional_dress_card_1794821584167.jpg",
            href: "/category/traditional-sindhi-wear",
          },
          {
            id: "tc-thari",
            title: "Thari Cultural Fashion",
            subtitle: "Artisan koti waistcoats & heritage desert attire",
            imageUrl: "/src/assets/images/thari_cultural_fashion_card_1794821584942.jpg",
            href: "/traditional-sindhi-collection",
          },
        ],
        isSystem: true,
      },
      {
        id: "sec-ajrak-topi",
        key: "ajrak_topi_special",
        title: "Ajrak & Sindhi Topi Special Collection",
        subtitle: "Hand-block-printed Sindhi Ajrak shawls and mirrorwork Topis crafted for pride and cultural gifting.",
        enabled: true,
        sortOrder: 7,
        imageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
        isSystem: true,
      },
      {
        id: "sec-new",
        key: "new_arrivals",
        title: "New Arrivals",
        subtitle: "Fresh seasonal designs newly added to our Mithi boutique and online catalog.",
        enabled: true,
        sortOrder: 8,
        isSystem: true,
      },
      {
        id: "sec-best",
        key: "best_sellers",
        title: "Best Selling Products",
        subtitle: "Customer-favorite garments and cultural pieces loved across Tharparkar and Pakistan.",
        enabled: true,
        sortOrder: 9,
        isSystem: true,
      },
      {
        id: "sec-sale",
        key: "sale_offers",
        title: "Seasonal Offers & Discounts",
        subtitle: "Limited-time savings on seasonal suits, casuals, and heritage collections.",
        enabled: true,
        sortOrder: 10,
        isSystem: true,
      },
      {
        id: "sec-featured",
        key: "featured_products",
        title: "Featured Products",
        subtitle: "Handpicked signature pieces representing the craft and elegance of THAR STYLE.",
        enabled: true,
        sortOrder: 11,
        isSystem: true,
      },
      {
        id: "sec-why",
        key: "why_shop_with_us",
        title: "Why Shop With Us",
        subtitle: "Every piece reflects thoughtful fabric selection, tailored sizing, and proud Tharparkar hospitality.",
        enabled: true,
        sortOrder: 12,
        isSystem: true,
      },
      {
        id: "sec-reviews",
        key: "reviews",
        title: "What Our Customers Say",
        subtitle: "Verified feedback from families and fashion shoppers across Mithi, Karachi, Hyderabad, and Lahore.",
        enabled: true,
        sortOrder: 13,
        isSystem: true,
      },
      {
        id: "sec-newsletter",
        key: "newsletter",
        title: "Join the THAR STYLE Lookbook",
        subtitle: "Receive updates on seasonal lawn launches, festive Eid drops, and new Ajrak weaves.",
        enabled: true,
        sortOrder: 14,
        isSystem: true,
      },
    ],
    featuredStoreIds: [] as string[],
    maxTrendingProducts: 8,
    primaryColor: "#141413",
    secondaryColor: "#9E2A2B",
    accentColor: "#B4843D",
    pageBg: "#FAF8F5",
    buttonBg: "#141413",
    buttonTextColor: "#FFFFFF",
    navbarBg: "#FFFFFF",
    navbarTextColor: "#141413",
    footerBg: "#141413",
    footerTextColor: "#E7E2DA",
    headingFont: "Playfair Display",
    bodyFont: "Plus Jakarta Sans",
    urduFont: "Noto Nastaliq Urdu",
    stickyHeader: true,
    announcementEnabled: true,
    announcementText:
      "Welcome to THAR STYLE – Your Fashion Destination in Mithi, Tharparkar! · Traditional Sindhi Ajrak & Topi Collection Available · Free Delivery Over Rs. 5,000",
    announcements: [
      {
        id: "ann-1",
        text: "Welcome to THAR STYLE – Your Fashion Destination in Mithi, Tharparkar! · Discover Men's, Women's, Kids & Young Fashion",
        linkHref: "/new-arrivals",
        textColor: "#FFFFFF",
        bgColor: "#9E2A2B",
        fontSizePx: 12,
        fontWeight: "600",
        mode: "scroll",
        scrollDirection: "left",
        scrollSpeedSec: 26,
        enabled: true,
        startDate: "",
        endDate: "",
        showOnDesktop: true,
        showOnMobile: true,
      },
      {
        id: "ann-2",
        text: "Traditional Sindhi Ajrak & Mirrorwork Topi Collection Available · Free Delivery Across Pakistan Over Rs. 5,000",
        linkHref: "/category/ajrak-collection",
        textColor: "#FAF8F5",
        bgColor: "#141413",
        fontSizePx: 12,
        fontWeight: "600",
        mode: "scroll",
        scrollDirection: "left",
        scrollSpeedSec: 26,
        enabled: true,
        startDate: "",
        endDate: "",
        showOnDesktop: false,
        showOnMobile: false,
      },
    ],
    logoSettings: {
      mainLogoUrl: "",
      headerLogoUrl: "",
      footerLogoUrl: "",
      mobileLogoUrl: "",
      faviconUrl: "",
      adminLogoUrl: "",
      socialShareImageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
      logoWidthPx: 40,
      logoHeightPx: 36,
      logoAlignment: "left",
      logoPresentation: "transparent",
    },
    themeColors: {
      headerBg: "#FFFFFF",
      headerText: "#141413",
      headerIcon: "#141413",
      headerBorder: "#E7E1D8",
      navbarBg: "#FFFFFF",
      navbarText: "#141413",
      navbarHover: "#9E2A2B",
      navbarActive: "#9E2A2B",
      dropdownBg: "#FFFFFF",
      dropdownText: "#3A3631",
      dropdownHover: "#FAF8F5",
      heroOverlay: "#141413",
      heroTitle: "#FFFFFF",
      heroSubtitle: "#E6C994",
      heroButtonBg: "#9E2A2B",
      heroButtonText: "#FFFFFF",
      pageBg: "#FAF8F5",
      sectionBg: "#F2EDE4",
      cardBg: "#FFFFFF",
      primaryText: "#141413",
      secondaryText: "#5D574F",
      borderColor: "#E7E1D8",
      primaryButtonBg: "#141413",
      primaryButtonHover: "#9E2A2B",
      secondaryButtonBg: "#FAF8F5",
      secondaryButtonHover: "#EFEAE2",
      buttonText: "#FFFFFF",
      footerBg: "#141413",
      footerHeading: "#FFFFFF",
      footerText: "#E7E2DA",
      footerLinks: "#D8D0C4",
      footerLinkHover: "#FFFFFF",
      footerBorder: "#2A2824",
      saleBadge: "#9E2A2B",
      discountBadge: "#141413",
      priceText: "#141413",
      ratingStars: "#B4843D",
      successColor: "#15803D",
      warningColor: "#B45309",
      errorColor: "#BE123C",
    },
    typography: {
      primary: {
        fontFamily: "Playfair Display",
        desktopSizePx: 16,
        tabletSizePx: 15,
        mobileSizePx: 14,
        fontWeight: "600",
        fontStyle: "normal",
        color: "#141413",
        lineHeight: "1.4",
        letterSpacing: "0.01em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      heading: {
        fontFamily: "Playfair Display",
        desktopSizePx: 36,
        tabletSizePx: 30,
        mobileSizePx: 24,
        fontWeight: "700",
        fontStyle: "normal",
        color: "#141413",
        lineHeight: "1.15",
        letterSpacing: "-0.01em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      body: {
        fontFamily: "Plus Jakarta Sans",
        desktopSizePx: 15,
        tabletSizePx: 15,
        mobileSizePx: 14,
        fontWeight: "400",
        fontStyle: "normal",
        color: "#3A3631",
        lineHeight: "1.6",
        letterSpacing: "0em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      navigation: {
        fontFamily: "Plus Jakarta Sans",
        desktopSizePx: 12,
        tabletSizePx: 12,
        mobileSizePx: 14,
        fontWeight: "500",
        fontStyle: "normal",
        color: "#141413",
        lineHeight: "1.2",
        letterSpacing: "0.02em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      button: {
        fontFamily: "Plus Jakarta Sans",
        desktopSizePx: 12,
        tabletSizePx: 12,
        mobileSizePx: 12,
        fontWeight: "700",
        fontStyle: "normal",
        color: "#FFFFFF",
        lineHeight: "1.2",
        letterSpacing: "0.06em",
        textAlign: "center",
        textTransform: "uppercase",
        textDecoration: "none",
      },
      productTitle: {
        fontFamily: "Playfair Display",
        desktopSizePx: 15,
        tabletSizePx: 15,
        mobileSizePx: 14,
        fontWeight: "600",
        fontStyle: "normal",
        color: "#141413",
        lineHeight: "1.35",
        letterSpacing: "0em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      price: {
        fontFamily: "Plus Jakarta Sans",
        desktopSizePx: 14,
        tabletSizePx: 14,
        mobileSizePx: 14,
        fontWeight: "700",
        fontStyle: "normal",
        color: "#141413",
        lineHeight: "1.2",
        letterSpacing: "0em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      footer: {
        fontFamily: "Plus Jakarta Sans",
        desktopSizePx: 12,
        tabletSizePx: 12,
        mobileSizePx: 12,
        fontWeight: "400",
        fontStyle: "normal",
        color: "#E7E2DA",
        lineHeight: "1.6",
        letterSpacing: "0em",
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
      },
      customFonts: [] as Array<{ id: string; name: string; fontFamily: string; url: string; format: string }>,
    },
    navigationSettings: {
      headerHeightPx: 64,
      stickyHeader: true,
      showSearchIcon: true,
      showWishlistIcon: true,
      showCartIcon: true,
      showAccountIcon: true,
      mobileMenuStyle: "drawer",
    },
    footerSettings: {
      visible: true,
      aboutText:
        "Curated contemporary apparel and traditional Sindhi & Thari fashion from Mithi, Tharparkar.",
      logoSizePx: 36,
      showPaymentIcons: true,
      copyrightText: "© 2026 THAR STYLE · Mithi, Tharparkar, Sindh, Pakistan. All rights reserved.",
      columns: [
        {
          id: "fcol- care",
          title: "Customer Care",
          links: [
            { id: "fl-1", label: "New Arrivals", href: "/new-arrivals" },
            { id: "fl-2", label: "Best Sellers", href: "/best-sellers" },
            { id: "fl-3", label: "Seasonal Offers & Sale", href: "/sale" },
            { id: "fl-4", label: "Size Guide", href: "/size-guide" },
            { id: "fl-5", label: "FAQ", href: "/faq" },
            { id: "fl-6", label: "About Us", href: "/about" },
            { id: "fl-7", label: "Contact Us", href: "/contact" },
          ],
        },
        {
          id: "fcol-policies",
          title: "Store Policies",
          links: [
            { id: "fl-8", label: "Return & Exchange Policy", href: "/policy/return" },
            { id: "fl-9", label: "Shipping Policy", href: "/policy/shipping" },
            { id: "fl-10", label: "Privacy Policy", href: "/policy/privacy" },
            { id: "fl-11", label: "Terms & Conditions", href: "/policy/terms" },
          ],
        },
      ],
    },
    animationSettings: {
      heroTransition: { enabled: true, type: "fade", durationMs: 700, delayMs: 0 },
      productCardHover: { enabled: true, type: "lift", durationMs: 250, delayMs: 0 },
      imageZoom: { enabled: true, type: "scale", durationMs: 500, delayMs: 0 },
      buttonHover: { enabled: true, type: "lift", durationMs: 180, delayMs: 0 },
      scrollReveal: { enabled: true, type: "fade", durationMs: 400, delayMs: 0 },
      sectionEntrance: { enabled: true, type: "fade", durationMs: 450, delayMs: 0 },
      marqueeMotion: { enabled: true, type: "slide", durationMs: 26000, delayMs: 0 },
      pageTransition: { enabled: true, type: "fade", durationMs: 220, delayMs: 0 },
    },
    seoSettings: {
      siteTitle: "THAR STYLE — Fashion for Every Generation | Mithi, Tharparkar",
      metaDescription:
        "THAR STYLE is a premier clothing and traditional Sindhi fashion store in Mithi, Tharparkar, Sindh, Pakistan — offering Men's, Women's, Kids, Young Fashion, Authentic Ajrak, and Sindhi Topi collections.",
      metaKeywords:
        "THAR STYLE, Mithi clothing store, Tharparkar fashion, Sindhi Ajrak, Sindhi Topi, Pakistani shalwar kameez, embroidered lawn suits",
      ogTitle: "THAR STYLE — Fashion for Every Generation",
      ogDescription:
        "Shop Men, Women, Kids, Young Fashion, Traditional Sindhi Wear, Ajrak Collection, and Sindhi Topi in Mithi, Tharparkar.",
      ogImageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
      canonicalBaseUrl: "",
      robotsIndex: true,
    },
    navLinks: [
      { id: "nav-home", label: "Home", href: "/", visible: true },
      { id: "nav-men", label: "Men", href: "/category/men", visible: true },
      { id: "nav-women", label: "Women", href: "/category/women", visible: true },
      { id: "nav-kids", label: "Kids", href: "/category/kids", visible: true },
      { id: "nav-young", label: "Young Fashion", href: "/category/young-fashion", visible: true },
      { id: "nav-sindhi", label: "Traditional Sindhi Wear", href: "/category/traditional-sindhi-wear", visible: true },
      { id: "nav-ajrak", label: "Ajrak Collection", href: "/category/ajrak-collection", visible: true },
      { id: "nav-topi", label: "Sindhi Topi", href: "/category/sindhi-topi", visible: true },
      { id: "nav-new", label: "New Arrivals", href: "/new-arrivals", visible: true },
      { id: "nav-best", label: "Best Sellers", href: "/best-sellers", visible: true },
      { id: "nav-sale", label: "Sale", href: "/sale", visible: true },
      { id: "nav-about", label: "About Us", href: "/about", visible: true },
      { id: "nav-contact", label: "Contact Us", href: "/contact", visible: true },
    ],
    pages: [
      { id: "pg-1", title: "Home", slug: "/", seoTitle: "THAR STYLE — Fashion for Every Generation", published: true, updatedAt: "Today" },
      { id: "pg-2", title: "About Us", slug: "/about", seoTitle: "About THAR STYLE · Mithi, Tharparkar", published: true, updatedAt: "Today" },
      { id: "pg-3", title: "Contact Us", slug: "/contact", seoTitle: "Contact THAR STYLE · Mithi, Tharparkar", published: true, updatedAt: "Today" },
      { id: "pg-4", title: "New Arrivals", slug: "/new-arrivals", seoTitle: "New Arrivals — THAR STYLE", published: true, updatedAt: "Today" },
      { id: "pg-5", title: "Sale", slug: "/sale", seoTitle: "Seasonal Offers — THAR STYLE", published: true, updatedAt: "Today" },
    ],
    footerCopyright: "© 2026 THAR STYLE · Mithi, Tharparkar, Sindh, Pakistan. All rights reserved.",
    storeSettings: {
      storeName: "THAR STYLE",
      tagline: "Fashion for Every Generation",
      cityLocation: "Mithi, Tharparkar, Sindh, Pakistan",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      openingHours: "",
      googleMapsEmbedUrl: "",
      deliveryFee: 200,
      freeDeliveryThreshold: 5000,
      currency: "PKR",
      returnPolicy:
        "Unused, unworn garments with original tags attached can be exchanged or returned within 7 days of delivery. Handcrafted Ajrak and Sindhi Topi gifts qualify for exchange if unused and in original packaging.",
      privacyPolicy:
        "THAR STYLE collects customer name, delivery address, and phone details strictly to fulfill clothing orders and provide order status updates across Mithi, Tharparkar, and Pakistan.",
      termsPolicy:
        "All prices are listed in Pakistani Rupees (PKR). Orders placed via Cash on Delivery are confirmed prior to dispatch. Custom-altered items may not be eligible for return.",
      aboutStory:
        "Born in the heart of Mithi, Tharparkar, THAR STYLE brings together contemporary Pakistani apparel and centuries-old Sindhi cultural craftsmanship under one roof. From tailored men's waistcoats and festive women's 3-piece ensembles to vibrant kids' outfits, modern young fashion, authentic hand-block-printed Ajrak, and mirrorwork Sindhi Topi — every garment is curated for comfort, quality, and pride across generations.",
      paymentMethods: {
        cod: true,
        jazzcash: false,
        easypaisa: false,
        bankTransfer: false,
      },
      socialLinks: {
        facebook: "",
        instagram: "",
        tiktok: "",
        youtube: "",
      },
    },
    versionNumber: 1,
    status: "Published",
    lastPublishedAt: new Date().toISOString(),
    lastPublishedBy: "System",
  };
}

function migrateToTharStyleStore() {
  const alreadyMigrated = db
    .prepare("SELECT key FROM cms_state WHERE key = 'thar_style_migrated_v1'")
    .get();
  if (alreadyMigrated) return;

  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    // 1. Clean out old multi-category marketplace sample entities (grocery, pharmacy, hardware, electronics)
    db.exec(`
      DELETE FROM order_status_history;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM wishlists;
      DELETE FROM product_reviews;
      DELETE FROM product_images;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM businesses;
    `);

    // 2. Ensure THAR STYLE Admin + Customer accounts exist cleanly
    const upsertUser = db.prepare(`
      INSERT INTO users (id, full_name, email, mobile, password_hash, role, email_verified, mobile_verified, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'active', ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        email_verified = 1,
        mobile_verified = 1,
        status = 'active'
    `);

    upsertUser.run(
      "usr-thar-admin",
      "THAR STYLE Store Admin",
      "admin@tharstyle.pk",
      null,
      hashPassword("Admin@123"),
      "super_admin",
      now
    );

    upsertUser.run(
      "usr-thar-cust",
      "Ayesha Samejo",
      "ayesha@tharstyle.pk",
      "+923331234567",
      hashPassword("Customer@123"),
      "customer",
      now
    );

    // Preserve legacy super admin login compatibility if someone signs in with prior admin creds
    const legacyAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@karobarsaathi.pk'").get();
    if (!legacyAdmin) {
      upsertUser.run(
        "usr-admin-1",
        "THAR STYLE Administrator",
        "admin@karobarsaathi.pk",
        null,
        hashPassword("Admin@123"),
        "super_admin",
        now
      );
    }

    // 3. Create single authoritative THAR STYLE store row
    db.prepare(`
      INSERT INTO businesses (id, owner_id, slug, name, category, city, address, phone, whatsapp, description, logo_url, cover_url, hours, online_store_enabled, approval_status, plan, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', 'Enterprise', ?)
    `).run(
      "biz-thar-style",
      "usr-thar-admin",
      "thar-style",
      "THAR STYLE",
      "Clothing & Traditional Sindhi Fashion",
      "Mithi, Tharparkar, Sindh, Pakistan",
      "",
      "",
      "",
      "THAR STYLE — Fashion for Every Generation in Mithi, Tharparkar. Curating Men's, Women's, Kids, Young Fashion, Authentic Ajrak, and Traditional Sindhi Topi.",
      "/src/assets/images/hero_clothing_store_1794817075010.jpg",
      "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
      "",
      now
    );

    // 4. Seed Dedicated Clothing & Sindhi Cultural Categories with Subcategories
    const categories = [
      {
        id: "cat-men",
        slug: "men",
        name: "Men",
        description:
          "Refined Pakistani menswear — crisp cotton shirts, polo shirts, tailored jeans & trousers, classic Shalwar Kameez, wool-blend waistcoats, and traditional Sindhi attire.",
        imageUrl: "/src/assets/images/thar_hero_men_1794818533982.jpg",
        subcategories: [
          "Men's Shirts",
          "T-Shirts",
          "Polo Shirts",
          "Jeans",
          "Trousers",
          "Shalwar Kameez",
          "Waistcoats",
          "Traditional Sindhi Clothing",
          "Men's Accessories",
        ],
        sortOrder: 1,
        featured: 1,
      },
      {
        id: "cat-women",
        slug: "women",
        name: "Women",
        description:
          "Graceful Pakistani womenswear — embroidered 2-piece and 3-piece lawn suits, everyday kurtis, formal ensembles, abayas, dupattas, and traditional Thari dresses.",
        imageUrl: "/src/assets/images/thar_hero_women_1794818535484.jpg",
        subcategories: [
          "Women's Dresses",
          "2-Piece Suits",
          "3-Piece Suits",
          "Kurtis",
          "Casual Wear",
          "Formal Wear",
          "Abayas",
          "Dupattas",
          "Traditional Sindhi Dresses",
        ],
        sortOrder: 2,
        featured: 1,
      },
      {
        id: "cat-kids",
        slug: "kids",
        name: "Kids",
        description:
          "Soft, breathable clothing for every milestone — boys' kurta sets, girls' embroidered frocks, baby outfits, festive party wear, and comfortable everyday playwear.",
        imageUrl: "/src/assets/images/thar_hero_kids_1794818534679.jpg",
        subcategories: [
          "Boys Clothing",
          "Girls Clothing",
          "Baby Clothing",
          "Kids Traditional Wear",
          "Kids Casual Wear",
          "Kids Party Wear",
        ],
        sortOrder: 3,
        featured: 1,
      },
      {
        id: "cat-young-fashion",
        slug: "young-fashion",
        name: "Young Fashion",
        description:
          "Contemporary silhouettes, relaxed overshirts, urban streetwear, denim staples, and seasonal campus-ready outfits for young men and women.",
        imageUrl: "/src/assets/images/thar_hero_young_1794818534339.jpg",
        subcategories: [
          "Young Men's Fashion",
          "Young Women's Fashion",
          "Casual Outfits",
          "Modern Trends",
          "Streetwear",
          "Seasonal Collections",
        ],
        sortOrder: 4,
        featured: 1,
      },
      {
        id: "cat-traditional-sindhi-wear",
        slug: "traditional-sindhi-wear",
        name: "Traditional Sindhi Wear",
        description:
          "Celebrate Sindhi & Thari heritage with handcrafted traditional waistcoats, Thari mirrorwork outfits, cultural clothing, and heirloom gift collections.",
        imageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
        subcategories: [
          "Sindhi Cultural Clothing",
          "Traditional Waistcoats",
          "Thari Traditional Wear",
          "Cultural Gift Collections",
        ],
        sortOrder: 5,
        featured: 1,
      },
      {
        id: "cat-ajrak-collection",
        slug: "ajrak-collection",
        name: "Ajrak Collection",
        description:
          "Authentic double-sided hand-block-printed Sindhi Ajrak shawls, soft combed cotton Ajrak wraps, and artisan Ajrak dresses dyed in madder crimson and indigo.",
        imageUrl: "/src/assets/images/prod_ajrak_shawl_1794818534620.jpg",
        subcategories: [
          "Sindhi Ajrak",
          "Ajrak Shawls",
          "Ajrak Dresses",
          "Cultural Gift Collections",
        ],
        sortOrder: 6,
        featured: 1,
      },
      {
        id: "cat-sindhi-topi",
        slug: "sindhi-topi",
        name: "Sindhi Topi",
        description:
          "Artisan-embroidered Traditional Sindhi Topi caps crafted with intricate geometric silk threadwork, archival front arch, and authentic mirrorwork.",
        imageUrl: "/src/assets/images/prod_sindhi_topi_1794818535584.jpg",
        subcategories: [
          "Traditional Sindhi Topi",
          "Mirrorwork Sindhi Topi",
          "Cultural Gift Collections",
        ],
        sortOrder: 7,
        featured: 1,
      },
    ];

    const insCat = db.prepare(`
      INSERT INTO categories (id, slug, name, description, image_url, subcategories_json, sort_order, published, featured, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const c of categories) {
      insCat.run(
        c.id,
        c.slug,
        c.name,
        c.description,
        c.imageUrl,
        JSON.stringify(c.subcategories),
        c.sortOrder,
        c.featured,
        now
      );
    }

    // 5. Seed Authentic THAR STYLE Fashion & Cultural Apparel Catalog
    const products = [
      // MEN
      {
        id: "ts-men-1",
        sku: "TS-M-001",
        barcode: "896501001",
        name: "Mithi Tailored Charcoal Waistcoat & Ivory Kurta",
        brand: "THAR STYLE Signature",
        category: "Men",
        categorySlug: "men",
        subcategory: "Waistcoats",
        unit: "suit",
        description:
          "Structured textured wool-blend waistcoat paired with a breathable Egyptian-cotton ivory collar kurta. Designed for Eid, weddings, and formal gatherings.",
        cost: 4600,
        price: 6850,
        discount: 5950,
        stock: 24,
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Charcoal Black", "Ivory", "Deep Navy"],
        specs: { Fabric: "Tropical Wool Blend & Combed Cotton", Fit: "Tailored Regular", Collar: "Band Collar", Care: "Dry Clean Recommended" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_men_waistcoat_1794818534691.jpg", "/src/assets/images/thar_hero_men_1794818533982.jpg"],
      },
      {
        id: "ts-men-2",
        sku: "TS-M-002",
        barcode: "896501002",
        name: "Desert Breeze Wash & Wear Shalwar Kameez",
        brand: "THAR STYLE Classic",
        category: "Men",
        categorySlug: "men",
        subcategory: "Shalwar Kameez",
        unit: "suit",
        description:
          "Wrinkle-resistant soft cotton-blend Shalwar Kameez engineered for Tharparkar warmth with clean concealed placket stitching.",
        cost: 2900,
        price: 4450,
        discount: null,
        stock: 36,
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Warm Cream", "Stone Grey", "Midnight Black"],
        specs: { Fabric: "Premium Wash & Wear", Stitch: "Double-Needle Cuff", Season: "All-Season", Origin: "Mithi Atelier" },
        isNew: 1,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_men_1794818533982.jpg", "/src/assets/images/prod_men_waistcoat_1794818534691.jpg"],
      },
      {
        id: "ts-men-3",
        sku: "TS-M-003",
        barcode: "896501003",
        name: "Oxford Loom Button-Down Dress Shirt",
        brand: "THAR STYLE Menswear",
        category: "Men",
        categorySlug: "men",
        subcategory: "Men's Shirts",
        unit: "pcs",
        description:
          "Crisp 100% combed cotton Oxford weave shirt with tailored chest pocket and breathable gusset construction.",
        cost: 1650,
        price: 2750,
        discount: 2350,
        stock: 30,
        sizes: ["S", "M", "L", "XL"],
        colors: ["Chalk White", "Olive Stone", "Slate Blue"],
        specs: { Fabric: "100% Cotton Oxford", Fit: "Modern Tailored", Sleeve: "Full Sleeve", Wash: "Machine Washable" },
        isNew: 0,
        isFeat: 1,
        isBest: 0,
        images: ["/src/assets/images/prod_young_streetwear_1794818536129.jpg", "/src/assets/images/hero_clothing_store_1794817075010.jpg"],
      },
      {
        id: "ts-men-4",
        sku: "TS-M-004",
        barcode: "896501004",
        name: "Essential Pique Cotton Polo & Chino Set",
        brand: "THAR STYLE Casual",
        category: "Men",
        categorySlug: "men",
        subcategory: "Polo Shirts",
        unit: "pcs",
        description:
          "Breathable honeycomb pique knit polo shirt paired effortlessly with stretch-cotton chinos or denim.",
        cost: 1400,
        price: 2450,
        discount: 1990,
        stock: 42,
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Jet Black", "Sandstone", "Forest Olive"],
        specs: { Fabric: "220 GSM Cotton Pique", Fit: "Regular Comfort", Collar: "Ribbed Polo Collar" },
        isNew: 0,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/hero_clothing_store_1794817075010.jpg", "/src/assets/images/prod_young_streetwear_1794818536129.jpg"],
      },

      // WOMEN
      {
        id: "ts-wom-1",
        sku: "TS-W-001",
        barcode: "896502001",
        name: "Sage & Ivory Festive Embroidered 3-Piece Lawn Suit",
        brand: "THAR STYLE Couture",
        category: "Women",
        categorySlug: "women",
        subcategory: "3-Piece Suits",
        unit: "suit",
        description:
          "Intricately thread-embroidered sage green lawn shirt paired with straight trousers and scalloped sheer organza dupatta.",
        cost: 4900,
        price: 7450,
        discount: 6490,
        stock: 18,
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Sage Green", "Warm Cream"],
        specs: { Pieces: "3-Piece Stitched (Shirt, Trouser, Organza Dupatta)", Embroidery: "Resham & Tilla Threadwork", Fabric: "Swiss Voile Lawn" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_women_suit_1794818535930.jpg", "/src/assets/images/thar_hero_women_1794818535484.jpg"],
      },
      {
        id: "ts-wom-2",
        sku: "TS-W-002",
        barcode: "896502002",
        name: "Crimson Heritage Gold-Embroidered 3-Piece Ensemble",
        brand: "THAR STYLE Festive",
        category: "Women",
        categorySlug: "women",
        subcategory: "Formal Wear",
        unit: "suit",
        description:
          "Regal deep crimson lawn-silk kameez with gold floral neckline embroidery, wide-leg cream embroidered trousers, and bordered chiffon dupatta.",
        cost: 6200,
        price: 9400,
        discount: 8250,
        stock: 14,
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Madder Crimson", "Ivory Gold"],
        specs: { Pieces: "3-Piece Formal Ensemble", Dupatta: "Crinkle Chiffon Embroidered", Occasion: "Festive & Wedding" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_women_1794818535484.jpg", "/src/assets/images/prod_women_suit_1794818535930.jpg"],
      },
      {
        id: "ts-wom-3",
        sku: "TS-W-003",
        barcode: "896502003",
        name: "Mithi Courtyard Daily Printed 2-Piece Kurti Set",
        brand: "THAR STYLE Pret",
        category: "Women",
        categorySlug: "women",
        subcategory: "2-Piece Suits",
        unit: "suit",
        description:
          "Soft breathable cotton kurti with subtle neckline pintucks and matching straight-cut cambric trouser for effortless everyday wear.",
        cost: 2100,
        price: 3450,
        discount: 2950,
        stock: 32,
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Terracotta Rose", "Pastel Sage", "Warm Ivory"],
        specs: { Pieces: "2-Piece (Kurti + Trouser)", Fabric: "100% Breathable Lawn", Fit: "Relaxed A-Line" },
        isNew: 1,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/cat_clothing_fashion_1794817076850.jpg", "/src/assets/images/prod_women_suit_1794818535930.jpg"],
      },
      {
        id: "ts-wom-4",
        sku: "TS-W-004",
        barcode: "896502004",
        name: "Handcrafted Thari Mirrorwork Embroidered Kurti",
        brand: "THAR STYLE Artisan",
        category: "Women",
        categorySlug: "women",
        subcategory: "Traditional Sindhi Dresses",
        unit: "pcs",
        description:
          "Artisan-embroidered women's kurti crafted by Tharparkar needlecraft specialists featuring fine geometric mirrorwork and cotton tassels.",
        cost: 2650,
        price: 4200,
        discount: null,
        stock: 20,
        sizes: ["S", "M", "L", "XL"],
        colors: ["Deep Crimson", "Indigo", "Mustard Ochre"],
        specs: { Craft: "Hand Shisha Mirrorwork", Fabric: "Handloom Cotton", Origin: "Tharparkar, Sindh" },
        isNew: 1,
        isFeat: 1,
        isBest: 0,
        images: ["/src/assets/images/thar_hero_women_1794818535484.jpg", "/src/assets/images/cat_clothing_fashion_1794817076850.jpg"],
      },

      // KIDS
      {
        id: "ts-kid-1",
        sku: "TS-K-001",
        barcode: "896503001",
        name: "Boys Sky-Blue Embroidered Kurta & Waistcoat Festive Set",
        brand: "THAR STYLE Junior",
        category: "Kids",
        categorySlug: "kids",
        subcategory: "Boys Clothing",
        unit: "set",
        description:
          "Soft cotton-silk sky-blue kurta paired with a delicately embroidered matching waistcoat and ivory pajama for family celebrations.",
        cost: 2200,
        price: 3650,
        discount: 3150,
        stock: 26,
        sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-12Y"],
        colors: ["Sky Blue / Ivory", "Saffron Gold"],
        specs: { AgeRange: "2 to 12 Years", Pieces: "Kurta, Embroidered Waistcoat, Pajama", Fabric: "Soft Cotton-Silk" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_kids_festive_1794818536710.jpg", "/src/assets/images/thar_hero_kids_1794818534679.jpg"],
      },
      {
        id: "ts-kid-2",
        sku: "TS-K-002",
        barcode: "896503002",
        name: "Girls Pastel Mint Floral Embroidered Frock & Trouser",
        brand: "THAR STYLE Junior",
        category: "Kids",
        categorySlug: "kids",
        subcategory: "Girls Clothing",
        unit: "set",
        description:
          "Cheerful pastel mint gathered cotton frock adorned with soft rose threadwork and lace trim, lined in skin-friendly voile.",
        cost: 2050,
        price: 3450,
        discount: 2890,
        stock: 22,
        sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-12Y"],
        colors: ["Mint Green", "Blush Peach"],
        specs: { AgeRange: "2 to 12 Years", Lining: "100% Soft Cotton", Occasion: "Eid & Party Wear" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_kids_1794818534679.jpg", "/src/assets/images/prod_kids_festive_1794818536710.jpg"],
      },
      {
        id: "ts-kid-3",
        sku: "TS-K-003",
        barcode: "896503003",
        name: "Thari Ochre Kids Festive Kurta Pajama",
        brand: "THAR STYLE Junior",
        category: "Kids",
        categorySlug: "kids",
        subcategory: "Kids Traditional Wear",
        unit: "set",
        description:
          "Warm ochre cotton kurta with crisp white & turquoise neckline embroidery designed for cultural days and festive mornings.",
        cost: 1750,
        price: 2850,
        discount: null,
        stock: 19,
        sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
        colors: ["Desert Ochre", "Ivory"],
        specs: { Fabric: "100% Organic Cotton", Fit: "Comfort Relaxed" },
        isNew: 0,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_kids_1794818534679.jpg", "/src/assets/images/prod_kids_festive_1794818536710.jpg"],
      },

      // YOUNG FASHION
      {
        id: "ts-yng-1",
        sku: "TS-Y-001",
        barcode: "896504001",
        name: "Olive-Stone Heavyweight Twill Overshirt & Relaxed Chinos",
        brand: "THAR STYLE Studio",
        category: "Young Fashion",
        categorySlug: "young-fashion",
        subcategory: "Streetwear",
        unit: "pcs",
        description:
          "Architectural heavyweight cotton-twill utility overshirt with twin flap pockets and matte snap buttons — built for effortless layering.",
        cost: 2800,
        price: 4550,
        discount: 3890,
        stock: 28,
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Olive Stone", "Charcoal", "Sand"],
        specs: { Fabric: "310 GSM Brushed Cotton Twill", Fit: "Boxy Relaxed", Style: "Unisex Streetwear" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_young_streetwear_1794818536129.jpg", "/src/assets/images/thar_hero_young_1794818534339.jpg"],
      },
      {
        id: "ts-yng-2",
        sku: "TS-Y-002",
        barcode: "896504002",
        name: "Indigo Raw-Wash Trucker Denim Jacket",
        brand: "THAR STYLE Studio",
        category: "Young Fashion",
        categorySlug: "young-fashion",
        subcategory: "Young Men's Fashion",
        unit: "pcs",
        description:
          "Structured 12oz indigo selvedge-inspired denim jacket with contrast stitching and relaxed modern shoulder fit.",
        cost: 3400,
        price: 5450,
        discount: 4750,
        stock: 16,
        sizes: ["S", "M", "L", "XL"],
        colors: ["Raw Indigo", "Washed Slate"],
        specs: { Fabric: "12oz 100% Cotton Denim", Hardware: "Antique Brass Rivets", Fit: "Modern Cropped" },
        isNew: 1,
        isFeat: 1,
        isBest: 0,
        images: ["/src/assets/images/thar_hero_young_1794818534339.jpg", "/src/assets/images/prod_young_streetwear_1794818536129.jpg"],
      },
      {
        id: "ts-yng-3",
        sku: "TS-Y-003",
        barcode: "896504003",
        name: "Ivory Linen Overshirt & High-Rise Denim Co-ord",
        brand: "THAR STYLE Studio",
        category: "Young Fashion",
        categorySlug: "young-fashion",
        subcategory: "Young Women's Fashion",
        unit: "pcs",
        description:
          "Breezy cream linen-blend button-down overshirt styled for campus days, paired seamlessly with wide-leg indigo jeans.",
        cost: 2300,
        price: 3850,
        discount: 3250,
        stock: 25,
        sizes: ["XS", "S", "M", "L"],
        colors: ["Chalk Cream", "Soft Sage"],
        specs: { Fabric: "55% Linen / 45% Cotton", Fit: "Relaxed Drape" },
        isNew: 1,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_young_1794818534339.jpg", "/src/assets/images/hero_clothing_store_1794817075010.jpg"],
      },

      // TRADITIONAL SINDHI WEAR
      {
        id: "ts-sin-1",
        sku: "TS-S-001",
        barcode: "896505001",
        name: "Royal Sindhi Cultural Gift Set (Ajrak Shawl + Mirrorwork Topi)",
        brand: "THAR STYLE Heritage",
        category: "Traditional Sindhi Wear",
        categorySlug: "traditional-sindhi-wear",
        subcategory: "Cultural Gift Collections",
        unit: "set",
        description:
          "Signature cultural presentation box uniting an authentic double-block Sindhi Ajrak shawl with a handcrafted mirrorwork Sindhi Topi.",
        cost: 3400,
        price: 5250,
        discount: 4650,
        stock: 30,
        sizes: ["Free Size (57cm)", "Free Size (58cm)", "Free Size (59cm)"],
        colors: ["Crimson & Indigo", "Classic Madder"],
        specs: { Includes: "Full-Size Cotton Ajrak + Artisan Sindhi Topi", Packaging: "Presentation Gift Box", Origin: "Sindh, Pakistan" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_sindhi_1794818534180.jpg", "/src/assets/images/prod_ajrak_shawl_1794818534620.jpg", "/src/assets/images/prod_sindhi_topi_1794818535584.jpg"],
      },
      {
        id: "ts-sin-2",
        sku: "TS-S-002",
        barcode: "896505002",
        name: "Thari Hand-Embroidered Cultural Waistcoat",
        brand: "THAR STYLE Heritage",
        category: "Traditional Sindhi Wear",
        categorySlug: "traditional-sindhi-wear",
        subcategory: "Traditional Waistcoats",
        unit: "pcs",
        description:
          "Structured charcoal-black cultural waistcoat accented with subtle Thari threadwork along the pocket welt and collar edge.",
        cost: 3500,
        price: 5400,
        discount: null,
        stock: 15,
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Obsidian Charcoal", "Indigo"],
        specs: { Fabric: "Raw Cotton Suiting", Craft: "Thari Hand Trim", Fit: "Tailored" },
        isNew: 1,
        isFeat: 1,
        isBest: 0,
        images: ["/src/assets/images/prod_men_waistcoat_1794818534691.jpg", "/src/assets/images/thar_hero_sindhi_1794818534180.jpg"],
      },

      // AJRAK COLLECTION
      {
        id: "ts-ajr-1",
        sku: "TS-A-001",
        barcode: "896506001",
        name: "Bhitshah Heritage Double-Block Sindhi Ajrak Shawl",
        brand: "THAR STYLE Heritage",
        category: "Ajrak Collection",
        categorySlug: "ajrak-collection",
        subcategory: "Sindhi Ajrak",
        unit: "pcs",
        description:
          "Authentic 14-stage hand-block-printed Sindhi Ajrak shawl crafted on pure breathable cotton using natural madder crimson and deep indigo dyes.",
        cost: 1950,
        price: 3250,
        discount: 2850,
        stock: 48,
        sizes: ["Free Size (2.5m)"],
        colors: ["Madder Crimson & Indigo", "Deep Indigo & Ivory"],
        specs: { Technique: "Authentic Hand Block Print", Dimensions: "2.5m × 1.15m", Fabric: "100% Fine Muslin Cotton", Tassels: "Hand-Twisted Fringe" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_ajrak_shawl_1794818534620.jpg", "/src/assets/images/thar_hero_sindhi_1794818534180.jpg"],
      },
      {
        id: "ts-ajr-2",
        sku: "TS-A-002",
        barcode: "896506002",
        name: "Indigo Star Geometric Ajrak Winter Wrap",
        brand: "THAR STYLE Heritage",
        category: "Ajrak Collection",
        categorySlug: "ajrak-collection",
        subcategory: "Ajrak Shawls",
        unit: "pcs",
        description:
          "Heavier-weave cotton-khaddar Ajrak shawl ideal for crisp Tharparkar desert evenings and Sindhi Cultural Day gatherings.",
        cost: 2250,
        price: 3650,
        discount: null,
        stock: 28,
        sizes: ["Free Size (2.6m)"],
        colors: ["Royal Indigo", "Crimson Black"],
        specs: { Fabric: "Fine Soft Khaddar Cotton", Print: "Double-Sided Resist Block", Care: "Gentle Cold Hand Wash" },
        isNew: 0,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_sindhi_1794818534180.jpg", "/src/assets/images/prod_ajrak_shawl_1794818534620.jpg"],
      },
      {
        id: "ts-ajr-3",
        sku: "TS-A-003",
        barcode: "896506003",
        name: "Artisan Ajrak Print 3-Piece Cotton Suit",
        brand: "THAR STYLE Heritage",
        category: "Ajrak Collection",
        categorySlug: "ajrak-collection",
        subcategory: "Ajrak Dresses",
        unit: "suit",
        description:
          "Contemporary stitched 3-piece women's suit uniting classic crimson Ajrak motifs with breathable combed cotton and matching Ajrak dupatta.",
        cost: 3300,
        price: 5150,
        discount: 4490,
        stock: 20,
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Crimson Ajrak", "Indigo Ajrak"],
        specs: { Pieces: "3-Piece Stitched Suit", Fabric: "Pure Block-Print Lawn/Cotton", Dupatta: "Full Ajrak Print" },
        isNew: 1,
        isFeat: 0,
        isBest: 1,
        images: ["/src/assets/images/prod_ajrak_shawl_1794818534620.jpg", "/src/assets/images/thar_hero_women_1794818535484.jpg"],
      },

      // SINDHI TOPI
      {
        id: "ts-top-1",
        sku: "TS-T-001",
        barcode: "896507001",
        name: "Mithi Royal Mirrorwork Traditional Sindhi Topi",
        brand: "THAR STYLE Heritage",
        category: "Sindhi Topi",
        categorySlug: "sindhi-topi",
        subcategory: "Mirrorwork Sindhi Topi",
        unit: "pcs",
        description:
          "Hand-embroidered Sindhi Topi with iconic front arch cutout, vibrant silk-thread geometric diamonds, and hand-stitched shisha mirrors.",
        cost: 1650,
        price: 2750,
        discount: 2390,
        stock: 38,
        sizes: ["56 cm (M)", "58 cm (L)", "60 cm (XL)"],
        colors: ["Crimson & Cobalt", "Deep Maroon Gold"],
        specs: { Embroidery: "Hand Silk Resham & Shisha Mirrors", Structure: "Reinforced Comfort Crown", Origin: "Tharparkar Craft Guild" },
        isNew: 1,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/prod_sindhi_topi_1794818535584.jpg", "/src/assets/images/thar_hero_sindhi_1794818534180.jpg"],
      },
      {
        id: "ts-top-2",
        sku: "TS-T-002",
        barcode: "896507002",
        name: "Classic Indigo & Gold Thread Sindhi Topi",
        brand: "THAR STYLE Heritage",
        category: "Sindhi Topi",
        categorySlug: "sindhi-topi",
        subcategory: "Traditional Sindhi Topi",
        unit: "pcs",
        description:
          "Understated formal Sindhi Topi woven in deep indigo velvet-cotton base with fine ochre and crimson geometric stitchwork.",
        cost: 1450,
        price: 2350,
        discount: null,
        stock: 30,
        sizes: ["56 cm (M)", "58 cm (L)", "60 cm (XL)"],
        colors: ["Indigo Gold", "Black Crimson"],
        specs: { Lining: "Breathable Cotton Sweatband", Occasion: "Formal & Cultural Day" },
        isNew: 0,
        isFeat: 1,
        isBest: 1,
        images: ["/src/assets/images/thar_hero_sindhi_1794818534180.jpg", "/src/assets/images/prod_sindhi_topi_1794818535584.jpg"],
      },
    ];

    const insProd = db.prepare(`
      INSERT INTO products (
        id, business_id, sku, barcode, name, brand, specs_json,
        category, category_slug, subcategory, unit, description,
        cost_price, selling_price, discount_price, stock, min_stock,
        published, active, variants_json, sizes_json, colors_json,
        is_new_arrival, is_featured, is_best_seller, rating, review_count, updated_at
      )
      VALUES (?, 'biz-thar-style', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 1, 1, ?, ?, ?, ?, ?, ?, 4.9, 2, ?)
    `);

    const insImg = db.prepare(`
      INSERT INTO product_images (id, product_id, url, is_primary, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of products) {
      const variants = p.sizes.map((sz) => `${sz} · ${p.colors[0]}`);
      insProd.run(
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.brand,
        JSON.stringify(p.specs),
        p.category,
        p.categorySlug,
        p.subcategory,
        p.unit,
        p.description,
        p.cost,
        p.price,
        p.discount,
        p.stock,
        JSON.stringify(variants),
        JSON.stringify(p.sizes),
        JSON.stringify(p.colors),
        p.isNew,
        p.isFeat,
        p.isBest,
        now
      );
      p.images.forEach((imgUrl, idx) => {
        insImg.run(`img-${p.id}-${idx}`, p.id, imgUrl, idx === 0 ? 1 : 0, idx);
      });
    }

    // 6. Seed Authentic Customer Reviews
    const reviews = [
      {
        id: "rev-1",
        productId: "ts-ajr-1",
        name: "Dr. Mahesh Kumar",
        city: "Mithi, Tharparkar",
        rating: 5,
        comment: "Authentic double-block Ajrak with rich natural madder crimson. The cotton weave is soft and true to Sindhi craft.",
      },
      {
        id: "rev-2",
        productId: "ts-top-1",
        name: "Sajjad Hingorjo",
        city: "Hyderabad, Sindh",
        rating: 5,
        comment: "Ordered two Mirrorwork Sindhi Topis for Cultural Day — stitching and mirror finish are heirloom quality.",
      },
      {
        id: "rev-3",
        productId: "ts-wom-1",
        name: "Ayesha Samejo",
        city: "Mithi, Tharparkar",
        rating: 5,
        comment: "The Sage 3-Piece Lawn Suit fits true to size and the organza dupatta looks even richer in person.",
      },
      {
        id: "rev-4",
        productId: "ts-men-1",
        name: "Kamran Memon",
        city: "Karachi, Sindh",
        rating: 5,
        comment: "Tailored charcoal waistcoat over the ivory kurta had crisp seams right out of the parcel. Delivered in 2 days.",
      },
      {
        id: "rev-5",
        productId: "ts-kid-1",
        name: "Nadia Bano",
        city: "Umerkot, Sindh",
        rating: 5,
        comment: "Soft fabric that didn't irritate my son's skin during Eid celebrations. Lovely embroidery work.",
      },
      {
        id: "rev-6",
        productId: "ts-yng-1",
        name: "Zohaib Khoso",
        city: "Jamshoro, Sindh",
        rating: 4,
        comment: "Heavyweight olive overshirt holds its boxy shape really well. Great modern fit for university.",
      },
    ];

    const insRev = db.prepare(`
      INSERT INTO product_reviews (id, product_id, customer_name, city, rating, comment, verified_purchase, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    for (const r of reviews) {
      insRev.run(r.id, r.productId, r.name, r.city, r.rating, r.comment, now);
    }

    // Update accurate review counts & ratings on seeded products
    db.exec(`
      UPDATE products
      SET review_count = (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = products.id),
          rating = COALESCE((SELECT ROUND(AVG(pr.rating), 1) FROM product_reviews pr WHERE pr.product_id = products.id), 4.9)
    `);

    // 7. Seed default customer address & 1 THAR STYLE order
    db.prepare(`
      INSERT OR REPLACE INTO customer_addresses (id, user_id, label, recipient, phone, city, street_address, is_default)
      VALUES (?, ?, 'Home', ?, ?, ?, ?, 1)
    `).run(
      "addr-thar-1",
      "usr-thar-cust",
      "Ayesha Samejo",
      "+92 333 1234567",
      "Mithi, Tharparkar",
      "Kashmir Chowk Road, Ward 4, Mithi"
    );

    db.prepare(`
      INSERT INTO orders (id, order_number, business_id, customer_id, customer_name, customer_phone, delivery_address, payment_method, payment_status, order_status, subtotal, delivery_fee, total, notes, created_at)
      VALUES (?, ?, 'biz-thar-style', 'usr-thar-cust', 'Ayesha Samejo', '+92 333 1234567', 'Kashmir Chowk Road, Ward 4, Mithi, Tharparkar', 'Cash on Delivery', 'PENDING_COD', 'Preparing', 9340, 0, 9340, 'Call before delivery', ?)
    `).run("ord-ts-1001", "TS-ORD-1001", now);

    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, variant_label, quantity, unit_price, image_url)
      VALUES (?, 'ord-ts-1001', 'ts-wom-1', 'Sage & Ivory Festive Embroidered 3-Piece Lawn Suit', 'Size: M · Color: Sage Green', 1, 6490, '/src/assets/images/prod_women_suit_1794818535930.jpg')
    `).run("oi-ts-1");

    db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, variant_label, quantity, unit_price, image_url)
      VALUES (?, 'ord-ts-1001', 'ts-ajr-1', 'Bhitshah Heritage Double-Block Sindhi Ajrak Shawl', 'Size: Free Size (2.5m) · Color: Madder Crimson & Indigo', 1, 2850, '/src/assets/images/prod_ajrak_shawl_1794818534620.jpg')
    `).run("oi-ts-2");

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, status, note, actor, created_at)
      VALUES ('osh-ts-1', 'ord-ts-1001', 'Pending', 'Order placed online at THAR STYLE', 'Ayesha Samejo', ?)
    `).run(now);
    db.prepare(`
      INSERT INTO order_status_history (id, order_id, status, note, actor, created_at)
      VALUES ('osh-ts-2', 'ord-ts-1001', 'Preparing', 'Order packed at THAR STYLE Mithi Boutique', 'Store Admin', ?)
    `).run(now);

    // 8. Save THAR STYLE CMS state & migration marker
    const cms = buildDefaultCmsConfig();
    db.prepare(`
      INSERT INTO cms_state (key, json_value, updated_at) VALUES ('public_cms', ?, ?)
      ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at
    `).run(JSON.stringify(cms), now);

    db.prepare(`
      INSERT INTO cms_state (key, json_value, updated_at) VALUES ('thar_style_migrated_v1', ?, ?)
    `).run(JSON.stringify({ migratedAt: now }), now);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, role, action, target, severity, created_at)
      VALUES (?, 'System', 'super_admin', 'Converted Store to THAR STYLE', 'Mithi, Tharparkar Fashion Catalog & CMS', 'info', ?)
    `).run(`aud-ts-${Date.now()}`, now);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export const ALL_ADMIN_PERMISSIONS = [
  "overview",
  "visual_editor",
  "hero_media",
  "branding_nav_footer",
  "colors_typography",
  "marquee_animations",
  "sections_pages",
  "products_categories",
  "orders_customers",
  "settings_seo",
  "users_logs_backup",
] as const;

export function syncNormalizedCmsTables(cms: ReturnType<typeof buildDefaultCmsConfig> & Record<string, unknown>) {
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO website_settings (id, store_name, tagline, city_location, seo_json, store_settings_json, updated_at)
       VALUES ('default', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         store_name = excluded.store_name,
         tagline = excluded.tagline,
         city_location = excluded.city_location,
         seo_json = excluded.seo_json,
         store_settings_json = excluded.store_settings_json,
         updated_at = excluded.updated_at`
    ).run(
      String(cms.brandName || "THAR STYLE"),
      String(cms.tagline || "Fashion for Every Generation"),
      String(cms.storeSettings?.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"),
      JSON.stringify(cms.seoSettings || {}),
      JSON.stringify(cms.storeSettings || {}),
      now
    );

    db.prepare(
      `INSERT INTO theme_settings (id, colors_json, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET colors_json = excluded.colors_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.themeColors || {}), now);

    db.prepare(
      `INSERT INTO typography_settings (id, typography_json, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET typography_json = excluded.typography_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.typography || {}), now);

    db.prepare(
      `INSERT INTO navigation_settings (id, settings_json, links_json, updated_at) VALUES ('default', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, links_json = excluded.links_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.navigationSettings || {}), JSON.stringify(cms.navLinks || []), now);

    db.prepare(
      `INSERT INTO footer_settings (id, settings_json, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.footerSettings || {}), now);

    db.prepare(
      `INSERT INTO logo_settings (id, settings_json, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.logoSettings || {}), now);

    db.prepare(
      `INSERT INTO animation_settings (id, settings_json, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(cms.animationSettings || {}), now);

    db.prepare("DELETE FROM hero_slides").run();
    const insSlide = db.prepare(
      `INSERT INTO hero_slides (
        id, title, subtitle, description, image_url, mobile_image_url, focal_point,
        object_fit, pos_x, pos_y, zoom_percent, overlay_opacity, text_align,
        primary_cta_text, primary_cta_href, secondary_cta_text, secondary_cta_href, enabled, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    ((cms.heroSlides || []) as Array<Record<string, unknown>>).forEach((s, idx) => {
      insSlide.run(
        String(s.id),
        String(s.title || ""),
        String(s.subtitle || ""),
        String(s.description || ""),
        String(s.imageUrl || ""),
        String(s.mobileImageUrl || ""),
        String(s.focalPoint || "center"),
        String(s.objectFit || "cover"),
        Number(s.posX ?? 50),
        Number(s.posY ?? (s.focalPoint === "top" ? 16 : 50)),
        Number(s.zoomPercent ?? 100),
        Number(s.overlayOpacity ?? 65),
        String(s.textAlign || "left"),
        String(s.primaryCtaText || "Shop Now"),
        String(s.primaryCtaHref || "/"),
        String(s.secondaryCtaText || ""),
        String(s.secondaryCtaHref || ""),
        s.enabled === false ? 0 : 1,
        Number(s.sortOrder || idx + 1)
      );
    });

    db.prepare("DELETE FROM announcements").run();
    const insAnn = db.prepare(
      `INSERT INTO announcements (
        id, text, link_href, text_color, bg_color, font_size_px, font_weight, mode,
        scroll_direction, scroll_speed_sec, enabled, start_date, end_date, show_on_desktop, show_on_mobile
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    (cms.announcements || []).forEach((a) => {
      insAnn.run(
        String(a.id),
        String(a.text || ""),
        String(a.linkHref || ""),
        String(a.textColor || "#FFFFFF"),
        String(a.bgColor || "#9E2A2B"),
        Number(a.fontSizePx || 12),
        String(a.fontWeight || "600"),
        String(a.mode || "scroll"),
        String(a.scrollDirection || "left"),
        Number(a.scrollSpeedSec || 25),
        a.enabled === false ? 0 : 1,
        String(a.startDate || ""),
        String(a.endDate || ""),
        a.showOnDesktop === false ? 0 : 1,
        a.showOnMobile === false ? 0 : 1
      );
    });

    db.prepare("DELETE FROM homepage_sections").run();
    const insSec = db.prepare(
      `INSERT INTO homepage_sections (id, section_key, title, subtitle, enabled, sort_order, config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    ((cms.sections || []) as Array<Record<string, unknown>>).forEach((sec, idx) => {
      insSec.run(
        String(sec.id),
        String(sec.key),
        String(sec.title || ""),
        String(sec.subtitle || ""),
        sec.enabled === false ? 0 : 1,
        Number(sec.sortOrder || idx + 1),
        JSON.stringify({
          imageUrl: sec.imageUrl || "",
          backgroundColor: sec.backgroundColor || "",
          ctaText: sec.ctaText || "",
          ctaHref: sec.ctaHref || "",
          productTag: sec.productTag || "all",
          collectionCards: Array.isArray(sec.collectionCards) ? sec.collectionCards : [],
          isSystem: Boolean(sec.isSystem),
        })
      );
    });

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function migrateToTharStyleV2() {
  const done = db.prepare("SELECT key FROM cms_state WHERE key = 'thar_style_migrated_v2'").get();
  if (done) return;

  const now = new Date().toISOString();
  const defaults = buildDefaultCmsConfig();

  const patchCmsKey = (stateKey: "public_cms" | "draft_cms") => {
    const row = db.prepare("SELECT json_value FROM cms_state WHERE key = ?").get(stateKey) as
      | { json_value: string }
      | undefined;
    if (!row) return;
    try {
      const parsed = JSON.parse(row.json_value) as Record<string, unknown>;
      const existingSlides = Array.isArray(parsed.heroSlides)
        ? (parsed.heroSlides as Array<Record<string, unknown>>)
        : [];
      const portraitIds = new Set(["slide-men", "slide-women", "slide-kids", "slide-young"]);
      const updatedSlides: Array<Record<string, unknown>> = existingSlides.map((s) => {
        const id = String(s.id || "");
        if (portraitIds.has(id)) {
          return {
            ...s,
            focalPoint: s.focalPoint === "center" || !s.focalPoint ? "top" : s.focalPoint,
            objectFit: s.objectFit || "cover",
            posX: s.posX ?? 50,
            posY: s.posY ?? (id === "slide-kids" ? 18 : 16),
            zoomPercent: s.zoomPercent ?? 100,
          };
        }
        return {
          ...s,
          objectFit: s.objectFit || "cover",
          posX: s.posX ?? 50,
          posY: s.posY ?? 50,
          zoomPercent: s.zoomPercent ?? 100,
        };
      });
      const existingIds = new Set(updatedSlides.map((s) => String(s.id || "")));
      for (const defSlide of defaults.heroSlides) {
        if (!existingIds.has(defSlide.id)) {
          updatedSlides.push(defSlide as unknown as Record<string, unknown>);
        }
      }

      const existingSections = Array.isArray(parsed.sections)
        ? (parsed.sections as Array<Record<string, unknown>>)
        : [];
      const defaultSindhi = defaults.sections.find((s) => s.key === "sindhi_thari");
      const updatedSections = existingSections.map((sec) => {
        if (sec.key === "sindhi_thari" && defaultSindhi) {
          return {
            ...sec,
            ctaText: sec.ctaText || defaultSindhi.ctaText,
            ctaHref: sec.ctaHref || defaultSindhi.ctaHref,
            collectionCards:
              Array.isArray(sec.collectionCards) && sec.collectionCards.length > 0
                ? sec.collectionCards
                : defaultSindhi.collectionCards,
          };
        }
        return sec;
      });

      const merged = {
        ...parsed,
        heroSettings: {
          ...defaults.heroSettings,
          ...((parsed.heroSettings as Record<string, unknown>) || {}),
        },
        heroSlides: updatedSlides,
        sections: updatedSections,
      };

      db.prepare("UPDATE cms_state SET json_value = ?, updated_at = ? WHERE key = ?").run(
        JSON.stringify(merged),
        now,
        stateKey
      );
      if (stateKey === "public_cms") {
        syncNormalizedCmsTables(merged as ReturnType<typeof buildDefaultCmsConfig>);
      }
    } catch {
      // Ignore malformed stored json
    }
  };

  patchCmsKey("public_cms");
  patchCmsKey("draft_cms");

  // Seed newly generated images into media_assets for instant Admin Media Library visibility
  const newMedia = [
    { id: "med-hero-festive", name: "hero_festive_bridal_collection.jpg", category: "Hero", url: "/src/assets/images/hero_festive_bridal_collection_1794821581556.jpg", dimensions: "1920 × 1080", fileSize: "390 KB", alt: "Festive & bridal Pakistani formal couture collection" },
    { id: "med-hero-winter", name: "hero_winter_shawl_menswear.jpg", category: "Hero", url: "/src/assets/images/hero_winter_shawl_menswear_1794821582077.jpg", dimensions: "1920 × 1080", fileSize: "360 KB", alt: "Winter wool shawl and navy kameez shalwar lookbook" },
    { id: "med-card-ajrak", name: "sindhi_ajrak_collection_card.jpg", category: "Collections", url: "/src/assets/images/sindhi_ajrak_collection_card_1794821582353.jpg", dimensions: "1200 × 900", fileSize: "295 KB", alt: "Double-block Sindhi Ajrak cotton shawls" },
    { id: "med-card-topi", name: "sindhi_topi_craft_card.jpg", category: "Collections", url: "/src/assets/images/sindhi_topi_craft_card_1794821583404.jpg", dimensions: "1200 × 900", fileSize: "285 KB", alt: "Hand-embroidered mirrorwork Sindhi Topi" },
    { id: "med-card-dress", name: "sindhi_traditional_dress_card.jpg", category: "Collections", url: "/src/assets/images/sindhi_traditional_dress_card_1794821584167.jpg", dimensions: "1200 × 900", fileSize: "290 KB", alt: "Traditional embroidered Sindhi & Thari gaj dress" },
    { id: "med-card-thari", name: "thari_cultural_fashion_card.jpg", category: "Collections", url: "/src/assets/images/thari_cultural_fashion_card_1794821584942.jpg", dimensions: "1200 × 900", fileSize: "275 KB", alt: "Traditional Thari embroidered koti and desert shawl" },
  ];
  const insM = db.prepare(
    `INSERT OR IGNORE INTO media_assets (id, name, category, url, dimensions, file_size, mime_type, alt_text, used_in_json, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'image/jpeg', ?, '[]', 'System Seed', ?)`
  );
  for (const m of newMedia) {
    insM.run(m.id, m.name, m.category, m.url, m.dimensions, m.fileSize, m.alt, now);
  }

  db.prepare(
    `INSERT OR REPLACE INTO cms_state (key, json_value, updated_at) VALUES ('thar_style_migrated_v2', ?, ?)`
  ).run(JSON.stringify({ migratedAt: now }), now);
}

function seedSuperAdminEnhancements() {
  const now = new Date().toISOString();

  // 1. Ensure initial media_assets catalog is populated
  const mediaCount = (db.prepare("SELECT COUNT(*) as c FROM media_assets").get() as { c: number }).c;
  if (mediaCount === 0) {
    const seedMedia = [
      { id: "med-hero-men", name: "thar_hero_men.jpg", category: "Hero", url: "/src/assets/images/thar_hero_men_1794818533982.jpg", dimensions: "1920 × 1080", fileSize: "340 KB", alt: "Men's waistcoats & kurta collection" },
      { id: "med-hero-women", name: "thar_hero_women.jpg", category: "Hero", url: "/src/assets/images/thar_hero_women_1794818535484.jpg", dimensions: "1920 × 1080", fileSize: "385 KB", alt: "Women's embroidered 3-piece lawn suits" },
      { id: "med-hero-sindhi", name: "thar_hero_sindhi.jpg", category: "Hero", url: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg", dimensions: "1920 × 1080", fileSize: "410 KB", alt: "Traditional Sindhi Ajrak & Topi heritage" },
      { id: "med-hero-kids", name: "thar_hero_kids.jpg", category: "Hero", url: "/src/assets/images/thar_hero_kids_1794818534679.jpg", dimensions: "1920 × 1080", fileSize: "320 KB", alt: "Kids festive embroidered wear" },
      { id: "med-hero-young", name: "thar_hero_young.jpg", category: "Hero", url: "/src/assets/images/thar_hero_young_1794818534339.jpg", dimensions: "1920 × 1080", fileSize: "355 KB", alt: "Young fashion denim & overshirts" },
      { id: "med-prod-ajrak", name: "prod_ajrak_shawl.jpg", category: "Products", url: "/src/assets/images/prod_ajrak_shawl_1794818534620.jpg", dimensions: "1200 × 1500", fileSize: "260 KB", alt: "Double-block Sindhi Ajrak shawl" },
      { id: "med-prod-topi", name: "prod_sindhi_topi.jpg", category: "Products", url: "/src/assets/images/prod_sindhi_topi_1794818535584.jpg", dimensions: "1200 × 1500", fileSize: "245 KB", alt: "Mirrorwork Sindhi Topi" },
      { id: "med-prod-waistcoat", name: "prod_men_waistcoat.jpg", category: "Products", url: "/src/assets/images/prod_men_waistcoat_1794818534691.jpg", dimensions: "1200 × 1500", fileSize: "250 KB", alt: "Tailored charcoal waistcoat" },
      { id: "med-prod-women-suit", name: "prod_women_suit.jpg", category: "Products", url: "/src/assets/images/prod_women_suit_1794818535930.jpg", dimensions: "1200 × 1500", fileSize: "275 KB", alt: "Sage & Ivory embroidered lawn suit" },
      { id: "med-prod-street", name: "prod_young_streetwear.jpg", category: "Products", url: "/src/assets/images/prod_young_streetwear_1794818536129.jpg", dimensions: "1200 × 1500", fileSize: "240 KB", alt: "Olive twill utility overshirt" },
      { id: "med-prod-kids", name: "prod_kids_festive.jpg", category: "Products", url: "/src/assets/images/prod_kids_festive_1794818536710.jpg", dimensions: "1200 × 1500", fileSize: "230 KB", alt: "Kids embroidered kurta waistcoat set" },
      { id: "med-store-hero", name: "hero_clothing_store.jpg", category: "Collections", url: "/src/assets/images/hero_clothing_store_1794817075010.jpg", dimensions: "1600 × 1066", fileSize: "310 KB", alt: "THAR STYLE boutique interior" },
      { id: "med-cat-fashion", name: "cat_clothing_fashion.jpg", category: "Collections", url: "/src/assets/images/cat_clothing_fashion_1794817076850.jpg", dimensions: "1200 × 1500", fileSize: "265 KB", alt: "THAR STYLE seasonal kurti collection" },
    ];
    const insM = db.prepare(
      `INSERT OR IGNORE INTO media_assets (id, name, category, url, dimensions, file_size, mime_type, alt_text, used_in_json, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'image/jpeg', ?, '[]', 'System Seed', ?)`
    );
    for (const m of seedMedia) {
      insM.run(m.id, m.name, m.category, m.url, m.dimensions, m.fileSize, m.alt, now);
    }
  }

  // 2. Ensure all 8 CMS store pages exist
  const pagesCount = (db.prepare("SELECT COUNT(*) as c FROM cms_pages").get() as { c: number }).c;
  if (pagesCount === 0) {
    const defaults = buildDefaultCmsConfig().storeSettings;
    const seedPages = [
      {
        id: "page-about",
        slug: "about-us",
        title: "About Us",
        heading: "About THAR STYLE · Mithi, Tharparkar",
        subtitle: "Fashion for Every Generation",
        bodyHtml: `<p>${defaults.aboutStory}</p><p>We partner directly with master block-printers in Bhitshah and needlecraft artisans across Tharparkar so every Sindhi Ajrak shawl, mirrorwork Topi, and contemporary ensemble carries enduring quality.</p>`,
        imageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
        ctaText: "Explore Traditional Sindhi Wear",
        ctaHref: "/category/traditional-sindhi-wear",
        seoTitle: "About THAR STYLE — Mithi, Tharparkar Clothing Store",
        seoDescription: "Discover THAR STYLE's story in Mithi, Tharparkar: contemporary Pakistani clothing and authentic Sindhi heritage craft.",
      },
      {
        id: "page-contact",
        slug: "contact-us",
        title: "Contact Us",
        heading: "Visit or Contact THAR STYLE",
        subtitle: "Mithi, Tharparkar, Sindh, Pakistan",
        bodyHtml: "<p>Our Mithi boutique team is delighted to assist with garment sizing, wedding and Eid family ensembles, and custom Ajrak & Sindhi Topi gifting.</p>",
        imageUrl: "/src/assets/images/hero_clothing_store_1794817075010.jpg",
        ctaText: "Browse Collections",
        ctaHref: "/categories",
        seoTitle: "Contact THAR STYLE — Mithi, Tharparkar",
        seoDescription: "Reach THAR STYLE in Mithi, Tharparkar for sizing help, orders, and traditional cultural gifting.",
      },
      {
        id: "page-return",
        slug: "return-policy",
        title: "Return & Exchange Policy",
        heading: "7-Day Easy Return & Exchange",
        subtitle: "Shop with confidence across Mithi & Pakistan",
        bodyHtml: `<p>${defaults.returnPolicy}</p><ul><li>Items must remain unworn, unwashed, and have original THAR STYLE tags attached.</li><li>Exchange requests can be initiated from your Customer Portal or by contacting our store team.</li></ul>`,
        imageUrl: "",
        ctaText: "View Customer Portal",
        ctaHref: "/customer",
        seoTitle: "Return & Exchange Policy — THAR STYLE",
        seoDescription: "Easy 7-day garment exchanges and returns at THAR STYLE Mithi.",
      },
      {
        id: "page-shipping",
        slug: "shipping-policy",
        title: "Shipping Policy",
        heading: "Nationwide & Mithi Local Delivery",
        subtitle: "Fast, tracked parcel dispatch across Sindh & Pakistan",
        bodyHtml: "<p>Same-day or next-day courier delivery across Mithi and Tharparkar towns, and 2–4 working days nationwide via tracked courier partners. Orders above our free shipping threshold automatically qualify for complimentary delivery.</p>",
        imageUrl: "",
        ctaText: "Shop New Arrivals",
        ctaHref: "/new-arrivals",
        seoTitle: "Shipping Policy — THAR STYLE",
        seoDescription: "Delivery timelines and shipping rates from Mithi, Tharparkar across Pakistan.",
      },
      {
        id: "page-privacy",
        slug: "privacy-policy",
        title: "Privacy Policy",
        heading: "Customer Privacy & Data Protection",
        subtitle: "Transparent handling of your order information",
        bodyHtml: `<p>${defaults.privacyPolicy}</p>`,
        imageUrl: "",
        ctaText: "Continue Shopping",
        ctaHref: "/",
        seoTitle: "Privacy Policy — THAR STYLE",
        seoDescription: "How THAR STYLE protects customer personal and delivery details.",
      },
      {
        id: "page-terms",
        slug: "terms-and-conditions",
        title: "Terms & Conditions",
        heading: "Store Terms & Conditions",
        subtitle: "THAR STYLE · Mithi, Tharparkar",
        bodyHtml: `<p>${defaults.termsPolicy}</p>`,
        imageUrl: "",
        ctaText: "Browse Collections",
        ctaHref: "/categories",
        seoTitle: "Terms & Conditions — THAR STYLE",
        seoDescription: "Terms of sale and service for THAR STYLE online and boutique orders.",
      },
      {
        id: "page-size-guide",
        slug: "size-guide",
        title: "Size Guide",
        heading: "Apparel & Sindhi Topi Size Guide",
        subtitle: "Accurate measurements for Men, Women, Kids & Cultural Headwear",
        bodyHtml: "<p><strong>Men's Kurta & Kameez (Chest / Length in inches):</strong> S (38 / 39), M (40 / 41), L (43 / 42), XL (46 / 44), XXL (49 / 45).</p><p><strong>Women's Stitched Suits (Bust / Shirt Length):</strong> XS (34 / 37), S (36 / 38), M (39 / 39), L (42 / 40), XL (45 / 41).</p><p><strong>Sindhi Topi Head Circumference:</strong> 56cm (S), 57cm (M), 58cm (L), 59cm (XL).</p>",
        imageUrl: "",
        ctaText: "Shop Tailored Fits",
        ctaHref: "/categories",
        seoTitle: "Size Guide — THAR STYLE",
        seoDescription: "Complete sizing chart for Pakistani men's, women's, kids' apparel and Sindhi Topi.",
      },
      {
        id: "page-faq",
        slug: "faq",
        title: "Frequently Asked Questions",
        heading: "Frequently Asked Questions",
        subtitle: "Answers about fabrics, Ajrak care, delivery, and exchanges",
        bodyHtml: "<p><strong>Are your Ajrak shawls hand-block printed?</strong><br/>Yes, our heritage Ajrak collection uses authentic multi-stage woodblock printing and natural madder & indigo dyes.</p><p><strong>Do you deliver outside Mithi, Tharparkar?</strong><br/>Yes, we deliver to Hyderabad, Karachi, Umerkot, Mirpurkhas, Lahore, Islamabad, and all major cities across Pakistan.</p><p><strong>Can I pay Cash on Delivery?</strong><br/>Yes, Cash on Delivery is available across Pakistan, alongside any digital payment methods enabled in Store Settings.</p>",
        imageUrl: "",
        ctaText: "Contact Support",
        ctaHref: "/contact",
        seoTitle: "FAQ — THAR STYLE",
        seoDescription: "Frequently asked questions about THAR STYLE Mithi clothing & Sindhi heritage collections.",
      },
    ];
    const insP = db.prepare(
      `INSERT OR IGNORE INTO cms_pages (id, slug, title, heading, subtitle, body_html, image_url, cta_text, cta_href, seo_title, seo_description, published, is_system, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
    );
    for (const p of seedPages) {
      insP.run(p.id, p.slug, p.title, p.heading, p.subtitle, p.bodyHtml, p.imageUrl, p.ctaText, p.ctaHref, p.seoTitle, p.seoDescription, now);
    }
  }

  // 3. Ensure initial published version exists in cms_versions & sync normalized tables
  const verCount = (db.prepare("SELECT COUNT(*) as c FROM cms_versions").get() as { c: number }).c;
  const cmsRow = db.prepare("SELECT json_value FROM cms_state WHERE key = 'public_cms'").get() as { json_value: string } | undefined;
  const baseCms = cmsRow ? { ...buildDefaultCmsConfig(), ...JSON.parse(cmsRow.json_value) } : buildDefaultCmsConfig();
  if (verCount === 0) {
    db.prepare(
      `INSERT INTO cms_versions (id, version_number, status, label, published_by, config_json, created_at)
       VALUES ('ver-1', 1, 'Published', 'Initial THAR STYLE Storefront Launch', 'THAR STYLE Store Admin', ?, ?)`
    ).run(JSON.stringify(baseCms), now);
    syncNormalizedCmsTables(baseCms);
  }

  // 4. Ensure super_admin accounts have full permissions rows in admin_permissions
  const adminUsers = db.prepare("SELECT id, admin_role FROM users WHERE role = 'super_admin'").all() as Array<{ id: string; admin_role?: string }>;
  const insPerm = db.prepare(
    `INSERT OR IGNORE INTO admin_permissions (user_id, admin_role, permissions_json, updated_at)
     VALUES (?, ?, ?, ?)`
  );
  for (const au of adminUsers) {
    insPerm.run(au.id, au.admin_role || "super_admin", JSON.stringify(ALL_ADMIN_PERMISSIONS), now);
  }
}
