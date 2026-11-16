export function formatPKR(amount: number): string {
  const rounded = Math.round(amount);
  return `Rs. ${rounded.toLocaleString("en-PK")}`;
}

export function exportToCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (val: string | number) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function speakUrduOrEnglish(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith("ur")) ||
      voices.find((v) => v.lang.includes("PK") || v.lang.includes("IN")) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers
  }
}

export interface ParsedAICommandResult {
  intent:
    | "CREATE_SALE"
    | "RECORD_PAYMENT"
    | "ADD_EXPENSE"
    | "CHECK_STOCK"
    | "CHECK_KHATA"
    | "PROFIT_REPORT"
    | "CREATE_PO"
    | "GENERAL_ADVICE";
  confidence: number;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  spokenReply: string;
  extracted?: {
    productName?: string;
    quantity?: number;
    unit?: string;
    customerName?: string;
    amount?: number;
    expenseCategory?: string;
    paymentMethod?: string;
  };
}

// Offline deterministic parser used ONLY when user toggles Offline Mode (PRD Section 9.1)
export function parseOfflineCommand(
  input: string,
  context: {
    products: Array<{ name: string; stock: number; unit: string; sellingPrice: number }>;
    customers: Array<{ name: string; khataBalance: number }>;
    salesTotal: number;
    profitTotal: number;
  }
): ParsedAICommandResult {
  const lower = input.toLowerCase();
  const numMatch = input.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
  const numericVal = numMatch ? Number(numMatch[1].replace(/,/g, "")) : undefined;

  const matchedCustomer = context.customers.find((c) =>
    lower.includes(c.name.toLowerCase().split(" ")[0])
  );
  const matchedProduct = context.products.find((p) => {
    const firstWord = p.name.toLowerCase().split(" ")[0];
    return lower.includes(firstWord) || (firstWord === "cheeni" && lower.includes("sugar"));
  });

  if (lower.includes("munafa") || lower.includes("profit")) {
    return {
      intent: "PROFIT_REPORT",
      confidence: 0.92,
      requiresConfirmation: false,
      spokenReply: `Offline cache ke mutabiq kul farokht ${formatPKR(context.salesTotal)} aur khalis munafa ${formatPKR(context.profitTotal)} hai.`,
    };
  }

  if (lower.includes("stock") || lower.includes("baqi") || lower.includes("kitna")) {
    if (matchedProduct) {
      return {
        intent: "CHECK_STOCK",
        confidence: 0.9,
        requiresConfirmation: false,
        spokenReply: `${matchedProduct.name} ka mojooda stock ${matchedProduct.stock} ${matchedProduct.unit} hai.`,
      };
    }
    const low = context.products.filter((p) => p.stock <= 10).map((p) => `${p.name} (${p.stock} ${p.unit})`);
    return {
      intent: "CHECK_STOCK",
      confidence: 0.85,
      requiresConfirmation: false,
      spokenReply: low.length
        ? `Kam stock wale items: ${low.join(", ")}.`
        : "Tamam products ka stock munasib miqdar mein hai.",
    };
  }

  if (lower.includes("udhaar") || lower.includes("khata") || lower.includes("pending")) {
    const overdue = context.customers.filter((c) => c.khataBalance > 0);
    const total = overdue.reduce((s, c) => s + c.khataBalance, 0);
    return {
      intent: "CHECK_KHATA",
      confidence: 0.88,
      requiresConfirmation: false,
      spokenReply: `${overdue.length} customers ke zimme kul ${formatPKR(total)} udhaar baqi hai. Sab se zyada ${overdue[0]?.name || "customer"} (${formatPKR(overdue[0]?.khataBalance || 0)}) ka hai.`,
    };
  }

  if (lower.includes("diya") || lower.includes("diye") || lower.includes("payment") || lower.includes("receive")) {
    const amt = numericVal || (lower.includes("do hazaar") ? 2000 : lower.includes("teen hazaar") ? 3000 : 1000);
    const cust = matchedCustomer?.name || "Ali Raza";
    return {
      intent: "RECORD_PAYMENT",
      confidence: 0.89,
      requiresConfirmation: true,
      confirmationPrompt: `${cust} ke account mein ${formatPKR(amt)} payment receive record kar doon? (Offline queue)`,
      spokenReply: `${cust} se ${formatPKR(amt)} wasooli ki tasdeeq darkar hai.`,
      extracted: { customerName: cust, amount: amt, paymentMethod: "Cash" },
    };
  }

  if (lower.includes("sale") || lower.includes("bech") || lower.includes("kilo") || lower.includes("karo")) {
    const qty = numericVal || (lower.includes("paanch") ? 5 : 1);
    const prod = matchedProduct || context.products[0];
    const amt = qty * (prod?.sellingPrice || 148);
    return {
      intent: "CREATE_SALE",
      confidence: 0.87,
      requiresConfirmation: true,
      confirmationPrompt: `${qty} ${prod?.unit || "kg"} ${prod?.name || "Cheeni"} (${formatPKR(amt)}) ki sale record kar doon?`,
      spokenReply: `${qty} ${prod?.unit || "kg"} ${prod?.name || "Cheeni"} bill ${formatPKR(amt)} tayyar hai.`,
      extracted: { productName: prod?.name, quantity: qty, unit: prod?.unit, amount: amt, paymentMethod: "Cash" },
    };
  }

  if (lower.includes("order") || lower.includes("carton") || lower.includes("bag")) {
    const qty = numericVal || 10;
    const prod = matchedProduct || context.products[0];
    return {
      intent: "CREATE_PO",
      confidence: 0.84,
      requiresConfirmation: true,
      confirmationPrompt: `${prod?.name || "Cheeni"} ke ${qty} units ka Purchase Order tayyar kar doon?`,
      spokenReply: `${qty} units ka purchase order review ke liye tayyar hai.`,
      extracted: { productName: prod?.name, quantity: qty, amount: qty * 132 },
    };
  }

  return {
    intent: "GENERAL_ADVICE",
    confidence: 0.7,
    requiresConfirmation: false,
    spokenReply: "Offline mode active hai. Aap sale, payment, stock ya khata ke mutalliq pooch sakte hain.",
  };
}
