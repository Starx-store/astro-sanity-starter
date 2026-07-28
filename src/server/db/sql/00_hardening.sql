-- تصليب قاعدة البيانات لسجل المحفظة: منع التعديل والحذف (Append-only).
-- شغّل هذا الملف مرة واحدة بعد تطبيق الهجرات:
--   psql "$DATABASE_URL" -f src/server/db/sql/00_hardening.sql
-- (يُطبَّق تلقائيًا أيضًا ضمن سكربت db:seed.)

CREATE OR REPLACE FUNCTION evo_block_wtx_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions سجل إلحاقي: التعديل والحذف ممنوعان. استخدم قيد correction.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wtx_no_update ON wallet_transactions;
CREATE TRIGGER trg_wtx_no_update
  BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION evo_block_wtx_mutation();

DROP TRIGGER IF EXISTS trg_wtx_no_delete ON wallet_transactions;
CREATE TRIGGER trg_wtx_no_delete
  BEFORE DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION evo_block_wtx_mutation();

-- قيود سلامة إضافية: المبلغ موجب دائمًا (الاتجاه يحدد الأثر).
ALTER TABLE wallet_transactions
  DROP CONSTRAINT IF EXISTS wtx_amount_positive;
ALTER TABLE wallet_transactions
  ADD CONSTRAINT wtx_amount_positive CHECK (amount > 0);

-- منع الرصيد السالب على مستوى قاعدة البيانات (طبقة دفاع أخيرة).
ALTER TABLE wallets
  DROP CONSTRAINT IF EXISTS wallets_balance_nonneg;
ALTER TABLE wallets
  ADD CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0 AND held_balance >= 0);
