import React from "react";
import { CmsConfig, TypographyRoleConfig } from "../types";

export const AVAILABLE_GOOGLE_FONTS = [
  "Playfair Display",
  "Cormorant Garamond",
  "Plus Jakarta Sans",
  "DM Sans",
  "Outfit",
  "Bricolage Grotesque",
  "Manrope",
  "Public Sans",
  "Poppins",
  "Inter",
  "Lora",
  "Montserrat",
];

export function hexToRgbString(hex: string): string {
  const clean = (hex || "#141413").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return "20, 20, 19";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function sanitizeRichHtml(rawHtml: string): string {
  return String(rawHtml || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function fontStack(family: string | undefined, fallback: string): string {
  if (!family) return fallback;
  return `'${family.replace(/'/g, "")}', ${fallback}`;
}

function getRolePx(role: TypographyRoleConfig | undefined, viewport?: "desktop" | "tablet" | "mobile"): number {
  if (!role) return 15;
  if (viewport === "mobile") return role.mobileSizePx || role.desktopSizePx || 14;
  if (viewport === "tablet") return role.tabletSizePx || role.desktopSizePx || 15;
  return role.desktopSizePx || 15;
}

export function getCmsThemeStyleVars(
  cms: CmsConfig,
  viewport?: "desktop" | "tablet" | "mobile"
): React.CSSProperties {
  const tc = cms.themeColors;
  const ty = cms.typography;
  const anim = cms.animationSettings;

  const headingFont = ty?.heading?.fontFamily || cms.headingFont || "Playfair Display";
  const bodyFont = ty?.body?.fontFamily || cms.bodyFont || "Plus Jakarta Sans";

  const style: Record<string, string> = {
    "--font-display": fontStack(headingFont, "Georgia, serif"),
    "--font-body": fontStack(bodyFont, "system-ui, sans-serif"),
    "--ts-header-bg": tc?.headerBg || cms.navbarBg || "#FFFFFF",
    "--ts-header-text": tc?.headerText || cms.navbarTextColor || "#141413",
    "--ts-header-icon": tc?.headerIcon || cms.navbarTextColor || "#141413",
    "--ts-header-border": tc?.headerBorder || "#E7E1D8",
    "--ts-navbar-bg": tc?.navbarBg || cms.navbarBg || "#FFFFFF",
    "--ts-navbar-text": tc?.navbarText || cms.navbarTextColor || "#141413",
    "--ts-navbar-hover": tc?.navbarHover || cms.secondaryColor || "#9E2A2B",
    "--ts-navbar-active": tc?.navbarActive || cms.secondaryColor || "#9E2A2B",
    "--ts-dropdown-bg": tc?.dropdownBg || "#FFFFFF",
    "--ts-dropdown-text": tc?.dropdownText || "#3A3631",
    "--ts-dropdown-hover": tc?.dropdownHover || "#FAF8F5",
    "--ts-hero-overlay": tc?.heroOverlay || "#141413",
    "--ts-hero-title": tc?.heroTitle || "#FFFFFF",
    "--ts-hero-subtitle": tc?.heroSubtitle || "#E6C994",
    "--ts-hero-btn-bg": tc?.heroButtonBg || cms.secondaryColor || "#9E2A2B",
    "--ts-hero-btn-text": tc?.heroButtonText || "#FFFFFF",
    "--ts-page-bg": tc?.pageBg || cms.pageBg || "#FAF8F5",
    "--ts-section-bg": tc?.sectionBg || "#F2EDE4",
    "--ts-card-bg": tc?.cardBg || "#FFFFFF",
    "--ts-primary-text": tc?.primaryText || "#141413",
    "--ts-secondary-text": tc?.secondaryText || "#5D574F",
    "--ts-border-color": tc?.borderColor || "#E7E1D8",
    "--ts-btn-primary-bg": tc?.primaryButtonBg || cms.buttonBg || "#141413",
    "--ts-btn-primary-hover": tc?.primaryButtonHover || cms.secondaryColor || "#9E2A2B",
    "--ts-btn-secondary-bg": tc?.secondaryButtonBg || "#FAF8F5",
    "--ts-btn-secondary-hover": tc?.secondaryButtonHover || "#EFEAE2",
    "--ts-btn-text": tc?.buttonText || cms.buttonTextColor || "#FFFFFF",
    "--ts-footer-bg": tc?.footerBg || cms.footerBg || "#141413",
    "--ts-footer-heading": tc?.footerHeading || "#FFFFFF",
    "--ts-footer-text": tc?.footerText || cms.footerTextColor || "#E7E2DA",
    "--ts-footer-links": tc?.footerLinks || "#D8D0C4",
    "--ts-footer-link-hover": tc?.footerLinkHover || "#FFFFFF",
    "--ts-footer-border": tc?.footerBorder || "#2A2824",
    "--ts-sale-badge": tc?.saleBadge || cms.secondaryColor || "#9E2A2B",
    "--ts-discount-badge": tc?.discountBadge || "#141413",
    "--ts-price-text": tc?.priceText || "#141413",
    "--ts-rating-stars": tc?.ratingStars || cms.accentColor || "#B4843D",

    // Typography role tokens
    "--ts-heading-font": fontStack(ty?.heading?.fontFamily || headingFont, "Georgia, serif"),
    "--ts-heading-size": `${getRolePx(ty?.heading, viewport)}px`,
    "--ts-heading-weight": ty?.heading?.fontWeight || "700",
    "--ts-heading-style": ty?.heading?.fontStyle || "normal",
    "--ts-heading-color": ty?.heading?.color || tc?.primaryText || "#141413",
    "--ts-heading-lh": ty?.heading?.lineHeight || "1.15",
    "--ts-heading-ls": ty?.heading?.letterSpacing || "-0.01em",
    "--ts-heading-transform": ty?.heading?.textTransform || "none",

    "--ts-body-font": fontStack(ty?.body?.fontFamily || bodyFont, "system-ui, sans-serif"),
    "--ts-body-size": `${getRolePx(ty?.body, viewport)}px`,
    "--ts-body-weight": ty?.body?.fontWeight || "400",
    "--ts-body-color": ty?.body?.color || tc?.primaryText || "#3A3631",
    "--ts-body-lh": ty?.body?.lineHeight || "1.6",

    "--ts-nav-font": fontStack(ty?.navigation?.fontFamily || bodyFont, "system-ui, sans-serif"),
    "--ts-nav-size": `${getRolePx(ty?.navigation, viewport)}px`,
    "--ts-nav-weight": ty?.navigation?.fontWeight || "500",
    "--ts-nav-ls": ty?.navigation?.letterSpacing || "0.02em",
    "--ts-nav-transform": ty?.navigation?.textTransform || "none",

    "--ts-btn-font": fontStack(ty?.button?.fontFamily || bodyFont, "system-ui, sans-serif"),
    "--ts-btn-size": `${getRolePx(ty?.button, viewport)}px`,
    "--ts-btn-weight": ty?.button?.fontWeight || "700",
    "--ts-btn-ls": ty?.button?.letterSpacing || "0.06em",
    "--ts-btn-transform": ty?.button?.textTransform || "uppercase",

    "--ts-prod-title-font": fontStack(ty?.productTitle?.fontFamily || headingFont, "Georgia, serif"),
    "--ts-prod-title-size": `${getRolePx(ty?.productTitle, viewport)}px`,
    "--ts-prod-title-weight": ty?.productTitle?.fontWeight || "600",
    "--ts-prod-title-color": ty?.productTitle?.color || tc?.primaryText || "#141413",

    "--ts-price-font": fontStack(ty?.price?.fontFamily || bodyFont, "system-ui, sans-serif"),
    "--ts-price-size": `${getRolePx(ty?.price, viewport)}px`,
    "--ts-price-weight": ty?.price?.fontWeight || "700",
    "--ts-price-color": ty?.price?.color || tc?.priceText || "#141413",

    "--ts-footer-font": fontStack(ty?.footer?.fontFamily || bodyFont, "system-ui, sans-serif"),
    "--ts-footer-size": `${getRolePx(ty?.footer, viewport)}px`,

    // Animation durations
    "--ts-card-duration": `${anim?.productCardHover?.enabled === false ? 0 : anim?.productCardHover?.durationMs || 250}ms`,
    "--ts-img-duration": `${anim?.imageZoom?.enabled === false ? 0 : anim?.imageZoom?.durationMs || 500}ms`,
    "--ts-btn-duration": `${anim?.buttonHover?.enabled === false ? 0 : anim?.buttonHover?.durationMs || 180}ms`,
    "--ts-hero-duration": `${anim?.heroTransition?.enabled === false ? 0 : anim?.heroTransition?.durationMs || 700}ms`,
  };

  return style as React.CSSProperties;
}

export function loadGoogleAndCustomFonts(cms: CmsConfig) {
  if (typeof document === "undefined") return;

  // 1. Load custom uploaded fonts via style element
  const customFonts = cms.typography?.customFonts || [];
  let customStyle = document.getElementById("ts-custom-fonts-style") as HTMLStyleElement | null;
  if (!customStyle) {
    customStyle = document.createElement("style");
    customStyle.id = "ts-custom-fonts-style";
    document.head.appendChild(customStyle);
  }
  customStyle.textContent = customFonts
    .map(
      (f) =>
        `@font-face { font-family: '${f.name.replace(/'/g, "")}'; src: url('${f.url}') format('${f.format || "woff2"}'); font-display: swap; }`
    )
    .join("\n");

  // 2. Load any selected Google Fonts dynamically
  const customSet = new Set(customFonts.map((f) => f.name.toLowerCase()));
  const roleKeys = [
    "primary",
    "heading",
    "body",
    "navigation",
    "button",
    "productTitle",
    "price",
    "footer",
  ] as const;
  const families = new Set<string>();
  if (cms.headingFont && !customSet.has(cms.headingFont.toLowerCase())) families.add(cms.headingFont);
  if (cms.bodyFont && !customSet.has(cms.bodyFont.toLowerCase())) families.add(cms.bodyFont);
  roleKeys.forEach((k) => {
    const ff = cms.typography?.[k]?.fontFamily;
    if (ff && !customSet.has(ff.toLowerCase()) && AVAILABLE_GOOGLE_FONTS.includes(ff)) {
      families.add(ff);
    }
  });

  if (families.size > 0) {
    const query = Array.from(families)
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400`)
      .join("&");
    const href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    let link = document.getElementById("ts-dynamic-google-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "ts-dynamic-google-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) {
      link.href = href;
    }
  }
}
