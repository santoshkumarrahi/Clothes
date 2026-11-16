import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import {
  AuthUser,
  CmsConfig,
  DbBusiness,
  DbProduct,
  HomepageSectionConfig,
  ProductReview,
  PublicCategory,
} from "../types";
import { getCmsThemeStyleVars } from "../utils/cmsTheme";
import { formatPKR } from "../utils/formatters";
import { FashionProductCard } from "./FashionProductCard";
import { PublicFooter, PublicNavbar } from "./PublicNavbar";

interface PublicWebsiteViewProps {
  cms: CmsConfig;
  stores: DbBusiness[];
  products: DbProduct[];
  categories: PublicCategory[];
  reviews?: ProductReview[];
  currentUser: AuthUser | null;
  cartCount: number;
  wishlistIds: string[];
  initialSection?: "home" | "stores" | "offers" | "about";
  previewMode?: boolean;
  previewViewport?: "desktop" | "tablet" | "mobile";
  onNavigateRoute: (path: string) => void;
  onOpenStore: (slug: string) => void;
  onAddToCart: (product: DbProduct, variantLabel?: string) => void;
  onToggleWishlist: (productId: string) => void;
  onOpenCart: () => void;
  onLogout: () => void;
}

export const PublicWebsiteView: React.FC<PublicWebsiteViewProps> = ({
  cms,
  products,
  categories,
  reviews = [],
  currentUser,
  cartCount,
  wishlistIds,
  previewViewport,
  onNavigateRoute,
  onAddToCart,
  onToggleWishlist,
  onOpenCart,
  onLogout,
}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const [quickProd, setQuickProd] = useState<DbProduct | null>(null);
  const [quickImage, setQuickImage] = useState("");
  const [quickSize, setQuickSize] = useState("");
  const [quickColor, setQuickColor] = useState("");

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  const themeVars = useMemo(
    () => getCmsThemeStyleVars(cms, previewViewport),
    [cms, previewViewport]
  );

  const tc = cms.themeColors;
  const heroCfg = cms.heroSettings;

  const enabledSlides = useMemo(
    () =>
      (cms.heroSlides || [])
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [cms.heroSlides]
  );

  const autoSlideEnabled = heroCfg?.autoSlide ?? true;
  const slideDurationMs = Math.max(
    2500,
    Number(heroCfg?.slideDurationMs || cms.slideDurationMs) || 5500
  );

  useEffect(() => {
    if (!autoSlideEnabled || enabledSlides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % enabledSlides.length);
    }, slideDurationMs);
    return () => clearInterval(timer);
  }, [enabledSlides.length, slideDurationMs, autoSlideEnabled]);

  const activeSlide = enabledSlides[slideIdx % Math.max(1, enabledSlides.length)] || {
    id: "fallback",
    title: cms.heroTitle || "Style That Defines You",
    subtitle: cms.heroSubtitle || "THAR STYLE · Mithi, Tharparkar",
    description: cms.heroDescription,
    imageUrl: cms.heroImage || "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
    mobileImageUrl: "",
    focalPoint: "center" as const,
    overlayOpacity: 65,
    textAlign: "left" as const,
    primaryCtaText: cms.heroCtaText || "Shop Now",
    primaryCtaHref: "/category/men",
    secondaryCtaText: "New Arrivals",
    secondaryCtaHref: "/new-arrivals",
  };

  const orderedSections = useMemo(
    () =>
      (cms.sections || [])
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [cms.sections]
  );

  const openQuickView = (prod: DbProduct) => {
    setQuickProd(prod);
    setQuickImage(prod.primaryImage || prod.images?.[0]?.url || "");
    const sizes = prod.sizes?.length ? prod.sizes : prod.variants || ["Standard"];
    setQuickSize(sizes[0] || "Standard");
    setQuickColor(prod.colors?.[0] || "Standard");
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterLoading(true);
    setNewsletterStatus(null);
    setNewsletterError(null);
    try {
      const res = await fetch("/api/public/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not subscribe.");
      setNewsletterStatus(data.message);
      setNewsletterEmail("");
    } catch (err: unknown) {
      setNewsletterError(err instanceof Error ? err.message : "Subscription failed.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  // Pre-sliced collection buckets
  const menProducts = useMemo(
    () => products.filter((p) => p.category_slug === "men").slice(0, 4),
    [products]
  );
  const womenProducts = useMemo(
    () => products.filter((p) => p.category_slug === "women").slice(0, 4),
    [products]
  );
  const kidsProducts = useMemo(
    () => products.filter((p) => p.category_slug === "kids").slice(0, 4),
    [products]
  );
  const youngProducts = useMemo(
    () => products.filter((p) => p.category_slug === "young-fashion").slice(0, 4),
    [products]
  );
  const sindhiProducts = useMemo(
    () => products.filter((p) => p.category_slug === "traditional-sindhi-wear").slice(0, 4),
    [products]
  );
  const ajrakTopiProducts = useMemo(
    () =>
      products
        .filter((p) => p.category_slug === "ajrak-collection" || p.category_slug === "sindhi-topi")
        .slice(0, 4),
    [products]
  );
  const newArrivalProducts = useMemo(
    () => products.filter((p) => p.is_new_arrival).slice(0, 4),
    [products]
  );
  const bestSellerProducts = useMemo(
    () => products.filter((p) => p.is_best_seller).slice(0, 4),
    [products]
  );
  const saleProducts = useMemo(
    () =>
      products
        .filter((p) => p.discount_price && p.discount_price > 0 && p.discount_price < p.selling_price)
        .slice(0, 4),
    [products]
  );
  const featuredProducts = useMemo(
    () => products.filter((p) => p.is_featured).slice(0, 4),
    [products]
  );

  const getProductsForTag = (tag?: HomepageSectionConfig["productTag"]): DbProduct[] => {
    switch (tag) {
      case "new":
        return newArrivalProducts;
      case "best":
        return bestSellerProducts;
      case "sale":
        return saleProducts;
      case "featured":
        return featuredProducts;
      case "men":
        return menProducts;
      case "women":
        return womenProducts;
      case "kids":
        return kidsProducts;
      case "young":
        return youngProducts;
      case "sindhi":
        return sindhiProducts;
      case "ajrak":
        return ajrakTopiProducts;
      default:
        return products.slice(0, 4);
    }
  };

  const renderSectionHeading = (title: string, subtitle?: string) => (
    <div className="space-y-1">
      <h2
        style={{
          fontFamily: "var(--ts-heading-font, var(--font-display))",
          fontSize: "var(--ts-heading-size, 32px)",
          fontWeight: "var(--ts-heading-weight, 700)",
          fontStyle: "var(--ts-heading-style, normal)",
          color: "var(--ts-heading-color, #141413)",
          lineHeight: "var(--ts-heading-lh, 1.15)",
          letterSpacing: "var(--ts-heading-ls, -0.01em)",
          textTransform: "var(--ts-heading-transform, none)" as React.CSSProperties["textTransform"],
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="max-w-2xl"
          style={{
            fontFamily: "var(--ts-body-font, var(--font-body))",
            fontSize: "var(--ts-body-size, 14px)",
            color: "var(--ts-secondary-text, #5D574F)",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );

  const renderProductRow = (
    sec: HomepageSectionConfig,
    items: DbProduct[],
    viewAllHref: string,
    viewAllLabel: string,
    tinted = false
  ) => {
    if (items.length === 0) return null;
    const customBg = sec.backgroundColor?.trim();
    return (
      <section
        key={sec.id}
        className={`py-14 px-4 lg:px-8 ${tinted && !customBg ? "border-y" : ""}`}
        style={{
          backgroundColor: customBg || (tinted ? "var(--ts-section-bg, #F2EDE4)" : "transparent"),
          borderColor: "var(--ts-border-color, #E7E1D8)",
        }}
      >
        <div className="mx-auto max-w-7xl space-y-7">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            {renderSectionHeading(sec.title, sec.subtitle)}
            <button
              type="button"
              onClick={() => onNavigateRoute(sec.ctaHref || viewAllHref)}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider hover:underline whitespace-nowrap cursor-pointer"
              style={{ color: tc?.navbarHover || "#9E2A2B" }}
            >
              <span>{sec.ctaText || viewAllLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((p) => (
              <FashionProductCard
                key={p.id}
                product={p}
                animations={cms.animationSettings}
                isWishlisted={wishlistIds.includes(p.id)}
                onOpenProduct={(pid) => onNavigateRoute(`/product/${pid}`)}
                onQuickView={openQuickView}
                onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist}
              />
            ))}
          </div>
        </div>
      </section>
    );
  };

  // Hero visual computation
  const heroHeightPx =
    previewViewport === "mobile"
      ? heroCfg?.heightMobilePx || 440
      : previewViewport === "tablet"
      ? heroCfg?.heightTabletPx || 500
      : heroCfg?.heightDesktopPx || 580;
  const heroImgUrl =
    previewViewport === "mobile" && activeSlide.mobileImageUrl
      ? activeSlide.mobileImageUrl
      : activeSlide.imageUrl;
  const overlayOp = Math.max(0, Math.min(95, Number(activeSlide.overlayOpacity ?? 55))) / 100;
  const alignClass =
    activeSlide.textAlign === "center"
      ? "mx-auto text-center items-center"
      : activeSlide.textAlign === "right"
      ? "ml-auto text-right items-end"
      : "text-left items-start";

  const posX = Math.max(0, Math.min(100, Number(activeSlide.posX ?? 50)));
  const posY = Math.max(
    0,
    Math.min(
      100,
      Number(
        activeSlide.posY ??
          (activeSlide.focalPoint === "top"
            ? 16
            : activeSlide.focalPoint === "bottom"
            ? 85
            : 50)
      )
    )
  );
  const objFit = activeSlide.objectFit === "contain" ? "contain" : "cover";
  const zoomRatio = Math.max(0.8, Math.min(1.6, Number(activeSlide.zoomPercent ?? 100) / 100));
  const heroMaxWidthPct = Math.max(60, Math.min(100, Number(heroCfg?.maxWidthPct ?? 100)));
  const heroContained = heroCfg?.widthMode === "contained";

  const heroTransitionDuration =
    cms.animationSettings?.heroTransition?.enabled === false
      ? "0ms"
      : `${cms.animationSettings?.heroTransition?.durationMs || 700}ms`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        ...themeVars,
        backgroundColor: tc?.pageBg || cms.pageBg || "#FAF8F5",
        color: tc?.primaryText || "#141413",
        fontFamily: "var(--ts-body-font, var(--font-body))",
      }}
    >
      <PublicNavbar
        cms={cms}
        categories={categories}
        currentUser={currentUser}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
        activePath="/"
        previewViewport={previewViewport}
        onNavigateRoute={onNavigateRoute}
        onOpenCart={onOpenCart}
        onLogout={onLogout}
      />

      <main className="flex-1">
        {/* 1. HERO FASHION IMAGE SLIDER */}
        <section
          className={`relative overflow-hidden bg-[#141413] text-white ${
            heroContained ? "mx-auto my-4 max-w-7xl rounded-2xl shadow-lg" : "mx-auto"
          }`}
          style={heroMaxWidthPct < 100 ? { maxWidth: `${heroMaxWidthPct}%` } : undefined}
        >
          <div
            className="relative flex items-center"
            style={{ height: `${heroHeightPx}px`, minHeight: `${heroHeightPx}px` }}
          >
            <img
              src={heroImgUrl}
              alt={activeSlide.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full transition-all"
              style={{
                objectFit: objFit,
                objectPosition: `${posX}% ${posY}%`,
                transform: `scale(${zoomRatio})`,
                transformOrigin: `${posX}% ${posY}%`,
                transitionDuration: heroTransitionDuration,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  activeSlide.textAlign === "center"
                    ? tc?.heroOverlay || "#141413"
                    : `linear-gradient(90deg, ${tc?.heroOverlay || "#141413"} 0%, ${tc?.heroOverlay || "#141413"}99 42%, transparent 82%)`,
                opacity: overlayOp,
              }}
            />

            <div className="relative z-10 mx-auto max-w-7xl w-full px-6 py-16 lg:px-12">
              <div className={`max-w-xl flex flex-col space-y-5 ${alignClass}`}>
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: tc?.heroSubtitle || "#E6C994" }}
                >
                  {activeSlide.subtitle}
                </p>
                <h1
                  className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08]"
                  style={{
                    fontFamily: "var(--ts-heading-font, var(--font-display))",
                    color: tc?.heroTitle || "#FFFFFF",
                  }}
                >
                  {activeSlide.title}
                </h1>
                <p className="text-sm sm:text-base text-[#EAE4DB] leading-relaxed">
                  {activeSlide.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateRoute(activeSlide.primaryCtaHref || "/category/men")}
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: tc?.heroButtonBg || cms.secondaryColor || "#9E2A2B",
                      color: tc?.heroButtonText || "#FFFFFF",
                    }}
                  >
                    <span>{activeSlide.primaryCtaText || "Shop Now"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {activeSlide.secondaryCtaText && (
                    <button
                      type="button"
                      onClick={() => onNavigateRoute(activeSlide.secondaryCtaHref || "/new-arrivals")}
                      className="rounded-lg border border-white/40 bg-white/10 backdrop-blur-xs px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 cursor-pointer"
                    >
                      {activeSlide.secondaryCtaText}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Slide Controls */}
            {enabledSlides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSlideIdx((prev) => (prev - 1 + enabledSlides.length) % enabledSlides.length)
                  }
                  aria-label="Previous slide"
                  className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/75 cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((prev) => (prev + 1) % enabledSlides.length)}
                  aria-label="Next slide"
                  className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/75 cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
                  {enabledSlides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlideIdx(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === slideIdx % enabledSlides.length ? "w-7 bg-white" : "w-2 bg-white/45"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* DYNAMIC CMS-ORDERED SECTIONS */}
        {orderedSections.map((sec) => {
          if (sec.key === "categories") {
            return (
              <section
                key={sec.id}
                className="py-14 px-4 lg:px-8"
                style={{ backgroundColor: sec.backgroundColor || "transparent" }}
              >
                <div className="mx-auto max-w-7xl space-y-7">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    {renderSectionHeading(sec.title, sec.subtitle)}
                    <button
                      type="button"
                      onClick={() => onNavigateRoute("/categories")}
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer"
                      style={{ color: tc?.navbarHover || "#9E2A2B" }}
                    >
                      All Collections <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => onNavigateRoute(`/category/${cat.slug}`)}
                        className="group rounded-xl border overflow-hidden text-left hover:border-[#9E2A2B] transition-all cursor-pointer"
                        style={{
                          backgroundColor: tc?.cardBg || "#FFFFFF",
                          borderColor: tc?.borderColor || "#E7E1D8",
                        }}
                      >
                        <div
                          className="aspect-[3/4] overflow-hidden"
                          style={{ backgroundColor: tc?.sectionBg || "#F2EDE4" }}
                        >
                          <img
                            src={cat.image_url}
                            alt={cat.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-3">
                          <h3 className="font-display text-sm font-bold group-hover:text-[#9E2A2B] line-clamp-1">
                            {cat.name}
                          </h3>
                          <p className="text-[11px] text-[#8D857B] tabular-nums mt-0.5">
                            {cat.product_count ?? 0} styles
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          if (sec.key === "men_latest") {
            return renderProductRow(sec, menProducts, "/category/men", "Shop Men's Collection");
          }
          if (sec.key === "women_latest") {
            return renderProductRow(sec, womenProducts, "/category/women", "Shop Women's Collection", true);
          }
          if (sec.key === "kids_fashion") {
            return renderProductRow(sec, kidsProducts, "/category/kids", "Shop Kids Fashion");
          }
          if (sec.key === "young_fashion") {
            return renderProductRow(sec, youngProducts, "/category/young-fashion", "Shop Young Fashion", true);
          }
          if (sec.key === "sindhi_thari") {
            const culturalCards =
              sec.collectionCards && sec.collectionCards.length > 0
                ? sec.collectionCards
                : [
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
                  ];
            const heritageProducts = [...sindhiProducts, ...ajrakTopiProducts].slice(0, 4);
            return (
              <section
                key={sec.id}
                className="py-16 px-4 lg:px-8 border-y"
                style={{
                  backgroundColor: sec.backgroundColor || "var(--ts-section-bg, #F2EDE4)",
                  borderColor: "var(--ts-border-color, #E7E1D8)",
                }}
              >
                <div className="mx-auto max-w-7xl space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1.5">
                      <span className="inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-[#9E2A2B]">
                        Mithi &amp; Tharparkar Heritage Craft
                      </span>
                      {renderSectionHeading(sec.title, sec.subtitle)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateRoute(sec.ctaHref || "/traditional-sindhi-collection")}
                      className="inline-flex items-center gap-2 self-start md:self-auto rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: tc?.heroButtonBg || "#9E2A2B" }}
                    >
                      <span>{sec.ctaText || "Explore Collection"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 4 Cultural Craft Collection Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {culturalCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onNavigateRoute(card.href || "/traditional-sindhi-collection")}
                        className="group rounded-2xl border overflow-hidden text-left transition-all hover:border-[#9E2A2B] hover:shadow-md cursor-pointer"
                        style={{
                          backgroundColor: tc?.cardBg || "#FFFFFF",
                          borderColor: tc?.borderColor || "#E7E1D8",
                        }}
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-[#EAE4DB]">
                          <img
                            src={card.imageUrl}
                            alt={card.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover object-[50%_20%] transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-4 space-y-1">
                          <h3 className="font-display text-base font-bold text-[#141413] group-hover:text-[#9E2A2B]">
                            {card.title}
                          </h3>
                          <p className="text-xs text-[#5D574F] line-clamp-2">{card.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Curated Traditional Heritage Products */}
                  {heritageProducts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
                      {heritageProducts.map((p) => (
                        <FashionProductCard
                          key={p.id}
                          product={p}
                          animations={cms.animationSettings}
                          isWishlisted={wishlistIds.includes(p.id)}
                          onOpenProduct={(pid) => onNavigateRoute(`/product/${pid}`)}
                          onQuickView={openQuickView}
                          onAddToCart={onAddToCart}
                          onToggleWishlist={onToggleWishlist}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          }
          if (sec.key === "ajrak_topi_special") {
            return (
              <section
                key={sec.id}
                className="py-16 px-4 lg:px-8 text-[#FAF8F5]"
                style={{ backgroundColor: sec.backgroundColor || "#1F1A17" }}
              >
                <div className="mx-auto max-w-7xl space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6 space-y-4">
                      <span className="inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-[#D8A85A]">
                        Heritage Craft of Sindh · Mithi, Tharparkar
                      </span>
                      <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
                        {sec.title}
                      </h2>
                      <p className="text-sm text-[#D8D0C4] leading-relaxed">{sec.subtitle}</p>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => onNavigateRoute("/category/ajrak-collection")}
                          className="rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 cursor-pointer"
                          style={{ backgroundColor: tc?.heroButtonBg || "#9E2A2B" }}
                        >
                          Shop Ajrak Collection
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateRoute("/category/sindhi-topi")}
                          className="rounded-lg border border-white/30 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 cursor-pointer"
                        >
                          Shop Sindhi Topi
                        </button>
                      </div>
                    </div>
                    <div className="lg:col-span-6">
                      <img
                        src={sec.imageUrl || "/src/assets/images/thar_hero_sindhi_1794818534180.jpg"}
                        alt="Sindhi Ajrak & Topi Heritage"
                        referrerPolicy="no-referrer"
                        className="h-72 sm:h-80 w-full rounded-2xl object-cover border border-white/15"
                      />
                    </div>
                  </div>

                  {ajrakTopiProducts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {ajrakTopiProducts.map((p) => (
                        <FashionProductCard
                          key={p.id}
                          product={p}
                          animations={cms.animationSettings}
                          isWishlisted={wishlistIds.includes(p.id)}
                          onOpenProduct={(pid) => onNavigateRoute(`/product/${pid}`)}
                          onQuickView={openQuickView}
                          onAddToCart={onAddToCart}
                          onToggleWishlist={onToggleWishlist}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          }
          if (sec.key === "new_arrivals") {
            return renderProductRow(sec, newArrivalProducts, "/new-arrivals", "View All New Arrivals");
          }
          if (sec.key === "best_sellers") {
            return renderProductRow(sec, bestSellerProducts, "/best-sellers", "View All Best Sellers", true);
          }
          if (sec.key === "sale_offers") {
            return renderProductRow(sec, saleProducts, "/sale", "Shop Seasonal Offers");
          }
          if (sec.key === "featured_products") {
            return renderProductRow(sec, featuredProducts, "/categories", "Explore Featured Catalog", true);
          }
          if (sec.key === "why_shop_with_us") {
            const pillars = [
              {
                icon: Award,
                title: "Authentic Sindhi Craft",
                desc: "Hand-block-printed Ajrak & mirrorwork Topis curated directly with Tharparkar artisans.",
              },
              {
                icon: Sparkles,
                title: "All Generations Styled",
                desc: "Tailored Men's, Women's, Kids, and Young Fashion ensembles under one store.",
              },
              {
                icon: Truck,
                title: "Mithi & Nationwide Delivery",
                desc: `Flat ${formatPKR(cms.storeSettings?.deliveryFee ?? 200)} delivery · Free over ${formatPKR(cms.storeSettings?.freeDeliveryThreshold ?? 5000)}.`,
              },
              {
                icon: RefreshCw,
                title: "7-Day Easy Exchange",
                desc: "Transparent sizing guidance and hassle-free exchange on unworn items with tags.",
              },
            ];
            return (
              <section
                key={sec.id}
                className="py-14 px-4 lg:px-8 border-t"
                style={{
                  backgroundColor: sec.backgroundColor || "transparent",
                  borderColor: tc?.borderColor || "#E7E1D8",
                }}
              >
                <div className="mx-auto max-w-7xl space-y-8">
                  <div className="text-center max-w-2xl mx-auto space-y-1.5">
                    <h2
                      style={{
                        fontFamily: "var(--ts-heading-font, var(--font-display))",
                        fontSize: "var(--ts-heading-size, 32px)",
                        fontWeight: "var(--ts-heading-weight, 700)",
                        color: "var(--ts-heading-color, #141413)",
                      }}
                    >
                      {sec.title}
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: tc?.secondaryText || "#5D574F" }}>
                      {sec.subtitle}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {pillars.map((pl) => {
                      const Icon = pl.icon;
                      return (
                        <div
                          key={pl.title}
                          className="rounded-xl border p-6 space-y-2.5"
                          style={{
                            backgroundColor: tc?.cardBg || "#FFFFFF",
                            borderColor: tc?.borderColor || "#E7E1D8",
                          }}
                        >
                          <div className="h-10 w-10 rounded-lg bg-[#FAF8F5] border border-[#E7E1D8] flex items-center justify-center text-[#9E2A2B]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <h3 className="font-display text-base font-bold">{pl.title}</h3>
                          <p className="text-xs leading-relaxed" style={{ color: tc?.secondaryText || "#5D574F" }}>
                            {pl.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }
          if (sec.key === "reviews") {
            if (reviews.length === 0) return null;
            return (
              <section
                key={sec.id}
                className="py-14 px-4 lg:px-8 border-y"
                style={{
                  backgroundColor: sec.backgroundColor || tc?.sectionBg || "#F2EDE4",
                  borderColor: tc?.borderColor || "#E7E1D8",
                }}
              >
                <div className="mx-auto max-w-7xl space-y-7">
                  <div className="text-center max-w-2xl mx-auto space-y-1">
                    <h2
                      style={{
                        fontFamily: "var(--ts-heading-font, var(--font-display))",
                        fontSize: "var(--ts-heading-size, 32px)",
                        fontWeight: "var(--ts-heading-weight, 700)",
                        color: "var(--ts-heading-color, #141413)",
                      }}
                    >
                      {sec.title}
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: tc?.secondaryText || "#5D574F" }}>
                      {sec.subtitle}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {reviews.slice(0, 4).map((rv) => (
                      <div
                        key={rv.id}
                        className="rounded-xl border p-5 flex flex-col justify-between space-y-3"
                        style={{
                          backgroundColor: tc?.cardBg || "#FFFFFF",
                          borderColor: tc?.borderColor || "#E7E1D8",
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: rv.rating }).map((_, idx) => (
                              <Star
                                key={idx}
                                className="h-3.5 w-3.5"
                                style={{
                                  fill: "var(--ts-rating-stars, #B4843D)",
                                  color: "var(--ts-rating-stars, #B4843D)",
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-xs leading-relaxed">“{rv.comment}”</p>
                        </div>
                        <div className="pt-2 border-t border-[#F2EDE4] text-[11px]">
                          <p className="font-bold">{rv.customer_name}</p>
                          <p className="text-[#8D857B]">
                            {rv.city || "Tharparkar"} ·{" "}
                            <button
                              type="button"
                              onClick={() => onNavigateRoute(`/product/${rv.product_id}`)}
                              className="text-[#9E2A2B] hover:underline cursor-pointer"
                            >
                              {rv.product_name || "View Item"}
                            </button>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }
          if (sec.key === "newsletter") {
            return (
              <section
                key={sec.id}
                className="py-14 px-4 lg:px-8"
                style={{ backgroundColor: sec.backgroundColor || "transparent" }}
              >
                <div
                  className="mx-auto max-w-3xl rounded-2xl border p-8 sm:p-10 text-center space-y-4"
                  style={{
                    backgroundColor: tc?.cardBg || "#FFFFFF",
                    borderColor: tc?.borderColor || "#E7E1D8",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9E2A2B]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {cms.brandName || "THAR STYLE"} · {cms.storeSettings?.cityLocation || "Mithi, Tharparkar"}
                  </span>
                  <h2
                    style={{
                      fontFamily: "var(--ts-heading-font, var(--font-display))",
                      fontSize: "var(--ts-heading-size, 30px)",
                      fontWeight: "var(--ts-heading-weight, 700)",
                      color: "var(--ts-heading-color, #141413)",
                    }}
                  >
                    {sec.title}
                  </h2>
                  <p className="text-xs sm:text-sm" style={{ color: tc?.secondaryText || "#5D574F" }}>
                    {sec.subtitle}
                  </p>
                  <form
                    onSubmit={handleNewsletterSubmit}
                    className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto pt-2"
                  >
                    <input
                      required
                      type="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-4 py-2.5 text-xs focus:border-[#141413] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={newsletterLoading}
                      className="rounded-lg px-5 py-2.5 ts-btn-primary cursor-pointer"
                    >
                      {newsletterLoading ? "Joining..." : "Subscribe"}
                    </button>
                  </form>
                  {newsletterStatus && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <Check className="h-4 w-4" />
                      {newsletterStatus}
                    </p>
                  )}
                  {newsletterError && (
                    <p className="text-xs font-semibold text-rose-700">{newsletterError}</p>
                  )}
                </div>
              </section>
            );
          }

          // Custom Admin-added Sections
          if (sec.key === "custom") {
            const tagProducts = sec.productTag ? getProductsForTag(sec.productTag) : [];
            return (
              <section
                key={sec.id}
                className="py-14 px-4 lg:px-8 border-y"
                style={{
                  backgroundColor: sec.backgroundColor || tc?.sectionBg || "#F2EDE4",
                  borderColor: tc?.borderColor || "#E7E1D8",
                }}
              >
                <div className="mx-auto max-w-7xl space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className={sec.imageUrl ? "lg:col-span-7 space-y-3" : "lg:col-span-12 space-y-3"}>
                      {renderSectionHeading(sec.title, sec.subtitle)}
                      {sec.ctaText && (
                        <button
                          type="button"
                          onClick={() => onNavigateRoute(sec.ctaHref || "/categories")}
                          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 ts-btn-primary cursor-pointer mt-2"
                        >
                          <span>{sec.ctaText}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {sec.imageUrl && (
                      <div className="lg:col-span-5">
                        <img
                          src={sec.imageUrl}
                          alt={sec.title}
                          referrerPolicy="no-referrer"
                          className="h-64 w-full rounded-xl object-cover border border-[#E7E1D8]"
                        />
                      </div>
                    )}
                  </div>
                  {tagProducts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {tagProducts.map((p) => (
                        <FashionProductCard
                          key={p.id}
                          product={p}
                          animations={cms.animationSettings}
                          isWishlisted={wishlistIds.includes(p.id)}
                          onOpenProduct={(pid) => onNavigateRoute(`/product/${pid}`)}
                          onQuickView={openQuickView}
                          onAddToCart={onAddToCart}
                          onToggleWishlist={onToggleWishlist}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          }

          return null;
        })}
      </main>

      <PublicFooter cms={cms} categories={categories} onNavigateRoute={onNavigateRoute} />

      {/* Quick View Modal */}
      {quickProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white overflow-hidden shadow-2xl grid grid-cols-1 sm:grid-cols-2 text-[#141413]">
            <div className="bg-[#F2EDE4] p-4 flex flex-col gap-2">
              <img
                src={quickImage || quickProd.primaryImage}
                alt={quickProd.name}
                referrerPolicy="no-referrer"
                className="h-72 w-full rounded-xl object-cover"
              />
              {quickProd.images && quickProd.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {quickProd.images.map((im) => (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => setQuickImage(im.url)}
                      className={`h-12 w-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                        quickImage === im.url ? "border-[#9E2A2B]" : "border-transparent"
                      }`}
                    >
                      <img src={im.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E6B35]">
                    {quickProd.category} {quickProd.subcategory ? `· ${quickProd.subcategory}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickProd(null)}
                    className="rounded-lg p-1 text-[#8D857B] hover:text-[#141413] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="font-display text-xl font-bold text-[#141413]">{quickProd.name}</h3>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-xl font-extrabold text-[#141413]">
                    {formatPKR(quickProd.discount_price || quickProd.selling_price)}
                  </span>
                  {quickProd.discount_price && (
                    <span className="text-xs text-[#8D857B] line-through">
                      {formatPKR(quickProd.selling_price)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5D574F] leading-relaxed line-clamp-3">
                  {quickProd.description}
                </p>

                {(quickProd.sizes?.length ? quickProd.sizes : quickProd.variants || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase text-[#141413]">Size</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(quickProd.sizes?.length ? quickProd.sizes : quickProd.variants).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setQuickSize(sz)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                            quickSize === sz
                              ? "border-[#141413] bg-[#141413] text-white"
                              : "border-[#DFD8CE] text-[#3A3631]"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {quickProd.colors && quickProd.colors.length > 0 && quickProd.colors[0] !== "Standard" && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase text-[#141413]">Color</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickProd.colors.map((cl) => (
                        <button
                          key={cl}
                          type="button"
                          onClick={() => setQuickColor(cl)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                            quickColor === cl
                              ? "border-[#9E2A2B] bg-[#9E2A2B]/10 text-[#9E2A2B]"
                              : "border-[#DFD8CE] text-[#3A3631]"
                          }`}
                        >
                          {cl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={quickProd.stock <= 0}
                    onClick={() => {
                      const label =
                        quickColor && quickColor !== "Standard"
                          ? `Size: ${quickSize} · Color: ${quickColor}`
                          : `Size: ${quickSize}`;
                      onAddToCart(quickProd, label);
                      setQuickProd(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 ts-btn-primary disabled:opacity-40 cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Add to Bag
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(quickProd.id)}
                    className="rounded-lg border border-[#DFD8CE] px-3 py-2.5 text-[#141413] cursor-pointer"
                  >
                    <Heart
                      className={`h-4 w-4 ${wishlistIds.includes(quickProd.id) ? "fill-[#9E2A2B] text-[#9E2A2B]" : ""}`}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = quickProd.id;
                    setQuickProd(null);
                    onNavigateRoute(`/product/${id}`);
                  }}
                  className="w-full text-center text-xs font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                >
                  View Full Garment Details &amp; Size Guide →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
