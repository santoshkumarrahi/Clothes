import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Globe,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Monitor,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Undo2,
  X,
} from "lucide-react";
import {
  AuthUser,
  CmsConfig,
  DbBusiness,
  DbProduct,
  MediaAsset,
  ProductReview,
  PublicCategory,
} from "../../types";
import { AVAILABLE_GOOGLE_FONTS } from "../../utils/cmsTheme";
import { PublicWebsiteView } from "../PublicWebsiteView";

interface AdminVisualEditorProps {
  cmsDraft: CmsConfig;
  cmsPublished: CmsConfig;
  hasUnpublishedDraft: boolean;
  stores: DbBusiness[];
  products: DbProduct[];
  categories: PublicCategory[];
  reviews: ProductReview[];
  currentUser: AuthUser | null;
  savingDraft: boolean;
  publishing: boolean;
  onChangeDraft: (next: CmsConfig) => void;
  onSaveDraft: () => Promise<void>;
  onPublishLive: () => Promise<void>;
  onDiscardDraft: () => void;
  onOpenImagePicker: (
    onPicked: (url: string) => void,
    category?: MediaAsset["category"],
    title?: string
  ) => void;
  onShowToast: (msg: string) => void;
}

type EditorPanelGroup =
  | "branding"
  | "hero"
  | "announcement"
  | "colors"
  | "typography"
  | "navigation"
  | "sections"
  | "animations"
  | "footer";

export const AdminVisualEditor: React.FC<AdminVisualEditorProps> = ({
  cmsDraft,
  cmsPublished,
  hasUnpublishedDraft,
  stores,
  products,
  categories,
  reviews,
  currentUser,
  savingDraft,
  publishing,
  onChangeDraft,
  onSaveDraft,
  onPublishLive,
  onDiscardDraft,
  onOpenImagePicker,
  onShowToast,
}) => {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [openGroup, setOpenGroup] = useState<EditorPanelGroup>("hero");
  const [undoStack, setUndoStack] = useState<CmsConfig[]>([]);
  const [redoStack, setRedoStack] = useState<CmsConfig[]>([]);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

  const commitDraftChange = (next: CmsConfig) => {
    setUndoStack((prev) => [...prev.slice(-24), cmsDraft]);
    setRedoStack([]);
    onChangeDraft({ ...next, status: "Draft" });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, cmsDraft]);
    onChangeDraft(prevSnapshot);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, cmsDraft]);
    onChangeDraft(nextSnapshot);
  };

  const firstEnabledSlide =
    cmsDraft.heroSlides.find((s) => s.enabled !== false) || cmsDraft.heroSlides[0];
  const firstAnnouncement = cmsDraft.announcements?.[0];

  const renderGroupHeader = (
    key: EditorPanelGroup,
    label: string,
    IconComp: React.ComponentType<{ className?: string }>
  ) => {
    const isOpen = openGroup === key;
    return (
      <button
        type="button"
        onClick={() => setOpenGroup(isOpen ? key : key)}
        className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold border-b border-[#E7E1D8] cursor-pointer ${
          isOpen ? "bg-[#141413] text-white" : "bg-white text-[#141413] hover:bg-[#FAF8F5]"
        }`}
      >
        <span className="flex items-center gap-2">
          <IconComp className="h-3.5 w-3.5" />
          {label}
        </span>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
    );
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Editor Action Bar */}
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-1">
            {(
              [
                { id: "desktop", label: "Desktop", icon: Monitor },
                { id: "tablet", label: "Tablet", icon: Tablet },
                { id: "mobile", label: "Mobile", icon: Smartphone },
              ] as const
            ).map((vp) => {
              const Icon = vp.icon;
              return (
                <button
                  key={vp.id}
                  type="button"
                  onClick={() => setViewport(vp.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                    viewport === vp.id ? "bg-[#141413] text-white" : "text-[#5D574F]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {vp.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold disabled:opacity-35 hover:bg-[#FAF8F5] cursor-pointer"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold disabled:opacity-35 hover:bg-[#FAF8F5] cursor-pointer"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </button>
          </div>

          <span
            className={`rounded-md px-2.5 py-1 font-bold ${
              hasUnpublishedDraft
                ? "bg-amber-50 border border-amber-200 text-amber-800"
                : "bg-emerald-50 border border-emerald-200 text-emerald-800"
            }`}
          >
            {hasUnpublishedDraft ? "Draft Changes Unsaved/Unpublished" : `Live Published · v${cmsPublished.versionNumber}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDiscardDraft}
            className="inline-flex items-center gap-1 rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold text-[#5D574F] hover:bg-[#FAF8F5] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Live
          </button>
          <button
            type="button"
            disabled={savingDraft}
            onClick={onSaveDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#141413] bg-white px-3.5 py-2 font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {savingDraft ? "Saving Draft..." : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={publishing}
            onClick={() => setConfirmPublishOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            {publishing ? "Publishing..." : "Publish Live"}
          </button>
        </div>
      </div>

      {/* Main 2-Area Split: Left Customization Panel + Center Responsive Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Customization Controls */}
        <div className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-[#E7E1D8] bg-white overflow-hidden max-h-[78vh] overflow-y-auto">
          {/* Branding */}
          {renderGroupHeader("branding", "Logo & Identity", Globe)}
          {openGroup === "branding" && (
            <div className="p-4 space-y-3 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              <div>
                <label className="block font-semibold mb-1">Store Brand Name</label>
                <input
                  type="text"
                  value={cmsDraft.brandName}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      brandName: e.target.value,
                      storeSettings: { ...cmsDraft.storeSettings, storeName: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Brand Tagline</label>
                <input
                  type="text"
                  value={cmsDraft.tagline}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      tagline: e.target.value,
                      storeSettings: { ...cmsDraft.storeSettings, tagline: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenImagePicker(
                      (url) =>
                        commitDraftChange({
                          ...cmsDraft,
                          headerLogoUrl: url,
                          logoSettings: { ...cmsDraft.logoSettings, headerLogoUrl: url },
                        }),
                      "Logos",
                      "Select Header Logo"
                    )
                  }
                  className="rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5 font-semibold cursor-pointer"
                >
                  Pick Header Logo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenImagePicker(
                      (url) =>
                        commitDraftChange({
                          ...cmsDraft,
                          faviconUrl: url,
                          logoSettings: { ...cmsDraft.logoSettings, faviconUrl: url },
                        }),
                      "Logos",
                      "Select Favicon"
                    )
                  }
                  className="rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5 font-semibold cursor-pointer"
                >
                  Pick Favicon
                </button>
              </div>
            </div>
          )}

          {/* Hero */}
          {renderGroupHeader("hero", "Hero Banner & Slider", ImageIcon)}
          {openGroup === "hero" && firstEnabledSlide && (
            <div className="p-4 space-y-3 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              <div>
                <label className="block font-semibold mb-1">Active Slide Headline</label>
                <input
                  type="text"
                  value={firstEnabledSlide.title}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      heroSlides: cmsDraft.heroSlides.map((s) =>
                        s.id === firstEnabledSlide.id ? { ...s, title: e.target.value } : s
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5 font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Active Slide Subtitle</label>
                <input
                  type="text"
                  value={firstEnabledSlide.subtitle}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      heroSlides: cmsDraft.heroSlides.map((s) =>
                        s.id === firstEnabledSlide.id ? { ...s, subtitle: e.target.value } : s
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenImagePicker(
                    (url) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id ? { ...s, imageUrl: url } : s
                        ),
                      }),
                    "Hero",
                    "Pick Hero Slide Banner"
                  )
                }
                className="w-full rounded-lg border border-[#DFD8CE] bg-white px-3 py-2 font-semibold cursor-pointer hover:border-[#9E2A2B]"
              >
                Change Slide #1 Image
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Desktop Height (px)</label>
                  <input
                    type="number"
                    min={360}
                    max={820}
                    value={cmsDraft.heroSettings?.heightDesktopPx ?? 580}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSettings: {
                          ...cmsDraft.heroSettings,
                          heightDesktopPx: Number(e.target.value) || 580,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tablet Height (px)</label>
                  <input
                    type="number"
                    min={340}
                    max={760}
                    value={cmsDraft.heroSettings?.heightTabletPx ?? 500}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSettings: {
                          ...cmsDraft.heroSettings,
                          heightTabletPx: Number(e.target.value) || 500,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Width Mode</label>
                  <select
                    value={cmsDraft.heroSettings?.widthMode || "full"}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSettings: {
                          ...cmsDraft.heroSettings,
                          widthMode: e.target.value as "full" | "contained",
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2 py-1.5"
                  >
                    <option value="full">Full Width</option>
                    <option value="contained">Contained</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Object Fit</label>
                  <select
                    value={firstEnabledSlide.objectFit || "cover"}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id
                            ? { ...s, objectFit: e.target.value as "cover" | "contain" }
                            : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2 py-1.5"
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">
                    Pos X ({firstEnabledSlide.posX ?? 50}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={firstEnabledSlide.posX ?? 50}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id
                            ? { ...s, posX: Number(e.target.value) }
                            : s
                        ),
                      })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Pos Y ({firstEnabledSlide.posY ?? 18}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={firstEnabledSlide.posY ?? 18}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id
                            ? { ...s, posY: Number(e.target.value) }
                            : s
                        ),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">
                    Zoom ({firstEnabledSlide.zoomPercent ?? 100}%)
                  </label>
                  <input
                    type="range"
                    min={80}
                    max={160}
                    value={firstEnabledSlide.zoomPercent ?? 100}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id
                            ? { ...s, zoomPercent: Number(e.target.value) }
                            : s
                        ),
                      })
                    }
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Overlay Opacity (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={95}
                    value={firstEnabledSlide.overlayOpacity ?? 65}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === firstEnabledSlide.id
                            ? { ...s, overlayOpacity: Number(e.target.value) }
                            : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Announcements */}
          {renderGroupHeader("announcement", "Announcement / Marquee", Megaphone)}
          {openGroup === "announcement" && (
            <div className="p-4 space-y-3 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              <label className="inline-flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={firstAnnouncement ? firstAnnouncement.enabled : cmsDraft.announcementEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const nextAnn = (cmsDraft.announcements || []).map((a, i) =>
                      i === 0 ? { ...a, enabled: checked } : a
                    );
                    commitDraftChange({
                      ...cmsDraft,
                      announcementEnabled: checked,
                      announcements: nextAnn,
                    });
                  }}
                />
                Show Announcement Bar
              </label>
              <textarea
                rows={2}
                value={firstAnnouncement ? firstAnnouncement.text : cmsDraft.announcementText}
                onChange={(e) => {
                  const val = e.target.value;
                  const nextAnn = (cmsDraft.announcements || []).map((a, i) =>
                    i === 0 ? { ...a, text: val } : a
                  );
                  commitDraftChange({
                    ...cmsDraft,
                    announcementText: val,
                    announcements: nextAnn,
                  });
                }}
                className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
              />
              {firstAnnouncement && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="font-semibold">Bg Color</span>
                    <input
                      type="color"
                      value={firstAnnouncement.bgColor}
                      onChange={(e) =>
                        commitDraftChange({
                          ...cmsDraft,
                          announcements: cmsDraft.announcements.map((a, i) =>
                            i === 0 ? { ...a, bgColor: e.target.value } : a
                          ),
                        })
                      }
                      className="h-8 w-full rounded border border-[#DFD8CE] mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold">Text Color</span>
                    <input
                      type="color"
                      value={firstAnnouncement.textColor}
                      onChange={(e) =>
                        commitDraftChange({
                          ...cmsDraft,
                          announcements: cmsDraft.announcements.map((a, i) =>
                            i === 0 ? { ...a, textColor: e.target.value } : a
                          ),
                        })
                      }
                      className="h-8 w-full rounded border border-[#DFD8CE] mt-1"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Colors */}
          {renderGroupHeader("colors", "Quick Theme Colors", Palette)}
          {openGroup === "colors" && (
            <div className="p-4 grid grid-cols-2 gap-2.5 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              {(
                [
                  { key: "headerBg", label: "Header Bg" },
                  { key: "pageBg", label: "Page Bg" },
                  { key: "sectionBg", label: "Section Bg" },
                  { key: "cardBg", label: "Card Bg" },
                  { key: "primaryText", label: "Primary Text" },
                  { key: "primaryButtonBg", label: "Button Bg" },
                  { key: "saleBadge", label: "Accent / Sale" },
                  { key: "footerBg", label: "Footer Bg" },
                ] as const
              ).map((item) => (
                <label key={item.key} className="block">
                  <span className="font-semibold text-[11px]">{item.label}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="color"
                      value={cmsDraft.themeColors[item.key]}
                      onChange={(e) =>
                        commitDraftChange({
                          ...cmsDraft,
                          themeColors: { ...cmsDraft.themeColors, [item.key]: e.target.value },
                        })
                      }
                      className="h-7 w-9 rounded border border-[#DFD8CE]"
                    />
                    <span className="font-mono text-[10px] text-[#5D574F]">
                      {cmsDraft.themeColors[item.key]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Typography */}
          {renderGroupHeader("typography", "Fonts & Sizing", Type)}
          {openGroup === "typography" && (
            <div className="p-4 space-y-3 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              <div>
                <label className="block font-semibold mb-1">Heading Font</label>
                <select
                  value={cmsDraft.typography.heading.fontFamily}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      headingFont: e.target.value as CmsConfig["headingFont"],
                      typography: {
                        ...cmsDraft.typography,
                        heading: { ...cmsDraft.typography.heading, fontFamily: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                >
                  {AVAILABLE_GOOGLE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  {(cmsDraft.typography.customFonts || []).map((cf) => (
                    <option key={cf.id} value={cf.name}>
                      {cf.name} (Custom)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Body Font</label>
                <select
                  value={cmsDraft.typography.body.fontFamily}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      bodyFont: e.target.value as CmsConfig["bodyFont"],
                      typography: {
                        ...cmsDraft.typography,
                        body: { ...cmsDraft.typography.body, fontFamily: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                >
                  {AVAILABLE_GOOGLE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Heading Size (px)</label>
                  <input
                    type="number"
                    min={18}
                    max={64}
                    value={cmsDraft.typography.heading.desktopSizePx}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        typography: {
                          ...cmsDraft.typography,
                          heading: {
                            ...cmsDraft.typography.heading,
                            desktopSizePx: Number(e.target.value) || 36,
                          },
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Body Size (px)</label>
                  <input
                    type="number"
                    min={12}
                    max={22}
                    value={cmsDraft.typography.body.desktopSizePx}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        typography: {
                          ...cmsDraft.typography,
                          body: {
                            ...cmsDraft.typography.body,
                            desktopSizePx: Number(e.target.value) || 15,
                          },
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Header & Navigation */}
          {renderGroupHeader("navigation", "Header & Nav Controls", Eye)}
          {openGroup === "navigation" && (
            <div className="p-4 space-y-2.5 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              <div>
                <label className="block font-semibold mb-1">Header Height (px)</label>
                <input
                  type="number"
                  min={48}
                  max={110}
                  value={cmsDraft.navigationSettings.headerHeightPx}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      navigationSettings: {
                        ...cmsDraft.navigationSettings,
                        headerHeightPx: Number(e.target.value) || 64,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                />
              </div>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={cmsDraft.navigationSettings.stickyHeader}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      stickyHeader: e.target.checked,
                      navigationSettings: {
                        ...cmsDraft.navigationSettings,
                        stickyHeader: e.target.checked,
                      },
                    })
                  }
                />
                Sticky Header on Scroll
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={cmsDraft.navigationSettings.showSearchIcon}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      navigationSettings: {
                        ...cmsDraft.navigationSettings,
                        showSearchIcon: e.target.checked,
                      },
                    })
                  }
                />
                Show Search Icon
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={cmsDraft.navigationSettings.showWishlistIcon}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      navigationSettings: {
                        ...cmsDraft.navigationSettings,
                        showWishlistIcon: e.target.checked,
                      },
                    })
                  }
                />
                Show Wishlist Icon
              </label>
            </div>
          )}

          {/* Sections */}
          {renderGroupHeader("sections", "Homepage Sections", Layers)}
          {openGroup === "sections" && (
            <div className="p-3 space-y-2 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              {cmsDraft.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="rounded-lg border border-[#DFD8CE] bg-white p-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 font-bold truncate">
                      <input
                        type="checkbox"
                        checked={sec.enabled}
                        onChange={(e) =>
                          commitDraftChange({
                            ...cmsDraft,
                            sections: cmsDraft.sections.map((s) =>
                              s.id === sec.id ? { ...s, enabled: e.target.checked } : s
                            ),
                          })
                        }
                      />
                      <span className="truncate">{sec.title}</span>
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const copy = [...cmsDraft.sections];
                          const [m] = copy.splice(idx, 1);
                          copy.splice(idx - 1, 0, m);
                          commitDraftChange({
                            ...cmsDraft,
                            sections: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                          });
                        }}
                        className="rounded border border-[#DFD8CE] p-0.5 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === cmsDraft.sections.length - 1}
                        onClick={() => {
                          const copy = [...cmsDraft.sections];
                          const [m] = copy.splice(idx, 1);
                          copy.splice(idx + 1, 0, m);
                          commitDraftChange({
                            ...cmsDraft,
                            sections: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                          });
                        }}
                        className="rounded border border-[#DFD8CE] p-0.5 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Animations */}
          {renderGroupHeader("animations", "Motion & Hover Effects", Sparkles)}
          {openGroup === "animations" && (
            <div className="p-4 space-y-2.5 bg-[#FAF8F5] border-b border-[#E7E1D8]">
              {(
                [
                  { key: "productCardHover", label: "Product Card Hover Lift" },
                  { key: "imageZoom", label: "Product Image Zoom" },
                  { key: "buttonHover", label: "Button Hover Motion" },
                  { key: "marqueeMotion", label: "Announcement Marquee Motion" },
                ] as const
              ).map((ef) => (
                <label key={ef.key} className="flex items-center justify-between font-semibold">
                  <span>{ef.label}</span>
                  <input
                    type="checkbox"
                    checked={cmsDraft.animationSettings[ef.key].enabled}
                    onChange={(e) =>
                      commitDraftChange({
                        ...cmsDraft,
                        animationSettings: {
                          ...cmsDraft.animationSettings,
                          [ef.key]: {
                            ...cmsDraft.animationSettings[ef.key],
                            enabled: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}

          {/* Footer */}
          {renderGroupHeader("footer", "Footer Visibility & Copy", Layers)}
          {openGroup === "footer" && (
            <div className="p-4 space-y-2.5 bg-[#FAF8F5]">
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={cmsDraft.footerSettings.visible}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      footerSettings: {
                        ...cmsDraft.footerSettings,
                        visible: e.target.checked,
                      },
                    })
                  }
                />
                Show Storefront Footer
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={cmsDraft.footerSettings.showPaymentIcons}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      footerSettings: {
                        ...cmsDraft.footerSettings,
                        showPaymentIcons: e.target.checked,
                      },
                    })
                  }
                />
                Show Payment Badges
              </label>
              <div>
                <label className="block font-semibold mb-1">Copyright Text</label>
                <input
                  type="text"
                  value={cmsDraft.footerSettings.copyrightText}
                  onChange={(e) =>
                    commitDraftChange({
                      ...cmsDraft,
                      footerCopyright: e.target.value,
                      footerSettings: {
                        ...cmsDraft.footerSettings,
                        copyrightText: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2.5 py-1.5"
                />
              </div>
            </div>
          )}
        </div>

        {/* Center Live Storefront Preview Canvas */}
        <div className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-[#E7E1D8] bg-[#E8E2D7] p-3 lg:p-5 overflow-auto max-h-[78vh] flex justify-center">
          <div
            className={`bg-white shadow-2xl rounded-xl overflow-hidden transition-all duration-300 border border-[#DFD8CE] ${
              viewport === "desktop"
                ? "w-full"
                : viewport === "tablet"
                ? "w-[768px] shrink-0"
                : "w-[390px] shrink-0"
            }`}
          >
            <div className="bg-[#141413] text-white px-3 py-1.5 text-[10px] font-semibold flex items-center justify-between">
              <span>Live Storefront Preview ({viewport.toUpperCase()})</span>
              <span className="text-[#E6C994]">
                {hasUnpublishedDraft ? "Previewing Draft Changes" : "Live Published Version"}
              </span>
            </div>
            <div className="pointer-events-auto">
              <PublicWebsiteView
                cms={cmsDraft}
                stores={stores}
                products={products}
                categories={categories}
                reviews={reviews}
                currentUser={currentUser}
                cartCount={0}
                wishlistIds={[]}
                previewMode
                previewViewport={viewport}
                onNavigateRoute={(href) =>
                  onShowToast(`Preview mode navigation target: ${href}`)
                }
                onOpenStore={(slug) =>
                  onShowToast(`Preview mode store link: /store/${slug}`)
                }
                onAddToCart={() => onShowToast("Preview mode: Add to Bag simulated.")}
                onToggleWishlist={() => onShowToast("Preview mode: Wishlist simulated.")}
                onOpenCart={() => onShowToast("Preview mode: Shopping bag icon tested.")}
                onLogout={() => {}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Publish Dialog */}
      {confirmPublishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                Publish Changes to Live Storefront?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmPublishOpen(false)}
                className="cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[#5D574F] leading-relaxed">
              This will publish your visual edits, colors, typography, sections, and hero banners to the live public THAR STYLE website and record a new version snapshot for rollback safety.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPublishOpen(false)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Keep as Draft
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmPublishOpen(false);
                  await onPublishLive();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-5 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm & Publish Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
