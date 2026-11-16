import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import {
  AnimationEffectConfig,
  AnimationSettingsConfig,
  AnnouncementItem,
  CmsConfig,
  HeritageCollectionCard,
  HeroSlide,
  HomepageSectionConfig,
  MediaAsset,
  ThemeColorsConfig,
  TypographyRoleConfig,
  TypographySettingsConfig,
} from "../../types";
import { INITIAL_CMS_CONFIG } from "../../data/seedData";
import { AVAILABLE_GOOGLE_FONTS, hexToRgbString } from "../../utils/cmsTheme";

export type DesignPanelTab =
  | "hero-slider"
  | "branding"
  | "navigation"
  | "footer"
  | "colors"
  | "typography"
  | "marquee"
  | "animations"
  | "sections";

interface AdminDesignPanelsProps {
  activeSection: DesignPanelTab;
  cmsDraft: CmsConfig;
  authToken: string;
  onChangeDraft: (next: CmsConfig) => void;
  onSaveDraft: () => Promise<void>;
  onRequestPublish: () => void;
  onOpenImagePicker: (
    onPicked: (url: string) => void,
    category?: MediaAsset["category"],
    title?: string
  ) => void;
  onUploadFile?: (
    file: File,
    category?: MediaAsset["category"],
    altText?: string
  ) => Promise<string | null>;
  onShowToast: (msg: string) => void;
}

const DEFAULT_THEME_COLORS: ThemeColorsConfig = INITIAL_CMS_CONFIG.themeColors;
const DEFAULT_TYPOGRAPHY: TypographySettingsConfig = INITIAL_CMS_CONFIG.typography;

export const AdminDesignPanels: React.FC<AdminDesignPanelsProps> = ({
  activeSection,
  cmsDraft,
  authToken,
  onChangeDraft,
  onSaveDraft,
  onRequestPublish,
  onOpenImagePicker,
  onUploadFile,
  onShowToast,
}) => {
  const [dragSlideIdx, setDragSlideIdx] = useState<number | null>(null);
  const [dragSecIdx, setDragSecIdx] = useState<number | null>(null);
  const [heroPreviewViewport, setHeroPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [confirmResetTheme, setConfirmResetTheme] = useState(false);
  const [confirmHideNavIcon, setConfirmHideNavIcon] = useState<{
    key: "showCartIcon" | "showAccountIcon";
    label: string;
  } | null>(null);
  const [confirmHideSystemSection, setConfirmHideSystemSection] =
    useState<HomepageSectionConfig | null>(null);
  const [fontNameInput, setFontNameInput] = useState("");
  const [uploadingFont, setUploadingFont] = useState(false);
  const [activeTypoRole, setActiveTypoRole] = useState<
    "primary" | "heading" | "body" | "navigation" | "button" | "productTitle" | "price" | "footer"
  >("heading");
  const [hoverDemoActive, setHoverDemoActive] = useState(false);

  const handleDirectUpload = async (
    file: File | undefined,
    slotKey: string,
    category: MediaAsset["category"],
    altText: string,
    onDone: (url: string) => void
  ) => {
    if (!file || !onUploadFile) return;
    setUploadingSlotKey(slotKey);
    try {
      const url = await onUploadFile(file, category, altText);
      if (url) {
        onDone(url);
        onShowToast(`Uploaded & applied image: ${file.name}`);
      }
    } finally {
      setUploadingSlotKey(null);
    }
  };

  const actionHeader = (title: string, subtitle: string) => (
    <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-[#141413]">{title}</h2>
        <p className="text-xs text-[#5D574F]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#141413] bg-white px-3.5 py-2 text-xs font-bold text-[#141413] hover:bg-[#FAF8F5] cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </button>
        <button
          type="button"
          onClick={onRequestPublish}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 text-xs font-bold text-white hover:bg-[#141413] cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" />
          Publish Live
        </button>
      </div>
    </div>
  );

  // ==========================================
  // 1. HERO SLIDER MANAGER
  // ==========================================
  if (activeSection === "hero-slider") {
    const heroCfg = cmsDraft.heroSettings || INITIAL_CMS_CONFIG.heroSettings;
    const previewHeight =
      heroPreviewViewport === "mobile"
        ? Math.round((heroCfg.heightMobilePx || 440) * 0.42)
        : heroPreviewViewport === "tablet"
        ? Math.round((heroCfg.heightTabletPx || 500) * 0.36)
        : Math.round((heroCfg.heightDesktopPx || 580) * 0.32);

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Hero Slider & Banner Controls",
          "Upload/replace hero images, tune height, width, X/Y focal position, object-fit & zoom, and preview Desktop / Tablet / Mobile framing."
        )}

        {/* Global Hero Settings + Viewport Preview Switcher */}
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDE4] pb-3">
            <span className="font-display text-sm font-bold text-[#141413]">
              Global Hero Dimensions &amp; Responsive Preview
            </span>
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
                    onClick={() => setHeroPreviewViewport(vp.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                      heroPreviewViewport === vp.id ? "bg-[#141413] text-white" : "text-[#5D574F]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {vp.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
            <div>
              <label className="block font-semibold mb-1">Desktop H (px)</label>
              <input
                type="number"
                min={360}
                max={900}
                value={heroCfg.heightDesktopPx}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: { ...heroCfg, heightDesktopPx: Number(e.target.value) || 580 },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tablet H (px)</label>
              <input
                type="number"
                min={340}
                max={820}
                value={heroCfg.heightTabletPx ?? 500}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: { ...heroCfg, heightTabletPx: Number(e.target.value) || 500 },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Mobile H (px)</label>
              <input
                type="number"
                min={320}
                max={760}
                value={heroCfg.heightMobilePx}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: { ...heroCfg, heightMobilePx: Number(e.target.value) || 440 },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Width Mode</label>
              <select
                value={heroCfg.widthMode || "full"}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: {
                      ...heroCfg,
                      widthMode: e.target.value as "full" | "contained",
                    },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              >
                <option value="full">Full Width</option>
                <option value="contained">Contained</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Max Width (%)</label>
              <input
                type="number"
                min={70}
                max={100}
                value={heroCfg.maxWidthPct ?? 100}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: {
                      ...heroCfg,
                      maxWidthPct: Math.min(100, Math.max(70, Number(e.target.value) || 100)),
                    },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Speed (ms)</label>
              <input
                type="number"
                min={2500}
                max={15000}
                step={500}
                value={heroCfg.slideDurationMs}
                onChange={(e) => {
                  const ms = Number(e.target.value) || 5500;
                  onChangeDraft({
                    ...cmsDraft,
                    slideDurationMs: ms,
                    heroSettings: { ...heroCfg, slideDurationMs: ms },
                  });
                }}
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Transition</label>
              <select
                value={heroCfg.transitionEffect}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: {
                      ...heroCfg,
                      transitionEffect: e.target.value as "fade" | "slide" | "zoom",
                    },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              >
                <option value="fade">Smooth Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Cinematic Zoom</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-bold pb-2">
              <input
                type="checkbox"
                checked={heroCfg.autoSlide}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    heroSettings: { ...heroCfg, autoSlide: e.target.checked },
                  })
                }
              />
              Auto-Slide
            </label>
          </div>
        </div>

        {/* Slides List */}
        <div className="space-y-4">
          {cmsDraft.heroSlides.map((slide, idx) => {
            const posX = typeof slide.posX === "number" ? slide.posX : 50;
            const posY =
              typeof slide.posY === "number"
                ? slide.posY
                : slide.focalPoint === "top"
                ? 18
                : slide.focalPoint === "bottom"
                ? 82
                : 50;
            const zoomPct = typeof slide.zoomPercent === "number" ? slide.zoomPercent : 100;
            const fitMode = slide.objectFit || "cover";
            const previewSrc =
              heroPreviewViewport === "mobile" && slide.mobileImageUrl
                ? slide.mobileImageUrl
                : slide.imageUrl;

            return (
              <div
                key={slide.id}
                draggable
                onDragStart={() => setDragSlideIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragSlideIdx === null || dragSlideIdx === idx) return;
                  const copy = [...cmsDraft.heroSlides];
                  const [moved] = copy.splice(dragSlideIdx, 1);
                  copy.splice(idx, 0, moved);
                  onChangeDraft({
                    ...cmsDraft,
                    heroSlides: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                  });
                  setDragSlideIdx(null);
                }}
                className="rounded-2xl border border-[#E7E1D8] bg-white p-5 grid grid-cols-1 lg:grid-cols-12 gap-4"
              >
                <div className="lg:col-span-4 space-y-2.5">
                  <div className="rounded-xl border border-[#E7E1D8] bg-[#141413] p-2 flex justify-center">
                    <div
                      className="relative rounded-lg overflow-hidden bg-[#141413] transition-all"
                      style={{
                        height: `${Math.max(150, previewHeight)}px`,
                        width:
                          heroPreviewViewport === "mobile"
                            ? "190px"
                            : heroPreviewViewport === "tablet"
                            ? "260px"
                            : `${heroCfg.widthMode === "contained" ? heroCfg.maxWidthPct ?? 100 : 100}%`,
                      }}
                    >
                      <img
                        src={previewSrc}
                        alt={slide.title}
                        className="h-full w-full"
                        style={{
                          objectFit: fitMode,
                          objectPosition: `${posX}% ${posY}%`,
                          transform: `scale(${zoomPct / 100})`,
                          transformOrigin: `${posX}% ${posY}%`,
                        }}
                      />
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
                        <GripVertical className="h-3 w-3" /> Slide #{idx + 1} · {heroPreviewViewport}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenImagePicker(
                          (url) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, imageUrl: url } : s
                              ),
                            }),
                          "Hero",
                          `Pick / Replace Desktop Image · Slide ${idx + 1}`
                        )
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Replace Desktop
                    </button>
                    {onUploadFile && (
                      <label className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#9E2A2B] bg-[#FAF8F5] px-2.5 py-1.5 font-semibold text-[#9E2A2B] hover:bg-[#9E2A2B] hover:text-white cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingSlotKey === `hero-d-${slide.id}` ? "Uploading..." : "Upload Desktop"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            handleDirectUpload(f, `hero-d-${slide.id}`, "Hero", slide.title, (url) =>
                              onChangeDraft({
                                ...cmsDraft,
                                heroSlides: cmsDraft.heroSlides.map((s) =>
                                  s.id === slide.id ? { ...s, imageUrl: url } : s
                                ),
                              })
                            );
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenImagePicker(
                          (url) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, mobileImageUrl: url } : s
                              ),
                            }),
                          "Hero",
                          `Pick / Replace Mobile Image · Slide ${idx + 1}`
                        )
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {slide.mobileImageUrl ? "Mobile Set ✓" : "Mobile Image"}
                    </button>
                    {onUploadFile && (
                      <label className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold hover:bg-[#FAF8F5] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingSlotKey === `hero-m-${slide.id}` ? "Uploading..." : "Upload Mobile"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            handleDirectUpload(f, `hero-m-${slide.id}`, "Hero", `${slide.title} Mobile`, (url) =>
                              onChangeDraft({
                                ...cmsDraft,
                                heroSlides: cmsDraft.heroSlides.map((s) =>
                                  s.id === slide.id ? { ...s, mobileImageUrl: url } : s
                                ),
                              })
                            );
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const copy = [...cmsDraft.heroSlides];
                          const [m] = copy.splice(idx, 1);
                          copy.splice(idx - 1, 0, m);
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                          });
                        }}
                        className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === cmsDraft.heroSlides.length - 1}
                        onClick={() => {
                          const copy = [...cmsDraft.heroSlides];
                          const [m] = copy.splice(idx, 1);
                          copy.splice(idx + 1, 0, m);
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                          });
                        }}
                        className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <label className="inline-flex items-center gap-1.5 font-bold">
                        <input
                          type="checkbox"
                          checked={slide.enabled}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, enabled: e.target.checked } : s
                              ),
                            })
                          }
                        />
                        Slide Enabled
                      </label>
                    </div>
                    {cmsDraft.heroSlides.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: cmsDraft.heroSlides.filter((s) => s.id !== slide.id),
                          })
                        }
                        className="inline-flex items-center gap-1 text-rose-600 font-semibold hover:underline cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Slide
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={slide.subtitle}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, subtitle: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="Eyebrow Subtitle"
                      className="rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                    <input
                      type="text"
                      value={slide.title}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, title: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="Hero Headline"
                      className="rounded-lg border border-[#DFD8CE] px-3 py-2 font-bold"
                    />
                  </div>

                  <textarea
                    rows={2}
                    value={slide.description}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        heroSlides: cmsDraft.heroSlides.map((s) =>
                          s.id === slide.id ? { ...s, description: e.target.value } : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />

                  {/* Image Framing Controls: Object Fit, X/Y Positioning, Zoom, Focal Preset */}
                  <div className="rounded-xl border border-[#EFEAE1] bg-[#FAF8F5] p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#141413]">
                        Image Positioning, Crop &amp; Zoom
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: "Portrait Top", posX: 50, posY: 16, focal: "top" as const },
                          { label: "Center", posX: 50, posY: 50, focal: "center" as const },
                          { label: "Lower", posX: 50, posY: 82, focal: "bottom" as const },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              onChangeDraft({
                                ...cmsDraft,
                                heroSlides: cmsDraft.heroSlides.map((s) =>
                                  s.id === slide.id
                                    ? {
                                        ...s,
                                        focalPoint: preset.focal,
                                        posX: preset.posX,
                                        posY: preset.posY,
                                      }
                                    : s
                                ),
                              })
                            }
                            className="rounded border border-[#DFD8CE] bg-white px-2 py-0.5 text-[10px] font-semibold hover:border-[#9E2A2B] cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Object Fit</label>
                        <select
                          value={fitMode}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, objectFit: e.target.value as "cover" | "contain" }
                                  : s
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-[#DFD8CE] bg-white px-2 py-1.5"
                        >
                          <option value="cover">Cover (Fill Frame)</option>
                          <option value="contain">Contain (Full Image)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Horizontal X ({posX}%)</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={posX}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, posX: Number(e.target.value) } : s
                              ),
                            })
                          }
                          className="w-full mt-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Vertical Y ({posY}%)</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={posY}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, posY: Number(e.target.value) } : s
                              ),
                            })
                          }
                          className="w-full mt-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Zoom ({zoomPct}%)</label>
                        <input
                          type="range"
                          min={80}
                          max={160}
                          value={zoomPct}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              heroSlides: cmsDraft.heroSlides.map((s) =>
                                s.id === slide.id ? { ...s, zoomPercent: Number(e.target.value) } : s
                              ),
                            })
                          }
                          className="w-full mt-1.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-semibold mb-1">Focal Anchor</label>
                      <select
                        value={slide.focalPoint || "center"}
                        onChange={(e) => {
                          const fp = e.target.value as HeroSlide["focalPoint"];
                          const mappedY = fp === "top" ? 16 : fp === "bottom" ? 82 : 50;
                          const mappedX = fp === "left" ? 18 : fp === "right" ? 82 : 50;
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: cmsDraft.heroSlides.map((s) =>
                              s.id === slide.id
                                ? { ...s, focalPoint: fp, posX: mappedX, posY: mappedY }
                                : s
                            ),
                          });
                        }}
                        className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                      >
                        <option value="top">Top (Portrait)</option>
                        <option value="center">Center</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">
                        Overlay Dark ({slide.overlayOpacity ?? 65}%)
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={slide.overlayOpacity ?? 65}
                        onChange={(e) =>
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: cmsDraft.heroSlides.map((s) =>
                              s.id === slide.id
                                ? { ...s, overlayOpacity: Number(e.target.value) }
                                : s
                            ),
                          })
                        }
                        className="w-full mt-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Text Alignment</label>
                      <select
                        value={slide.textAlign || "left"}
                        onChange={(e) =>
                          onChangeDraft({
                            ...cmsDraft,
                            heroSlides: cmsDraft.heroSlides.map((s) =>
                              s.id === slide.id
                                ? { ...s, textAlign: e.target.value as "left" | "center" | "right" }
                                : s
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                      >
                        <option value="left">Left Aligned</option>
                        <option value="center">Centered</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={slide.primaryCtaText}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, primaryCtaText: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="Primary CTA Label"
                      className="rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={slide.primaryCtaHref}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, primaryCtaHref: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="/category/men"
                      className="rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-mono"
                    />
                    <input
                      type="text"
                      value={slide.secondaryCtaText}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, secondaryCtaText: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="Secondary CTA"
                      className="rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={slide.secondaryCtaHref}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          heroSlides: cmsDraft.heroSlides.map((s) =>
                            s.id === slide.id ? { ...s, secondaryCtaHref: e.target.value } : s
                          ),
                        })
                      }
                      placeholder="/new-arrivals"
                      className="rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const nextSlide: HeroSlide = {
              id: `slide-${Date.now()}`,
              title: "New THAR STYLE Showcase",
              subtitle: "Mithi Heritage Collection",
              description: "Explore newly crafted ensembles for every generation.",
              imageUrl: "/src/assets/images/thar_hero_sindhi_1794818534180.jpg",
              mobileImageUrl: "",
              focalPoint: "top",
              objectFit: "cover",
              posX: 50,
              posY: 18,
              zoomPercent: 100,
              overlayOpacity: 58,
              textAlign: "left",
              primaryCtaText: "Shop Collection",
              primaryCtaHref: "/new-arrivals",
              secondaryCtaText: "Traditional Sindhi",
              secondaryCtaHref: "/traditional-sindhi-collection",
              enabled: true,
              sortOrder: cmsDraft.heroSlides.length + 1,
            };
            onChangeDraft({ ...cmsDraft, heroSlides: [...cmsDraft.heroSlides, nextSlide] });
          }}
          className="w-full rounded-xl border-2 border-dashed border-[#DFD8CE] bg-white py-3.5 font-bold text-[#141413] hover:border-[#9E2A2B] cursor-pointer"
        >
          + Add New Hero Banner Slide
        </button>
      </div>
    );
  }

  // ==========================================
  // 2. LOGO & BRANDING MANAGER
  // ==========================================
  if (activeSection === "branding") {
    const logo = cmsDraft.logoSettings || INITIAL_CMS_CONFIG.logoSettings;
    const logoSlots: Array<{
      key: keyof typeof logo;
      label: string;
      hint: string;
    }> = [
      { key: "mainLogoUrl", label: "Main Brand Logo", hint: "Default primary store mark" },
      { key: "headerLogoUrl", label: "Header Navigation Logo", hint: "Displayed at top-left/center of navbar" },
      { key: "footerLogoUrl", label: "Footer Logo", hint: "Displayed in dark storefront footer" },
      { key: "mobileLogoUrl", label: "Mobile Compact Logo", hint: "Used on narrow mobile screens" },
      { key: "faviconUrl", label: "Browser Favicon (.ico / .png)", hint: "Tab icon in browser" },
      { key: "adminLogoUrl", label: "Admin Dashboard Logo", hint: "Shown in Super Admin sidebar" },
      { key: "socialShareImageUrl", label: "Social Share / OG Image", hint: "WhatsApp / Facebook preview card" },
    ];

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Logo & Brand Assets Manager",
          "Configure storefront logos, favicon, social share preview image, sizing, alignment, and presentation."
        )}

        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block font-semibold mb-1">Brand Display Name</label>
            <input
              type="text"
              value={cmsDraft.brandName}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  brandName: e.target.value,
                  storeSettings: { ...cmsDraft.storeSettings, storeName: e.target.value },
                })
              }
              className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Logo Width (px)</label>
            <input
              type="number"
              min={20}
              max={240}
              value={logo.logoWidthPx}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  logoSettings: { ...logo, logoWidthPx: Number(e.target.value) || 40 },
                })
              }
              className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Logo Height (px)</label>
            <input
              type="number"
              min={20}
              max={120}
              value={logo.logoHeightPx}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  logoSettings: { ...logo, logoHeightPx: Number(e.target.value) || 36 },
                })
              }
              className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Alignment</label>
              <select
                value={logo.logoAlignment}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    logoSettings: { ...logo, logoAlignment: e.target.value as "left" | "center" },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Style</label>
              <select
                value={logo.logoPresentation}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    logoSettings: {
                      ...logo,
                      logoPresentation: e.target.value as "transparent" | "boxed",
                    },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
              >
                <option value="transparent">Transparent</option>
                <option value="boxed">Boxed Card</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {logoSlots.map((slot) => {
            const val = String(logo[slot.key] || "");
            return (
              <div
                key={slot.key}
                className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-3"
              >
                <div>
                  <p className="font-bold text-[#141413]">{slot.label}</p>
                  <p className="text-[11px] text-[#5D574F]">{slot.hint}</p>
                </div>
                <div className="h-24 rounded-xl border border-[#E7E1D8] bg-[#FAF8F5] flex items-center justify-center overflow-hidden p-2">
                  {val ? (
                    <img src={val} alt={slot.label} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-[#8D857B]">Using Typography Wordmark</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenImagePicker(
                        (url) => {
                          const nextLogo = { ...logo, [slot.key]: url };
                          onChangeDraft({
                            ...cmsDraft,
                            logoSettings: nextLogo,
                            headerLogoUrl:
                              slot.key === "headerLogoUrl" ? url : cmsDraft.headerLogoUrl,
                            footerLogoUrl:
                              slot.key === "footerLogoUrl" ? url : cmsDraft.footerLogoUrl,
                            faviconUrl: slot.key === "faviconUrl" ? url : cmsDraft.faviconUrl,
                          });
                        },
                        "Logos",
                        `Choose ${slot.label}`
                      )
                    }
                    className="flex-1 rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-1.5 font-semibold hover:border-[#9E2A2B] cursor-pointer"
                  >
                    Choose / Upload
                  </button>
                  {val && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft({
                          ...cmsDraft,
                          logoSettings: { ...logo, [slot.key]: "" },
                          headerLogoUrl:
                            slot.key === "headerLogoUrl" ? "" : cmsDraft.headerLogoUrl,
                          footerLogoUrl:
                            slot.key === "footerLogoUrl" ? "" : cmsDraft.footerLogoUrl,
                          faviconUrl: slot.key === "faviconUrl" ? "" : cmsDraft.faviconUrl,
                        })
                      }
                      className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. HEADER & NAVIGATION MANAGER
  // ==========================================
  if (activeSection === "navigation") {
    const navCfg = cmsDraft.navigationSettings || INITIAL_CMS_CONFIG.navigationSettings;
    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Header & Navigation Bar Controls",
          "Customize header height, sticky behavior, utility icon visibility, and add, edit, or reorder menu links."
        )}

        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          <div>
            <label className="block font-semibold mb-1">Header Height (px)</label>
            <input
              type="number"
              min={48}
              max={110}
              value={navCfg.headerHeightPx}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  navigationSettings: { ...navCfg, headerHeightPx: Number(e.target.value) || 64 },
                })
              }
              className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={navCfg.stickyHeader}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  stickyHeader: e.target.checked,
                  navigationSettings: { ...navCfg, stickyHeader: e.target.checked },
                })
              }
            />
            Sticky Header
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={navCfg.showSearchIcon}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  navigationSettings: { ...navCfg, showSearchIcon: e.target.checked },
                })
              }
            />
            Search Icon
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={navCfg.showWishlistIcon}
              onChange={(e) =>
                onChangeDraft({
                  ...cmsDraft,
                  navigationSettings: { ...navCfg, showWishlistIcon: e.target.checked },
                })
              }
            />
            Wishlist Icon
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={navCfg.showCartIcon}
              onChange={(e) => {
                if (!e.target.checked) {
                  setConfirmHideNavIcon({ key: "showCartIcon", label: "Shopping Bag / Cart Icon" });
                } else {
                  onChangeDraft({
                    ...cmsDraft,
                    navigationSettings: { ...navCfg, showCartIcon: true },
                  });
                }
              }}
            />
            Shopping Bag Icon
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={navCfg.showAccountIcon}
              onChange={(e) => {
                if (!e.target.checked) {
                  setConfirmHideNavIcon({
                    key: "showAccountIcon",
                    label: "Customer Account / Sign In Icon",
                  });
                } else {
                  onChangeDraft({
                    ...cmsDraft,
                    navigationSettings: { ...navCfg, showAccountIcon: true },
                  });
                }
              }}
            />
            Account / Login
          </label>
        </div>

        {/* Nav Links Table */}
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold">Menu Items ({cmsDraft.navLinks.length})</h3>
            <button
              type="button"
              onClick={() =>
                onChangeDraft({
                  ...cmsDraft,
                  navLinks: [
                    ...cmsDraft.navLinks,
                    { id: `nav-${Date.now()}`, label: "New Link", href: "/categories", visible: true },
                  ],
                })
              }
              className="inline-flex items-center gap-1 rounded-lg bg-[#141413] px-3 py-1.5 font-bold text-white cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Menu Item
            </button>
          </div>
          <div className="space-y-2">
            {cmsDraft.navLinks.map((lnk, idx) => (
              <div
                key={lnk.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-[#F2EDE4] p-2.5"
              >
                <label className="sm:col-span-2 inline-flex items-center gap-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={lnk.visible}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        navLinks: cmsDraft.navLinks.map((n) =>
                          n.id === lnk.id ? { ...n, visible: e.target.checked } : n
                        ),
                      })
                    }
                  />
                  Visible
                </label>
                <input
                  type="text"
                  value={lnk.label}
                  onChange={(e) =>
                    onChangeDraft({
                      ...cmsDraft,
                      navLinks: cmsDraft.navLinks.map((n) =>
                        n.id === lnk.id ? { ...n, label: e.target.value } : n
                      ),
                    })
                  }
                  className="sm:col-span-4 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-semibold"
                />
                <input
                  type="text"
                  value={lnk.href}
                  onChange={(e) =>
                    onChangeDraft({
                      ...cmsDraft,
                      navLinks: cmsDraft.navLinks.map((n) =>
                        n.id === lnk.id ? { ...n, href: e.target.value } : n
                      ),
                    })
                  }
                  className="sm:col-span-4 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-mono"
                />
                <div className="sm:col-span-2 flex justify-end gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const copy = [...cmsDraft.navLinks];
                      const [m] = copy.splice(idx, 1);
                      copy.splice(idx - 1, 0, m);
                      onChangeDraft({ ...cmsDraft, navLinks: copy });
                    }}
                    className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === cmsDraft.navLinks.length - 1}
                    onClick={() => {
                      const copy = [...cmsDraft.navLinks];
                      const [m] = copy.splice(idx, 1);
                      copy.splice(idx + 1, 0, m);
                      onChangeDraft({ ...cmsDraft, navLinks: copy });
                    }}
                    className="rounded border border-[#DFD8CE] p-1 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDraft({
                        ...cmsDraft,
                        navLinks: cmsDraft.navLinks.filter((n) => n.id !== lnk.id),
                      })
                    }
                    className="rounded border border-rose-200 p-1 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety confirmation for hiding critical ecommerce header icons */}
        {confirmHideNavIcon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold">
                    Hide {confirmHideNavIcon.label}?
                  </h3>
                  <p className="text-[#5D574F] mt-1">
                    Hiding this navigation element may prevent visitors from accessing their shopping bag or signing in from the header.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmHideNavIcon(null)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Keep Visible
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeDraft({
                      ...cmsDraft,
                      navigationSettings: { ...navCfg, [confirmHideNavIcon.key]: false },
                    });
                    setConfirmHideNavIcon(null);
                  }}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-bold text-white cursor-pointer"
                >
                  Confirm Hide
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 4. FOOTER MANAGER
  // ==========================================
  if (activeSection === "footer") {
    const ftr = cmsDraft.footerSettings || INITIAL_CMS_CONFIG.footerSettings;
    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Footer & Link Columns Customizer",
          "Edit footer brand blurb, custom link columns, payment badges visibility, and copyright statement."
        )}

        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={ftr.visible}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    footerSettings: { ...ftr, visible: e.target.checked },
                  })
                }
              />
              Show Storefront Footer
            </label>
            <label className="inline-flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={ftr.showPaymentIcons}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    footerSettings: { ...ftr, showPaymentIcons: e.target.checked },
                  })
                }
              />
              Show Payment Badges (COD / JazzCash / Easypaisa)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Footer Logo Size (px):</span>
              <input
                type="number"
                min={20}
                max={90}
                value={ftr.logoSizePx}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    footerSettings: { ...ftr, logoSizePx: Number(e.target.value) || 36 },
                  })
                }
                className="w-20 rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Footer About Text</label>
              <textarea
                rows={2}
                value={ftr.aboutText}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    footerSettings: { ...ftr, aboutText: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Copyright Bar Text</label>
              <input
                type="text"
                value={ftr.copyrightText}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    footerCopyright: e.target.value,
                    footerSettings: { ...ftr, copyrightText: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ftr.columns.map((col) => (
            <div key={col.id} className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={col.title}
                  onChange={(e) =>
                    onChangeDraft({
                      ...cmsDraft,
                      footerSettings: {
                        ...ftr,
                        columns: ftr.columns.map((c) =>
                          c.id === col.id ? { ...c, title: e.target.value } : c
                        ),
                      },
                    })
                  }
                  className="rounded-lg border border-[#DFD8CE] px-3 py-1.5 font-bold flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChangeDraft({
                      ...cmsDraft,
                      footerSettings: {
                        ...ftr,
                        columns: ftr.columns.filter((c) => c.id !== col.id),
                      },
                    })
                  }
                  className="rounded-lg border border-rose-200 p-1.5 text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {col.links.map((lk) => (
                  <div key={lk.id} className="grid grid-cols-11 gap-1.5 items-center">
                    <input
                      type="text"
                      value={lk.label}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          footerSettings: {
                            ...ftr,
                            columns: ftr.columns.map((c) =>
                              c.id === col.id
                                ? {
                                    ...c,
                                    links: c.links.map((x) =>
                                      x.id === lk.id ? { ...x, label: e.target.value } : x
                                    ),
                                  }
                                : c
                            ),
                          },
                        })
                      }
                      className="col-span-5 rounded border border-[#DFD8CE] px-2 py-1"
                    />
                    <input
                      type="text"
                      value={lk.href}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          footerSettings: {
                            ...ftr,
                            columns: ftr.columns.map((c) =>
                              c.id === col.id
                                ? {
                                    ...c,
                                    links: c.links.map((x) =>
                                      x.id === lk.id ? { ...x, href: e.target.value } : x
                                    ),
                                  }
                                : c
                            ),
                          },
                        })
                      }
                      className="col-span-5 rounded border border-[#DFD8CE] px-2 py-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft({
                          ...cmsDraft,
                          footerSettings: {
                            ...ftr,
                            columns: ftr.columns.map((c) =>
                              c.id === col.id
                                ? { ...c, links: c.links.filter((x) => x.id !== lk.id) }
                                : c
                            ),
                          },
                        })
                      }
                      className="col-span-1 text-rose-600 flex justify-center cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChangeDraft({
                      ...cmsDraft,
                      footerSettings: {
                        ...ftr,
                        columns: ftr.columns.map((c) =>
                          c.id === col.id
                            ? {
                                ...c,
                                links: [
                                  ...c.links,
                                  { id: `fl-${Date.now()}`, label: "New Link", href: "/categories" },
                                ],
                              }
                            : c
                        ),
                      },
                    })
                  }
                  className="rounded-lg border border-dashed border-[#DFD8CE] px-3 py-1.5 font-semibold w-full hover:border-[#9E2A2B] cursor-pointer"
                >
                  + Add Link to Column
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            onChangeDraft({
              ...cmsDraft,
              footerSettings: {
                ...ftr,
                columns: [
                  ...ftr.columns,
                  {
                    id: `fcol-${Date.now()}`,
                    title: "New Footer Column",
                    links: [{ id: `fl-${Date.now()}`, label: "Shop All", href: "/categories" }],
                  },
                ],
              },
            })
          }
          className="rounded-xl border-2 border-dashed border-[#DFD8CE] bg-white py-3 font-bold w-full hover:border-[#9E2A2B] cursor-pointer"
        >
          + Add New Footer Column
        </button>
      </div>
    );
  }

  // ==========================================
  // 5. COLORS & THEME MANAGER
  // ==========================================
  if (activeSection === "colors") {
    const tc = cmsDraft.themeColors || DEFAULT_THEME_COLORS;
    const colorGroups: Array<{
      group: string;
      fields: Array<{ key: keyof ThemeColorsConfig; label: string }>;
    }> = [
      {
        group: "Header & Top Navigation",
        fields: [
          { key: "headerBg", label: "Header Background" },
          { key: "headerText", label: "Header Text" },
          { key: "headerIcon", label: "Header Icons" },
          { key: "headerBorder", label: "Header Border" },
          { key: "navbarBg", label: "Navbar Background" },
          { key: "navbarText", label: "Navbar Text" },
          { key: "navbarHover", label: "Navbar Hover" },
          { key: "navbarActive", label: "Navbar Active" },
          { key: "dropdownBg", label: "Dropdown Bg" },
          { key: "dropdownText", label: "Dropdown Text" },
          { key: "dropdownHover", label: "Dropdown Hover" },
        ],
      },
      {
        group: "Hero Banner Overlay & CTAs",
        fields: [
          { key: "heroOverlay", label: "Hero Overlay" },
          { key: "heroTitle", label: "Hero Title" },
          { key: "heroSubtitle", label: "Hero Subtitle" },
          { key: "heroButtonBg", label: "Hero Button Bg" },
          { key: "heroButtonText", label: "Hero Button Text" },
        ],
      },
      {
        group: "Body, Sections & Cards",
        fields: [
          { key: "pageBg", label: "Page Background" },
          { key: "sectionBg", label: "Section Alternate Bg" },
          { key: "cardBg", label: "Product Card Bg" },
          { key: "primaryText", label: "Primary Text" },
          { key: "secondaryText", label: "Secondary Text" },
          { key: "borderColor", label: "Border Color" },
        ],
      },
      {
        group: "Buttons & Calls to Action",
        fields: [
          { key: "primaryButtonBg", label: "Primary Button Bg" },
          { key: "primaryButtonHover", label: "Primary Button Hover" },
          { key: "secondaryButtonBg", label: "Secondary Button Bg" },
          { key: "secondaryButtonHover", label: "Secondary Button Hover" },
          { key: "buttonText", label: "Button Text" },
        ],
      },
      {
        group: "Footer Palette",
        fields: [
          { key: "footerBg", label: "Footer Background" },
          { key: "footerHeading", label: "Footer Headings" },
          { key: "footerText", label: "Footer Body Text" },
          { key: "footerLinks", label: "Footer Links" },
          { key: "footerLinkHover", label: "Footer Link Hover" },
          { key: "footerBorder", label: "Footer Border" },
        ],
      },
      {
        group: "Badges, Prices & Status",
        fields: [
          { key: "saleBadge", label: "Sale / Accent Badge" },
          { key: "discountBadge", label: "Discount Badge" },
          { key: "priceText", label: "Product Price Text" },
          { key: "ratingStars", label: "Rating Stars" },
          { key: "successColor", label: "Success Accent" },
          { key: "warningColor", label: "Warning Accent" },
          { key: "errorColor", label: "Error Accent" },
        ],
      },
    ];

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Colors & Theme Variables Manager",
          "Fine-tune every semantic color token across Header, Hero, Body, Cards, Buttons, Footer, and Status Badges."
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmResetTheme(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All Colors to THAR STYLE Defaults
          </button>
        </div>

        <div className="space-y-5">
          {colorGroups.map((grp) => (
            <div key={grp.group} className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-[#F2EDE4] pb-2">
                <Palette className="h-4 w-4 text-[#9E2A2B]" />
                <h3 className="font-display text-base font-bold text-[#141413]">{grp.group}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grp.fields.map((f) => {
                  const val = tc[f.key] || DEFAULT_THEME_COLORS[f.key];
                  return (
                    <div
                      key={f.key}
                      className="rounded-xl border border-[#F2EDE4] bg-[#FAF8F5] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#141413]">{f.label}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeDraft({
                              ...cmsDraft,
                              themeColors: { ...tc, [f.key]: DEFAULT_THEME_COLORS[f.key] },
                            })
                          }
                          className="text-[10px] font-semibold text-[#8E6B35] hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={val}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              themeColors: { ...tc, [f.key]: e.target.value },
                            })
                          }
                          className="h-9 w-11 rounded-lg border border-[#DFD8CE] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            onChangeDraft({
                              ...cmsDraft,
                              themeColors: { ...tc, [f.key]: e.target.value },
                            })
                          }
                          className="w-24 rounded-lg border border-[#DFD8CE] bg-white px-2 py-1.5 font-mono uppercase"
                        />
                        <span className="text-[10px] text-[#5D574F] font-mono truncate">
                          rgb({hexToRgbString(val)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {confirmResetTheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                Reset All Theme Colors?
              </h3>
              <p className="text-[#5D574F]">
                This restores every header, hero, button, card, and footer color in your draft back to the signature THAR STYLE desert ivory, charcoal, and Sindhi crimson palette.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetTheme(false)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeDraft({
                      ...cmsDraft,
                      themeColors: { ...DEFAULT_THEME_COLORS },
                    });
                    setConfirmResetTheme(false);
                    onShowToast("Theme colors reset to THAR STYLE defaults in Draft.");
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 6. FONTS & TYPOGRAPHY MANAGER
  // ==========================================
  if (activeSection === "typography") {
    const ty = cmsDraft.typography || DEFAULT_TYPOGRAPHY;
    const roles: Array<{
      key:
        | "primary"
        | "heading"
        | "body"
        | "navigation"
        | "button"
        | "productTitle"
        | "price"
        | "footer";
      label: string;
    }> = [
      { key: "heading", label: "Section Headings" },
      { key: "body", label: "Body & Paragraphs" },
      { key: "primary", label: "Primary Brand Display" },
      { key: "navigation", label: "Navigation Menu" },
      { key: "button", label: "Buttons & CTAs" },
      { key: "productTitle", label: "Product Card Titles" },
      { key: "price", label: "Product Prices" },
      { key: "footer", label: "Footer Copy" },
    ];
    const roleCfg: TypographyRoleConfig = ty[activeTypoRole] || DEFAULT_TYPOGRAPHY[activeTypoRole];

    const updateRole = (patch: Partial<TypographyRoleConfig>) => {
      onChangeDraft({
        ...cmsDraft,
        headingFont:
          activeTypoRole === "heading" && patch.fontFamily
            ? (patch.fontFamily as CmsConfig["headingFont"])
            : cmsDraft.headingFont,
        bodyFont:
          activeTypoRole === "body" && patch.fontFamily
            ? (patch.fontFamily as CmsConfig["bodyFont"])
            : cmsDraft.bodyFont,
        typography: {
          ...ty,
          [activeTypoRole]: { ...roleCfg, ...patch },
        },
      });
    };

    const handleUploadCustomFont = async (file: File) => {
      setUploadingFont(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/api/uploads/font", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              dataUrl: String(reader.result || ""),
              fileName: file.name,
              fontName: fontNameInput.trim() || file.name.replace(/\.\w+$/, ""),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Font upload failed");
          onChangeDraft({
            ...cmsDraft,
            typography: {
              ...ty,
              customFonts: [data.font, ...(ty.customFonts || [])],
            },
          });
          setFontNameInput("");
          onShowToast(`Custom font "${data.font.name}" uploaded.`);
        } catch (err: unknown) {
          onShowToast(err instanceof Error ? err.message : "Could not upload custom font.");
        } finally {
          setUploadingFont(false);
        }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Fonts & Typography Scale Manager",
          "Configure Google Fonts, custom uploaded fonts (.woff2/.ttf/.otf), and responsive sizes across Desktop, Tablet, and Mobile."
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Role Selector + Custom Font Uploader */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-2">
              <p className="font-bold text-[#141413] mb-2">Typography Roles</p>
              {roles.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActiveTypoRole(r.key)}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold cursor-pointer ${
                    activeTypoRole === r.key
                      ? "bg-[#141413] text-white"
                      : "bg-[#FAF8F5] text-[#141413] hover:bg-[#F2EDE4]"
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="text-[10px] opacity-80">
                    {ty[r.key]?.fontFamily} · {ty[r.key]?.desktopSizePx}px
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-[#9E2A2B]" />
                <h3 className="font-bold text-[#141413]">Upload Custom Font</h3>
              </div>
              <input
                type="text"
                value={fontNameInput}
                onChange={(e) => setFontNameInput(e.target.value)}
                placeholder="Font Family Name (e.g. TharDisplay)"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
              <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#DFD8CE] bg-[#FAF8F5] py-2.5 font-bold cursor-pointer hover:border-[#9E2A2B]">
                <Upload className="h-3.5 w-3.5" />
                {uploadingFont ? "Uploading..." : "Upload .woff2 / .woff / .ttf / .otf"}
                <input
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadCustomFont(f);
                  }}
                />
              </label>
              {(ty.customFonts || []).length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-semibold text-[#5D574F]">Uploaded Fonts:</p>
                  {ty.customFonts.map((cf) => (
                    <div
                      key={cf.id}
                      className="flex items-center justify-between rounded bg-[#FAF8F5] px-2.5 py-1 text-[11px]"
                    >
                      <span className="font-bold">{cf.name}</span>
                      <span className="text-[#8D857B]">{cf.format}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role Inspector + Live Specimen */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                <h3 className="font-display text-base font-bold text-[#141413]">
                  Editing: {roles.find((r) => r.key === activeTypoRole)?.label}
                </h3>
                <button
                  type="button"
                  onClick={() => updateRole(DEFAULT_TYPOGRAPHY[activeTypoRole])}
                  className="text-[#8E6B35] font-semibold hover:underline cursor-pointer"
                >
                  Reset Role Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Font Family</label>
                  <select
                    value={roleCfg.fontFamily}
                    onChange={(e) => updateRole({ fontFamily: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  >
                    {AVAILABLE_GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    {(ty.customFonts || []).map((cf) => (
                      <option key={cf.id} value={cf.name}>
                        {cf.name} (Custom)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Font Weight</label>
                  <select
                    value={roleCfg.fontWeight}
                    onChange={(e) =>
                      updateRole({ fontWeight: e.target.value as TypographyRoleConfig["fontWeight"] })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  >
                    <option value="400">400 Regular</option>
                    <option value="500">500 Medium</option>
                    <option value="600">600 Semibold</option>
                    <option value="700">700 Bold</option>
                    <option value="800">800 Extrabold</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Style & Color</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={roleCfg.fontStyle}
                      onChange={(e) =>
                        updateRole({ fontStyle: e.target.value as "normal" | "italic" })
                      }
                      className="rounded-lg border border-[#DFD8CE] px-2.5 py-2 flex-1"
                    >
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                    <input
                      type="color"
                      value={roleCfg.color}
                      onChange={(e) => updateRole({ color: e.target.value })}
                      className="h-9 w-11 rounded border border-[#DFD8CE]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Desktop Size (px)</label>
                  <input
                    type="number"
                    min={10}
                    max={72}
                    value={roleCfg.desktopSizePx}
                    onChange={(e) => updateRole({ desktopSizePx: Number(e.target.value) || 15 })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tablet Size (px)</label>
                  <input
                    type="number"
                    min={10}
                    max={64}
                    value={roleCfg.tabletSizePx}
                    onChange={(e) => updateRole({ tabletSizePx: Number(e.target.value) || 14 })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mobile Size (px)</label>
                  <input
                    type="number"
                    min={10}
                    max={48}
                    value={roleCfg.mobileSizePx}
                    onChange={(e) => updateRole({ mobileSizePx: Number(e.target.value) || 13 })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Line Height</label>
                  <input
                    type="text"
                    value={roleCfg.lineHeight}
                    onChange={(e) => updateRole({ lineHeight: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Letter Spacing</label>
                  <input
                    type="text"
                    value={roleCfg.letterSpacing}
                    onChange={(e) => updateRole({ letterSpacing: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Transform</label>
                  <select
                    value={roleCfg.textTransform}
                    onChange={(e) =>
                      updateRole({
                        textTransform: e.target.value as TypographyRoleConfig["textTransform"],
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
                  >
                    <option value="none">None</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Decoration</label>
                  <select
                    value={roleCfg.textDecoration}
                    onChange={(e) =>
                      updateRole({ textDecoration: e.target.value as "none" | "underline" })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-2"
                  >
                    <option value="none">None</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Specimen Preview */}
            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8D857B]">
                Live Typography Preview
              </p>
              <div
                className="rounded-xl border border-[#F2EDE4] bg-[#FAF8F5] p-5"
                style={{
                  fontFamily: `'${roleCfg.fontFamily}', serif`,
                  fontSize: `${roleCfg.desktopSizePx}px`,
                  fontWeight: roleCfg.fontWeight,
                  fontStyle: roleCfg.fontStyle,
                  color: roleCfg.color,
                  lineHeight: roleCfg.lineHeight,
                  letterSpacing: roleCfg.letterSpacing,
                  textTransform: roleCfg.textTransform,
                  textDecoration: roleCfg.textDecoration,
                }}
              >
                THAR STYLE · Heritage Apparel & Sindhi Craft from Mithi, Tharparkar
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 7. MARQUEE & ANNOUNCEMENTS MANAGER
  // ==========================================
  if (activeSection === "marquee") {
    const items = cmsDraft.announcements || [];
    const updateItem = (id: string, patch: Partial<AnnouncementItem>) => {
      const next = items.map((a) => (a.id === id ? { ...a, ...patch } : a));
      onChangeDraft({
        ...cmsDraft,
        announcements: next,
        announcementEnabled: next.some((x) => x.enabled),
        announcementText: next[0]?.text || cmsDraft.announcementText,
      });
    };

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Marquee & Promotional Announcements Manager",
          "Schedule scrolling or static announcement bars with custom colors, speed, direction, links, and device visibility."
        )}

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
              {/* Live Mini Bar */}
              <div
                className="rounded-lg px-4 py-2 overflow-hidden whitespace-nowrap"
                style={{
                  backgroundColor: item.bgColor,
                  color: item.textColor,
                  fontSize: `${item.fontSizePx}px`,
                  fontWeight: item.fontWeight,
                }}
              >
                {item.mode === "scroll" ? `⇄ Scrolling (${item.scrollDirection}): ` : ""}
                {item.text}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#8E6B35]">Announcement #{idx + 1}</span>
                  <label className="inline-flex items-center gap-1.5 font-bold">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateItem(item.id, { enabled: e.target.checked })}
                    />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={item.showOnDesktop}
                      onChange={(e) => updateItem(item.id, { showOnDesktop: e.target.checked })}
                    />
                    Desktop
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={item.showOnMobile}
                      onChange={(e) => updateItem(item.id, { showOnMobile: e.target.checked })}
                    />
                    Mobile
                  </label>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDraft({
                        ...cmsDraft,
                        announcements: items.filter((a) => a.id !== item.id),
                      })
                    }
                    className="inline-flex items-center gap-1 text-rose-600 font-semibold cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8">
                  <label className="block font-semibold mb-1">Announcement Message</label>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateItem(item.id, { text: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block font-semibold mb-1">Click Link Route</label>
                  <input
                    type="text"
                    value={item.linkHref}
                    onChange={(e) => updateItem(item.id, { linkHref: e.target.value })}
                    placeholder="/sale or /new-arrivals"
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Mode</label>
                  <select
                    value={item.mode}
                    onChange={(e) =>
                      updateItem(item.id, { mode: e.target.value as "scroll" | "static" })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1.5"
                  >
                    <option value="scroll">Scroll Marquee</option>
                    <option value="static">Static Centered</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Direction</label>
                  <select
                    value={item.scrollDirection}
                    onChange={(e) =>
                      updateItem(item.id, { scrollDirection: e.target.value as "left" | "right" })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1.5"
                  >
                    <option value="left">Right to Left</option>
                    <option value="right">Left to Right</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Speed ({item.scrollSpeedSec}s)</label>
                  <input
                    type="number"
                    min={8}
                    max={60}
                    value={item.scrollSpeedSec}
                    onChange={(e) =>
                      updateItem(item.id, { scrollSpeedSec: Number(e.target.value) || 24 })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Bg Color</label>
                  <input
                    type="color"
                    value={item.bgColor}
                    onChange={(e) => updateItem(item.id, { bgColor: e.target.value })}
                    className="h-8 w-full rounded border border-[#DFD8CE]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Text Color</label>
                  <input
                    type="color"
                    value={item.textColor}
                    onChange={(e) => updateItem(item.id, { textColor: e.target.value })}
                    className="h-8 w-full rounded border border-[#DFD8CE]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={item.startDate}
                    onChange={(e) => updateItem(item.id, { startDate: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={item.endDate}
                    onChange={(e) => updateItem(item.id, { endDate: e.target.value })}
                    className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            const newAnn: AnnouncementItem = {
              id: `ann-${Date.now()}`,
              text: "Festive Eid & Traditional Sindhi Collection Now Available · Free Shipping Over Rs. 5,000",
              linkHref: "/sale",
              textColor: "#FFFFFF",
              bgColor: "#141413",
              fontSizePx: 12,
              fontWeight: "600",
              mode: "scroll",
              scrollDirection: "left",
              scrollSpeedSec: 24,
              enabled: true,
              startDate: "",
              endDate: "",
              showOnDesktop: true,
              showOnMobile: true,
            };
            onChangeDraft({ ...cmsDraft, announcements: [...items, newAnn] });
          }}
          className="w-full rounded-xl border-2 border-dashed border-[#DFD8CE] bg-white py-3.5 font-bold hover:border-[#9E2A2B] cursor-pointer"
        >
          + Add New Announcement Banner
        </button>
      </div>
    );
  }

  // ==========================================
  // 8. ANIMATIONS & EFFECTS MANAGER
  // ==========================================
  if (activeSection === "animations") {
    const anim = cmsDraft.animationSettings || INITIAL_CMS_CONFIG.animationSettings;
    const animRows: Array<{ key: keyof AnimationSettingsConfig; label: string; desc: string }> = [
      { key: "heroTransition", label: "Hero Slide Transition", desc: "Slide entrance and banner transition timing" },
      { key: "productCardHover", label: "Product Card Hover Effect", desc: "Elevation and shadow on product card hover" },
      { key: "imageZoom", label: "Product Image Hover Zoom", desc: "Gentle scale zoom on garment photos" },
      { key: "buttonHover", label: "CTA Button Hover Motion", desc: "Tactile lift/scale on primary buttons" },
      { key: "scrollReveal", label: "Scroll Reveal Transitions", desc: "Fade/slide reveal while scrolling sections" },
      { key: "sectionEntrance", label: "Section Entrance", desc: "Entrance curve for storefront blocks" },
      { key: "marqueeMotion", label: "Announcement Marquee Motion", desc: "Horizontal scrolling announcement speed" },
      { key: "pageTransition", label: "Page Navigation Transition", desc: "Smooth fade between storefront views" },
    ];

    const updateAnim = (key: keyof AnimationSettingsConfig, patch: Partial<AnimationEffectConfig>) => {
      onChangeDraft({
        ...cmsDraft,
        animationSettings: {
          ...anim,
          [key]: { ...anim[key], ...patch },
        },
      });
    };

    return (
      <div className="space-y-5 text-xs">
        {actionHeader(
          "Animations & Interactive Motion Effects",
          "Toggle individual animations on/off, select motion styles, tune duration/delays, and preview interactions live."
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-3">
            {animRows.map((row) => {
              const cfg = anim[row.key];
              return (
                <div
                  key={row.key}
                  className="rounded-2xl border border-[#E7E1D8] bg-white p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-5">
                    <label className="inline-flex items-center gap-2 font-bold text-[#141413]">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => updateAnim(row.key, { enabled: e.target.checked })}
                      />
                      {row.label}
                    </label>
                    <p className="text-[11px] text-[#5D574F] pl-5">{row.desc}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={cfg.type}
                      onChange={(e) =>
                        updateAnim(row.key, { type: e.target.value as AnimationEffectConfig["type"] })
                      }
                      className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                    >
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="scale">Scale</option>
                      <option value="lift">Lift</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#5D574F]">Duration (ms)</label>
                    <input
                      type="number"
                      min={0}
                      max={60000}
                      step={50}
                      value={cfg.durationMs}
                      onChange={(e) => updateAnim(row.key, { durationMs: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#5D574F]">Delay (ms)</label>
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      step={50}
                      value={cfg.delayMs}
                      onChange={(e) => updateAnim(row.key, { delayMs: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-[#DFD8CE] px-2 py-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Live Animation Preview Box */}
          <div className="lg:col-span-4 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Interactive Motion Sandbox</h3>
              <Sparkles className="h-4 w-4 text-[#9E2A2B]" />
            </div>
            <p className="text-[11px] text-[#5D574F]">
              Hover over the garment card or toggle preview state below to inspect your exact animation timing:
            </p>
            <div
              onMouseEnter={() => setHoverDemoActive(true)}
              onMouseLeave={() => setHoverDemoActive(false)}
              className="rounded-xl border border-[#E7E1D8] bg-[#FAF8F5] overflow-hidden cursor-pointer"
              style={{
                transitionProperty: "transform, box-shadow",
                transitionDuration: `${anim.productCardHover.enabled ? anim.productCardHover.durationMs : 0}ms`,
                transform:
                  hoverDemoActive && anim.productCardHover.enabled
                    ? anim.productCardHover.type === "scale"
                      ? "scale(1.02)"
                      : "translateY(-4px)"
                    : "none",
                boxShadow:
                  hoverDemoActive && anim.productCardHover.enabled
                    ? "0 14px 26px rgba(20,20,19,0.12)"
                    : "none",
              }}
            >
              <div className="h-44 overflow-hidden bg-white">
                <img
                  src="/src/assets/images/prod_ajrak_shawl_1794818534620.jpg"
                  alt="Preview Garment"
                  className="h-full w-full object-cover"
                  style={{
                    transitionProperty: "transform",
                    transitionDuration: `${anim.imageZoom.enabled ? anim.imageZoom.durationMs : 0}ms`,
                    transform:
                      hoverDemoActive && anim.imageZoom.enabled ? "scale(1.07)" : "scale(1)",
                  }}
                />
              </div>
              <div className="p-3.5 space-y-2">
                <p className="font-display font-bold text-[#141413]">
                  Handcrafted Mithi Ajrak Shawl
                </p>
                <button
                  type="button"
                  onClick={() => setHoverDemoActive((v) => !v)}
                  className="w-full rounded-lg bg-[#141413] py-2 font-bold text-white"
                  style={{
                    transitionProperty: "transform, background-color",
                    transitionDuration: `${anim.buttonHover.enabled ? anim.buttonHover.durationMs : 0}ms`,
                    transform:
                      hoverDemoActive && anim.buttonHover.enabled ? "translateY(-1px)" : "none",
                  }}
                >
                  {hoverDemoActive ? "Reset Sandbox" : "Trigger Hover Preview"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 9. HOMEPAGE SECTIONS MANAGER
  // ==========================================
  return (
    <div className="space-y-5 text-xs">
      {actionHeader(
        "Homepage Sections & Layout Manager",
        "Drag-and-drop to reorder homepage sections, toggle visibility, customize titles, backgrounds, or add custom editorial blocks."
      )}

      <div className="space-y-3">
        {cmsDraft.sections.map((sec, idx) => (
          <div
            key={sec.id}
            draggable
            onDragStart={() => setDragSecIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragSecIdx === null || dragSecIdx === idx) return;
              const copy = [...cmsDraft.sections];
              const [moved] = copy.splice(dragSecIdx, 1);
              copy.splice(idx, 0, moved);
              onChangeDraft({
                ...cmsDraft,
                sections: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
              });
              setDragSecIdx(null);
            }}
            className="rounded-2xl border border-[#E7E1D8] bg-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <GripVertical className="h-4 w-4 text-[#8D857B] cursor-grab" />
                <label className="inline-flex items-center gap-1.5 font-bold">
                  <input
                    type="checkbox"
                    checked={sec.enabled}
                    onChange={(e) => {
                      if (!e.target.checked && sec.isSystem) {
                        setConfirmHideSystemSection(sec);
                      } else {
                        onChangeDraft({
                          ...cmsDraft,
                          sections: cmsDraft.sections.map((s) =>
                            s.id === sec.id ? { ...s, enabled: e.target.checked } : s
                          ),
                        });
                      }
                    }}
                  />
                  Visible
                </label>
                <span className="rounded bg-[#FAF8F5] border border-[#E7E1D8] px-2 py-0.5 text-[10px] font-mono text-[#5D574F]">
                  #{idx + 1} · {sec.key}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => {
                    const copy = [...cmsDraft.sections];
                    const [m] = copy.splice(idx, 1);
                    copy.splice(idx - 1, 0, m);
                    onChangeDraft({
                      ...cmsDraft,
                      sections: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                    });
                  }}
                  className="rounded border border-[#DFD8CE] p-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === cmsDraft.sections.length - 1}
                  onClick={() => {
                    const copy = [...cmsDraft.sections];
                    const [m] = copy.splice(idx, 1);
                    copy.splice(idx + 1, 0, m);
                    onChangeDraft({
                      ...cmsDraft,
                      sections: copy.map((s, i) => ({ ...s, sortOrder: i + 1 })),
                    });
                  }}
                  className="rounded border border-[#DFD8CE] p-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                {!sec.isSystem && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDraft({
                        ...cmsDraft,
                        sections: cmsDraft.sections.filter((s) => s.id !== sec.id),
                      })
                    }
                    className="rounded border border-rose-200 p-1.5 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block font-semibold mb-1">Section Title</label>
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) =>
                    onChangeDraft({
                      ...cmsDraft,
                      sections: cmsDraft.sections.map((s) =>
                        s.id === sec.id ? { ...s, title: e.target.value } : s
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-1.5 font-bold"
                />
              </div>
              <div className="md:col-span-6">
                <label className="block font-semibold mb-1">Subtitle / Copy</label>
                <input
                  type="text"
                  value={sec.subtitle}
                  onChange={(e) =>
                    onChangeDraft({
                      ...cmsDraft,
                      sections: cmsDraft.sections.map((s) =>
                        s.id === sec.id ? { ...s, subtitle: e.target.value } : s
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">Bg Override</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={sec.backgroundColor || "#FAF8F5"}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        sections: cmsDraft.sections.map((s) =>
                          s.id === sec.id ? { ...s, backgroundColor: e.target.value } : s
                        ),
                      })
                    }
                    className="h-8 w-10 rounded border border-[#DFD8CE]"
                  />
                  {sec.backgroundColor && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft({
                          ...cmsDraft,
                          sections: cmsDraft.sections.map((s) =>
                            s.id === sec.id ? { ...s, backgroundColor: "" } : s
                          ),
                        })
                      }
                      className="text-[10px] text-[#8E6B35] underline cursor-pointer"
                    >
                      Auto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {sec.key === "sindhi_thari" && (
              <div className="pt-3 border-t border-[#F2EDE4] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Explore Button Text</label>
                    <input
                      type="text"
                      value={sec.ctaText || "Explore Collection"}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          sections: cmsDraft.sections.map((s) =>
                            s.id === sec.id ? { ...s, ctaText: e.target.value } : s
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Explore Button Route</label>
                    <input
                      type="text"
                      value={sec.ctaHref || "/traditional-sindhi-collection"}
                      onChange={(e) =>
                        onChangeDraft({
                          ...cmsDraft,
                          sections: cmsDraft.sections.map((s) =>
                            s.id === sec.id ? { ...s, ctaHref: e.target.value } : s
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      Traditional Sindhi &amp; Thari Cultural Cards ({(sec.collectionCards || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newCard: HeritageCollectionCard = {
                          id: `card-${Date.now()}`,
                          title: "New Sindhi Cultural Collection",
                          subtitle: "Authentic artisan craft from Mithi & Tharparkar.",
                          imageUrl: "/src/assets/images/sindhi_ajrak_collection_card_1794821582353.jpg",
                          href: "/traditional-sindhi-collection",
                        };
                        onChangeDraft({
                          ...cmsDraft,
                          sections: cmsDraft.sections.map((s) =>
                            s.id === sec.id
                              ? { ...s, collectionCards: [...(s.collectionCards || []), newCard] }
                              : s
                          ),
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#141413] px-2.5 py-1 font-bold text-white cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Add Collection Card
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(sec.collectionCards || []).map((card) => (
                      <div
                        key={card.id}
                        className="rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-3 space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={card.imageUrl}
                            alt={card.title}
                            className="h-20 w-24 rounded-lg object-cover border border-[#DFD8CE] shrink-0"
                          />
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <input
                              type="text"
                              value={card.title}
                              onChange={(e) =>
                                onChangeDraft({
                                  ...cmsDraft,
                                  sections: cmsDraft.sections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          collectionCards: (s.collectionCards || []).map((c) =>
                                            c.id === card.id ? { ...c, title: e.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                })
                              }
                              placeholder="Card Title"
                              className="w-full rounded border border-[#DFD8CE] bg-white px-2 py-1 font-bold"
                            />
                            <input
                              type="text"
                              value={card.subtitle}
                              onChange={(e) =>
                                onChangeDraft({
                                  ...cmsDraft,
                                  sections: cmsDraft.sections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          collectionCards: (s.collectionCards || []).map((c) =>
                                            c.id === card.id ? { ...c, subtitle: e.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                })
                              }
                              placeholder="Card Subtitle"
                              className="w-full rounded border border-[#DFD8CE] bg-white px-2 py-1"
                            />
                            <input
                              type="text"
                              value={card.href}
                              onChange={(e) =>
                                onChangeDraft({
                                  ...cmsDraft,
                                  sections: cmsDraft.sections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          collectionCards: (s.collectionCards || []).map((c) =>
                                            c.id === card.id ? { ...c, href: e.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                })
                              }
                              placeholder="/traditional-sindhi-collection"
                              className="w-full rounded border border-[#DFD8CE] bg-white px-2 py-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenImagePicker(
                                  (url) =>
                                    onChangeDraft({
                                      ...cmsDraft,
                                      sections: cmsDraft.sections.map((s) =>
                                        s.id === sec.id
                                          ? {
                                              ...s,
                                              collectionCards: (s.collectionCards || []).map((c) =>
                                                c.id === card.id ? { ...c, imageUrl: url } : c
                                              ),
                                            }
                                          : s
                                      ),
                                    }),
                                  "Collections",
                                  `Replace Image · ${card.title}`
                                )
                              }
                              className="inline-flex items-center gap-1 rounded border border-[#DFD8CE] bg-white px-2 py-1 font-semibold hover:border-[#9E2A2B] cursor-pointer"
                            >
                              <ImageIcon className="h-3 w-3" /> Pick / Replace
                            </button>
                            {onUploadFile && (
                              <label className="inline-flex items-center gap-1 rounded border border-[#DFD8CE] bg-white px-2 py-1 font-semibold hover:border-[#9E2A2B] cursor-pointer">
                                <Upload className="h-3 w-3" />
                                {uploadingSlotKey === `card-${card.id}` ? "Uploading..." : "Upload"}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    handleDirectUpload(f, `card-${card.id}`, "Collections", card.title, (url) =>
                                      onChangeDraft({
                                        ...cmsDraft,
                                        sections: cmsDraft.sections.map((s) =>
                                          s.id === sec.id
                                            ? {
                                                ...s,
                                                collectionCards: (s.collectionCards || []).map((c) =>
                                                  c.id === card.id ? { ...c, imageUrl: url } : c
                                                ),
                                              }
                                            : s
                                        ),
                                      })
                                    );
                                    e.currentTarget.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          {(sec.collectionCards || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeDraft({
                                  ...cmsDraft,
                                  sections: cmsDraft.sections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          collectionCards: (s.collectionCards || []).filter(
                                            (c) => c.id !== card.id
                                          ),
                                        }
                                      : s
                                  ),
                                })
                              }
                              className="inline-flex items-center gap-1 text-rose-600 font-semibold cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sec.key === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#F2EDE4]">
                <div>
                  <label className="block font-semibold mb-1">Product Feed Filter</label>
                  <select
                    value={sec.productTag || "featured"}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        sections: cmsDraft.sections.map((s) =>
                          s.id === sec.id
                            ? {
                                ...s,
                                productTag: e.target.value as HomepageSectionConfig["productTag"],
                              }
                            : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                  >
                    <option value="featured">Featured Garments</option>
                    <option value="new">New Arrivals</option>
                    <option value="best">Best Sellers</option>
                    <option value="sale">Sale & Discounts</option>
                    <option value="sindhi">Traditional Sindhi</option>
                    <option value="ajrak">Ajrak & Topi</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">CTA Text</label>
                  <input
                    type="text"
                    value={sec.ctaText || ""}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        sections: cmsDraft.sections.map((s) =>
                          s.id === sec.id ? { ...s, ctaText: e.target.value } : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">CTA Link</label>
                  <input
                    type="text"
                    value={sec.ctaHref || ""}
                    onChange={(e) =>
                      onChangeDraft({
                        ...cmsDraft,
                        sections: cmsDraft.sections.map((s) =>
                          s.id === sec.id ? { ...s, ctaHref: e.target.value } : s
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenImagePicker(
                        (url) =>
                          onChangeDraft({
                            ...cmsDraft,
                            sections: cmsDraft.sections.map((s) =>
                              s.id === sec.id ? { ...s, imageUrl: url } : s
                            ),
                          }),
                        "Collections",
                        `Select Banner for ${sec.title}`
                      )
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] py-1.5 font-semibold cursor-pointer"
                  >
                    {sec.imageUrl ? "Banner Selected ✓" : "Pick Editorial Image"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          const customSec: HomepageSectionConfig = {
            id: `sec-custom-${Date.now()}`,
            key: "custom",
            title: "Tharparkar Festive Spotlight",
            subtitle: "Handpicked seasonal attire curated by our Mithi styling team.",
            enabled: true,
            sortOrder: cmsDraft.sections.length + 1,
            productTag: "featured",
            ctaText: "Explore Selection",
            ctaHref: "/new-arrivals",
            isSystem: false,
          };
          onChangeDraft({ ...cmsDraft, sections: [...cmsDraft.sections, customSec] });
        }}
        className="w-full rounded-xl border-2 border-dashed border-[#DFD8CE] bg-white py-3.5 font-bold hover:border-[#9E2A2B] cursor-pointer"
      >
        + Add Custom Homepage Section
      </button>

      {/* Safety warning modal before hiding a system homepage section */}
      {confirmHideSystemSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold">
                  Hide Core Section “{confirmHideSystemSection.title}”?
                </h3>
                <p className="text-[#5D574F] mt-1">
                  This is a core THAR STYLE homepage showcase section. Hiding it removes this block from the homepage once published. You can re-enable it at any time.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmHideSystemSection(null)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Keep Visible
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeDraft({
                    ...cmsDraft,
                    sections: cmsDraft.sections.map((s) =>
                      s.id === confirmHideSystemSection.id ? { ...s, enabled: false } : s
                    ),
                  });
                  setConfirmHideSystemSection(null);
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 font-bold text-white cursor-pointer"
              >
                Confirm Hide Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
