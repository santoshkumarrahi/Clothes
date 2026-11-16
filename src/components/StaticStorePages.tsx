import React, { useMemo, useState } from "react";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { AuthUser, CmsConfig, CmsPageRecord, PublicCategory } from "../types";
import { getCmsThemeStyleVars, sanitizeRichHtml } from "../utils/cmsTheme";
import { PublicFooter, PublicNavbar } from "./PublicNavbar";

interface StaticStorePagesProps {
  page:
    | "about"
    | "contact"
    | "policy-return"
    | "policy-privacy"
    | "policy-terms"
    | "policy-shipping"
    | "size-guide"
    | "faq"
    | "custom";
  customSlug?: string;
  cmsPages?: CmsPageRecord[];
  cms: CmsConfig;
  allCategories: PublicCategory[];
  currentUser: AuthUser | null;
  cartCount: number;
  wishlistCount: number;
  onNavigateRoute: (path: string) => void;
  onOpenCart: () => void;
  onLogout: () => void;
}

export const StaticStorePages: React.FC<StaticStorePagesProps> = ({
  page,
  customSlug,
  cmsPages = [],
  cms,
  allCategories,
  currentUser,
  cartCount,
  wishlistCount,
  onNavigateRoute,
  onOpenCart,
  onLogout,
}) => {
  const st = cms.storeSettings;
  const [name, setName] = useState(currentUser?.fullName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.mobile || "");
  const [subject, setSubject] = useState("Product / Sizing Inquiry");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const themeVars = useMemo(() => getCmsThemeStyleVars(cms), [cms]);

  const slugMap: Record<string, string> = {
    about: "about-us",
    contact: "contact-us",
    "policy-return": "return-policy",
    "policy-shipping": "shipping-policy",
    "policy-privacy": "privacy-policy",
    "policy-terms": "terms-and-conditions",
    "size-guide": "size-guide",
    faq: "faq",
  };

  const targetSlug = page === "custom" ? customSlug || "" : slugMap[page] || "";
  const matchedCmsPage = cmsPages.find((p) => p.slug.toLowerCase() === targetSlug.toLowerCase());

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSentNotice(null);
    setSendError(null);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send message.");
      setSentNotice(data.message);
      setMessage("");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const activePath =
    page === "about"
      ? "/about"
      : page === "contact"
      ? "/contact"
      : page === "size-guide"
      ? "/size-guide"
      : page === "faq"
      ? "/faq"
      : page === "custom"
      ? `/page/${customSlug || ""}`
      : `/policy/${page.replace("policy-", "")}`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        ...themeVars,
        backgroundColor: "var(--ts-page-bg, #FAF8F5)",
        color: "var(--ts-primary-text, #141413)",
        fontFamily: "var(--ts-body-font, var(--font-body))",
      }}
    >
      <PublicNavbar
        cms={cms}
        categories={allCategories}
        currentUser={currentUser}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        activePath={activePath}
        onNavigateRoute={onNavigateRoute}
        onOpenCart={onOpenCart}
        onLogout={onLogout}
      />

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-12 lg:px-8 space-y-10">
        {page === "about" && (
          <div className="space-y-10">
            <section
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-2xl border p-6 lg:p-10"
              style={{
                backgroundColor: "var(--ts-card-bg, #FFFFFF)",
                borderColor: "var(--ts-border-color, #E7E1D8)",
              }}
            >
              <div className="lg:col-span-7 space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9E2A2B]">
                  {matchedCmsPage?.subtitle || `Our Heritage · ${st.cityLocation}`}
                </span>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">
                  {matchedCmsPage?.heading || `About ${cms.brandName}`}
                </h1>
                <p className="text-sm font-medium text-[#8E6B35]">{cms.tagline}</p>
                {matchedCmsPage?.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none text-sm leading-relaxed space-y-3"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(matchedCmsPage.bodyHtml) }}
                  />
                ) : (
                  <p className="text-sm text-[#3A3631] leading-relaxed">{st.aboutStory}</p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateRoute(matchedCmsPage?.ctaHref || "/category/traditional-sindhi-wear")
                    }
                    className="rounded-lg px-5 py-2.5 ts-btn-primary cursor-pointer"
                  >
                    {matchedCmsPage?.ctaText || "Explore Sindhi Heritage"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateRoute("/contact")}
                    className="rounded-lg border border-[#DFD8CE] px-5 py-2.5 text-xs font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                  >
                    Visit / Contact Mithi Store
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5">
                <img
                  src={
                    matchedCmsPage?.imageUrl ||
                    "/src/assets/images/thar_hero_sindhi_1794818534180.jpg"
                  }
                  alt="THAR STYLE Mithi Tharparkar"
                  referrerPolicy="no-referrer"
                  className="h-80 w-full rounded-xl object-cover border border-[#E7E1D8]"
                />
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: "Every Generation Under One Roof",
                  body: "Curated fashion for Men, Women, Kids, and Young trendsetters so entire families in Mithi and across Pakistan shop together.",
                },
                {
                  title: "Authentic Ajrak & Sindhi Topi",
                  body: "Direct partnerships with Sindhi block-printers and mirrorwork artisans preserve genuine heritage colors, natural madder dyes, and hand-stitched precision.",
                },
                {
                  title: "Honest Quality & Service",
                  body: "Clear PKR pricing, accurate sizing guidance, Cash on Delivery, and responsive customer support from Mithi, Tharparkar.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border p-6 space-y-2"
                  style={{
                    backgroundColor: "var(--ts-card-bg, #FFFFFF)",
                    borderColor: "var(--ts-border-color, #E7E1D8)",
                  }}
                >
                  <h2 className="font-display text-lg font-bold">{card.title}</h2>
                  <p className="text-xs text-[#5D574F] leading-relaxed">{card.body}</p>
                </div>
              ))}
            </section>
          </div>
        )}

        {page === "contact" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-5">
              <div
                className="rounded-2xl border p-6 space-y-4"
                style={{
                  backgroundColor: "var(--ts-card-bg, #FFFFFF)",
                  borderColor: "var(--ts-border-color, #E7E1D8)",
                }}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9E2A2B]">
                    Store Contact Details
                  </span>
                  <h1 className="font-display text-3xl font-bold mt-1">
                    {matchedCmsPage?.heading || `Contact ${cms.brandName}`}
                  </h1>
                  <p className="text-xs text-[#5D574F] mt-1">
                    {matchedCmsPage?.subtitle ||
                      "Reach out for sizing assistance, Ajrak gift sets, or order inquiries in Mithi, Tharparkar."}
                  </p>
                </div>

                <div className="space-y-3 text-xs pt-2 border-t border-[#F2EDE4]">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-[#9E2A2B] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Location</p>
                      <p className="text-[#5D574F]">
                        {st.address ? `${st.address}, ` : ""}
                        {st.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"}
                      </p>
                    </div>
                  </div>

                  {st.phone && (
                    <div className="flex items-start gap-2.5">
                      <Phone className="h-4 w-4 text-[#9E2A2B] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Phone</p>
                        <p className="text-[#5D574F]">{st.phone}</p>
                      </div>
                    </div>
                  )}

                  {st.whatsapp && (
                    <div className="flex items-start gap-2.5">
                      <MessageCircle className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">WhatsApp</p>
                        <a
                          href={`https://wa.me/${st.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline"
                        >
                          {st.whatsapp}
                        </a>
                      </div>
                    </div>
                  )}

                  {st.email && (
                    <div className="flex items-start gap-2.5">
                      <Mail className="h-4 w-4 text-[#9E2A2B] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Email</p>
                        <p className="text-[#5D574F]">{st.email}</p>
                      </div>
                    </div>
                  )}

                  {st.openingHours && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-[#8E6B35] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Store Opening Hours</p>
                        <p className="text-[#5D574F]">{st.openingHours}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {st.googleMapsEmbedUrl ? (
                <div className="rounded-2xl border border-[#E7E1D8] bg-white overflow-hidden h-64">
                  <iframe
                    src={st.googleMapsEmbedUrl}
                    title="THAR STYLE Mithi Location Map"
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#DFD8CE] bg-white p-6 text-center space-y-1.5">
                  <MapPin className="mx-auto h-6 w-6 text-[#8E6B35]" />
                  <p className="text-xs font-semibold">
                    {st.cityLocation || "Mithi, Tharparkar, Sindh, Pakistan"}
                  </p>
                  <p className="text-[11px] text-[#8D857B]">
                    Storefront street address, phone &amp; Google Map pin can be configured anytime in Store Settings.
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={handleContactSubmit}
              className="lg:col-span-7 rounded-2xl border p-6 lg:p-8 space-y-4 h-fit"
              style={{
                backgroundColor: "var(--ts-card-bg, #FFFFFF)",
                borderColor: "var(--ts-border-color, #E7E1D8)",
              }}
            >
              <h2 className="font-display text-2xl font-bold">Send Us a Message</h2>
              {sentNotice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {sentNotice}
                </div>
              )}
              {sendError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                  {sendError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 3xx xxxxxxx"
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5"
                  />
                </div>
              </div>
              <div className="text-xs">
                <label className="block font-semibold text-[#3A3631] mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can our Mithi boutique assist you today?"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5"
                />
              </div>
              <button type="submit" disabled={sending} className="rounded-lg px-6 py-3 ts-btn-primary cursor-pointer">
                {sending ? "Sending..." : "Submit Inquiry"}
              </button>
            </form>
          </div>
        )}

        {page !== "about" && page !== "contact" && (
          <div
            className="max-w-3xl mx-auto rounded-2xl border p-8 space-y-5"
            style={{
              backgroundColor: "var(--ts-card-bg, #FFFFFF)",
              borderColor: "var(--ts-border-color, #E7E1D8)",
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#9E2A2B]">
              <ShieldCheck className="h-4 w-4" />
              <span>
                {cms.brandName} · {matchedCmsPage?.subtitle || "Store Information"}
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold">
              {matchedCmsPage?.heading ||
                (page === "policy-return"
                  ? "Return & Exchange Policy"
                  : page === "policy-privacy"
                  ? "Privacy Policy"
                  : page === "policy-shipping"
                  ? "Shipping Policy"
                  : page === "size-guide"
                  ? "Size Guide"
                  : page === "faq"
                  ? "Frequently Asked Questions"
                  : "Terms & Conditions")}
            </h1>

            {matchedCmsPage?.imageUrl && (
              <img
                src={matchedCmsPage.imageUrl}
                alt={matchedCmsPage.title}
                referrerPolicy="no-referrer"
                className="w-full max-h-72 rounded-xl object-cover border border-[#E7E1D8]"
              />
            )}

            {matchedCmsPage?.bodyHtml ? (
              <div
                className="space-y-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(matchedCmsPage.bodyHtml) }}
              />
            ) : (
              <p className="text-sm text-[#3A3631] leading-relaxed whitespace-pre-line">
                {page === "policy-return"
                  ? st.returnPolicy
                  : page === "policy-privacy"
                  ? st.privacyPolicy
                  : st.termsPolicy}
              </p>
            )}

            <div className="pt-4 border-t border-[#F2EDE4] flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigateRoute(matchedCmsPage?.ctaHref || "/")}
                className="rounded-lg px-5 py-2.5 ts-btn-primary cursor-pointer"
              >
                {matchedCmsPage?.ctaText || "Continue Shopping"}
              </button>
            </div>
          </div>
        )}
      </main>

      <PublicFooter cms={cms} categories={allCategories} onNavigateRoute={onNavigateRoute} />
    </div>
  );
};
