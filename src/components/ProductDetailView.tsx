import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Heart,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
  ZoomIn,
} from "lucide-react";
import {
  AuthUser,
  CmsConfig,
  DbProduct,
  ProductReview,
  PublicCategory,
  StoreSettingsConfig,
} from "../types";
import { formatPKR } from "../utils/formatters";
import { FashionProductCard } from "./FashionProductCard";
import { PublicFooter, PublicNavbar } from "./PublicNavbar";

interface ProductDetailViewProps {
  productId: string;
  cms: CmsConfig;
  allCategories: PublicCategory[];
  currentUser: AuthUser | null;
  cartCount: number;
  wishlistIds: string[];
  onNavigateRoute: (path: string) => void;
  onAddToCart: (product: DbProduct, variantLabel?: string) => void;
  onToggleWishlist: (productId: string) => void;
  onOpenCart: () => void;
  onLogout: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  productId,
  cms,
  allCategories,
  currentUser,
  cartCount,
  wishlistIds,
  onNavigateRoute,
  onAddToCart,
  onToggleWishlist,
  onOpenCart,
  onLogout,
}) => {
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [related, setRelated] = useState<DbProduct[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettingsConfig>(cms.storeSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeImage, setActiveImage] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [qty, setQty] = useState(1);

  // Review form state
  const [revName, setRevName] = useState(currentUser?.fullName || "");
  const [revCity, setRevCity] = useState("Mithi, Tharparkar");
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState("");
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revMessage, setRevMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/public/products/${encodeURIComponent(productId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Product not found.");
        if (!active) return;
        const p: DbProduct = data.product;
        setProduct(p);
        setReviews(data.reviews || []);
        setRelated(data.relatedProducts || []);
        if (data.storeSettings) setStoreSettings(data.storeSettings);
        setActiveImage(p.primaryImage || p.images?.[0]?.url || "");
        const sizes = p.sizes?.length ? p.sizes : p.variants || [];
        setSelectedSize(sizes[0] || "Standard");
        setSelectedColor(p.colors?.[0] || "Standard");
        setQty(1);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load product.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !revName.trim() || !revComment.trim()) return;
    setRevSubmitting(true);
    setRevMessage(null);
    try {
      const res = await fetch(`/api/public/products/${encodeURIComponent(product.id)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: revName.trim(),
          city: revCity.trim(),
          rating: revRating,
          comment: revComment.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setRevComment("");
        setRevMessage("Thank you! Your review has been published.");
      }
    } finally {
      setRevSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
        <PublicNavbar
          cms={cms}
          categories={allCategories}
          currentUser={currentUser}
          cartCount={cartCount}
          wishlistCount={wishlistIds.length}
          activePath={`/product/${productId}`}
          onNavigateRoute={onNavigateRoute}
          onOpenCart={onOpenCart}
          onLogout={onLogout}
        />
        <div className="flex-1 flex items-center justify-center p-12 text-sm text-[#5D574F]">
          Loading garment details...
        </div>
        <PublicFooter cms={cms} categories={allCategories} onNavigateRoute={onNavigateRoute} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
        <PublicNavbar
          cms={cms}
          categories={allCategories}
          currentUser={currentUser}
          cartCount={cartCount}
          wishlistCount={wishlistIds.length}
          activePath={`/product/${productId}`}
          onNavigateRoute={onNavigateRoute}
          onOpenCart={onOpenCart}
          onLogout={onLogout}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
          <h1 className="font-display text-2xl font-bold text-[#141413]">Product Unavailable</h1>
          <p className="text-sm text-[#5D574F]">{error || "This product could not be found."}</p>
          <button
            type="button"
            onClick={() => onNavigateRoute("/")}
            className="rounded-lg bg-[#141413] px-5 py-2.5 text-xs font-semibold text-white cursor-pointer"
          >
            Return to Store
          </button>
        </div>
        <PublicFooter cms={cms} categories={allCategories} onNavigateRoute={onNavigateRoute} />
      </div>
    );
  }

  const hasDiscount =
    product.discount_price !== null &&
    product.discount_price > 0 &&
    product.discount_price < product.selling_price;
  const activePrice = hasDiscount ? (product.discount_price as number) : product.selling_price;
  const sizes = product.sizes?.length ? product.sizes : product.variants || ["Standard"];
  const colors = product.colors?.length ? product.colors : ["Standard"];
  const isWishlisted = wishlistIds.includes(product.id);
  const chosenVariantLabel =
    selectedColor && selectedColor !== "Standard"
      ? `Size: ${selectedSize} · Color: ${selectedColor}`
      : `Size: ${selectedSize}`;

  const handleAddMultiple = () => {
    for (let i = 0; i < qty; i += 1) {
      onAddToCart(product, chosenVariantLabel);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#141413] flex flex-col">
      <PublicNavbar
        cms={cms}
        categories={allCategories}
        currentUser={currentUser}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
        activePath={`/product/${productId}`}
        onNavigateRoute={onNavigateRoute}
        onOpenCart={onOpenCart}
        onLogout={onLogout}
      />

      <main className="mx-auto max-w-7xl w-full px-4 py-8 lg:px-8 space-y-12 flex-1">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5D574F]">
          <button
            type="button"
            onClick={() => onNavigateRoute("/")}
            className="inline-flex items-center gap-1 hover:text-[#9E2A2B] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => onNavigateRoute(`/category/${product.category_slug || "men"}`)}
            className="hover:text-[#9E2A2B] cursor-pointer"
          >
            {product.category}
          </button>
          {product.subcategory && (
            <>
              <span>/</span>
              <button
                type="button"
                onClick={() =>
                  onNavigateRoute(
                    `/category/${product.category_slug || "men"}?sub=${encodeURIComponent(product.subcategory || "")}`
                  )
                }
                className="hover:text-[#9E2A2B] cursor-pointer"
              >
                {product.subcategory}
              </button>
            </>
          )}
          <span>/</span>
          <span className="font-semibold text-[#141413]">{product.name}</span>
        </div>

        {/* Main 2-Column Product Presentation */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-[4/5] bg-[#F2EDE4] rounded-2xl overflow-hidden border border-[#E7E1D8] group">
              <img
                src={activeImage || product.primaryImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#141413] shadow-sm hover:bg-[#141413] hover:text-white cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                Zoom
              </button>
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {product.images.map((im) => (
                  <button
                    key={im.id}
                    type="button"
                    onClick={() => setActiveImage(im.url)}
                    className={`h-20 w-16 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                      activeImage === im.url ? "border-[#9E2A2B]" : "border-[#E7E1D8]"
                    }`}
                  >
                    <img src={im.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details & Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2 border-b border-[#E7E1D8] pb-5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold uppercase tracking-[0.14em] text-[#8E6B35]">
                  {product.category} {product.subcategory ? `· ${product.subcategory}` : ""}
                </span>
                <span className="font-mono text-[#8D857B]">SKU: {product.sku}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141413] leading-tight">
                {product.name}
              </h1>

              <div className="flex items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#141413]">
                  <Star className="h-4 w-4 fill-[#B4843D] text-[#B4843D]" />
                  <span className="tabular-nums">{Number(product.rating || 4.8).toFixed(1)}</span>
                  <span className="text-[#5D574F]">({reviews.length} reviews)</span>
                </div>
                <span className="text-[#DFD8CE]">|</span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    product.stock > 0 ? "text-[#1A5D3A]" : "text-[#9E2A2B]"
                  }`}
                >
                  {product.stock > 0 ? `In Stock (${product.stock} available)` : "Currently Out of Stock"}
                </span>
              </div>

              <div className="flex items-baseline gap-3 pt-2 tabular-nums">
                <span className="text-2xl font-extrabold text-[#141413]">{formatPKR(activePrice)}</span>
                {hasDiscount && (
                  <>
                    <span className="text-base text-[#8D857B] line-through">
                      {formatPKR(product.selling_price)}
                    </span>
                    <span className="rounded bg-[#9E2A2B]/10 px-2 py-0.5 text-xs font-bold text-[#9E2A2B]">
                      Save {formatPKR(product.selling_price - activePrice)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-[#3A3631] leading-relaxed">{product.description}</p>

            {/* Size Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-[#141413]">
                  Select Size: <span className="text-[#9E2A2B]">{selectedSize}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1 font-semibold text-[#8E6B35] hover:underline cursor-pointer"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`min-w-[48px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      selectedSize === sz
                        ? "border-[#141413] bg-[#141413] text-white"
                        : "border-[#DFD8CE] bg-white text-[#141413] hover:border-[#141413]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selector */}
            {colors.length > 0 && colors[0] !== "Standard" && (
              <div className="space-y-2.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#141413]">
                  Color: <span className="text-[#9E2A2B]">{selectedColor}</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((cl) => (
                    <button
                      key={cl}
                      type="button"
                      onClick={() => setSelectedColor(cl)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        selectedColor === cl
                          ? "border-[#9E2A2B] bg-[#9E2A2B]/10 text-[#9E2A2B] font-semibold"
                          : "border-[#DFD8CE] bg-white text-[#3A3631]"
                      }`}
                    >
                      {cl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & Add to Cart */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="inline-flex items-center rounded-lg border border-[#DFD8CE] bg-white">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2.5 text-sm font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  −
                </button>
                <span className="px-3 text-sm font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="px-3.5 py-2.5 text-sm font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleAddMultiple}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#141413] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9E2A2B] disabled:opacity-40 cursor-pointer transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                {product.stock > 0 ? "Add to Shopping Bag" : "Sold Out"}
              </button>

              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                className={`rounded-lg border p-3 cursor-pointer ${
                  isWishlisted
                    ? "border-[#9E2A2B] bg-[#9E2A2B]/10 text-[#9E2A2B]"
                    : "border-[#DFD8CE] bg-white text-[#141413]"
                }`}
                title="Save to Wishlist"
              >
                <Heart className={`h-4.5 w-4.5 ${isWishlisted ? "fill-[#9E2A2B]" : ""}`} />
              </button>
            </div>

            {/* Fabric & Specifications */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <div className="rounded-xl border border-[#E7E1D8] bg-white p-4 space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#141413]">
                  Fabric & Craftsmanship Details
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(product.specs).map(([k, v]) => (
                    <div key={k} className="border-b border-[#F2EDE4] pb-1.5">
                      <dt className="text-[#8D857B]">{k}</dt>
                      <dd className="font-semibold text-[#141413]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Delivery & Return Info from Store Settings */}
            <div className="rounded-xl border border-[#E7E1D8] bg-white p-4 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Truck className="h-4 w-4 text-[#9E2A2B] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#141413]">
                    Mithi, Tharparkar & Nationwide Delivery
                  </p>
                  <p className="text-[#5D574F] mt-0.5">
                    Standard delivery fee {formatPKR(storeSettings.deliveryFee ?? 200)} · Free shipping on orders over{" "}
                    {formatPKR(storeSettings.freeDeliveryThreshold ?? 5000)}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#8E6B35] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#141413]">Return & Exchange Policy</p>
                  <p className="text-[#5D574F] mt-0.5">{storeSettings.returnPolicy}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Reviews & Leave a Review */}
        <section className="border-t border-[#E7E1D8] pt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#141413]">
              Customer Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-[#5D574F] rounded-xl border border-[#E7E1D8] bg-white p-6">
                No reviews yet for this piece. Share your experience below!
              </p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-[#E7E1D8] bg-white p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#141413]">{r.customer_name}</span>
                        {r.city && <span className="text-[#8D857B]">· {r.city}</span>}
                        {r.verified_purchase && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#1A5D3A]">
                            <Check className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[#B4843D] font-bold">
                        {"★".repeat(r.rating)}
                      </span>
                    </div>
                    <p className="text-xs text-[#3A3631] leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmitReview}
            className="lg:col-span-5 rounded-2xl border border-[#E7E1D8] bg-white p-6 space-y-3 h-fit"
          >
            <h3 className="font-display text-lg font-bold text-[#141413]">Write a Review</h3>
            {revMessage && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-900">
                {revMessage}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block font-semibold text-[#3A3631] mb-1">Your Name</label>
                <input
                  required
                  type="text"
                  value={revName}
                  onChange={(e) => setRevName(e.target.value)}
                  placeholder="Ayesha Samejo"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3A3631] mb-1">City</label>
                <input
                  type="text"
                  value={revCity}
                  onChange={(e) => setRevCity(e.target.value)}
                  placeholder="Mithi, Tharparkar"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
            </div>
            <div className="text-xs">
              <label className="block font-semibold text-[#3A3631] mb-1">Rating</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRevRating(star)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      revRating >= star
                        ? "border-[#B4843D] bg-[#B4843D]/15 text-[#8E6B35]"
                        : "border-[#DFD8CE] text-[#8D857B]"
                    }`}
                  >
                    {star} ★
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs">
              <label className="block font-semibold text-[#3A3631] mb-1">Review</label>
              <textarea
                required
                rows={3}
                value={revComment}
                onChange={(e) => setRevComment(e.target.value)}
                placeholder="Share your feedback on fabric quality, sizing, or embroidery..."
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={revSubmitting}
              className="w-full rounded-lg bg-[#141413] py-2.5 text-xs font-semibold text-white hover:bg-[#9E2A2B] cursor-pointer"
            >
              {revSubmitting ? "Publishing..." : "Publish Review"}
            </button>
          </form>
        </section>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="border-t border-[#E7E1D8] pt-10 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#141413]">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((rp) => (
                <FashionProductCard
                  key={rp.id}
                  product={rp}
                  isWishlisted={wishlistIds.includes(rp.id)}
                  onOpenProduct={(id) => onNavigateRoute(`/product/${id}`)}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <PublicFooter cms={cms} categories={allCategories} onNavigateRoute={onNavigateRoute} />

      {/* Fullscreen Image Zoom Modal */}
      {zoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-5 right-5 rounded-full bg-white p-2 text-[#141413] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={activeImage || product.primaryImage}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain"
          />
        </div>
      )}

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                THAR STYLE Sizing Chart
              </h3>
              <button type="button" onClick={() => setSizeGuideOpen(false)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <p className="font-bold text-[#9E2A2B] mb-1.5">Adult Apparel (Men, Women & Young Fashion)</p>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E7E1D8] text-[#8D857B]">
                      <th className="py-1.5">Size</th>
                      <th>Chest (in)</th>
                      <th>Waist (in)</th>
                      <th>Kurta Length (in)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EDE4] tabular-nums">
                    <tr><td className="py-1.5 font-semibold">XS</td><td>35–36</td><td>29–30</td><td>37</td></tr>
                    <tr><td className="py-1.5 font-semibold">S</td><td>37–38</td><td>31–32</td><td>38.5</td></tr>
                    <tr><td className="py-1.5 font-semibold">M</td><td>39–40</td><td>33–34</td><td>40</td></tr>
                    <tr><td className="py-1.5 font-semibold">L</td><td>41–42</td><td>35–36</td><td>41.5</td></tr>
                    <tr><td className="py-1.5 font-semibold">XL</td><td>43–45</td><td>37–39</td><td>42.5</td></tr>
                    <tr><td className="py-1.5 font-semibold">XXL</td><td>46–48</td><td>40–42</td><td>43.5</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-bold text-[#8E6B35] mb-1">Sindhi Topi Circumference Guide</p>
                <p className="text-[#5D574F]">
                  56cm (Standard S) · 57cm (Medium) · 58cm (Large) · 59cm (Extra Large). Measure 1 inch above eyebrows.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
