import type { ProviderAdapter } from "./types";
import { mockAdapter } from "./mock";
import { smmAdapter } from "./smm";

/** سجل المحوّلات المتاحة — أضف محوّلًا جديدًا هنا فقط. */
const ADAPTERS: Record<string, ProviderAdapter> = {
  [mockAdapter.key]: mockAdapter,
  [smmAdapter.key]: smmAdapter,
};

export function getAdapter(key: string): ProviderAdapter {
  const a = ADAPTERS[key];
  if (!a) throw new Error(`محوّل غير معروف: ${key}`);
  return a;
}

export function listAdapters(): { key: string; label: string }[] {
  return Object.values(ADAPTERS).map((a) => ({ key: a.key, label: a.label }));
}

export function adapterCredentialFields(key: string) {
  return ADAPTERS[key]?.credentialFields ?? [];
}

export * from "./types";
