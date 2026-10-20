export type SymbolKind = "component" | "function" | "method" | "type" | "interface" | "struct" | "export" | "package" | "unknown";

export const SYMBOL_KIND_COLORS: Record<SymbolKind, { bg: string; border: string; text: string }> = {
  component: { bg: "bg-violet-50", border: "border-violet-200/60", text: "text-violet-700" },
  function: { bg: "bg-emerald-50", border: "border-emerald-200/60", text: "text-emerald-700" },
  method: { bg: "bg-teal-50", border: "border-teal-200/60", text: "text-teal-700" },
  type: { bg: "bg-amber-50", border: "border-amber-200/60", text: "text-amber-700" },
  interface: { bg: "bg-amber-50", border: "border-amber-200/60", text: "text-amber-700" },
  struct: { bg: "bg-orange-50", border: "border-orange-200/60", text: "text-orange-700" },
  export: { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-700" },
  package: { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-700" },
  unknown: { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-700" },
};

export function symbolKindColors(kind: string) {
  const key = (kind.toLowerCase() as SymbolKind) ?? "unknown";
  return SYMBOL_KIND_COLORS[key] ?? SYMBOL_KIND_COLORS.unknown;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export const HTTP_METHOD_COLORS: Record<HttpMethod, { bg: string; border: string; text: string }> = {
  GET: { bg: "bg-emerald-50", border: "border-emerald-200/60", text: "text-emerald-700" },
  POST: { bg: "bg-blue-50", border: "border-blue-200/60", text: "text-blue-700" },
  PUT: { bg: "bg-amber-50", border: "border-amber-200/60", text: "text-amber-700" },
  PATCH: { bg: "bg-amber-50", border: "border-amber-200/60", text: "text-amber-700" },
  DELETE: { bg: "bg-rose-50", border: "border-rose-200/60", text: "text-rose-700" },
  HEAD: { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-700" },
  OPTIONS: { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-700" },
};

export function httpMethodColors(method: string) {
  const key = (method.toUpperCase() as HttpMethod) ?? "GET";
  return HTTP_METHOD_COLORS[key] ?? HTTP_METHOD_COLORS.GET;
}
