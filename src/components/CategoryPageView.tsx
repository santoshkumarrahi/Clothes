import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, SlidersHorizontal, X } from "lucide-react";
import { AuthUser, CmsConfig, DbProduct, PublicCategory } from "../types";
import { FashionProductCard } from "./FashionProductCard";
import { PublicFooter, PublicNavbar } from "./PublicNavbar";

interface CategoryPageViewProps {
  mode: "directory" | "detail" | "collection";
  slug: string;
  collectionKey?: "new-arrivals" | "best-sellers" | "sale" | "search" | "traditional-sindhi";
  initialQuery?: string;
  initialSub?: string;
  cms: CmsConfig;
  allCategories: PublicCategory[];
  currentUser: AuthUser | null;
  cartCount: number;
  wishlistIds: string[];
  onNavigateRoute: (path: string) => void;
  onOpenStore: (slug: string) => void;
  onAddToCart: (product: DbProduct, variantLabel?: string) => void;
  onToggleWishlist: (productId: string) => void;
  onOpenCart: () => void;
  onLogout: () => void;
}

export const CategoryPageView: React.FC<CategoryPageViewProps> = ({
  mode,
  slug,
  collectionKey,
  initialQuery = "",
  initialSub = "",
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
  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  const [selectedSub, setSelectedSub] = useState(initialSub || "All");
  const [selectedSize, setSelectedSize] = useState("All");
  const [selectedColor, setSelectedColor] = useState("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchText, setSearchText] = useState(initialQuery || "");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSub(initialSub || "All");
    setSelectedSize("All");
    setSelectedColor("All");
    setSearchText(initialQuery || "");
  }, [slug, collectionKey, initialSub, initialQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const url =
      mode === "detail"
        ? `/api/public/categories/${encodeURIComponent(slug)}`
        : mode === "collection"
        ? `/api/public/products${collectionKey && collectionKey !== "search" ? `?collection=${encodeURIComponent(collectionKey)}` : ""}`
        : null;

    if (!url) {
      setLoading(false);
      return;
    }

    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Collection unavailable.");
        if (!active) return;

        if (mode === "detail") {
          setCategory(data.category);
          setProducts(data.products || []);
          setSubcategories(data.subcategories || []);
          setSizes(data.sizes || []);
          setColors(data.colors || []);
        } else {
          const list: DbProduct[] = data.products || [];
          setProducts(list);
          setSubcategories(Array.from(new Set(list.map((p) => p.subcategory || "").filter(Boolean))));
          setSizes(Array.from(new Set(list.flatMap((p) => p.sizes || []).filter(Boolean))));
          setColors(Array.from(new Set(list.flatMap((p) => p.colors || []).filter(Boolean))));
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load collection.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, slug, collectionKey]);

  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let list = products.filter((p) => {
      if (selectedSub !== "All" && (p.subcategory || "").toLowerCase() !== selectedSub.toLowerCase()) {
        return false;
      }
      if (
        selectedSize !== "All" &&
        !(p.sizes || []).some((s) => s.toLowerCase() === selectedSize.toLowerCase())
      ) {
        return false;
      }
      if (
        selectedColor !== "All" &&
        !(p.colors || []).some((c) => c.toLowerCase() === selectedColor.toLowerCase())
      ) {
        return false;
      }
      if (inStockOnly && p.stock <= 0) return false;
      if (q) {
        const hay = `${p.name} ${p.description} ${p.category} ${p.subcategory || ""} ${(p.colors || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "price-asc") {
      list = [...list].sort(
        (a, b) => (a.discount_price || a.selling_price) - (b.discount_price || b.selling_price)
      );
    } else if (sortBy === "price-desc") {
      list = [...list].sort(
        (a, b) => (b.discount_price || b.selling_price) - (a.discount_price || a.selling_price)
      );
    } else if (sortBy === "name-asc") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "rating") {
      list = [...list].sort((a, b) => (b.rating || 4.8) - (a.rating || 4.8));
    }

    return list;
  }, [products, selectedSub, selectedSize, selectedColor, inStockOnly, searchText, sortBy]);

  const pageHeading =
    mode === "directory"
      ? "All Fashion Collections"
      : mode === "collection"
      ? collectionKey === "traditional-sindhi"
        ? "Traditional Sindhi & Thari Collection"
        : collectionKey === "new-arrivals"
        ? "New Arrivals"
        : collectionKey === "best-sellers"
        ? "Best Selling Styles"
        : collectionKey === "sale"
        ? "Seasonal Offers & Sale"
        : searchText
        ? `Search Results for "${searchText}"`
        : "Browse THAR STYLE Catalog"
      : category?.name || "Collection";

  const pageSubheading =
    mode === "directory"
      ? "Explore contemporary apparel and Sindhi heritage pieces for every generation in Mithi, Tharparkar."
      : mode === "collection"
      ? collectionKey === "traditional-sindhi"
        ? "Hand-block-printed Sindhi Ajrak shawls, artisan mirrorwork Sindhi Topi, embroidered traditional dresses, and authentic Thari cultural fashion from Mithi."
        : collectionKey === "sale"
        ? "Seasonal savings on selected suits, casuals, kids outfits, and traditional garments."
        : "Curated fashion for Men, Women, Kids, Young Trendsetters, and Sindhi Culture."
      : category?.description || "";

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#141413] flex flex-col">
      <PublicNavbar
        cms={cms}
        categories={allCategories}
        currentUser={currentUser}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
        activePath={
          mode === "detail"
            ? `/category/${slug}`
            : collectionKey === "traditional-sindhi"
            ? "/traditional-sindhi-collection"
            : `/${collectionKey || "categories"}`
        }
        onNavigateRoute={onNavigateRoute}
        onOpenCart={onOpenCart}
        onLogout={onLogout}
      />

      {/* Editorial Header Banner */}
      <section className="bg-[#1F1A17] text-white border-b border-[#2E2722]">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <button
              type="button"
              onClick={() => onNavigateRoute("/")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D8A85A] hover:underline cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </button>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">{pageHeading}</h1>
            {pageSubheading && <p className="text-xs sm:text-sm text-[#D8D0C4]">{pageSubheading}</p>}
          </div>

          {mode === "detail" && category?.image_url && (
            <img
              src={category.image_url}
              alt={category.name}
              referrerPolicy="no-referrer"
              className="h-28 w-48 rounded-xl object-cover border border-white/15 shrink-0"
            />
          )}
        </div>
      </section>

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 lg:px-8 space-y-6">
        {mode === "directory" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => onNavigateRoute(`/category/${cat.slug}`)}
                className="group rounded-2xl border border-[#E7E1D8] bg-white overflow-hidden cursor-pointer hover:border-[#9E2A2B] transition-all"
              >
                <div className="aspect-[16/10] bg-[#F2EDE4] overflow-hidden">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-bold text-[#141413] group-hover:text-[#9E2A2B]">
                      {cat.name}
                    </h2>
                    <span className="text-xs font-semibold text-[#8E6B35] tabular-nums">
                      {cat.product_count ?? 0} styles
                    </span>
                  </div>
                  <p className="text-xs text-[#5D574F] line-clamp-2">{cat.description}</p>
                  {cat.subcategories && cat.subcategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {cat.subcategories.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateRoute(`/category/${cat.slug}?sub=${encodeURIComponent(sub)}`);
                          }}
                          className="rounded border border-[#E7E1D8] bg-[#FAF8F5] px-2 py-0.5 text-[10.5px] font-medium text-[#3A3631] hover:border-[#9E2A2B] hover:text-[#9E2A2B] cursor-pointer"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Subcategories + Filters Bar */}
            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-4">
              {subcategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-[#F2EDE4]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8D857B] mr-1">
                    Style:
                  </span>
                  {["All", ...subcategories].map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSub(sub)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                        selectedSub.toLowerCase() === sub.toLowerCase()
                          ? "bg-[#141413] text-white"
                          : "bg-[#FAF8F5] border border-[#E7E1D8] text-[#3A3631] hover:border-[#141413]"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative min-w-[210px] flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8D857B]" />
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Filter by name, fabric, or color..."
                      className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] pl-8 pr-3 py-2 text-xs focus:bg-white focus:outline-none"
                    />
                  </div>

                  {sizes.length > 0 && (
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 text-xs font-medium"
                    >
                      <option value="All">All Sizes</option>
                      {sizes.map((s) => (
                        <option key={s} value={s}>
                          Size: {s}
                        </option>
                      ))}
                    </select>
                  )}

                  {colors.length > 0 && (
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 text-xs font-medium"
                    >
                      <option value="All">All Colors</option>
                      {colors.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

                  <label className="inline-flex items-center gap-1.5 font-medium text-[#3A3631] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="accent-[#9E2A2B]"
                    />
                    In Stock Only
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#8D857B]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="newest">Newest First</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="name-asc">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {(selectedSub !== "All" ||
                selectedSize !== "All" ||
                selectedColor !== "All" ||
                inStockOnly ||
                searchText) && (
                <div className="flex items-center justify-between pt-2 border-t border-[#F2EDE4] text-xs">
                  <span className="text-[#5D574F] tabular-nums">
                    Showing <strong>{filteredProducts.length}</strong> of {products.length} styles
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub("All");
                      setSelectedSize("All");
                      setSelectedColor("All");
                      setInStockOnly(false);
                      setSearchText("");
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" /> Reset Filters
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-[#5D574F]">Loading collection...</div>
            ) : error ? (
              <div className="rounded-2xl border border-[#E7E1D8] bg-white p-12 text-center space-y-3">
                <p className="font-display text-lg font-bold text-[#141413]">{error}</p>
                <button
                  type="button"
                  onClick={() => onNavigateRoute("/categories")}
                  className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Browse All Collections
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-[#E7E1D8] bg-white p-12 text-center space-y-3">
                <p className="font-display text-lg font-bold text-[#141413]">
                  No garments match your current filters
                </p>
                <p className="text-xs text-[#5D574F]">
                  Try clearing a size, color, or subcategory filter to view all pieces in this collection.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSub("All");
                    setSelectedSize("All");
                    setSelectedColor("All");
                    setInStockOnly(false);
                    setSearchText("");
                  }}
                  className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Show All Pieces
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredProducts.map((p) => (
                  <FashionProductCard
                    key={p.id}
                    product={p}
                    isWishlisted={wishlistIds.includes(p.id)}
                    onOpenProduct={(id) => onNavigateRoute(`/product/${id}`)}
                    onAddToCart={onAddToCart}
                    onToggleWishlist={onToggleWishlist}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <PublicFooter cms={cms} categories={allCategories} onNavigateRoute={onNavigateRoute} />
    </div>
  );
};
