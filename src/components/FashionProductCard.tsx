import React, { useState } from "react";
import { Eye, Heart, ShoppingBag, Star } from "lucide-react";
import { AnimationSettingsConfig, DbProduct } from "../types";
import { formatPKR } from "../utils/formatters";

interface FashionProductCardProps {
  product: DbProduct;
  isWishlisted: boolean;
  animations?: AnimationSettingsConfig;
  onOpenProduct: (id: string) => void;
  onQuickView?: (product: DbProduct) => void;
  onAddToCart: (product: DbProduct, variantLabel?: string) => void;
  onToggleWishlist: (productId: string) => void;
}

export const FashionProductCard: React.FC<FashionProductCardProps> = ({
  product,
  isWishlisted,
  animations,
  onOpenProduct,
  onQuickView,
  onAddToCart,
  onToggleWishlist,
}) => {
  const [hovered, setHovered] = useState(false);

  const hasDiscount =
    product.discount_price !== null &&
    product.discount_price > 0 &&
    product.discount_price < product.selling_price;

  const activePrice = hasDiscount ? (product.discount_price as number) : product.selling_price;
  const discountPct = hasDiscount
    ? Math.round(((product.selling_price - activePrice) / product.selling_price) * 100)
    : 0;

  const primaryImg = product.primaryImage || product.images?.[0]?.url || "";
  const secondaryImg = product.images && product.images.length > 1 ? product.images[1].url : primaryImg;
  const displayImg = hovered && secondaryImg ? secondaryImg : primaryImg;

  const sizesList = product.sizes && product.sizes.length > 0 ? product.sizes : product.variants || [];
  const colorsList = product.colors || [];

  const defaultVariant =
    sizesList.length > 0 && colorsList.length > 0 && colorsList[0] !== "Standard"
      ? `Size: ${sizesList[0]} · Color: ${colorsList[0]}`
      : sizesList[0] || product.variants?.[0] || "Standard";

  const cardHoverType =
    animations?.productCardHover?.enabled === false
      ? "none"
      : animations?.productCardHover?.type || "lift";
  const cardAnimClass =
    cardHoverType === "lift"
      ? "ts-card-lift"
      : cardHoverType === "scale"
      ? "ts-card-scale"
      : "";
  const zoomEnabled = animations?.imageZoom?.enabled !== false && animations?.imageZoom?.type !== "none";
  const btnLift = animations?.buttonHover?.enabled !== false && animations?.buttonHover?.type === "lift";

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group rounded-xl overflow-hidden flex flex-col justify-between border ${cardAnimClass}`}
      style={{
        backgroundColor: "var(--ts-card-bg, #FFFFFF)",
        borderColor: "var(--ts-border-color, #E7E1D8)",
      }}
    >
      <div>
        {/* Image Canvas */}
        <div
          className="relative aspect-[4/5] overflow-hidden"
          style={{ backgroundColor: "var(--ts-section-bg, #F2EDE4)" }}
        >
          <button
            type="button"
            onClick={() => onOpenProduct(product.id)}
            className="block w-full h-full cursor-pointer text-left"
          >
            <img
              src={displayImg}
              alt={product.name}
              referrerPolicy="no-referrer"
              className={`h-full w-full object-cover transition-transform ${
                zoomEnabled ? "group-hover:scale-105" : ""
              }`}
              style={{ transitionDuration: "var(--ts-img-duration, 500ms)" }}
            />
          </button>

          {/* Max 1 subtle top-left label */}
          {hasDiscount ? (
            <span
              className="absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: "var(--ts-sale-badge, #9E2A2B)" }}
            >
              -{discountPct}%
            </span>
          ) : product.is_new_arrival ? (
            <span
              className="absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FAF8F5]"
              style={{ backgroundColor: "var(--ts-discount-badge, #141413)" }}
            >
              New
            </span>
          ) : null}

          {product.stock <= 0 && (
            <span className="absolute inset-x-0 bottom-0 bg-[#141413]/80 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white">
              Out of Stock
            </span>
          )}

          {/* Top-right Quick Actions */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onToggleWishlist(product.id)}
              title={isWishlisted ? "Remove from Wishlist" : "Save to Wishlist"}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                isWishlisted
                  ? "text-white"
                  : "bg-white/95 border-[#E7E1D8] text-[#141413] hover:bg-[#141413] hover:text-white"
              }`}
              style={
                isWishlisted
                  ? {
                      backgroundColor: "var(--ts-sale-badge, #9E2A2B)",
                      borderColor: "var(--ts-sale-badge, #9E2A2B)",
                    }
                  : undefined
              }
            >
              <Heart className={`h-3.5 w-3.5 ${isWishlisted ? "fill-white" : ""}`} />
            </button>
            {onQuickView && (
              <button
                type="button"
                onClick={() => onQuickView(product)}
                title="Quick View"
                className="h-8 w-8 rounded-full bg-white/95 border border-[#E7E1D8] text-[#141413] flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-[#141413] hover:text-white cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-wider">
            <span className="font-semibold text-[#8E6B35] truncate">
              {product.subcategory || product.category}
            </span>
            <span
              className="inline-flex items-center gap-0.5 tabular-nums shrink-0"
              style={{ color: "var(--ts-secondary-text, #5D574F)" }}
            >
              <Star
                className="h-3 w-3"
                style={{
                  fill: "var(--ts-rating-stars, #B4843D)",
                  color: "var(--ts-rating-stars, #B4843D)",
                }}
              />
              {Number(product.rating || 4.8).toFixed(1)}
            </span>
          </div>

          <h3 className="leading-snug">
            <button
              type="button"
              onClick={() => onOpenProduct(product.id)}
              className="text-left line-clamp-2 cursor-pointer transition-colors hover:opacity-80"
              style={{
                fontFamily: "var(--ts-prod-title-font, var(--font-display))",
                fontSize: "var(--ts-prod-title-size, 15px)",
                fontWeight: "var(--ts-prod-title-weight, 600)",
                color: "var(--ts-prod-title-color, #141413)",
              }}
            >
              {product.name}
            </button>
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-2 pt-0.5 tabular-nums">
            <span
              style={{
                fontFamily: "var(--ts-price-font, var(--font-body))",
                fontSize: "var(--ts-price-size, 14px)",
                fontWeight: "var(--ts-price-weight, 700)",
                color: "var(--ts-price-color, #141413)",
              }}
            >
              {formatPKR(activePrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-[#8D857B] line-through">
                {formatPKR(product.selling_price)}
              </span>
            )}
          </div>

          {/* Sizes preview */}
          {sizesList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {sizesList.slice(0, 4).map((sz) => (
                <span
                  key={sz}
                  className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    borderColor: "var(--ts-border-color, #E7E1D8)",
                    backgroundColor: "var(--ts-page-bg, #FAF8F5)",
                    color: "var(--ts-secondary-text, #5D574F)",
                  }}
                >
                  {sz}
                </span>
              ))}
              {sizesList.length > 4 && (
                <span className="text-[10px] text-[#8D857B]">+{sizesList.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add to Cart */}
      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={() => onAddToCart(product, defaultVariant)}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 disabled:opacity-40 cursor-pointer ts-btn-primary ${
            btnLift ? "ts-btn-primary-lift" : ""
          }`}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>{product.stock > 0 ? "Add to Bag" : "Sold Out"}</span>
        </button>
      </div>
    </article>
  );
};
