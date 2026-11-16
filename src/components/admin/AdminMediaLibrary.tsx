import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Edit3,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MediaAsset } from "../../types";

interface ImagePickerModalProps {
  open: boolean;
  title?: string;
  mediaAssets: MediaAsset[];
  defaultCategory?: MediaAsset["category"];
  onClose: () => void;
  onSelect: (url: string) => void;
  onUploadFile: (
    file: File,
    category: MediaAsset["category"],
    altText?: string
  ) => Promise<string | null>;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  open,
  title = "Select or Upload Image",
  mediaAssets,
  defaultCategory = "Content",
  onClose,
  onSelect,
  onUploadFile,
}) => {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<"All" | MediaAsset["category"]>("All");
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mediaAssets.filter((m) => {
      const catOk = cat === "All" || m.category === cat;
      const qOk =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.altText.toLowerCase().includes(q) ||
        m.url.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [mediaAssets, search, cat]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-[#E7E1D8] flex flex-col max-h-[88vh] overflow-hidden text-xs">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E1D8] bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#9E2A2B]" />
            <h3 className="font-display text-base font-bold text-[#141413]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5D574F] hover:bg-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#F2EDE4] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="h-3.5 w-3.5 text-[#8D857B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media assets..."
                className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] pl-8 pr-3 py-2"
              />
            </div>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as "All" | MediaAsset["category"])}
              className="rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 font-semibold"
            >
              <option value="All">All Categories</option>
              <option value="Hero">Hero</option>
              <option value="Logos">Logos</option>
              <option value="Collections">Collections</option>
              <option value="Products">Products</option>
              <option value="Content">Content</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-3.5 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload New Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                const url = await onUploadFile(f, defaultCategory, f.name);
                setUploading(false);
                if (url) {
                  onSelect(url);
                  onClose();
                }
              }}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.url);
                onClose();
              }}
              className="group text-left rounded-xl border border-[#E7E1D8] bg-[#FAF8F5] overflow-hidden hover:border-[#9E2A2B] hover:shadow-md transition-all cursor-pointer"
            >
              <div className="aspect-square bg-white overflow-hidden relative">
                <img
                  src={item.url}
                  alt={item.altText || item.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {item.category}
                </span>
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="font-bold text-[#141413] truncate">{item.name}</p>
                <p className="text-[10px] text-[#8D857B] truncate">{item.dimensions || "Auto"}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-[#5D574F]">
              No matching media files found. Upload a new image using the button above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AdminMediaLibraryProps {
  mediaAssets: MediaAsset[];
  authToken: string;
  onRefreshMedia: () => Promise<void>;
  onUploadFile: (
    file: File,
    category: MediaAsset["category"],
    altText?: string
  ) => Promise<string | null>;
  onShowToast: (msg: string) => void;
}

export const AdminMediaLibrary: React.FC<AdminMediaLibraryProps> = ({
  mediaAssets,
  authToken,
  onRefreshMedia,
  onUploadFile,
  onShowToast,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | MediaAsset["category"]>("All");
  const [uploadCategory, setUploadCategory] = useState<MediaAsset["category"]>("Products");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<MediaAsset["category"]>("Content");
  const [editAlt, setEditAlt] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    asset: MediaAsset;
    usedIn: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mediaAssets.filter((m) => {
      const catOk = categoryFilter === "All" || m.category === categoryFilter;
      const qOk =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.altText.toLowerCase().includes(q) ||
        m.url.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [mediaAssets, search, categoryFilter]);

  const handleMultiFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = await onUploadFile(f, uploadCategory, f.name);
      if (url) successCount++;
    }
    setUploading(false);
    if (successCount > 0) {
      await onRefreshMedia();
      onShowToast(`Uploaded ${successCount} image(s) to Media Library.`);
    }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    const res = await fetch(`/api/admin/media/${encodeURIComponent(editingAsset.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: editName.trim(),
        category: editCategory,
        altText: editAlt.trim(),
      }),
    });
    if (res.ok) {
      onShowToast("Image metadata updated.");
      setEditingAsset(null);
      await onRefreshMedia();
    } else {
      onShowToast("Could not update image metadata.");
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset, force = false) => {
    const res = await fetch(
      `/api/admin/media/${encodeURIComponent(asset.id)}${force ? "?force=true" : ""}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const data = await res.json();
    if (res.status === 409) {
      setDeleteTarget({ asset, usedIn: data.usedIn || asset.usedIn });
      return;
    }
    if (!res.ok) {
      onShowToast(data.error || "Could not delete image.");
      return;
    }
    setDeleteTarget(null);
    onShowToast(`Deleted "${asset.name}" from Media Library.`);
    await onRefreshMedia();
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Header & Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleMultiFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 transition-colors bg-white ${
          dragOver ? "border-[#9E2A2B] bg-[#FAF8F5]" : "border-[#DFD8CE]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#141413]">
              Media & Image Library ({mediaAssets.length} Assets)
            </h2>
            <p className="text-[#5D574F]">
              Drag & drop images here or upload multiple PNG, JPG, WebP, SVG, or ICO files (max 5 MB each).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as MediaAsset["category"])}
              className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 font-semibold"
            >
              <option value="Hero">Upload to: Hero</option>
              <option value="Logos">Upload to: Logos</option>
              <option value="Collections">Upload to: Collections</option>
              <option value="Products">Upload to: Products</option>
              <option value="Content">Upload to: Content</option>
            </select>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Upload Images"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleMultiFiles(e.target.files)}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E1D8] bg-white p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["All", "Hero", "Logos", "Collections", "Products", "Content"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                categoryFilter === cat ? "bg-[#141413] text-white" : "bg-[#FAF8F5] text-[#5D574F]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-[#8D857B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename, alt text, URL..."
            className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] pl-8 pr-3 py-2"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="rounded-2xl border border-[#E7E1D8] bg-white overflow-hidden flex flex-col"
          >
            <div className="aspect-[4/3] bg-[#FAF8F5] relative overflow-hidden border-b border-[#F2EDE4]">
              <img
                src={asset.url}
                alt={asset.altText || asset.name}
                className="h-full w-full object-cover"
              />
              <span className="absolute top-2 left-2 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
                {asset.category}
              </span>
              {asset.fileSize && (
                <span className="absolute top-2 right-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#141413]">
                  {asset.fileSize}
                </span>
              )}
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <p className="font-bold text-[#141413] truncate" title={asset.name}>
                  {asset.name}
                </p>
                <p className="text-[11px] text-[#5D574F] line-clamp-1">
                  Alt: {asset.altText || "—"}
                </p>
                <p className="text-[10px] text-[#8D857B] tabular-nums">
                  {asset.dimensions || "Auto"} · Added {asset.uploadDate}
                </p>
                {asset.usedIn.length > 0 ? (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {asset.usedIn.slice(0, 2).map((u) => (
                      <span
                        key={u}
                        className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                      >
                        {u}
                      </span>
                    ))}
                    {asset.usedIn.length > 2 && (
                      <span className="text-[10px] text-[#5D574F]">
                        +{asset.usedIn.length - 2} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#8D857B] pt-1">Unused asset</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-1.5 border-t border-[#F2EDE4] pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(asset.url);
                    setCopiedId(asset.id);
                    setTimeout(() => setCopiedId(null), 1800);
                    onShowToast("Image URL copied to clipboard.");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                >
                  {copiedId === asset.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy URL
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAsset(asset);
                      setEditName(asset.name);
                      setEditCategory(asset.category);
                      setEditAlt(asset.altText);
                    }}
                    className="rounded-lg border border-[#DFD8CE] p-1.5 hover:bg-[#FAF8F5] cursor-pointer"
                    title="Edit Metadata"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (asset.usedIn.length > 0) {
                        setDeleteTarget({ asset, usedIn: asset.usedIn });
                      } else {
                        handleDeleteAsset(asset, false);
                      }
                    }}
                    className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Delete Image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Metadata Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <form
            onSubmit={handleSaveMeta}
            className="w-full max-w-md rounded-2xl bg-white p-6 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-2.5">
              <h3 className="font-display text-base font-bold">Edit Media Metadata</h3>
              <button type="button" onClick={() => setEditingAsset(null)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold mb-1">Asset Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Folder / Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as MediaAsset["category"])}
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              >
                <option value="Hero">Hero</option>
                <option value="Logos">Logos</option>
                <option value="Collections">Collections</option>
                <option value="Products">Products</option>
                <option value="Content">Content</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">SEO Alt Text</label>
              <input
                type="text"
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#141413] px-4 py-2 font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safety In-Use Delete Warning Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[#141413]">
                  Image Currently In Use
                </h3>
                <p className="text-[#5D574F] mt-1">
                  <strong>{deleteTarget.asset.name}</strong> is referenced on your storefront:
                </p>
              </div>
            </div>
            <ul className="rounded-xl bg-[#FAF8F5] border border-[#E7E1D8] p-3 space-y-1 text-[11px] font-semibold text-[#141413]">
              {deleteTarget.usedIn.map((u) => (
                <li key={u}>• {u}</li>
              ))}
            </ul>
            <p className="text-[11px] text-[#5D574F]">
              Replace this image in the sections above first, or force delete only if you plan to re-assign immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel Safe
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAsset(deleteTarget.asset, true)}
                className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white cursor-pointer"
              >
                Force Delete Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
