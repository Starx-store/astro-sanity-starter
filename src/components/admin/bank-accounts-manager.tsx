"use client";

import { useState } from "react";
import { useLocale } from "@/lib/use-locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { BankAccount } from "@/server/db/schema";
import type { BankAccountInput } from "@/server/validation/bank-accounts";

const T = {
  ar: {
    title: "الحسابات البنكية",
    add: "إضافة حساب",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ",
    cancel: "إلغاء",
    bankName: "اسم البنك",
    accountName: "اسم صاحب الحساب",
    accountNumber: "رقم الحساب",
    iban: "رقم الآيبان (IBAN)",
    currency: "العملة",
    notes: "ملاحظات",
    active: "نشط",
    inactive: "معطل",
    sortOrder: "الترتيب",
    confirmDelete: "هل أنت متأكد من حذف هذا الحساب؟",
    empty: "لا توجد حسابات بنكية مضافة.",
  },
  en: {
    title: "Bank Accounts",
    add: "Add Account",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    bankName: "Bank Name",
    accountName: "Account Name",
    accountNumber: "Account Number",
    iban: "IBAN",
    currency: "Currency",
    notes: "Notes",
    active: "Active",
    inactive: "Inactive",
    sortOrder: "Sort Order",
    confirmDelete: "Are you sure you want to delete this account?",
    empty: "No bank accounts added.",
  },
};

export function BankAccountsManager({
  initialAccounts,
}: {
  initialAccounts: BankAccount[];
}) {
  const locale = useLocale();
  const t = T[locale];
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<BankAccountInput>({
    bankName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    currency: "SAR",
    notes: "",
    logo: "",
    isActive: true,
    sortOrder: 0,
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenForm = (account?: BankAccount) => {
    setError("");
    if (account) {
      setEditingId(account.id);
      setFormData({
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        iban: account.iban || "",
        currency: account.currency,
        notes: account.notes || "",
        logo: account.logo || "",
        isActive: account.isActive,
        sortOrder: account.sortOrder,
      });
    } else {
      setEditingId(null);
      setFormData({
        bankName: "",
        accountName: "",
        accountNumber: "",
        iban: "",
        currency: "SAR",
        notes: "",
        logo: "",
        isActive: true,
        sortOrder: 0,
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (editingId) {
        const res = await apiPut<BankAccount>(`/api/admin/bank-accounts/${editingId}`, formData);
        if (!res.ok) {
          const detailMsg = res.fieldErrors
            ? Object.values(res.fieldErrors).join(" — ")
            : res.error || "تعذّر حفظ التعديلات.";
          setError(detailMsg);
          return;
        }
        setAccounts((prev) =>
          prev.map((a) => (a.id === editingId ? res.data : a))
        );
      } else {
        const res = await apiPost<BankAccount>("/api/admin/bank-accounts", formData);
        if (!res.ok) {
          const detailMsg = res.fieldErrors
            ? Object.values(res.fieldErrors).join(" — ")
            : res.error || "تعذّر إضافة الحساب البنكي.";
          setError(detailMsg);
          return;
        }
        setAccounts((prev) => [res.data, ...prev]);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      const res = await apiDelete(`/api/admin/bank-accounts/${id}`);
      if (!res.ok) {
        alert(res.error || "تعذّر حذف الحساب البنكي.");
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleActive = async (account: BankAccount) => {
    try {
      const res = await apiPut<BankAccount>(`/api/admin/bank-accounts/${account.id}`, {
        isActive: !account.isActive,
      });
      if (!res.ok) {
        alert(res.error || "تعذّر تغيير حالة الحساب البنكي.");
        return;
      }
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? res.data : a))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <Button onClick={() => handleOpenForm()}>{t.add}</Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {isFormOpen && (
        <Card className="p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t.bankName}>
                <Input
                  required
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </Field>
              <Field label={t.accountName}>
                <Input
                  required
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </Field>
              <Field label={t.accountNumber}>
                <Input
                  required
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </Field>
              <Field label={t.iban}>
                <Input
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                />
              </Field>
              <Field label={t.currency}>
                <Input
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </Field>
              <Field label={t.sortOrder}>
                <Input
                  type="number"
                  min="0"
                  required
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label={t.notes}>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" loading={isLoading}>
                {t.save}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            {t.empty}
          </div>
        ) : (
          accounts.map((account) => (
            <Card key={account.id} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{account.bankName}</h3>
                  <Badge variant={account.isActive ? "success" : "neutral"} className="cursor-pointer" onClick={() => toggleActive(account)}>
                    {account.isActive ? t.active : t.inactive}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <p><span className="font-medium">{t.accountName}:</span> {account.accountName}</p>
                  <p><span className="font-medium">{t.accountNumber}:</span> {account.accountNumber}</p>
                  {account.iban && <p><span className="font-medium">{t.iban}:</span> {account.iban}</p>}
                  {account.notes && <p className="text-xs text-gray-500 mt-2">{account.notes}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleOpenForm(account)}>
                  {t.edit}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => handleDelete(account.id)}>
                  {t.delete}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
