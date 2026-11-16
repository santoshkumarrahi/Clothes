import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { AnnouncementItem, AuthUser, CmsConfig, PublicCategory } from "../types";

interface PublicNavbarProps {
  cms: CmsConfig;
  categories: PublicCategory[];
  currentUser: AuthUser | null;
  cartCount: number;
  wishlistCount?: number;
  activePath: string;
  previewViewport?: "desktop" | "tablet" | "mobile";
  onNavigateRoute: (path: string) => void;
  onOpenCart: () => void;
  onLogout: () => void;
}

function isAnnouncementScheduledNow(item: AnnouncementItem): boolean {
  if (!item.enabled || !item.text?.trim()) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (item.startDate && item.startDate > today) return false;
  if (item.endDate && item.endDate < today) return false;
  return true;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  cms,
  categories,
  currentUser,
  cartCount,
  wishlistCount = 0,
  activePath,
  previewViewport,
  onNavigateRoute,
  onOpenCart,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null);

  const tc = cms.themeColors;
  const navCfg = cms.navigationSettings;
  const logoCfg = cms.logoSettings;
  const marqueeDisabled = cms.animationSettings?.marqueeMotion?.enabled === false;

  const isSticky = navCfg?.stickyHeader ?? cms.stickyHeader ?? true;
  const showSearch = navCfg?.showSearchIcon ?? true;
  const showWishlist = navCfg?.showWishlistIcon ?? true;
  const showCart = navCfg?.showCartIcon ?? true;
  const showAccount = navCfg?.showAccountIcon ?? true;
  const headerHeightPx = Math.max(48, Math.min(120, Number(navCfg?.headerHeightPx || 64)));

  const desktopLogo = logoCfg?.headerLogoUrl || cms.headerLogoUrl || logoCfg?.mainLogoUrl || "";
  const mobileLogo = logoCfg?.mobileLogoUrl || desktopLogo;
  const logoHeightPx = Math.max(20, Math.min(84, Number(logoCfg?.logoHeightPx || 36)));
  const logoWidthPx = Math.max(20, Math.min(220, Number(logoCfg?.logoWidthPx || 40)));
  const isBoxedLogo = logoCfg?.logoPresentation === "boxed";
  const isCenterLogo = logoCfg?.logoAlignment === "center";

  const visibleLinks = useMemo(
    () => (cms.navLinks || []).filter((l) => l.visible !== false),
    [cms.navLinks]
  );

  const activeAnnouncements = useMemo(() => {
    const list = (cms.announcements || []).filter(isAnnouncementScheduledNow);
    if (list.length > 0) return list;
    if (cms.announcementEnabled && cms.announcementText?.trim()) {
      return [
        {
          id: "legacy-ann",
          text: cms.announcementText,
          linkHref: "",
          textColor: "#FFFFFF",
          bgColor: tc?.heroButtonBg || cms.secondaryColor || "#9E2A2B",
          fontSizePx: 12,
          fontWeight: "600" as const,
          mode: "scroll" as const,
          scrollDirection: "left" as const,
          scrollSpeedSec: 26,
          enabled: true,
          startDate: "",
          endDate: "",
          showOnDesktop: true,
          showOnMobile: true,
        },
      ];
    }
    return [];
  }, [cms.announcements, cms.announcementEnabled, cms.announcementText, cms.secondaryColor, tc?.heroButtonBg]);

  const getCategoryForHref = (href: string): PublicCategory | undefined => {
    if (!href.startsWith("/category/")) return undefined;
    const slug = href.slice("/category/".length).split("?")[0];
    return categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchOpen(false);
    setMobileMenuOpen(false);
    onNavigateRoute(`/search?q=${encodeURIComponent(q)}`);
  };

  const isForceMobile = previewViewport === "mobile";
  const isForceTabletOrDesktop = previewViewport === "desktop" || previewViewport === "tablet";

  return (
    <header
      className={`${isSticky ? "sticky top-0 z-40" : "relative z-40"} border-b`}
      style={{
        backgroundColor: tc?.headerBg || cms.navbarBg || "#FFFFFF",
        color: tc?.headerText || cms.navbarTextColor || "#141413",
        borderColor: tc?.headerBorder || "#E7E1D8",
      }}
    >
      {/* Top Announcements / Marquee Bar(s) */}
      {activeAnnouncements.map((ann) => {
        if (isForceMobile && !ann.showOnMobile) return null;
        if (isForceTabletOrDesktop && !ann.showOnDesktop) return null;

        const visClass =
          previewViewport
            ? ""
            : ann.showOnDesktop && ann.showOnMobile
            ? ""
            : ann.showOnDesktop
            ? "hidden md:block"
            : ann.showOnMobile
            ? "block md:hidden"
            : "hidden";

        const shouldScroll = ann.mode === "scroll" && !marqueeDisabled;
        const speedSec = Math.max(8, Math.min(60, Number(ann.scrollSpeedSec || 24)));
        const trackClass =
          ann.scrollDirection === "right" ? "ts-marquee-track-right" : "ts-marquee-track-left";

        const contentNode = shouldScroll ? (
          <div
            className="ts-marquee-wrapper overflow-hidden w-full"
            style={{ "--ts-marquee-duration": `${speedSec}s` } as React.CSSProperties}
          >
            <div className={trackClass}>
              <span className="px-8">{ann.text}</span>
              <span className="px-8">{ann.text}</span>
              <span className="px-8">{ann.text}</span>
              <span className="px-8">{ann.text}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 text-center">{ann.text}</div>
        );

        return (
          <div
            key={ann.id}
            className={`${visClass} py-2 overflow-hidden tracking-wide`}
            style={{
              backgroundColor: ann.bgColor || "#9E2A2B",
              color: ann.textColor || "#FFFFFF",
              fontSize: `${ann.fontSizePx || 12}px`,
              fontWeight: ann.fontWeight || "600",
            }}
          >
            {ann.linkHref ? (
              <button
                type="button"
                onClick={() => onNavigateRoute(ann.linkHref)}
                className="w-full block text-center hover:opacity-90 cursor-pointer"
              >
                {contentNode}
              </button>
            ) : (
              contentNode
            )}
          </div>
        );
      })}

      {/* Top Row: Brand, Search, Account, Wishlist, Bag */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div
          className="flex items-center justify-between gap-4"
          style={{ minHeight: `${headerHeightPx}px` }}
        >
          {/* Mobile menu trigger + Brand */}
          <div className={`flex items-center gap-3 ${isCenterLogo ? "lg:flex-1" : ""}`}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden rounded-lg p-1.5 hover:bg-black/5 cursor-pointer"
              style={{ color: tc?.headerIcon || tc?.headerText || "#141413" }}
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {!isCenterLogo && (
              <button
                type="button"
                onClick={() => onNavigateRoute("/")}
                className="flex items-center gap-2.5 text-left cursor-pointer"
              >
                {desktopLogo && (
                  <span
                    className={
                      isBoxedLogo
                        ? "rounded-lg border border-black/10 bg-[#FAF8F5] p-1 flex items-center justify-center"
                        : "flex items-center"
                    }
                  >
                    <img
                      src={isForceMobile ? mobileLogo : desktopLogo}
                      alt={cms.brandName}
                      style={{
                        height: `${logoHeightPx}px`,
                        maxWidth: `${logoWidthPx * 2.5}px`,
                      }}
                      className="w-auto object-contain"
                    />
                  </span>
                )}
                <div>
                  <span
                    className="font-display text-xl sm:text-2xl font-bold tracking-[0.06em] uppercase block leading-none"
                    style={{ color: tc?.headerText || "#141413" }}
                  >
                    {cms.brandName || "THAR STYLE"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#8E6B35] block mt-0.5">
                    {cms.storeSettings?.cityLocation || "Mithi, Tharparkar"}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Centered Logo or Desktop Search */}
          {isCenterLogo ? (
            <button
              type="button"
              onClick={() => onNavigateRoute("/")}
              className="flex items-center gap-2.5 text-center cursor-pointer"
            >
              {desktopLogo && (
                <span
                  className={
                    isBoxedLogo
                      ? "rounded-lg border border-black/10 bg-[#FAF8F5] p-1 flex items-center justify-center"
                      : "flex items-center"
                  }
                >
                  <img
                    src={isForceMobile ? mobileLogo : desktopLogo}
                    alt={cms.brandName}
                    style={{ height: `${logoHeightPx}px`, maxWidth: `${logoWidthPx * 2.5}px` }}
                    className="w-auto object-contain"
                  />
                </span>
              )}
              <div>
                <span
                  className="font-display text-xl sm:text-2xl font-bold tracking-[0.06em] uppercase block leading-none"
                  style={{ color: tc?.headerText || "#141413" }}
                >
                  {cms.brandName || "THAR STYLE"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#8E6B35] block mt-0.5">
                  {cms.storeSettings?.cityLocation || "Mithi, Tharparkar"}
                </span>
              </div>
            </button>
          ) : (
            showSearch && (
              <div className="hidden md:flex flex-1 max-w-md mx-6">
                <form onSubmit={handleSearchSubmit} className="relative w-full">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8D857B]" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search kurta, waistcoat, lawn suit, Ajrak, Sindhi Topi..."
                    className="w-full rounded-full border border-[#DFD8CE] bg-[#FAF8F5] pl-10 pr-4 py-2 text-xs text-[#141413] placeholder:text-[#8D857B] focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </form>
              </div>
            )
          )}

          {/* Right Action Cluster */}
          <div
            className={`flex items-center gap-2 sm:gap-3 ${isCenterLogo ? "lg:flex-1 lg:justify-end" : ""}`}
            style={{ color: tc?.headerIcon || tc?.headerText || "#141413" }}
          >
            {showSearch && (
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className={`${isCenterLogo ? "" : "md:hidden"} rounded-full p-2 hover:bg-black/5 cursor-pointer`}
                aria-label="Search"
              >
                <Search className="h-4.5 w-4.5" />
              </button>
            )}

            {showWishlist && (
              <button
                type="button"
                onClick={() => onNavigateRoute(currentUser ? "/customer?tab=wishlist" : "/login")}
                className="relative rounded-full p-2 hover:bg-black/5 cursor-pointer"
                title="Wishlist"
              >
                <Heart className="h-4.5 w-4.5" />
                {wishlistCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-bold text-white flex items-center justify-center tabular-nums"
                    style={{ backgroundColor: tc?.saleBadge || "#9E2A2B" }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </button>
            )}

            {showCart && (
              <button
                type="button"
                onClick={onOpenCart}
                className="relative inline-flex items-center gap-1.5 rounded-full border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#141413] hover:border-[#141413] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Bag</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums"
                  style={{
                    backgroundColor: tc?.primaryButtonBg || "#141413",
                    color: tc?.buttonText || "#FFFFFF",
                  }}
                >
                  {cartCount}
                </span>
              </button>
            )}

            {showAccount &&
              (currentUser ? (
                <div className="flex items-center gap-1.5">
                  {currentUser.role === "super_admin" ? (
                    <button
                      type="button"
                      onClick={() => onNavigateRoute("/super-admin")}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ts-btn-primary cursor-pointer"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Store Admin</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateRoute("/customer")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#DFD8CE] px-3 py-1.5 text-xs font-semibold hover:bg-black/5 cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{currentUser.fullName.split(" ")[0]}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Sign Out"
                    className="rounded-full p-2 text-[#5D574F] hover:bg-black/5 hover:text-[#9E2A2B] cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateRoute("/login")}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-black/5 cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateRoute("/signup")}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold ts-btn-primary cursor-pointer"
                  >
                    Join
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Expandable Search Bar */}
        {searchOpen && showSearch && (
          <form onSubmit={handleSearchSubmit} className="pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8D857B]" />
              <input
                autoFocus
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search collections, Ajrak, Sindhi Topi..."
                className="w-full rounded-full border border-[#DFD8CE] bg-[#FAF8F5] pl-10 pr-4 py-2 text-xs text-[#141413] focus:outline-none"
              />
            </div>
          </form>
        )}

        {/* Desktop Secondary Category & Collection Navigation Bar */}
        <nav
          aria-label="Primary Collections"
          className="hidden lg:flex items-center justify-between xl:justify-center flex-nowrap gap-0.5 xl:gap-1 border-t py-1.5"
          style={{
            backgroundColor: tc?.navbarBg || cms.navbarBg || "#FFFFFF",
            borderColor: tc?.headerBorder || "#EFEAE2",
          }}
        >
          {visibleLinks.map((link, linkIdx) => {
            const cat = getCategoryForHref(link.href);
            const hasSubDropdown = Boolean(cat && cat.subcategories && cat.subcategories.length > 0);
            const isActive =
              activePath === link.href ||
              (link.href !== "/" && activePath.startsWith(link.href));
            const anchorRight = linkIdx >= Math.max(4, visibleLinks.length - 6);

            return (
              <div
                key={link.id}
                className="relative shrink-0"
                onMouseEnter={() => hasSubDropdown && setOpenDropdownId(link.id)}
                onMouseLeave={() => openDropdownId === link.id && setOpenDropdownId(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdownId(null);
                    onNavigateRoute(link.href);
                  }}
                  className={`inline-flex items-center gap-0.5 xl:gap-1 rounded-md px-1.5 xl:px-2.5 py-1.5 text-[11px] xl:text-xs whitespace-nowrap transition-colors cursor-pointer ts-nav-link ${
                    isActive ? "ts-nav-link-active" : ""
                  }`}
                >
                  <span>{link.label}</span>
                  {hasSubDropdown && <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />}
                </button>

                {/* Category Subcategory Dropdown Panel */}
                {hasSubDropdown && cat && openDropdownId === link.id && (
                  <div
                    className={`absolute ${anchorRight ? "right-0" : "left-0"} top-full z-50 w-[420px] rounded-xl border p-4 shadow-xl grid grid-cols-12 gap-4`}
                    style={{
                      backgroundColor: tc?.dropdownBg || "#FFFFFF",
                      color: tc?.dropdownText || "#3A3631",
                      borderColor: tc?.borderColor || "#E7E1D8",
                    }}
                  >
                    <div className="col-span-7 space-y-2">
                      <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#8E6B35]">
                        {cat.name}
                      </p>
                      <ul className="space-y-1">
                        {cat.subcategories.map((sub) => (
                          <li key={sub}>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownId(null);
                                onNavigateRoute(
                                  `/category/${cat.slug}?sub=${encodeURIComponent(sub)}`
                                );
                              }}
                              className="w-full text-left rounded-md px-2 py-1 text-xs hover:opacity-80 cursor-pointer"
                              style={{ color: tc?.dropdownText || "#3A3631" }}
                            >
                              {sub}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdownId(null);
                          onNavigateRoute(`/category/${cat.slug}`);
                        }}
                        className="mt-2 inline-block text-xs font-semibold hover:underline cursor-pointer"
                        style={{ color: tc?.navbarHover || "#9E2A2B" }}
                      >
                        View All {cat.name} →
                      </button>
                    </div>
                    <div className="col-span-5">
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        referrerPolicy="no-referrer"
                        className="h-40 w-full rounded-lg object-cover border border-[#EFEAE2]"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden border-t px-4 py-4 space-y-2 max-h-[80vh] overflow-y-auto"
          style={{
            backgroundColor: tc?.dropdownBg || "#FFFFFF",
            color: tc?.navbarText || "#141413",
            borderColor: tc?.headerBorder || "#E7E1D8",
          }}
        >
          {visibleLinks.map((link) => {
            const cat = getCategoryForHref(link.href);
            const hasSubs = Boolean(cat && cat.subcategories?.length);
            const expanded = mobileExpandedId === link.id;
            return (
              <div key={link.id} className="border-b border-[#F2EDE4] pb-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigateRoute(link.href);
                    }}
                    className="py-1.5 text-sm font-medium text-left cursor-pointer"
                  >
                    {link.label}
                  </button>
                  {hasSubs && (
                    <button
                      type="button"
                      onClick={() => setMobileExpandedId(expanded ? null : link.id)}
                      className="p-1.5 text-[#5D574F]"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
                {hasSubs && expanded && cat && (
                  <div className="pl-3 pt-1 space-y-1">
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onNavigateRoute(`/category/${cat.slug}?sub=${encodeURIComponent(sub)}`);
                        }}
                        className="block w-full py-1 text-left text-xs text-[#5D574F] hover:text-[#9E2A2B]"
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!currentUser && showAccount && (
            <div className="grid grid-cols-2 gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateRoute("/login");
                }}
                className="rounded-lg border border-[#DFD8CE] py-2 text-xs font-semibold"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateRoute("/signup");
                }}
                className="rounded-lg py-2 text-xs font-semibold ts-btn-primary"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

interface PublicFooterProps {
  cms: CmsConfig;
  categories: PublicCategory[];
  onNavigateRoute: (path: string) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  cms,
  categories,
  onNavigateRoute,
}) => {
  const fCfg = cms.footerSettings;
  if (fCfg && fCfg.visible === false) return null;

  const tc = cms.themeColors;
  const st = cms.storeSettings;
  const footerLogo = cms.logoSettings?.footerLogoUrl || cms.footerLogoUrl || cms.logoSettings?.mainLogoUrl || "";
  const logoSizePx = Math.max(20, Math.min(84, Number(fCfg?.logoSizePx || 36)));
  const footerColumns = fCfg?.columns && fCfg.columns.length > 0 ? fCfg.columns : [];

  const socialEntries = [
    { label: "Facebook", url: st?.socialLinks?.facebook },
    { label: "Instagram", url: st?.socialLinks?.instagram },
    { label: "TikTok", url: st?.socialLinks?.tiktok },
    { label: "YouTube", url: st?.socialLinks?.youtube },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  const paymentLabels: string[] = [];
  if (st?.paymentMethods?.cod !== false) paymentLabels.push("Cash on Delivery");
  if (st?.paymentMethods?.jazzcash) paymentLabels.push("JazzCash");
  if (st?.paymentMethods?.easypaisa) paymentLabels.push("Easypaisa");
  if (st?.paymentMethods?.bankTransfer) paymentLabels.push("Bank Transfer");

  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: tc?.footerBg || cms.footerBg || "#141413",
        color: tc?.footerText || cms.footerTextColor || "#E7E2DA",
        borderColor: tc?.footerBorder || "#2A2824",
        fontFamily: "var(--ts-footer-font, var(--font-body))",
        fontSize: "var(--ts-footer-size, 12px)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand & Location */}
        <div className="space-y-3">
          {footerLogo ? (
            <img
              src={footerLogo}
              alt={cms.brandName}
              style={{ height: `${logoSizePx}px` }}
              className="w-auto object-contain"
            />
          ) : null}
          <div>
            <p
              className="font-display text-xl font-bold tracking-[0.06em] uppercase"
              style={{ color: tc?.footerHeading || "#FFFFFF" }}
            >
              {cms.brandName || "THAR STYLE"}
            </p>
            <p className="text-xs text-[#C7A977] mt-0.5">
              {cms.tagline || "Fashion for Every Generation"}
            </p>
          </div>
          <p className="text-xs opacity-85 leading-relaxed">
            {fCfg?.aboutText ||
              (st?.aboutStory
                ? st.aboutStory.slice(0, 175) + (st.aboutStory.length > 175 ? "..." : "")
                : "Curated contemporary apparel and traditional Sindhi & Thari fashion from Mithi, Tharparkar.")}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-[#C7A977]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              {st?.address ? `${st.address}, ` : ""}
              {st?.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"}
            </span>
          </p>
        </div>

        {/* Collections */}
        <div className="space-y-3">
          <h3
            className="text-xs font-bold uppercase tracking-[0.14em]"
            style={{ color: tc?.footerHeading || "#FFFFFF" }}
          >
            Collections
          </h3>
          <ul className="space-y-2 text-xs">
            {categories.slice(0, 7).map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => onNavigateRoute(`/category/${cat.slug}`)}
                  className="ts-footer-link cursor-pointer"
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Custom / CMS Managed Footer Columns (renders primary column or merged columns) */}
        <div className="space-y-6">
          {footerColumns.length > 0 ? (
            footerColumns.map((col) => (
              <div key={col.id} className="space-y-2.5">
                <h3
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                  style={{ color: tc?.footerHeading || "#FFFFFF" }}
                >
                  {col.title}
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {col.links.map((lk) => (
                    <li key={lk.id}>
                      <button
                        type="button"
                        onClick={() => onNavigateRoute(lk.href)}
                        className="ts-footer-link cursor-pointer"
                      >
                        {lk.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="space-y-3">
              <h3
                className="text-xs font-bold uppercase tracking-[0.14em]"
                style={{ color: tc?.footerHeading || "#FFFFFF" }}
              >
                Customer Care
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button type="button" onClick={() => onNavigateRoute("/new-arrivals")} className="ts-footer-link cursor-pointer">
                    New Arrivals
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigateRoute("/size-guide")} className="ts-footer-link cursor-pointer">
                    Size Guide
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigateRoute("/faq")} className="ts-footer-link cursor-pointer">
                    FAQ
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigateRoute("/about")} className="ts-footer-link cursor-pointer">
                    About Us
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigateRoute("/contact")} className="ts-footer-link cursor-pointer">
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Store Details & Payments */}
        <div className="space-y-3 text-xs">
          <h3
            className="text-xs font-bold uppercase tracking-[0.14em]"
            style={{ color: tc?.footerHeading || "#FFFFFF" }}
          >
            Store &amp; Payments
          </h3>
          <div className="space-y-1.5 opacity-85">
            <p>City: {st?.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"}</p>
            {st?.phone && <p>Phone: {st.phone}</p>}
            {st?.whatsapp && <p>WhatsApp: {st.whatsapp}</p>}
            {st?.email && <p>Email: {st.email}</p>}
            {st?.openingHours && <p>Hours: {st.openingHours}</p>}
          </div>

          {fCfg?.showPaymentIcons !== false && (
            <div className="pt-2">
              <p className="text-[10.5px] uppercase tracking-wider text-[#C7A977] mb-1.5">
                Accepted Payments
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paymentLabels.map((pm) => (
                  <span
                    key={pm}
                    className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px]"
                  >
                    {pm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {socialEntries.length > 0 && (
            <div className="pt-2">
              <p className="text-[10.5px] uppercase tracking-wider text-[#C7A977] mb-1.5">
                Follow Us
              </p>
              <div className="flex flex-wrap gap-2">
                {socialEntries.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-white/15 px-2.5 py-1 text-[11px] hover:bg-white/10"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="border-t py-4 px-4 lg:px-8 text-[11px] opacity-85"
        style={{ borderColor: tc?.footerBorder || "rgba(255,255,255,0.1)" }}
      >
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {fCfg?.copyrightText || cms.footerCopyright || "© 2026 THAR STYLE · Mithi, Tharparkar, Sindh, Pakistan."}
          </span>
          <button
            type="button"
            onClick={() => onNavigateRoute("/admin-login")}
            className="text-[11px] font-medium opacity-75 hover:opacity-100 hover:underline cursor-pointer"
          >
            Store Admin Portal
          </button>
        </div>
      </div>
    </footer>
  );
};
