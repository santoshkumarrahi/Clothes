import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DbBusiness, DbOrder, DbProduct } from "../types";
import { formatPKR } from "../utils/formatters";

interface OnlineStoreManagerViewProps {
  mode: "online-products" | "online-orders" | "store-settings";
  authToken: string;
  business: DbBusiness | null;
  onBusinessCreated: (biz: DbBusiness) => void;
  onBusinessUpdated: (biz: DbBusiness) => void;
  onOpenPublicStore: (slug: string) => void;
  onShowToast: (msg: string) => void;
}

interface EditableImage {
  url: string;
  isPrimary: boolean;
}

const ORDER_STATUS_BADGE: Record<DbOrder["order_status"], string> = {
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Accepted: "bg-blue-50 text-blue-800 border-blue-200",
  Preparing: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Dispatched: "bg-purple-50 text-purple-800 border-purple-200",
  Delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export const OnlineStoreManagerView: React.FC<OnlineStoreManagerViewProps> = ({
  mode,
  authToken,
  business,
  onBusinessCreated,
  onBusinessUpdated,
  onOpenPublicStore,
  onShowToast,
}) => {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Registration form state if owner has no registered business yet
  const [regForm, setRegForm] = useState({
    name: "",
    category: "Kiryana / General Store",
    city: "Lahore",
    address: "",
    phone: "+92 300 ",
    whatsapp: "",
    description: "",
    plan: "Professional",
  });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Product list filters
  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState("All");
  const [prodPubFilter, setProdPubFilter] = useState<"all" | "published" | "draft">("all");
  const [prodSort, setProdSort] = useState<"newest" | "price-asc" | "price-desc" | "stock-low">("newest");

  // Add/Edit product modal
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "Kiryana & Grocery",
    brand: "",
    unit: "pcs",
    description: "",
    costPrice: 0,
    sellingPrice: 0,
    discountPrice: "",
    stock: 10,
    minStock: 5,
    published: true,
    variantsText: "",
  });
  const [prodImages, setProdImages] = useState<EditableImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  // Orders filter & selected order
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("All");
  const [orderSearch, setOrderSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Storefront settings form
  const [settingsForm, setSettingsForm] = useState({
    name: business?.name || "",
    description: business?.description || "",
    address: business?.address || "",
    phone: business?.phone || "",
    whatsapp: business?.whatsapp || "",
    hours: business?.hours || "9:00 AM - 10:30 PM",
    onlineStoreEnabled: business ? Boolean(business.online_store_enabled) : true,
    logoUrl: business?.logo_url || "",
    coverUrl: business?.cover_url || "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (business) {
      setSettingsForm({
        name: business.name || "",
        description: business.description || "",
        address: business.address || "",
        phone: business.phone || "",
        whatsapp: business.whatsapp || "",
        hours: business.hours || "9:00 AM - 10:30 PM",
        onlineStoreEnabled: Boolean(business.online_store_enabled),
        logoUrl: business.logo_url || "",
        coverUrl: business.cover_url || "",
      });
    }
  }, [business]);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    }),
    [authToken]
  );

  const loadBusinessData = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch(`/api/business/${business.id}/products`, { headers: authHeaders }),
        fetch(`/api/business/${business.id}/orders`, { headers: authHeaders }),
      ]);
      const pData = await pRes.json();
      const oData = await oRes.json();
      if (pRes.ok) setProducts(pData.products || []);
      if (oRes.ok) setOrders(oData.orders || []);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, [business, authHeaders]);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData, mode]);

  const uploadSingleFileToServer = async (file: File): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ dataUrl, fileName: file.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.url as string;
  };

  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSubmitting(true);
    try {
      const res = await fetch("/api/business/register", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      onBusinessCreated(data.business as DbBusiness);
      onShowToast(`Business storefront launched at ${data.storefrontPath}!`);
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : "Could not register business.");
    } finally {
      setRegSubmitting(false);
    }
  };

  // If no registered SQLite business yet for this owner, prompt clean onboarding
  if (!business) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 space-y-5">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Launch Your Online Business Storefront
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Set up your public shop URL (e.g. /store/your-shop-name), publish products with photos, and accept online orders synced with POS stock.
            </p>
          </div>
        </div>

        {regError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {regError}
          </div>
        )}

        <form onSubmit={handleRegisterBusiness} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Business / Shop Name *</label>
            <input
              type="text"
              required
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              placeholder="e.g. Madina Cash & Carry"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Business Category</label>
            <select
              value={regForm.category}
              onChange={(e) => setRegForm({ ...regForm, category: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option>Kiryana / General Store</option>
              <option>Pharmacy / Medical Store</option>
              <option>Electronics & Mobile</option>
              <option>Clothing & Garments</option>
              <option>Restaurant & Bakery</option>
              <option>Wholesale & Distribution</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">City *</label>
            <input
              type="text"
              required
              value={regForm.city}
              onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
              placeholder="Lahore, Karachi, Islamabad..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
            <input
              type="text"
              required
              value={regForm.phone}
              onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
              placeholder="+92 300 1234567"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">WhatsApp Order Number</label>
            <input
              type="text"
              value={regForm.whatsapp}
              onChange={(e) => setRegForm({ ...regForm, whatsapp: e.target.value })}
              placeholder="+92 300 1234567"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Shop Address</label>
            <input
              type="text"
              value={regForm.address}
              onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
              placeholder="Shop #12, Liberty Market, Gulberg III, Lahore"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Short Store Description</label>
            <textarea
              rows={2}
              value={regForm.description}
              onChange={(e) => setRegForm({ ...regForm, description: e.target.value })}
              placeholder="Tell local shoppers what you sell and your delivery coverage."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 pt-1 flex justify-end">
            <button
              type="submit"
              disabled={regSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F7C58] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0B6648] disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              {regSubmitting ? "Creating Storefront..." : "Create Business & Publish Storefront"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Open modal for New or Edit product
  const openNewProductModal = () => {
    setEditingProductId(null);
    setProdForm({
      name: "",
      sku: `SKU-${Math.floor(1000 + Math.random() * 8999)}`,
      barcode: `896400${Math.floor(1000 + Math.random() * 8999)}`,
      category: "Kiryana & Grocery",
      brand: "",
      unit: "pcs",
      description: "",
      costPrice: 0,
      sellingPrice: 0,
      discountPrice: "",
      stock: 20,
      minStock: 5,
      published: true,
      variantsText: "Standard",
    });
    setProdImages([]);
    setProdError(null);
    setShowProdModal(true);
  };

  const openEditProductModal = (p: DbProduct) => {
    setEditingProductId(p.id);
    setProdForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      brand: p.brand || "",
      unit: p.unit,
      description: p.description,
      costPrice: p.cost_price,
      sellingPrice: p.selling_price,
      discountPrice: p.discount_price ? String(p.discount_price) : "",
      stock: p.stock,
      minStock: p.min_stock,
      published: p.published,
      variantsText: (p.variants || []).join(", "),
    });
    setProdImages(
      (p.images || []).map((im) => ({
        url: im.url,
        isPrimary: im.is_primary,
      }))
    );
    setProdError(null);
    setShowProdModal(true);
  };

  const handleProductImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingImages(true);
    setProdError(null);
    try {
      const uploadedUrls: EditableImage[] = [];
      for (const file of files) {
        const url = await uploadSingleFileToServer(file);
        uploadedUrls.push({
          url,
          isPrimary: prodImages.length === 0 && uploadedUrls.length === 0,
        });
      }
      setProdImages((prev) => {
        const combined = [...prev, ...uploadedUrls];
        if (!combined.some((i) => i.isPrimary) && combined.length > 0) {
          combined[0].isPrimary = true;
        }
        return combined;
      });
    } catch (err: unknown) {
      setProdError(err instanceof Error ? err.message : "Failed to upload one or more images.");
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const setPrimaryImage = (idx: number) => {
    setProdImages((prev) => prev.map((im, i) => ({ ...im, isPrimary: i === idx })));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setProdImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeImage = (idx: number) => {
    setProdImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((i) => i.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim() || Number(prodForm.sellingPrice) <= 0) {
      setProdError("Product name and a positive selling price are required.");
      return;
    }
    setSavingProduct(true);
    setProdError(null);
    const variants = prodForm.variantsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: prodForm.name.trim(),
      sku: prodForm.sku.trim(),
      barcode: prodForm.barcode.trim(),
      category: prodForm.category.trim() || "Other Businesses",
      brand: prodForm.brand.trim(),
      unit: prodForm.unit.trim() || "pcs",
      description: prodForm.description.trim(),
      costPrice: Number(prodForm.costPrice) || 0,
      sellingPrice: Number(prodForm.sellingPrice),
      discountPrice: prodForm.discountPrice ? Number(prodForm.discountPrice) : null,
      stock: Number(prodForm.stock) || 0,
      minStock: Number(prodForm.minStock) || 5,
      published: prodForm.published,
      variants,
      images: prodImages,
    };

    try {
      const url = editingProductId
        ? `/api/business/${business.id}/products/${editingProductId}`
        : `/api/business/${business.id}/products`;
      const res = await fetch(url, {
        method: editingProductId ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save product.");

      const savedProd = data.product as DbProduct;
      if (editingProductId) {
        setProducts((prev) => prev.map((p) => (p.id === savedProd.id ? savedProd : p)));
        onShowToast(`Updated "${savedProd.name}" (${savedProd.images.length} photo(s)).`);
      } else {
        setProducts((prev) => [savedProd, ...prev]);
        onShowToast(`Added "${savedProd.name}" to your Online Storefront.`);
      }
      setShowProdModal(false);
    } catch (err: unknown) {
      setProdError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleTogglePublish = async (p: DbProduct) => {
    try {
      const res = await fetch(`/api/business/${business.id}/products/${p.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ published: !p.published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProducts((prev) => prev.map((item) => (item.id === p.id ? data.product : item)));
      onShowToast(
        data.product.published
          ? `"${p.name}" is now live on /store/${business.slug}.`
          : `"${p.name}" unpublished from public storefront.`
      );
    } catch {
      onShowToast("Could not update product visibility.");
    }
  };

  const handleDuplicateProduct = async (p: DbProduct) => {
    try {
      const res = await fetch(`/api/business/${business.id}/products/${p.id}/duplicate`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProducts((prev) => [data.product as DbProduct, ...prev]);
      onShowToast(`Duplicated "${p.name}" as draft.`);
    } catch {
      onShowToast("Failed to duplicate product.");
    }
  };

  const handleDeleteProduct = async (p: DbProduct) => {
    try {
      const res = await fetch(`/api/business/${business.id}/products/${p.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed");
      setProducts((prev) => prev.filter((item) => item.id !== p.id));
      onShowToast(`Deleted "${p.name}" from store catalog.`);
    } catch {
      onShowToast("Failed to delete product.");
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: "Accepted" | "Preparing" | "Dispatched" | "Delivered" | "Cancelled" | "Rejected"
  ) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/business/${business.id}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Update failed");
      }
      await loadBusinessData();
      onShowToast(`Order status updated to ${status}.`);
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : "Could not update order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/business/${business.id}/settings`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      onBusinessUpdated(data.business as DbBusiness);
      onShowToast("Public storefront settings updated successfully.");
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : "Could not save storefront settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const productCategories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      const okQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const okCat = prodCatFilter === "All" || p.category === prodCatFilter;
      const okPub =
        prodPubFilter === "all" ||
        (prodPubFilter === "published" ? p.published : !p.published);
      return okQ && okCat && okPub;
    });

    if (prodSort === "price-asc") {
      return [...list].sort((a, b) => a.selling_price - b.selling_price);
    }
    if (prodSort === "price-desc") {
      return [...list].sort((a, b) => b.selling_price - a.selling_price);
    }
    if (prodSort === "stock-low") {
      return [...list].sort((a, b) => a.stock - b.stock);
    }
    return list;
  }, [products, prodSearch, prodCatFilter, prodPubFilter, prodSort]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const okStatus = orderStatusFilter === "All" || o.order_status === orderStatusFilter;
      const okQ =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q);
      return okStatus && okQ;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const storefrontUrl = `/store/${business.slug}`;

  return (
    <div className="space-y-4">
      {/* Storefront Banner Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={business.logo_url}
            alt={business.name}
            className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base font-bold text-slate-900">{business.name}</h1>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  business.online_store_enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {business.online_store_enabled ? "Storefront Live" : "Storefront Offline"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Public Link: <span className="font-mono font-semibold text-emerald-700">{storefrontUrl}</span> ·{" "}
              {business.city}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPublicStore(business.slug)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
            View Live Storefront
          </button>
          {mode === "online-products" && (
            <button
              type="button"
              onClick={openNewProductModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Online Product
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: ONLINE PRODUCTS MANAGER */}
      {mode === "online-products" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs text-slate-500">Catalog Products</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{products.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs text-slate-500">Published Online</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
                {products.filter((p) => p.published).length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs text-slate-500">Low Stock Alerts</p>
              <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">
                {products.filter((p) => p.stock > 0 && p.stock <= p.min_stock).length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs text-slate-500">Out of Stock</p>
              <p className="mt-1 text-2xl font-bold text-rose-600 tabular-nums">
                {products.filter((p) => p.stock <= 0).length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="Search by product name, SKU, or category..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={prodCatFilter}
                  onChange={(e) => setProdCatFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700"
                >
                  {productCategories.map((c) => (
                    <option key={c} value={c}>
                      {c === "All" ? "All Categories" : c}
                    </option>
                  ))}
                </select>
                <select
                  value={prodPubFilter}
                  onChange={(e) => setProdPubFilter(e.target.value as "all" | "published" | "draft")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700"
                >
                  <option value="all">All Visibility</option>
                  <option value="published">Published Online</option>
                  <option value="draft">Draft / Hidden</option>
                </select>
                <select
                  value={prodSort}
                  onChange={(e) =>
                    setProdSort(e.target.value as "newest" | "price-asc" | "price-desc" | "stock-low")
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700"
                >
                  <option value="newest">Recently Updated</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="stock-low">Stock: Low First</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="py-10 text-center text-xs text-slate-500">Loading store products...</p>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Package className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No matching products found</p>
                <p className="text-xs text-slate-500">
                  Add your first product with photos to publish it immediately to {storefrontUrl}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Product & Photos</th>
                      <th className="py-2.5 px-3">Category & SKU</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">Live Stock</th>
                      <th className="py-2.5 px-3">Visibility</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.primaryImage}
                              alt={p.name}
                              className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate max-w-[220px]">{p.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {p.images.length} photo(s)
                                {p.variants.length > 0 ? ` · ${p.variants.join(", ")}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-semibold text-slate-700">{p.category}</p>
                          <p className="font-mono text-[11px] text-slate-400">{p.sku}</p>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {p.discount_price ? (
                            <div>
                              <p className="font-bold text-emerald-700">{formatPKR(p.discount_price)}</p>
                              <p className="text-[11px] text-slate-400 line-through">
                                {formatPKR(p.selling_price)}
                              </p>
                            </div>
                          ) : (
                            <p className="font-bold text-slate-900">{formatPKR(p.selling_price)}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <span
                            className={`font-bold ${
                              p.stock <= 0
                                ? "text-rose-600"
                                : p.stock <= p.min_stock
                                ? "text-amber-600"
                                : "text-slate-900"
                            }`}
                          >
                            {p.stock} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(p)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                              p.published
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {p.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {p.published ? "Published" : "Hidden"}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              title="Edit product"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(p)}
                              title="Duplicate product"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p)}
                              title="Delete product"
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: ONLINE ORDERS WORKFLOW */}
      {mode === "online-orders" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by order #, customer name, or mobile..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {["All", "Pending", "Accepted", "Preparing", "Dispatched", "Delivered", "Cancelled", "Rejected"].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      orderStatusFilter === st
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center space-y-2">
              <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No online orders in this filter</p>
              <p className="text-xs text-slate-500">
                Share {storefrontUrl} with your customers so they can browse and order online.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-slate-900">{ord.order_number}</span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                            ORDER_STATUS_BADGE[ord.order_status]
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customer: <strong className="text-slate-800">{ord.customer_name}</strong> ·{" "}
                        {ord.customer_phone} · {new Date(ord.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">Delivery: {ord.delivery_address}</p>
                    </div>
                    <div className="text-left sm:text-right tabular-nums">
                      <p className="text-lg font-extrabold text-emerald-700">{formatPKR(ord.total)}</p>
                      <p className="text-[11px] text-slate-500">
                        {ord.payment_method} ({ord.payment_status})
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ord.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2"
                      >
                        <img
                          src={it.image_url}
                          alt={it.product_name}
                          className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-slate-900 truncate">{it.product_name}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {it.quantity} × {formatPKR(it.unit_price)} · {it.variant_label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ord.order_status === "Pending" && (
                        <>
                          <button
                            type="button"
                            disabled={updatingOrderId === ord.id}
                            onClick={() => handleUpdateOrderStatus(ord.id, "Accepted")}
                            className="rounded-lg bg-[#0F7C58] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer"
                          >
                            Accept Order
                          </button>
                          <button
                            type="button"
                            disabled={updatingOrderId === ord.id}
                            onClick={() => handleUpdateOrderStatus(ord.id, "Rejected")}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {ord.order_status === "Accepted" && (
                        <button
                          type="button"
                          disabled={updatingOrderId === ord.id}
                          onClick={() => handleUpdateOrderStatus(ord.id, "Preparing")}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          Mark Preparing
                        </button>
                      )}
                      {(ord.order_status === "Accepted" || ord.order_status === "Preparing") && (
                        <button
                          type="button"
                          disabled={updatingOrderId === ord.id}
                          onClick={() => handleUpdateOrderStatus(ord.id, "Dispatched")}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 cursor-pointer"
                        >
                          Dispatch Rider
                        </button>
                      )}
                      {ord.order_status === "Dispatched" && (
                        <button
                          type="button"
                          disabled={updatingOrderId === ord.id}
                          onClick={() => handleUpdateOrderStatus(ord.id, "Delivered")}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer"
                        >
                          Mark Delivered
                        </button>
                      )}
                      {ord.order_status !== "Delivered" &&
                        ord.order_status !== "Cancelled" &&
                        ord.order_status !== "Rejected" && (
                          <button
                            type="button"
                            disabled={updatingOrderId === ord.id}
                            onClick={() => handleUpdateOrderStatus(ord.id, "Cancelled")}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            Cancel & Restore Stock
                          </button>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer no-print"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Packing Slip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: STOREFRONT SETTINGS */}
      {mode === "store-settings" && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Public Storefront Appearance & Contact
              </h2>
              <p className="text-xs text-slate-500">
                Changes reflect immediately on <span className="font-mono">{storefrontUrl}</span> and public search.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.onlineStoreEnabled}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, onlineStoreEnabled: e.target.checked })
                }
                className="accent-emerald-700"
              />
              Enable Public Online Storefront
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Store Display Name</label>
              <input
                type="text"
                required
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Operating Hours</label>
              <input
                type="text"
                value={settingsForm.hours}
                onChange={(e) => setSettingsForm({ ...settingsForm, hours: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={settingsForm.phone}
                onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">WhatsApp Order Number</label>
              <input
                type="text"
                value={settingsForm.whatsapp}
                onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Shop Address</label>
              <input
                type="text"
                value={settingsForm.address}
                onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Store About / Description</label>
              <textarea
                rows={3}
                value={settingsForm.description}
                onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {/* Logo Upload */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <p className="font-semibold text-slate-700">Shop Logo</p>
              <div className="flex items-center gap-3">
                <img
                  src={settingsForm.logoUrl}
                  alt="Store Logo"
                  className="h-14 w-14 rounded-xl object-cover border border-slate-200 bg-white"
                />
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  Upload New Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const url = await uploadSingleFileToServer(f);
                        setSettingsForm((prev) => ({ ...prev, logoUrl: url }));
                        onShowToast("Logo uploaded. Click Save Storefront Settings to publish.");
                      } catch {
                        onShowToast("Failed to upload logo.");
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Cover Banner Upload */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <p className="font-semibold text-slate-700">Cover Banner Image</p>
              <div className="flex items-center gap-3">
                <img
                  src={settingsForm.coverUrl}
                  alt="Store Cover"
                  className="h-14 w-24 rounded-xl object-cover border border-slate-200 bg-white"
                />
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  Upload New Cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const url = await uploadSingleFileToServer(f);
                        setSettingsForm((prev) => ({ ...prev, coverUrl: url }));
                        onShowToast("Cover image uploaded. Click Save Storefront Settings to publish.");
                      } catch {
                        onShowToast("Failed to upload cover.");
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0B6648] disabled:opacity-60 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              {savingSettings ? "Saving..." : "Save Storefront Settings"}
            </button>
          </div>
        </form>
      )}

      {/* ADD / EDIT PRODUCT MODAL WITH MULTI-IMAGE UPLOAD */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4 flex items-center justify-center">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingProductId ? "Edit Online Product" : "Add New Online Product"}
              </h2>
              <button
                type="button"
                onClick={() => setShowProdModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              {prodError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 font-medium text-rose-700">
                  {prodError}
                </div>
              )}

              {/* Multi-image uploader */}
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">Product Photos (Uploaded & Stored on Server)</p>
                    <p className="text-[11px] text-slate-500">
                      Upload multiple JPG, PNG, or WebP images. Mark your primary cover photo or reorder.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer shrink-0">
                    <ImagePlus className="h-4 w-4" />
                    {uploadingImages ? "Uploading..." : "Upload Photos"}
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleProductImageFiles}
                    />
                  </label>
                </div>

                {prodImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {prodImages.map((im, idx) => (
                      <div
                        key={`${im.url}-${idx}`}
                        className={`rounded-xl border bg-white p-1.5 space-y-1.5 ${
                          im.isPrimary ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-slate-200"
                        }`}
                      >
                        <img
                          src={im.url}
                          alt={`Product ${idx + 1}`}
                          className="h-24 w-full rounded-lg object-cover"
                        />
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(idx)}
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                              im.isPrimary
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <Star className="h-2.5 w-2.5" />
                            {im.isPrimary ? "Primary" : "Set Main"}
                          </button>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveImage(idx, -1)}
                              disabled={idx === 0}
                              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(idx, 1)}
                              disabled={idx === prodImages.length - 1}
                              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="rounded p-0.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    placeholder="e.g. Super Kernel Basmati Rice (5 kg)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    list="karobar-category-suggestions"
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                    placeholder="Smartphones, Kiryana & Grocery, Electronics..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <datalist id="karobar-category-suggestions">
                    <option value="Smartphones" />
                    <option value="Mobile Accessories" />
                    <option value="Computers & Laptops" />
                    <option value="Electronics" />
                    <option value="Home Appliances" />
                    <option value="Kiryana & Grocery" />
                    <option value="Pharmacy & Medical" />
                    <option value="Clothing & Fashion" />
                    <option value="Shoes & Footwear" />
                    <option value="Restaurants & Food" />
                    <option value="Wholesale & Distribution" />
                    <option value="Hardware & Sanitary" />
                    <option value="Cosmetics & Beauty" />
                    <option value="Auto Parts" />
                    <option value="Furniture & Home Decor" />
                    <option value="Stationery & Books" />
                    <option value="Sports & Fitness" />
                    <option value="Agriculture Supplies" />
                    <option value="Construction Materials" />
                    <option value="Salon & Personal Services" />
                    <option value="Repair & Maintenance" />
                    <option value="Other Businesses" />
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand (Optional)</label>
                  <input
                    type="text"
                    value={prodForm.brand}
                    onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                    placeholder="e.g. Samsung, Apple, Shan, Dell"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                    <input
                      type="text"
                      value={prodForm.sku}
                      onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={prodForm.unit}
                      onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
                      placeholder="kg, pcs, box"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (PKR) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prodForm.sellingPrice}
                    onChange={(e) => setProdForm({ ...prodForm, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Discounted Offer Price (Optional PKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={prodForm.discountPrice}
                    onChange={(e) => setProdForm({ ...prodForm, discountPrice: e.target.value })}
                    placeholder="Leave empty for no discount"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost Price (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={prodForm.costPrice}
                    onChange={(e) => setProdForm({ ...prodForm, costPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      min={0}
                      value={prodForm.stock}
                      onChange={(e) => setProdForm({ ...prodForm, stock: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Low Stock Alert</label>
                    <input
                      type="number"
                      min={0}
                      value={prodForm.minStock}
                      onChange={(e) => setProdForm({ ...prodForm, minStock: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Variants (comma-separated, e.g. 1 kg, 5 kg, 10 kg or Black, Silver)
                  </label>
                  <input
                    type="text"
                    value={prodForm.variantsText}
                    onChange={(e) => setProdForm({ ...prodForm, variantsText: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Product Description</label>
                  <textarea
                    rows={2}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    placeholder="Quality details, expiry/warranty info, delivery notes..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodForm.published}
                      onChange={(e) => setProdForm({ ...prodForm, published: e.target.checked })}
                      className="accent-emerald-700"
                    />
                    Publish immediately to public storefront ({storefrontUrl})
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowProdModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct || uploadingImages}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-5 py-2 text-xs font-bold text-white hover:bg-[#0B6648] disabled:opacity-60 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                {savingProduct ? "Saving Product..." : editingProductId ? "Save Changes" : "Publish Product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
