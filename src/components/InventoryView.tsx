import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { IndustryType, Product } from "../types";
import { exportToCsv, formatPKR } from "../utils/formatters";

interface InventoryViewProps {
  industry: IndustryType;
  products: Product[];
  onAddProduct: (product: Omit<Product, "id">) => void;
  onAdjustStock: (productId: string, delta: number, reason: string) => void;
  onOpenPurchaseOrder: (product: Product) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  industry,
  products,
  onAddProduct,
  onAdjustStock,
  onOpenPurchaseOrder,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "expiring">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(-1);
  const [adjustReason, setAdjustReason] = useState("Damaged / Spoiled");

  const [newProd, setNewProd] = useState({
    name: "",
    sku: `SKU-${Math.floor(100 + Math.random() * 899)}`,
    barcode: `896400${Math.floor(1000 + Math.random() * 8999)}`,
    category: "General",
    unit: "pcs",
    costPrice: 100,
    wholesalePrice: 115,
    sellingPrice: 130,
    stock: 20,
    minStock: 10,
    maxStock: 100,
    batchNo: "",
    expiryDate: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      if (!matchQ) return false;
      if (filter === "low") return p.stock <= p.minStock;
      if (filter === "expiring") {
        return Boolean(p.expiryDate && new Date(p.expiryDate).getTime() - Date.now() < 30 * 86400000);
      }
      return true;
    });
  }, [products, search, filter]);

  const totalValuation = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;
    onAddProduct({
      ...newProd,
      branchId: "br-1",
      batchNo: newProd.batchNo || undefined,
      expiryDate: newProd.expiryDate || undefined,
    });
    setShowAddModal(false);
    setNewProd((prev) => ({
      ...prev,
      name: "",
      sku: `SKU-${Math.floor(100 + Math.random() * 899)}`,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header & Valuation Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900">Inventory & Stock Control</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {products.length} SKUs · Stock Valuation:{" "}
            <strong className="text-slate-900 tabular-nums">{formatPKR(totalValuation)}</strong> ·{" "}
            <span className={lowStockCount > 0 ? "text-rose-600 font-semibold" : "text-emerald-700"}>
              {lowStockCount} Low-Stock Alerts
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                "karobar-inventory.csv",
                ["SKU", "Name", "Category", "Unit", "Stock", "Cost Price", "Selling Price"],
                products.map((p) => [p.sku, p.name, p.category, p.unit, p.stock, p.costPrice, p.sellingPrice])
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, SKU, or category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: "all", label: "All Items" },
                { id: "low", label: "Low Stock" },
                { id: "expiring", label: "Expiring Soon" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  filter === tab.id ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3">Category</th>
                {(industry === "pharmacy" || industry === "kiryana") && (
                  <th className="py-2.5 px-3">Batch / Expiry</th>
                )}
                <th className="py-2.5 px-3 text-right">Cost</th>
                <th className="py-2.5 px-3 text-right">Selling</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock;
                const isExpired = p.expiryDate && new Date(p.expiryDate).getTime() < Date.now();
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {p.sku} · {p.barcode}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                    {(industry === "pharmacy" || industry === "kiryana") && (
                      <td className="py-2.5 px-3 text-xs tabular-nums">
                        {p.expiryDate ? (
                          <span className={isExpired ? "font-semibold text-rose-600" : "text-amber-700"}>
                            {p.batchNo || "Batch"} · {p.expiryDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                      {formatPKR(p.costPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatPKR(p.sellingPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isLow ? "text-rose-600" : "text-emerald-700"
                        }`}
                      >
                        {isLow && <AlertTriangle className="h-3.5 w-3.5" />}
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(p);
                            setAdjustDelta(-1);
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <SlidersHorizontal className="h-3 w-3 inline mr-1" />
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPurchaseOrder(p)}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                        >
                          Restock
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                    <Package className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                    No products match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">Add New Inventory Product</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Product Name</label>
                <input
                  required
                  type="text"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  placeholder="e.g. Basmati Rice Super Kernel (5kg)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newProd.category}
                  onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                <select
                  value={newProd.unit}
                  onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="pack">pack</option>
                  <option value="carton">carton</option>
                  <option value="bottle">bottle</option>
                  <option value="box">box</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cost Price (Rs.)</label>
                <input
                  type="number"
                  min={1}
                  value={newProd.costPrice}
                  onChange={(e) => setNewProd({ ...newProd, costPrice: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Selling Price (Rs.)</label>
                <input
                  type="number"
                  min={1}
                  value={newProd.sellingPrice}
                  onChange={(e) => setNewProd({ ...newProd, sellingPrice: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Stock</label>
                <input
                  type="number"
                  min={0}
                  value={newProd.stock}
                  onChange={(e) => setNewProd({ ...newProd, stock: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Min Alert Level</label>
                <input
                  type="number"
                  min={0}
                  value={newProd.minStock}
                  onChange={(e) => setNewProd({ ...newProd, minStock: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Stock Adjustment: {adjustTarget.name}
              </h3>
              <button type="button" onClick={() => setAdjustTarget(null)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Current stock: <strong className="tabular-nums">{adjustTarget.stock} {adjustTarget.unit}</strong>
            </p>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity Change (+ or -)</label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Reason</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option>Damaged / Spoiled</option>
                  <option>Expired Stock Write-off</option>
                  <option>Physical Audit Correction</option>
                  <option>Return to Supplier</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAdjustStock(adjustTarget.id, adjustDelta, adjustReason);
                  setAdjustTarget(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
