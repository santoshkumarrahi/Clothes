import React, { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { AuthUser, DbBusiness } from "../types";

interface AuthViewsProps {
  mode: "login" | "signup" | "forgot" | "admin-login";
  defaultAccountType?: "customer" | "business_owner";
  onBackPublic: () => void;
  onSwitchMode: (mode: "login" | "signup" | "forgot" | "admin-login") => void;
  onAuthSuccess: (payload: { token: string; user: AuthUser; businesses: DbBusiness[] }) => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  mode,
  onBackPublic,
  onSwitchMode,
  onAuthSuccess,
}) => {
  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Signup state
  const [signupMethod, setSignupMethod] = useState<"email" | "mobile">("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+92");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Verification OTP screen state
  const [verifyState, setVerifyState] = useState<{
    active: boolean;
    target: string;
    channel: "email" | "mobile";
    sandboxOtp?: string;
  }>({ active: false, target: "", channel: "email" });
  const [otpInput, setOtpInput] = useState("");

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [resetStage, setResetStage] = useState(false);
  const [resetTarget, setResetTarget] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [sandboxResetOtp, setSandboxResetOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresVerification) {
          setVerifyState({
            active: true,
            target: data.target,
            channel: data.channel,
            sandboxOtp: data.sandboxOtpPreview,
          });
          setInfoMsg(data.error);
          return;
        }
        throw new Error(data.error || "Sign in failed.");
      }
      if (mode === "admin-login" && data.user?.role !== "super_admin") {
        throw new Error(
          "Store Admin privileges are required here. Use Customer Sign In for shopper accounts."
        );
      }
      onAuthSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          method: signupMethod,
          email: signupMethod === "email" ? email : undefined,
          countryCode,
          mobile: signupMethod === "mobile" || mobile ? mobile : undefined,
          password,
          accountType: "customer",
          acceptTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      setVerifyState({
        active: true,
        target: data.target,
        channel: data.channel,
        sandboxOtp: data.sandboxOtpPreview,
      });
      setInfoMsg(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: verifyState.target,
          channel: verifyState.channel,
          code: otpInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      onAuthSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset request failed.");
      setResetTarget(data.target);
      setSandboxResetOtp(data.sandboxOtpPreview);
      setResetStage(true);
      setInfoMsg(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: resetTarget, code: resetCode, newPassword: resetNewPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed.");
      setResetStage(false);
      setInfoMsg(data.message);
      onSwitchMode("login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={onBackPublic}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5D574F] hover:text-[#9E2A2B] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to THAR STYLE Store
        </button>

        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 sm:p-7 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <p className="font-display text-2xl font-bold tracking-[0.06em] uppercase text-[#141413]">
              THAR STYLE
            </p>
            <p className="text-xs uppercase tracking-[0.16em] text-[#8E6B35]">
              Fashion for Every Generation · Mithi, Tharparkar
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
              {infoMsg}
            </div>
          )}

          {verifyState.active ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <ShieldCheck className="mx-auto h-9 w-9 text-[#9E2A2B]" />
                <h2 className="font-display text-base font-bold text-[#141413]">
                  Verify Your {verifyState.channel === "email" ? "Email Address" : "Mobile Number"}
                </h2>
                <p className="text-xs text-[#5D574F]">
                  Enter the 6-digit verification code sent to <strong>{verifyState.target}</strong>
                </p>
              </div>

              {verifyState.sandboxOtp && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-900">
                  Verification Code: <strong className="font-mono text-sm">{verifyState.sandboxOtp}</strong>
                </div>
              )}

              <input
                required
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5 text-center font-mono text-lg font-bold tracking-widest"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#141413] py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/auth/resend-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target: verifyState.target, channel: verifyState.channel }),
                  });
                  const d = await res.json();
                  if (res.ok) {
                    setVerifyState({ ...verifyState, sandboxOtp: d.sandboxOtpPreview });
                    setInfoMsg(d.message);
                  }
                }}
                className="w-full text-xs font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
              >
                Resend Verification Code
              </button>
            </form>
          ) : mode === "forgot" ? (
            !resetStage ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="text-center">
                  <KeyRound className="mx-auto h-8 w-8 text-[#9E2A2B] mb-1" />
                  <h2 className="font-display text-base font-bold text-[#141413]">Recover Account</h2>
                  <p className="text-xs text-[#5D574F]">Enter your registered email or mobile number</p>
                </div>
                <input
                  required
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Email or 03xx mobile number"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#141413] py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
                >
                  Send Single-Use Reset Code
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchMode("login")}
                  className="w-full text-xs font-semibold text-[#5D574F] hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
                <h2 className="font-display text-base font-bold text-[#141413] text-center">Set New Password</h2>
                {sandboxResetOtp && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-center text-amber-900">
                    Reset OTP: <strong className="font-mono">{sandboxResetOtp}</strong>
                  </div>
                )}
                <input
                  required
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit Reset OTP"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 font-mono"
                />
                <input
                  required
                  type="password"
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="New Password (min 6 characters)"
                  className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#141413] py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            )
          ) : mode === "login" || mode === "admin-login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-[#141413]">
                    {mode === "admin-login" ? "Store Admin Portal" : "Sign In"}
                  </h2>
                  {mode === "admin-login" && (
                    <span className="rounded bg-[#9E2A2B] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </div>
                {mode === "admin-login" ? (
                  <button
                    type="button"
                    onClick={() => onSwitchMode("login")}
                    className="text-xs font-semibold text-[#5D574F] hover:text-[#9E2A2B] cursor-pointer"
                  >
                    Customer Login
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSwitchMode("signup")}
                    className="text-xs font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">
                    {mode === "admin-login" ? "Admin Email or Username" : "Email or Mobile Number"}
                  </label>
                  <input
                    required
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={mode === "admin-login" ? "admin@tharstyle.pk" : "you@domain.com or +92300..."}
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2.5 pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-2.5 text-[#8D857B] hover:text-[#141413]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-[#5D574F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[#9E2A2B]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => onSwitchMode("forgot")}
                  className="font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#141413] py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                {loading
                  ? "Signing In..."
                  : mode === "admin-login"
                  ? "Sign In to Admin Dashboard"
                  : "Sign In"}
              </button>

              {/* Quick Demo Login Buttons */}
              <div className="pt-3 border-t border-[#F2EDE4] space-y-2">
                <p className="text-[11px] font-semibold text-[#8D857B]">Quick Demo Access (Click to Fill):</p>
                {mode === "admin-login" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier("admin@tharstyle.pk");
                      setLoginPassword("Admin@123");
                    }}
                    className="w-full rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] py-2 text-[11px] font-semibold text-[#141413] hover:border-[#9E2A2B] cursor-pointer"
                  >
                    Fill Super Admin Credentials (admin@tharstyle.pk)
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginIdentifier("ayesha@tharstyle.pk");
                        setLoginPassword("Customer@123");
                      }}
                      className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] py-2 font-semibold text-[#141413] hover:border-[#9E2A2B] cursor-pointer"
                    >
                      Customer Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginIdentifier("admin@tharstyle.pk");
                        setLoginPassword("Admin@123");
                      }}
                      className="rounded-lg border border-[#DFD8CE] bg-[#FAF8F5] py-2 font-semibold text-[#141413] hover:border-[#9E2A2B] cursor-pointer"
                    >
                      Store Admin
                    </button>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-2">
                <h2 className="font-display text-base font-bold text-[#141413]">Create Customer Account</h2>
                <button
                  type="button"
                  onClick={() => onSwitchMode("login")}
                  className="text-xs font-semibold text-[#9E2A2B] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </div>

              <div className="flex rounded-lg bg-[#FAF8F5] border border-[#E7E1D8] p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSignupMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 cursor-pointer ${
                    signupMethod === "email" ? "bg-white text-[#141413] shadow-xs" : "text-[#5D574F]"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setSignupMethod("mobile")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 cursor-pointer ${
                    signupMethod === "mobile" ? "bg-white text-[#141413] shadow-xs" : "text-[#5D574F]"
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Mobile OTP
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#3A3631] mb-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ayesha Samejo"
                    className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 text-sm"
                  />
                </div>

                {signupMethod === "email" ? (
                  <>
                    <div>
                      <label className="block font-semibold text-[#3A3631] mb-1">Email Address</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#3A3631] mb-1">Mobile (Optional)</label>
                      <input
                        type="text"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="3001234567"
                        className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block font-semibold text-[#3A3631] mb-1">Mobile Number</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="rounded-lg border border-[#DFD8CE] px-2.5 py-2 bg-[#FAF8F5] font-semibold"
                      >
                        <option value="+92">+92 (PK)</option>
                        <option value="+971">+971 (UAE)</option>
                      </select>
                      <input
                        required
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="3001234567"
                        className="flex-1 rounded-lg border border-[#DFD8CE] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-[#3A3631] mb-1">Password</label>
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3A3631] mb-1">Confirm</label>
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat"
                      className="w-full rounded-lg border border-[#DFD8CE] px-3 py-2"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[#5D574F] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="accent-[#9E2A2B]"
                  />
                  <span>I accept THAR STYLE Terms & Privacy Policy</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#141413] py-2.5 text-xs font-bold text-white hover:bg-[#9E2A2B] cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{loading ? "Creating Account..." : "Create Account & Verify"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
