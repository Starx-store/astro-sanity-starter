"use client";

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string>;
    };

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const json = await res.json().catch(() => null);
  if (!json) {
    return { ok: false, error: "استجابة غير صالحة من الخادم." };
  }
  return json as ApiResult<T>;
}

/** استدعاء GET بنتيجة موحّدة. */
export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    return await toResult<T>(res);
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الشبكة." };
  }
}

/** استدعاء JSON POST بنتيجة موحّدة. */
export async function apiPost<T>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await toResult<T>(res);
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الشبكة." };
  }
}

/** استدعاء JSON PUT بنتيجة موحّدة. */
export async function apiPut<T>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await toResult<T>(res);
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الشبكة." };
  }
}

/** استدعاء POST بنموذج متعدد الأجزاء (رفع ملفات). */
export async function apiPostForm<T>(
  url: string,
  form: FormData,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", body: form });
    return await toResult<T>(res);
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الشبكة." };
  }
}

/** استدعاء DELETE بنتيجة موحّدة. */
export async function apiDelete<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "DELETE" });
    return await toResult<T>(res);
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الشبكة." };
  }
}

