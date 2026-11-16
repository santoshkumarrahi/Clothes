import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  AdminPermissionKey,
  AdminStaffRole,
  AdminUserRecord,
  CmsConfig,
  CmsPageRecord,
  CmsVersionRecord,
  MediaAsset,
} from "../../types";
import { sanitizeRichHtml } from "../../utils/cmsTheme";

export type SystemPanelTab =
  | "pages"
  | "seo"
  | "notifications"
  | "team"
  | "activity"
  | "versions"
  | "backup";

export interface AdminNotificationItem {
  id: string;
  type: "stock" | "order" | "message";
  title: string;
  detail: string;
  targetTab: string;
  createdAt: string;
}

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  severity?: string;
  created_at: string;
}

interface AdminSystemPanelsProps {
  activeSection: SystemPanelTab;
  authToken: string;
  cmsDraft: CmsConfig;
  pages: CmsPageRecord[];
  versions: CmsVersionRecord[];
  adminUsers: AdminUserRecord[];
  auditLogs: AuditLogRow[];
  notifications: AdminNotificationItem[];
  contactMessages: ContactMessageRow[];
  onChangeDraft: (next: CmsConfig) => void;
  onSaveDraft: () => Promise<void>;
  onRequestPublish: () => void;
  onRefreshAdminData: () => Promise<void>;
  onVersionRestored: (restoredCms: CmsConfig) => void;
  onNavigateTab: (tab: string) => void;
  onOpenImagePicker: (
    onPicked: (url: string) => void,
    category?: MediaAsset["category"],
    title?: string
  ) => void;
  onShowToast: (msg: string) => void;
}

const ROLE_PRESETS: Array<{
  id: AdminStaffRole;
  label: string;
  defaultPermissions: AdminPermissionKey[];
}> = [
  {
    id: "super_admin",
    label: "Super Admin (Full Control)",
    defaultPermissions: [
      "overview",
      "visual_editor",
      "hero_media",
      "branding_nav_footer",
      "colors_typography",
      "marquee_animations",
      "sections_pages",
      "products_categories",
      "orders_customers",
      "settings_seo",
      "users_logs_backup",
    ],
  },
  {
    id: "website_manager",
    label: "Website Visual Manager",
    defaultPermissions: [
      "overview",
      "visual_editor",
      "hero_media",
      "branding_nav_footer",
      "colors_typography",
      "marquee_animations",
      "sections_pages",
      "settings_seo",
    ],
  },
  {
    id: "content_manager",
    label: "Content & Pages Manager",
    defaultPermissions: ["overview", "hero_media", "marquee_animations", "sections_pages"],
  },
  {
    id: "product_manager",
    label: "Catalog & Product Manager",
    defaultPermissions: ["overview", "hero_media", "products_categories"],
  },
  {
    id: "order_manager",
    label: "Orders & Customer Manager",
    defaultPermissions: ["overview", "orders_customers"],
  },
];

const PERMISSION_LABELS: Array<{ key: AdminPermissionKey; label: string }> = [
  { key: "overview", label: "Dashboard Overview & Analytics" },
  { key: "visual_editor", label: "Live Visual Website Editor" },
  { key: "hero_media", label: "Hero Slider & Media Library" },
  { key: "branding_nav_footer", label: "Logos, Header Nav & Footer" },
  { key: "colors_typography", label: "Colors Theme & Typography Fonts" },
  { key: "marquee_animations", label: "Marquee Announcements & Animations" },
  { key: "sections_pages", label: "Homepage Sections & Store Pages" },
  { key: "products_categories", label: "Products & Categories Catalog" },
  { key: "orders_customers", label: "Orders, Invoices & Customers" },
  { key: "settings_seo", label: "Store Settings & SEO Controls" },
  { key: "users_logs_backup", label: "Staff RBAC, Logs & Backup/Restore" },
];

export const AdminSystemPanels: React.FC<AdminSystemPanelsProps> = ({
  activeSection,
  authToken,
  cmsDraft,
  pages,
  versions,
  adminUsers,
  auditLogs,
  notifications,
  contactMessages,
  onChangeDraft,
  onSaveDraft,
  onRequestPublish,
  onRefreshAdminData,
  onVersionRestored,
  onNavigateTab,
  onOpenImagePicker,
  onShowToast,
}) => {
  // Pages CMS state
  const [selectedPageId, setSelectedPageId] = useState<string>(pages[0]?.id || "");
  const [pagePreviewMode, setPagePreviewMode] = useState<"edit" | "preview">("edit");
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [npTitle, setNpTitle] = useState("");
  const [npSlug, setNpSlug] = useState("");
  const [npHeading, setNpHeading] = useState("");
  const [npBody, setNpBody] = useState("<p>Add store information here...</p>");
  const [savingPage, setSavingPage] = useState(false);
  const [confirmDeletePage, setConfirmDeletePage] = useState<CmsPageRecord | null>(null);

  // Local editable copy for selected page
  const selectedPage = useMemo(
    () => pages.find((p) => p.id === selectedPageId) || pages[0] || null,
    [pages, selectedPageId]
  );
  const [pageForm, setPageForm] = useState<CmsPageRecord | null>(null);
  const activePageDraft =
    pageForm && pageForm.id === selectedPage?.id ? pageForm : selectedPage;

  // Notifications filter
  const [notifFilter, setNotifFilter] = useState<"all" | "order" | "stock" | "message">("all");

  // Team RBAC modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sMobile, setSMobile] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sRole, setSRole] = useState<AdminStaffRole>("website_manager");
  const [sPerms, setSPerms] = useState<AdminPermissionKey[]>(
    ROLE_PRESETS[1].defaultPermissions
  );
  const [editingStaff, setEditingStaff] = useState<AdminUserRecord | null>(null);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<AdminUserRecord | null>(null);

  // Activity Log search
  const [logSearch, setLogSearch] = useState("");

  // Version restore modal
  const [confirmRestoreVer, setConfirmRestoreVer] = useState<CmsVersionRecord | null>(null);

  // Backup restore state
  const [backupJsonText, setBackupJsonText] = useState("");
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState(false);
  const backupFileRef = useRef<HTMLInputElement>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  // ==========================================
  // 1. PAGES & CONTENT CMS
  // ==========================================
  if (activeSection === "pages") {
    const insertHtmlTag = (snippet: string) => {
      if (!activePageDraft) return;
      setPageForm({
        ...activePageDraft,
        bodyHtml: `${activePageDraft.bodyHtml}\n${snippet}`,
      });
    };

    const handleSavePage = async () => {
      if (!activePageDraft) return;
      setSavingPage(true);
      try {
        const res = await fetch(`/api/admin/pages/${encodeURIComponent(activePageDraft.id)}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(activePageDraft),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not update page.");
        onShowToast(`Saved & published "${activePageDraft.title}" page.`);
        await onRefreshAdminData();
      } catch (err: unknown) {
        onShowToast(err instanceof Error ? err.message : "Failed to save page.");
      } finally {
        setSavingPage(false);
      }
    };

    const handleCreatePage = async (e: React.FormEvent) => {
      e.preventDefault();
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: npTitle,
          slug: npSlug || npTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          heading: npHeading || npTitle,
          bodyHtml: npBody,
          published: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast(data.error || "Could not create page.");
        return;
      }
      setNewPageOpen(false);
      setNpTitle("");
      setNpSlug("");
      setNpHeading("");
      onShowToast("Custom storefront page created.");
      await onRefreshAdminData();
      if (data.id) setSelectedPageId(data.id);
    };

    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141413]">
              Store Pages & Content CMS
            </h2>
            <p className="text-[#5D574F]">
              Edit About Us, Contact Us, Policies, Size Guide, FAQ, or publish custom storefront pages at /page/your-slug.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewPageOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Custom Page
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Pages List */}
          <div className="lg:col-span-4 rounded-2xl border border-[#E7E1D8] bg-white p-3 space-y-1.5">
            {pages.map((pg) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => {
                  setSelectedPageId(pg.id);
                  setPageForm(pg);
                }}
                className={`w-full text-left rounded-xl p-3 flex items-center justify-between cursor-pointer ${
                  activePageDraft?.id === pg.id
                    ? "bg-[#141413] text-white"
                    : "bg-[#FAF8F5] text-[#141413] hover:bg-[#F2EDE4]"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">{pg.title}</p>
                  <p className="text-[10px] opacity-75 font-mono truncate">/{pg.slug}</p>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    pg.published ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-400/20"
                  }`}
                >
                  {pg.published ? "Live" : "Hidden"}
                </span>
              </button>
            ))}
          </div>

          {/* Page Editor */}
          {activePageDraft && (
            <div className="lg:col-span-8 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2EDE4] pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[#141413]">
                    Editing: {activePageDraft.title}
                  </h3>
                  <p className="text-[11px] font-mono text-[#8E6B35]">
                    {activePageDraft.isSystem ? `Core Page (${activePageDraft.slug})` : `/page/${activePageDraft.slug}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 font-bold">
                    <input
                      type="checkbox"
                      checked={activePageDraft.published}
                      onChange={(e) =>
                        setPageForm({ ...activePageDraft, published: e.target.checked })
                      }
                    />
                    Visible Publicly
                  </label>
                  {!activePageDraft.isSystem && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePage(activePageDraft)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Page Title</label>
                  <input
                    type="text"
                    value={activePageDraft.title}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Main Heading</label>
                  <input
                    type="text"
                    value={activePageDraft.heading}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, heading: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Subtitle / Intro</label>
                <input
                  type="text"
                  value={activePageDraft.subtitle}
                  onChange={(e) =>
                    setPageForm({ ...activePageDraft, subtitle: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>

              {/* Formatting Toolbar + HTML / Sanitized Live Preview */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => insertHtmlTag("<h2>Section Subheading</h2>")}
                      className="rounded border border-[#DFD8CE] px-2 py-1 font-bold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      + H2
                    </button>
                    <button
                      type="button"
                      onClick={() => insertHtmlTag("<p>Paragraph text here...</p>")}
                      className="rounded border border-[#DFD8CE] px-2 py-1 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      + Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => insertHtmlTag("<strong>Bold Highlight</strong>")}
                      className="rounded border border-[#DFD8CE] px-2 py-1 font-bold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertHtmlTag("<ul><li>Key Point One</li><li>Key Point Two</li></ul>")}
                      className="rounded border border-[#DFD8CE] px-2 py-1 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      + List
                    </button>
                  </div>
                  <div className="inline-flex rounded-lg border border-[#DFD8CE] p-0.5 bg-[#FAF8F5]">
                    <button
                      type="button"
                      onClick={() => setPagePreviewMode("edit")}
                      className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                        pagePreviewMode === "edit" ? "bg-[#141413] text-white" : ""
                      }`}
                    >
                      HTML Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagePreviewMode("preview")}
                      className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                        pagePreviewMode === "preview" ? "bg-[#141413] text-white" : ""
                      }`}
                    >
                      Live Preview
                    </button>
                  </div>
                </div>

                {pagePreviewMode === "edit" ? (
                  <textarea
                    rows={8}
                    value={activePageDraft.bodyHtml}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, bodyHtml: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#DFD8CE] px-3 py-2.5 font-mono text-[11px]"
                  />
                ) : (
                  <div
                    className="rounded-xl border border-[#E7E1D8] bg-[#FAF8F5] p-5 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichHtml(activePageDraft.bodyHtml),
                    }}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Banner Image</label>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenImagePicker(
                        (url) => setPageForm({ ...activePageDraft, imageUrl: url }),
                        "Content",
                        `Select Image for ${activePageDraft.title}`
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 font-semibold cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {activePageDraft.imageUrl ? "Image Attached ✓" : "Pick Banner"}
                  </button>
                </div>
                <div>
                  <label className="block font-semibold mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={activePageDraft.ctaText}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, ctaText: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">CTA Link</label>
                  <input
                    type="text"
                    value={activePageDraft.ctaHref}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, ctaHref: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#F2EDE4]">
                <div>
                  <label className="block font-semibold mb-1">Page SEO Title</label>
                  <input
                    type="text"
                    value={activePageDraft.seoTitle}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, seoTitle: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Page SEO Meta Description</label>
                  <input
                    type="text"
                    value={activePageDraft.seoDescription}
                    onChange={(e) =>
                      setPageForm({ ...activePageDraft, seoDescription: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingPage}
                  onClick={handleSavePage}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-5 py-2.5 font-bold text-white hover:bg-[#141413] cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingPage ? "Saving..." : "Save & Publish Page"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Custom Page Modal */}
        {newPageOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <form
              onSubmit={handleCreatePage}
              className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-2.5">
                <h3 className="font-display text-base font-bold">Create Custom Storefront Page</h3>
                <button type="button" onClick={() => setNewPageOpen(false)} className="cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Page Title *</label>
                  <input
                    required
                    type="text"
                    value={npTitle}
                    onChange={(e) => setNpTitle(e.target.value)}
                    placeholder="e.g. Eid Lookbook"
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">URL Slug *</label>
                  <input
                    required
                    type="text"
                    value={npSlug}
                    onChange={(e) => setNpSlug(e.target.value)}
                    placeholder="eid-lookbook"
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Page Heading</label>
                <input
                  type="text"
                  value={npHeading}
                  onChange={(e) => setNpHeading(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Content HTML</label>
                <textarea
                  rows={4}
                  value={npBody}
                  onChange={(e) => setNpBody(e.target.value)}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewPageOpen(false)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#9E2A2B] px-5 py-2 font-bold text-white cursor-pointer"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Custom Page Confirmation */}
        {confirmDeletePage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
              <h3 className="font-display text-base font-bold text-[#141413]">
                Delete Custom Page “{confirmDeletePage.title}”?
              </h3>
              <p className="text-[#5D574F]">
                Visitors opening /page/{confirmDeletePage.slug} will no longer see this page.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePage(null)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/admin/pages/${encodeURIComponent(confirmDeletePage.id)}`,
                      { method: "DELETE", headers: authHeaders }
                    );
                    if (res.ok) {
                      setConfirmDeletePage(null);
                      onShowToast("Custom page deleted.");
                      await onRefreshAdminData();
                    }
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white cursor-pointer"
                >
                  Delete Page
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 2. SEO SETTINGS MANAGER
  // ==========================================
  if (activeSection === "seo") {
    const seo = cmsDraft.seoSettings;
    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141413]">
              Global SEO, Meta & Social Share Settings
            </h2>
            <p className="text-[#5D574F]">
              Control browser title, meta description, keywords, OpenGraph WhatsApp/Facebook cards, and search indexing.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-lg border border-[#141413] px-3.5 py-2 font-bold cursor-pointer"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={onRequestPublish}
              className="rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white cursor-pointer"
            >
              Publish SEO Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
            <div>
              <label className="block font-semibold mb-1">Site Meta Title</label>
              <input
                type="text"
                value={seo.siteTitle}
                onChange={(e) =>
                  onChangeDraft({ ...cmsDraft, seoSettings: { ...seo, siteTitle: e.target.value } })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Meta Description</label>
              <textarea
                rows={3}
                value={seo.metaDescription}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    seoSettings: { ...seo, metaDescription: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Keywords (comma separated)</label>
              <input
                type="text"
                value={seo.metaKeywords}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    seoSettings: { ...seo, metaKeywords: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">OpenGraph Share Title</label>
                <input
                  type="text"
                  value={seo.ogTitle}
                  onChange={(e) =>
                    onChangeDraft({ ...cmsDraft, seoSettings: { ...seo, ogTitle: e.target.value } })
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">OG Share Image</label>
                <button
                  type="button"
                  onClick={() =>
                    onOpenImagePicker(
                      (url) =>
                        onChangeDraft({ ...cmsDraft, seoSettings: { ...seo, ogImageUrl: url } }),
                      "Hero",
                      "Select OpenGraph Share Image"
                    )
                  }
                  className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-2 font-semibold cursor-pointer"
                >
                  {seo.ogImageUrl ? "Change OG Share Image ✓" : "Pick OG Share Image"}
                </button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 font-bold pt-1">
              <input
                type="checkbox"
                checked={seo.robotsIndex}
                onChange={(e) =>
                  onChangeDraft({
                    ...cmsDraft,
                    seoSettings: { ...seo, robotsIndex: e.target.checked },
                  })
                }
              />
              Allow Search Engine Indexing (index, follow)
            </label>
          </div>

          {/* Search Snippet Preview */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4 h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8D857B]">
              Google Search Snippet Preview
            </p>
            <div className="rounded-xl border border-[#F2EDE4] bg-[#FAF8F5] p-4 space-y-1">
              <p className="text-[11px] text-emerald-700 font-mono">
                https://tharstyle.pk
              </p>
              <p className="text-base font-bold text-[#1a0dab] leading-snug">
                {seo.siteTitle || "THAR STYLE — Fashion for Every Generation"}
              </p>
              <p className="text-xs text-[#4d5156] leading-relaxed">
                {seo.metaDescription}
              </p>
            </div>
            {seo.ogImageUrl && (
              <div className="rounded-xl overflow-hidden border border-[#E7E1D8]">
                <img src={seo.ogImageUrl} alt="OG Preview" className="h-36 w-full object-cover" />
                <div className="p-3 bg-[#FAF8F5]">
                  <p className="font-bold text-[#141413] truncate">{seo.ogTitle || seo.siteTitle}</p>
                  <p className="text-[11px] text-[#5D574F] line-clamp-1">{seo.ogDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. NOTIFICATIONS CENTER
  // ==========================================
  if (activeSection === "notifications") {
    const filtered =
      notifFilter === "all"
        ? notifications
        : notifications.filter((n) => n.type === notifFilter);

    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-[#9E2A2B]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#141413]">
                Store Notifications & Customer Inquiries ({notifications.length})
              </h2>
              <p className="text-[#5D574F]">
                Real-time alerts from pending customer orders, low inventory thresholds, and contact form inquiries.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "order", label: "Pending Orders" },
                { id: "stock", label: "Low Stock" },
                { id: "message", label: "Messages" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setNotifFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                  notifFilter === f.id ? "bg-[#141413] text-white" : "bg-[#FAF8F5] text-[#5D574F]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {filtered.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      n.type === "stock"
                        ? "bg-amber-50 text-amber-800"
                        : n.type === "order"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {n.type}
                  </span>
                  <p className="font-bold text-[#141413]">{n.title}</p>
                </div>
                <p className="text-[#5D574F] mt-1">{n.detail}</p>
              </div>
              {n.targetTab !== "notifications" && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(n.targetTab)}
                  className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-1.5 font-semibold hover:border-[#9E2A2B] cursor-pointer"
                >
                  Open {n.targetTab === "orders" ? "Orders" : "Products"} →
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-[#E7E1D8] bg-white p-8 text-center text-[#5D574F]">
              All caught up! No active alerts in this category.
            </div>
          )}
        </div>

        {contactMessages.length > 0 && (
          <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-[#141413]">
              Recent Customer Contact Inquiries
            </h3>
            <div className="space-y-2.5">
              {contactMessages.map((m) => (
                <div key={m.id} className="rounded-xl border border-[#F2EDE4] bg-[#FAF8F5] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[#141413]">
                      {m.name} · <span className="text-[#9E2A2B]">{m.subject}</span>
                    </p>
                    <span className="text-[11px] text-[#8D857B]">
                      {m.email || m.phone || "No contact info"} ·{" "}
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[#3A3631] mt-1">{m.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 4. ADMIN USERS & RBAC PERMISSIONS
  // ==========================================
  if (activeSection === "team") {
    const handleSaveStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingStaff) {
        const res = await fetch(`/api/admin/team/${encodeURIComponent(editingStaff.id)}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            fullName: sName,
            adminRole: sRole,
            permissions: sPerms,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          onShowToast(data.error || "Failed to update staff role.");
          return;
        }
        onShowToast("Updated admin staff permissions.");
      } else {
        const res = await fetch("/api/admin/team", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            fullName: sName,
            email: sEmail,
            mobile: sMobile,
            password: sPassword,
            adminRole: sRole,
            permissions: sPerms,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          onShowToast(data.error || "Could not create staff account.");
          return;
        }
        onShowToast(`Created ${sRole} staff account for ${sName}.`);
      }
      setStaffModalOpen(false);
      await onRefreshAdminData();
    };

    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-[#9E2A2B]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#141413]">
                Admin Users & Role-Based Permissions ({adminUsers.length})
              </h2>
              <p className="text-[#5D574F]">
                Assign granular backend-enforced permissions across Website Managers, Content Managers, Product Managers, and Order Managers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingStaff(null);
              setSName("");
              setSEmail("");
              setSMobile("");
              setSPassword("");
              setSRole("website_manager");
              setSPerms(ROLE_PRESETS[1].defaultPermissions);
              setStaffModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white hover:bg-[#141413] cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Admin Staff
          </button>
        </div>

        <div className="rounded-2xl border border-[#E7E1D8] bg-white overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-[#E7E1D8] bg-[#FAF8F5] text-[11px] uppercase tracking-wider text-[#5D574F]">
              <tr>
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Role Preset</th>
                <th className="p-3.5">Permissions</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EDE4]">
              {adminUsers.map((u) => (
                <tr key={u.id}>
                  <td className="p-3.5">
                    <p className="font-bold text-[#141413]">{u.fullName}</p>
                    <p className="text-[11px] text-[#5D574F]">{u.email}</p>
                  </td>
                  <td className="p-3.5 font-semibold text-[#8E6B35]">{u.adminRole}</td>
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.permissions.slice(0, 4).map((p) => (
                        <span
                          key={p}
                          className="rounded bg-[#FAF8F5] border border-[#E7E1D8] px-1.5 py-0.5 text-[10px]"
                        >
                          {p}
                        </span>
                      ))}
                      {u.permissions.length > 4 && (
                        <span className="text-[10px] text-[#5D574F]">
                          +{u.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                        u.status === "active"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaff(u);
                          setSName(u.fullName);
                          setSEmail(u.email);
                          setSRole(u.adminRole);
                          setSPerms(u.permissions);
                          setStaffModalOpen(true);
                        }}
                        className="rounded-lg border border-[#DFD8CE] px-2.5 py-1 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                      >
                        Edit Access
                      </button>
                      {u.id !== "usr-super-admin" && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus = u.status === "active" ? "suspended" : "active";
                              const res = await fetch(`/api/admin/team/${encodeURIComponent(u.id)}`, {
                                method: "PATCH",
                                headers: authHeaders,
                                body: JSON.stringify({ status: nextStatus }),
                              });
                              if (res.ok) {
                                onShowToast(`${u.fullName} is now ${nextStatus}.`);
                                await onRefreshAdminData();
                              }
                            }}
                            className="rounded-lg border border-[#DFD8CE] px-2.5 py-1 font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                          >
                            {u.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStaff(u)}
                            className="rounded-lg border border-rose-200 p-1.5 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add / Edit Staff Modal */}
        {staffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 overflow-y-auto">
            <form
              onSubmit={handleSaveStaff}
              className="w-full max-w-xl rounded-2xl bg-white p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-2.5">
                <h3 className="font-display text-base font-bold">
                  {editingStaff ? `Edit Access: ${editingStaff.fullName}` : "Create Admin Staff Account"}
                </h3>
                <button type="button" onClick={() => setStaffModalOpen(false)} className="cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                  />
                </div>
                {!editingStaff && (
                  <>
                    <div>
                      <label className="block font-semibold mb-1">Email Address *</label>
                      <input
                        required
                        type="email"
                        value={sEmail}
                        onChange={(e) => setSEmail(e.target.value)}
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Mobile</label>
                      <input
                        type="text"
                        value={sMobile}
                        onChange={(e) => setSMobile(e.target.value)}
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Temporary Password *</label>
                      <input
                        required
                        minLength={6}
                        type="password"
                        value={sPassword}
                        onChange={(e) => setSPassword(e.target.value)}
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Role Preset</label>
                <select
                  value={sRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as AdminStaffRole;
                    setSRole(nextRole);
                    const preset = ROLE_PRESETS.find((r) => r.id === nextRole);
                    if (preset) setSPerms([...preset.defaultPermissions]);
                  }}
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-semibold"
                >
                  {ROLE_PRESETS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block font-semibold">Granular Module Permissions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-[#F2EDE4] bg-[#FAF8F5] p-3">
                  {PERMISSION_LABELS.map((perm) => {
                    const checked = sRole === "super_admin" || sPerms.includes(perm.key);
                    return (
                      <label key={perm.key} className="inline-flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          disabled={sRole === "super_admin"}
                          checked={checked}
                          onChange={(e) =>
                            setSPerms((prev) =>
                              e.target.checked
                                ? [...prev, perm.key]
                                : prev.filter((x) => x !== perm.key)
                            )
                          }
                        />
                        {perm.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#9E2A2B] px-5 py-2 font-bold text-white cursor-pointer"
                >
                  {editingStaff ? "Save Permissions" : "Create Staff User"}
                </button>
              </div>
            </form>
          </div>
        )}

        {confirmDeleteStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
              <h3 className="font-display text-base font-bold">
                Remove Staff User “{confirmDeleteStaff.fullName}”?
              </h3>
              <p className="text-[#5D574F]">
                Their access to the THAR STYLE admin workspace will be revoked immediately.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteStaff(null)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/admin/team/${encodeURIComponent(confirmDeleteStaff.id)}`,
                      { method: "DELETE", headers: authHeaders }
                    );
                    if (res.ok) {
                      setConfirmDeleteStaff(null);
                      onShowToast("Admin staff user removed.");
                      await onRefreshAdminData();
                    }
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white cursor-pointer"
                >
                  Confirm Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 5. ACTIVITY LOGS
  // ==========================================
  if (activeSection === "activity") {
    const q = logSearch.trim().toLowerCase();
    const filteredLogs = auditLogs.filter(
      (l) =>
        !q ||
        l.action.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q)
    );

    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141413]">
              Admin Activity & Audit Trail ({filteredLogs.length})
            </h2>
            <p className="text-[#5D574F]">
              Persistent audit log of website publishes, product updates, order changes, and permission updates.
            </p>
          </div>
          <div className="relative min-w-[240px]">
            <Search className="h-3.5 w-3.5 text-[#8D857B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search actor, action, target..."
              className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] pl-8 pr-3 py-2"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D8] bg-white overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-[#E7E1D8] bg-[#FAF8F5] text-[11px] uppercase tracking-wider text-[#5D574F]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Actor & Role</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EDE4]">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3.5 text-[#5D574F] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className="font-bold text-[#141413]">{log.actor}</span>{" "}
                    <span className="text-[11px] text-[#8E6B35]">({log.role})</span>
                  </td>
                  <td className="p-3.5 font-semibold text-[#141413]">{log.action}</td>
                  <td className="p-3.5 text-[#5D574F]">{log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==========================================
  // 6. VERSION HISTORY & ROLLBACK
  // ==========================================
  if (activeSection === "versions") {
    return (
      <div className="space-y-5 text-xs">
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-[#9E2A2B]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#141413]">
                Website Version History & Snapshot Rollback ({versions.length})
              </h2>
              <p className="text-[#5D574F]">
                Every published update automatically saves a restorable storefront snapshot in SQLite.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {versions.map((ver, idx) => (
            <div
              key={ver.id}
              className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#141413] px-2 py-0.5 text-[11px] font-bold text-white">
                    v{ver.versionNumber}
                  </span>
                  <span className="font-bold text-[#141413] text-sm">{ver.label}</span>
                  {idx === 0 && (
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Current Live Snapshot
                    </span>
                  )}
                </div>
                <p className="text-[#5D574F]">
                  Published by <strong>{ver.publishedBy}</strong> ·{" "}
                  {new Date(ver.createdAt).toLocaleString()}
                </p>
              </div>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmRestoreVer(ver)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3.5 py-2 font-bold text-[#141413] hover:border-[#9E2A2B] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore This Version
                </button>
              )}
            </div>
          ))}
        </div>

        {confirmRestoreVer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
              <h3 className="font-display text-lg font-bold text-[#141413]">
                Restore Storefront to v{confirmRestoreVer.versionNumber}?
              </h3>
              <p className="text-[#5D574F]">
                This will immediately publish the design, colors, typography, sections, and hero banners from{" "}
                <strong>{confirmRestoreVer.label}</strong> as your new live storefront version.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRestoreVer(null)}
                  className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/admin/cms/versions/${encodeURIComponent(confirmRestoreVer.id)}/restore`,
                      { method: "POST", headers: authHeaders }
                    );
                    const data = await res.json();
                    if (res.ok && data.cms) {
                      setConfirmRestoreVer(null);
                      onVersionRestored(data.cms);
                      onShowToast(`Restored storefront from v${confirmRestoreVer.versionNumber}.`);
                      await onRefreshAdminData();
                    } else {
                      onShowToast(data.error || "Could not restore snapshot.");
                    }
                  }}
                  className="rounded-lg bg-[#9E2A2B] px-5 py-2 font-bold text-white cursor-pointer"
                >
                  Confirm Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 7. BACKUP & RESTORE
  // ==========================================
  const handleDownloadBackup = async () => {
    const res = await fetch("/api/admin/backup", { headers: authHeaders });
    const data = await res.json();
    if (!res.ok || !data.backup) {
      onShowToast(data.error || "Could not generate backup.");
      return;
    }
    const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thar-style-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast("Downloaded complete THAR STYLE JSON backup.");
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-[#9E2A2B]" />
          <div>
            <h2 className="font-display text-lg font-bold text-[#141413]">
              Storefront Backup & JSON Restore
            </h2>
            <p className="text-[#5D574F]">
              Export your complete storefront theme, sections, pages, media metadata, and store settings, or restore from a saved JSON snapshot.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadBackup}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-4 py-2 font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Download Full JSON Backup
        </button>
      </div>

      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[#141413]">
            Restore from JSON Snapshot
          </h3>
          <button
            type="button"
            onClick={() => backupFileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] px-3 py-1.5 font-semibold cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Load .json Backup File
          </button>
          <input
            ref={backupFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setBackupJsonText(String(reader.result || ""));
              reader.readAsText(f);
            }}
          />
        </div>

        <textarea
          rows={9}
          value={backupJsonText}
          onChange={(e) => setBackupJsonText(e.target.value)}
          placeholder='Paste exported THAR STYLE backup JSON here ({ "publicCms": { ... }, "pages": [ ... ] })'
          className="w-full rounded-xl border border-[#DFD8CE] bg-[#FAF8F5] p-3 font-mono text-[11px]"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!backupJsonText.trim()}
            onClick={() => setConfirmRestoreBackup(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E2A2B] px-5 py-2.5 font-bold text-white disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Validate & Restore Snapshot
          </button>
        </div>
      </div>

      {confirmRestoreBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[#141413]">
                  Confirm Storefront JSON Restore?
                </h3>
                <p className="text-[#5D574F] mt-1">
                  Restoring this JSON backup will overwrite your live storefront theme, sections, and CMS pages and record a version snapshot.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreBackup(false)}
                className="rounded-lg border border-[#DFD8CE] px-4 py-2 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(backupJsonText);
                    const res = await fetch("/api/admin/restore", {
                      method: "POST",
                      headers: authHeaders,
                      body: JSON.stringify({ backup: parsed }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Invalid backup payload.");
                    setConfirmRestoreBackup(false);
                    setBackupJsonText("");
                    if (data.cms) onVersionRestored(data.cms);
                    onShowToast("Backup JSON restored and published live.");
                    await onRefreshAdminData();
                  } catch (err: unknown) {
                    onShowToast(err instanceof Error ? err.message : "Invalid JSON format.");
                    setConfirmRestoreBackup(false);
                  }
                }}
                className="rounded-lg bg-rose-600 px-5 py-2 font-bold text-white cursor-pointer"
              >
                Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
