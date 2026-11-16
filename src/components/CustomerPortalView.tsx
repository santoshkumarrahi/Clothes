import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  LogOut,
  MapPin,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { AuthUser, CartItem, CustomerAddress, DbOrder, DbProduct, StoreSettingsConfig } from "../types";
import { formatPKR } from "../utils/formatters";

interface CustomerPortalViewProps {
  user: AuthUser;
  authToken: string;
  cart: CartItem[];
  storeSettings?: StoreSettingsConfig;
  initialTab?: "orders" | "cart" | "addresses" | "wishlist" | "profile";
  onUpdateCartQty: (productId: string, variantLabel: string, delta: number) => void;
  onClearCartForBusiness: (businessId: string) => void;
  onBackPublic: () => void;
  onOpenStore: (slug: string) => void;
  onOpenProduct?: (productId: string) => void;
  onLogout: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  user,
  authToken,
  cart,
  storeSettings,
  initialTab = "orders",
  onUpdateCartQty,
  onClearCartForBusiness,
  onBackPublic,
  onOpenStore,
  onOpenProduct,
  onLogout,
}) => {
  const [tab, setTab] = useState<"orders" | "cart" | "addresses" | "wishlist" | "profile">(initialTab);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wishlist, setWishlist] = useState<DbProduct[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [orderNotes, setOrderNotes] = useState("");
  const [newAddr, setNewAddr] = useState({
    label: "Home",
    recipient: user.fullName,
    phone: user.mobile || "+92 300 ",
    city: "Mithi, Tharparkar",
    streetAddress: "",
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deliveryFeeBase = Number(storeSettings?.deliveryFee ?? 200);
  const freeDeliveryThreshold = Number(storeSettings?.freeDeliveryThreshold ?? 5000);
  const pmConfig = storeSettings?.paymentMethods || {
    cod: true,
    jazzcash: false,
    easypaisa: false,
    bankTransfer: false,
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  const loadCustomerData = async () => {
    try {
      const [ordRes, addrRes, wishRes] = await Promise.all([
        fetch("/api/customer/orders", { headers: authHeaders }),
        fetch("/api/customer/addresses", { headers: authHeaders }),
        fetch("/api/customer/wishlist", { headers: authHeaders }),
      ]);
      const ordData = await ordRes.json();
      const addrData = await addrRes.json();
      const wishData = await wishRes.json();
      setOrders(ordData.orders || []);
      const addrList: CustomerAddress[] = addrData.addresses || [];
      setAddresses(addrList);
      if (addrList.length > 0 && !selectedAddressId) setSelectedAddressId(addrList[0].id);
      setWishlist(wishData.items || []);
    } catch {
      // ignore transient
    }
  };

  useEffect(() => {
    loadCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const cartByBusiness = cart.reduce<Record<string, { businessName: string; items: CartItem[] }>>((acc, item) => {
    const bid = item.product.business_id || "biz-thar-style";
    if (!acc[bid]) {
      acc[bid] = { businessName: "THAR STYLE · Mithi, Tharparkar", items: [] };
    }
    acc[bid].items.push(item);
    return acc;
  }, {});

  const handleCheckoutBusiness = async (businessId: string, items: CartItem[]) => {
    setErrorMsg(null);
    setStatusMsg(null);
    const addr = addresses.find((a) => a.id === selectedAddressId);
    const deliveryAddress = addr
      ? `${addr.street_address}, ${addr.city} (${addr.phone})`
      : newAddr.streetAddress
      ? `${newAddr.streetAddress}, ${newAddr.city}`
      : "";

    if (!deliveryAddress) {
      setErrorMsg("Please select or enter a delivery address before placing your order.");
      return;
    }

    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          businessId,
          items: items.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
            variantLabel: it.variantLabel,
          })),
          deliveryAddress,
          customerPhone: addr?.phone || user.mobile || "+92 300 0000000",
          paymentMethod,
          notes: orderNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order placement failed.");

      onClearCartForBusiness(businessId);
      setStatusMsg(
        `Order ${data.order.orderNumber} placed successfully! Total: ${formatPKR(data.order.total)}.`
      );
      await loadCustomerData();
      setTab("orders");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not place order.");
    }
  };

  const handleCancelOrder = async (orderId: string, orderNum: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel order.");
      setStatusMsg(`Order ${orderNum} has been cancelled and stock restored.`);
      await loadCustomerData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to cancel order.");
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/customer/addresses", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(newAddr),
    });
    const data = await res.json();
    if (res.ok) {
      setAddresses(data.addresses || []);
      setNewAddr({ ...newAddr, streetAddress: "" });
      setStatusMsg("Delivery address saved.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#141413]">
      <header className="border-b border-[#E7E1D8] bg-white px-4 py-4 lg:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackPublic}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5D574F] hover:text-[#9E2A2B] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </button>
          <span className="font-display text-base font-bold text-[#141413]">
            THAR STYLE · {user.fullName}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white border border-[#E7E1D8] p-1.5 w-fit">
          {(
            [
              { id: "orders", label: `My Orders (${orders.length})`, icon: Package },
              {
                id: "cart",
                label: `Shopping Bag (${cart.reduce((s, c) => s + c.quantity, 0)})`,
                icon: ShoppingCart,
              },
              { id: "addresses", label: "Addresses", icon: MapPin },
              { id: "wishlist", label: `Wishlist (${wishlist.length})`, icon: Heart },
              { id: "profile", label: "Account", icon: User },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                  tab === t.id ? "bg-[#141413] text-white" : "text-[#5D574F] hover:bg-[#FAF8F5]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {statusMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* 1. My Orders */}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-[#E7E1D8] bg-white p-10 text-center space-y-3">
                <Package className="mx-auto h-9 w-9 text-[#C7BEB0]" />
                <p className="text-sm font-semibold text-[#141413]">No orders placed yet</p>
                <button
                  type="button"
                  onClick={onBackPublic}
                  className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
                >
                  Shop Collections
                </button>
              </div>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDE4] pb-3">
                    <div>
                      <p className="font-display text-base font-bold text-[#141413]">
                        {ord.order_number} · {ord.business_name || "THAR STYLE"}
                      </p>
                      <p className="text-xs text-[#5D574F]">
                        {new Date(ord.created_at).toLocaleString()} · {ord.payment_method} ({ord.payment_status})
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {(ord.order_status === "Pending" || ord.order_status === "Accepted") && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(ord.id, ord.order_number)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel Order
                        </button>
                      )}
                      <div className="text-right">
                        <span className="inline-block rounded-md bg-[#FAF8F5] border border-[#E7E1D8] px-2.5 py-0.5 text-xs font-bold text-[#9E2A2B]">
                          {ord.order_status}
                        </span>
                        <p className="mt-1 text-base font-extrabold tabular-nums text-[#141413]">
                          {formatPKR(ord.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <p className="font-bold text-[#3A3631]">Ordered Garments</p>
                      {ord.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F5] p-2.5">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={it.image_url}
                              alt={it.product_name}
                              className="h-12 w-10 rounded-lg object-cover border border-[#E7E1D8]"
                            />
                            <div>
                              <p className="font-semibold text-[#141413]">{it.product_name}</p>
                              <p className="text-[#5D574F]">
                                {it.variant_label} × {it.quantity}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold tabular-nums">{formatPKR(it.unit_price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="font-bold text-[#3A3631]">Order Tracking</p>
                      <div className="space-y-2 border-l-2 border-[#9E2A2B]/30 pl-3">
                        {ord.history.map((h) => (
                          <div key={h.id}>
                            <p className="font-semibold text-[#141413]">{h.status}</p>
                            <p className="text-[#5D574F]">
                              {h.note} ·{" "}
                              {new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[#5D574F] pt-1">
                        Delivery Address: <strong className="text-[#141413]">{ord.delivery_address}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. Shopping Bag & Checkout */}
        {tab === "cart" && (
          <div className="space-y-4">
            {Object.keys(cartByBusiness).length === 0 ? (
              <div className="rounded-2xl border border-[#E7E1D8] bg-white p-10 text-center space-y-3">
                <ShoppingCart className="mx-auto h-9 w-9 text-[#C7BEB0]" />
                <p className="text-sm font-semibold text-[#141413]">Your shopping bag is empty</p>
                <button
                  type="button"
                  onClick={onBackPublic}
                  className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Browse Collections
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 space-y-4">
                  {Object.entries(cartByBusiness).map(([bizId, group]) => {
                    const sub = group.items.reduce(
                      (s, i) => s + (i.product.discount_price || i.product.selling_price) * i.quantity,
                      0
                    );
                    const fee = sub >= freeDeliveryThreshold ? 0 : deliveryFeeBase;
                    return (
                      <div key={bizId} className="rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-2.5">
                          <h3 className="font-display text-base font-bold text-[#141413]">
                            {group.businessName}
                          </h3>
                          <span className="text-xs text-[#5D574F] tabular-nums">
                            Delivery: {fee === 0 ? "Free" : formatPKR(fee)}
                          </span>
                        </div>

                        <div className="divide-y divide-[#F2EDE4]">
                          {group.items.map((item) => {
                            const price = item.product.discount_price || item.product.selling_price;
                            return (
                              <div key={`${item.product.id}-${item.variantLabel}`} className="py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={item.product.primaryImage}
                                    alt={item.product.name}
                                    className="h-14 w-12 rounded-lg object-cover border border-[#E7E1D8]"
                                  />
                                  <div>
                                    <p className="text-sm font-bold text-[#141413]">{item.product.name}</p>
                                    <p className="text-xs text-[#5D574F]">
                                      {item.variantLabel} · {formatPKR(price)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center rounded-lg border border-[#DFD8CE]">
                                    <button
                                      type="button"
                                      onClick={() => onUpdateCartQty(item.product.id, item.variantLabel, -1)}
                                      className="p-1.5 text-[#5D574F] cursor-pointer"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="px-2 text-xs font-bold tabular-nums">{item.quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateCartQty(item.product.id, item.variantLabel, 1)}
                                      className="p-1.5 text-[#5D574F] cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <span className="w-20 text-right text-sm font-bold tabular-nums">
                                    {formatPKR(price * item.quantity)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-3 border-t border-[#F2EDE4] flex items-center justify-between">
                          <div className="text-xs text-[#5D574F] tabular-nums">
                            <p>Subtotal: {formatPKR(sub)}</p>
                            <p className="text-sm font-extrabold text-[#141413]">
                              Total: {formatPKR(sub + fee)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCheckoutBusiness(bizId, group.items)}
                            className="rounded-lg bg-[#9E2A2B] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#141413] cursor-pointer"
                          >
                            Confirm & Place Order
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery & Payment */}
                <div className="lg:col-span-5 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-4 h-fit">
                  <h3 className="font-display text-base font-bold text-[#141413]">Delivery & Payment</h3>
                  <div className="space-y-2 text-xs">
                    <label className="block font-semibold text-[#3A3631]">Delivery Address</label>
                    {addresses.length > 0 ? (
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      >
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}: {a.street_address}, {a.city}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newAddr.streetAddress}
                        onChange={(e) => setNewAddr({ ...newAddr, streetAddress: e.target.value })}
                        placeholder="Enter street address, Mithi / City..."
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="block font-semibold text-[#3A3631]">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    >
                      {pmConfig.cod !== false && <option value="Cash on Delivery">Cash on Delivery (COD)</option>}
                      {pmConfig.jazzcash && <option value="JazzCash">JazzCash Wallet</option>}
                      {pmConfig.easypaisa && <option value="Easypaisa">Easypaisa Wallet</option>}
                      {pmConfig.bankTransfer && <option value="Bank Transfer">Bank Transfer</option>}
                    </select>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="block font-semibold text-[#3A3631]">Order Notes (Optional)</label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Sizing preference, gift wrap request, or delivery timing..."
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Addresses */}
        {tab === "addresses" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-3">
              {addresses.map((a) => (
                <div key={a.id} className="rounded-2xl border border-[#E7E1D8] bg-white p-4 flex items-center justify-between">
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#141413] text-sm">
                      {a.label} · {a.recipient}
                    </p>
                    <p className="text-[#5D574F]">
                      {a.street_address}, {a.city}
                    </p>
                    <p className="text-[#8D857B] font-mono">{a.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/customer/addresses/${a.id}`, { method: "DELETE", headers: authHeaders });
                      loadCustomerData();
                    }}
                    className="text-[#8D857B] hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddAddress} className="lg:col-span-5 rounded-2xl border border-[#E7E1D8] bg-white p-5 space-y-3 text-xs">
              <h3 className="font-display text-sm font-bold text-[#141413]">Add Delivery Address</h3>
              <input
                required
                type="text"
                value={newAddr.label}
                onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                placeholder="Label (Home / Office)"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
              <input
                required
                type="text"
                value={newAddr.phone}
                onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                placeholder="Phone"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
              <input
                required
                type="text"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                placeholder="City"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
              <textarea
                required
                rows={2}
                value={newAddr.streetAddress}
                onChange={(e) => setNewAddr({ ...newAddr, streetAddress: e.target.value })}
                placeholder="House, Mohalla, Street..."
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
              />
              <button type="submit" className="w-full rounded-lg bg-[#141413] py-2 font-bold text-white cursor-pointer">
                Save Address
              </button>
            </form>
          </div>
        )}

        {/* 4. Wishlist */}
        {tab === "wishlist" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {wishlist.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-[#E7E1D8] bg-white p-10 text-center text-xs text-[#5D574F]">
                No wishlist garments saved yet.
              </div>
            ) : (
              wishlist.map((p) => (
                <div key={p.id} className="rounded-2xl border border-[#E7E1D8] bg-white overflow-hidden">
                  <img src={p.primaryImage} alt={p.name} className="h-44 w-full object-cover" />
                  <div className="p-3.5 space-y-1.5">
                    <p className="text-xs font-bold text-[#141413] line-clamp-1">{p.name}</p>
                    <p className="text-sm font-extrabold text-[#9E2A2B] tabular-nums">
                      {formatPKR(p.discount_price || p.selling_price)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenProduct ? onOpenProduct(p.id) : p.business_slug && onOpenStore(p.business_slug)
                      }
                      className="mt-2 w-full rounded-lg bg-[#141413] py-1.5 text-xs font-semibold text-white hover:bg-[#9E2A2B] cursor-pointer"
                    >
                      View Garment
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 5. Profile */}
        {tab === "profile" && (
          <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 max-w-lg space-y-3 text-xs">
            <h2 className="font-display text-base font-bold text-[#141413]">Customer Account</h2>
            <p>
              Full Name: <strong>{user.fullName}</strong>
            </p>
            <p>
              Email: <strong>{user.email || "—"}</strong> ({user.emailVerified ? "Verified" : "Unverified"})
            </p>
            <p>
              Mobile: <strong>{user.mobile || "—"}</strong> ({user.mobileVerified ? "Verified" : "Unverified"})
            </p>
            <div className="pt-3 border-t border-[#F2EDE4]">
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg bg-[#9E2A2B] px-4 py-2 font-bold text-white cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
