import React from "react";
import {
  Bot,
  Check,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { ASSETS } from "../data/seedData";
import { AIRecommendation } from "../types";
import { ParsedAICommandResult, speakUrduOrEnglish } from "../utils/formatters";

interface AiAgentsViewProps {
  voiceListening: boolean;
  voiceLoading: boolean;
  voiceInput: string;
  onVoiceInputChange: (val: string) => void;
  onToggleMic: () => void;
  onSubmitVoiceCommand: (cmd?: string) => void;
  voiceResult: ParsedAICommandResult | null;
  voiceError: string | null;
  onConfirmVoiceAction: () => void;
  onCancelVoiceAction: () => void;
  voiceHistory: Array<{ id: string; query: string; reply: string; time: string }>;
  recommendations: AIRecommendation[];
  onApproveRecommendation: (rec: AIRecommendation) => void;
  onDismissRecommendation: (id: string) => void;
  onRefreshInsights: () => void;
  refreshingInsights: boolean;
}

const SAMPLE_COMMANDS = [
  "Aaj Ali ne do hazaar rupay diye",
  "Paanch kilo cheeni sale karo",
  "Mera aaj ka munafa batao",
  "Kis customer ka udhaar pending hai?",
  "Kitna stock baqi hai?",
  "Electricity bill 3500 expense add karo",
];

export const AiAgentsView: React.FC<AiAgentsViewProps> = ({
  voiceListening,
  voiceLoading,
  voiceInput,
  onVoiceInputChange,
  onToggleMic,
  onSubmitVoiceCommand,
  voiceResult,
  voiceError,
  onConfirmVoiceAction,
  onCancelVoiceAction,
  voiceHistory,
  recommendations,
  onApproveRecommendation,
  onDismissRecommendation,
  onRefreshInsights,
  refreshingInsights,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Voice & Command Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#063B2B] to-[#0B5A42] p-5 text-white flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <img
              src={ASSETS.aiAssistant}
              alt="Karobar Saathi AI Assistant"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-2xl object-cover border border-emerald-300/40"
            />
            <div>
              <h1 className="font-display text-lg font-bold">Karobar Saathi AI Voice</h1>
              <p className="text-xs text-emerald-100/85">
                Urdu, Roman Urdu, English & Punjabi Business Commands
              </p>
            </div>
          </div>

          <div className="my-4 rounded-2xl bg-white/10 border border-white/15 p-3.5 text-xs leading-relaxed">
            <p className="font-semibold text-amber-300 mb-1">Financial Safety Rule Active</p>
            <p className="text-emerald-50/90">
              Uncertain or financial transactions (sales, khata payments, expenses, POs) always require your explicit confirmation before updating ledgers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMic}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                voiceListening
                  ? "border-rose-300 bg-rose-500"
                  : "border-emerald-300/70 bg-emerald-500 hover:bg-emerald-400"
              }`}
              aria-label="Toggle microphone"
            >
              {voiceListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitVoiceCommand();
              }}
              className="flex-1 flex items-center gap-2 rounded-xl bg-black/30 border border-white/15 px-3 py-2"
            >
              <input
                type="text"
                value={voiceInput}
                onChange={(e) => onVoiceInputChange(e.target.value)}
                placeholder={voiceListening ? "Bolain, main sun rahi hoon..." : "Type or speak Roman Urdu / English command..."}
                className="w-full bg-transparent text-xs text-white placeholder:text-emerald-100/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={voiceLoading || !voiceInput.trim()}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-semibold text-emerald-200/80 mb-2">Tap a sample voice command:</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    onVoiceInputChange(cmd);
                    onSubmitVoiceCommand(cmd);
                  }}
                  className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] text-emerald-50 transition-colors cursor-pointer"
                >
                  "{cmd}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Structured Intent & Confirmation + Transcript History */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bot className="h-4.5 w-4.5 text-emerald-700" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Transaction Preparation & Confirmation
                </h2>
              </div>
              {voiceResult && (
                <button
                  type="button"
                  onClick={() =>
                    speakUrduOrEnglish(voiceResult.confirmationPrompt || voiceResult.spokenReply)
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Read Aloud
                </button>
              )}
            </div>

            {voiceLoading && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                Analyzing intent with Karobar Saathi AI...
              </div>
            )}

            {voiceError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{voiceError}</span>
              </div>
            )}

            {voiceResult && !voiceLoading && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900">
                    Intent: {voiceResult.intent.replace("_", " ")}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    Confidence: {Math.round(voiceResult.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {voiceResult.confirmationPrompt || voiceResult.spokenReply}
                </p>

                {voiceResult.extracted && (
                  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                    {voiceResult.extracted.customerName && (
                      <span>Customer: <strong>{voiceResult.extracted.customerName}</strong></span>
                    )}
                    {voiceResult.extracted.productName && (
                      <span>Product: <strong>{voiceResult.extracted.productName}</strong></span>
                    )}
                    {voiceResult.extracted.quantity && (
                      <span>Qty: <strong>{voiceResult.extracted.quantity} {voiceResult.extracted.unit || ""}</strong></span>
                    )}
                    {voiceResult.extracted.amount && (
                      <span>Amount: <strong className="tabular-nums">Rs. {voiceResult.extracted.amount.toLocaleString()}</strong></span>
                    )}
                  </div>
                )}

                {voiceResult.requiresConfirmation && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onConfirmVoiceAction}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-bold text-white hover:bg-[#0B6648] cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirm & Record Transaction
                    </button>
                    <button
                      type="button"
                      onClick={onCancelVoiceAction}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 mb-2">Recent Voice & Command Log</h3>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {voiceHistory.length === 0 ? (
                <p className="text-xs text-slate-400">No commands issued yet in this session.</p>
              ) : (
                voiceHistory.map((item) => (
                  <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>You: "{item.query}"</span>
                      <span className="tabular-nums">{item.time}</span>
                    </div>
                    <p className="mt-0.5 font-medium text-slate-800">{item.reply}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Specialized AI Agents Recommendations */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-amber-500" />
              Predictive AI Agents & Approval Queue
            </h2>
            <p className="text-xs text-slate-500">
              Every recommendation shows confidence, data window, and assumptions — owner approval required before execution.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefreshInsights}
            disabled={refreshingInsights}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingInsights ? "animate-spin" : ""}`} />
            Refresh AI Insights
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-emerald-800">{rec.agent}</span>
                  <span className="text-slate-500 tabular-nums">{rec.confidence}% Confidence</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{rec.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{rec.summary}</p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 space-y-0.5">
                  <p>Period: {rec.dataPeriod}</p>
                  <p>Basis: {rec.assumption}</p>
                </div>
              </div>

              {rec.status === "pending" ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onApproveRecommendation(rec)}
                    className="flex-1 rounded-xl bg-[#0F7C58] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
                  >
                    {rec.actionLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissRecommendation(rec.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <div className="text-xs font-bold text-emerald-700 capitalize">
                  Status: {rec.status}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
