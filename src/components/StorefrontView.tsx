import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react";
import { DbBusiness, DbProduct } from "../types";
import { formatPKR } from "../utils/formatters";

interface StorefrontViewProps {
  slug: string;
  cartCount: number;
  wishlistIds: string[];
  onBackHome: () => void;
  onOpenCart: () => void;
  onAddToCart: (product: DbProduct, variantLabel?: string) => void;
  onToggleWishlist: (productId: string) => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  slug,
  cartCount,
  wishlistIds,
  onBackHome,
  onOpenCart,
  onAddToCart,
  onToggleWishlist,
}) => {
  const [store, setStore] = useState<DbBusiness | null>(null);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [detailProd, setDetailProd] = useState<DbProduct | null>(null);
  const [activeImage, setActiveImage] = useState("");
  const [variant, setVariant] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/public/stores/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Storefront unavailable.");
        if (active) {
          setStore(data.store);
          setProducts(data.products || []);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load store.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === "All" || p.category === category;
      const qOk = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, search, category]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center p-6 text-sm text-slate-500">
        Loading storefront...
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <p className="font-display text-lg font-bold text-slate-900">{error || "Storefront not found"}</p>
        <button
          type="button"
          onClick={onBackHome}
          className="rounded-xl bg-[#063B2B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          Back to THAR STYLE
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#9E2A2B] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

          <span className="font-display text-sm font-bold text-slate-900 truncate">{store.name}</span>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#063B2B] px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Cart ({cartCount})</span>
          </button>
        </div>
      </header>

      {/* Storefront Cover & Identity */}
      <section className="relative bg-[#063B2B] text-white">
        <img
          src={store.cover_url}
          alt={store.name}
          referrerPolicy="no-referrer"
          className="h-52 w-full object-cover opacity-40"
        />
        <div className="mx-auto max-w-7xl px-4 lg:px-8 -mt-14 pb-6 relative z-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <img
                src={store.logo_url}
                alt={store.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
              <div>
                <h1 className="font-display text-xl font-extrabold text-slate-900">{store.name}</h1>
                <p className="text-xs font-medium text-emerald-700">{store.category}</p>
                <p className="mt-1 text-xs text-slate-600 max-w-2xl">{store.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                    {store.address}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-700" />
                    {store.hours}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-700" />
                    {store.phone}
                  </span>
                </div>
              </div>
            </div>

            {store.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Shop
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Catalog Controls & Products */}
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  category === cat ? "bg-[#063B2B] text-white" : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this store..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((p) => {
            const price = p.discount_price || p.selling_price;
            const isSaved = wishlistIds.includes(p.id);
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div
                    onClick={() => {
                      setDetailProd(p);
                      setActiveImage(p.primaryImage);
                      setVariant(p.variants[0] || "Standard");
                    }}
                    className="h-44 bg-slate-100 cursor-pointer overflow-hidden"
                  >
                    <img
                      src={p.primaryImage}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-emerald-700">{p.category}</p>
                    <h3
                      onClick={() => {
                        setDetailProd(p);
                        setActiveImage(p.primaryImage);
                        setVariant(p.variants[0] || "Standard");
                      }}
                      className="font-display text-sm font-bold text-slate-900 cursor-pointer hover:text-emerald-700"
                    >
                      {p.name}
                    </h3>
                    <div className="flex items-baseline gap-2 pt-1 tabular-nums">
                      <span className="text-base font-extrabold text-slate-900">{formatPKR(price)}</span>
                      {p.discount_price && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatPKR(p.selling_price)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {p.stock > 0 ? `${p.stock} ${p.unit} available` : "Out of stock"}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={p.stock <= 0}
                    onClick={() => onAddToCart(p, p.variants[0] || "Standard")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F7C58] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] disabled:opacity-40 cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(p.id)}
                    className={`rounded-xl border p-2 cursor-pointer ${
                      isSaved ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isSaved ? "fill-rose-600" : ""}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Multi-Image Product Detail Modal */}
      {detailProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white overflow-hidden shadow-2xl grid grid-cols-1 sm:grid-cols-2">
            <div className="bg-slate-100 p-3 flex flex-col gap-2">
              <img
                src={activeImage || detailProd.primaryImage}
                alt={detailProd.name}
                referrerPolicy="no-referrer"
                className="h-56 w-full rounded-xl object-cover"
              />
              {detailProd.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {detailProd.images.map((im) => (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => setActiveImage(im.url)}
                      className={`h-12 w-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                        activeImage === im.url ? "border-emerald-700" : "border-transparent"
                      }`}
                    >
                      <img src={im.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[11px] font-semibold uppercase text-emerald-700">
                    {detailProd.category}
                  </span>
                  <button type="button" onClick={() => setDetailProd(null)} className="text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">{detailProd.name}</h2>
                <p className="text-xs text-slate-600 leading-relaxed">{detailProd.description}</p>
                <p className="text-xl font-extrabold text-emerald-700 tabular-nums">
                  {formatPKR(detailProd.discount_price || detailProd.selling_price)}
                </p>
                {detailProd.variants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {detailProd.variants.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                          variant === v ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={detailProd.stock <= 0}
                onClick={() => {
                  onAddToCart(detailProd, variant);
                  setDetailProd(null);
                }}
                className="w-full rounded-xl bg-[#0F7C58] py-2.5 text-xs font-bold text-white hover:bg-[#0B6648] disabled:opacity-40 cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
