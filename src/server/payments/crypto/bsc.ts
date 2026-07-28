import "server-only";
import { AppError } from "@/server/errors";

/**
 * التحقق من تحويلات BEP20 (شبكة BNB Smart Chain) مباشرة من البلوكتشين.
 *
 * لا يتطلب أي حساب تاجر أو مفاتيح: سجلات البلوكتشين علنية، فنقرأ إيصال
 * المعاملة عبر RPC عام ونتحقق من:
 *   1) نجاح المعاملة وعدد تأكيداتها،
 *   2) أن الحدث Transfer صادر من عقد عملة مقبولة،
 *   3) أن المستلم هو محفظة المتجر بالضبط،
 *   4) أن المبلغ مطابق تمامًا للمطلوب.
 * ومنع التكرار يتم بفهرس فريد على رقم المعاملة في قاعدة البيانات.
 */

const DEFAULT_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://rpc.ankr.com/bsc",
];

/** توقيع الحدث Transfer(address,address,uint256). */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** العملات المستقرة المقبولة على BSC (جميعها بـ18 خانة عشرية). */
export const BSC_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDT: { address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  USDC: { address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
  BUSD: { address: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
};

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
}

interface RpcReceipt {
  status: string;
  blockNumber: string;
  from: string;
  logs: RpcLog[];
}

function rpcUrls(): string[] {
  const custom = process.env.BSC_RPC_URL?.trim();
  return custom ? [custom, ...DEFAULT_RPCS] : DEFAULT_RPCS;
}

/** نداء JSON-RPC مع تجربة عدة عقد عند الفشل. */
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: unknown = null;
  for (const url of rpcUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        lastError = new Error(`RPC ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { result?: T; error?: unknown };
      if (json.error || json.result === undefined) {
        lastError = json.error ?? new Error("empty result");
        continue;
      }
      return json.result as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw new AppError(
    "chain_unreachable",
    "تعذّر الاتصال بشبكة BNB — حاول بعد قليل.",
    502,
    undefined,
  );
}

/** تحويل قيمة hex بـ18 خانة إلى مقياسنا الداخلي (8 خانات). */
function toInternalAmount(hexValue: string, decimals: number): bigint {
  const raw = BigInt(hexValue);
  if (decimals >= 8) return raw / 10n ** BigInt(decimals - 8);
  return raw * 10n ** BigInt(8 - decimals);
}

const norm = (a: string) => a.toLowerCase().replace(/^0x/, "");

export interface ChainTransfer {
  token: string;
  amount: bigint;
  from: string;
  confirmations: number;
}

/**
 * يقرأ معاملة BEP20 ويعيد التحويل المتّجه لمحفظتنا (إن وُجد).
 * يرمي AppError برسالة عربية واضحة عند أي فشل تحقق.
 */
export async function verifyBep20Transfer(params: {
  txHash: string;
  toAddress: string;
  minConfirmations?: number;
}): Promise<ChainTransfer> {
  const hash = params.txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new AppError("bad_hash", "رقم المعاملة غير صالح.", 422, {
      txHash: "أدخل رقم معاملة صحيح (يبدأ بـ 0x وطوله 66 خانة)",
    });
  }

  const receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [
    hash,
  ]);
  if (!receipt) {
    throw new AppError(
      "tx_not_found",
      "لم نجد هذه المعاملة على الشبكة بعد — انتظر دقيقة وأعد المحاولة.",
      404,
    );
  }
  if (receipt.status !== "0x1") {
    throw new AppError("tx_failed", "هذه المعاملة فاشلة على الشبكة.", 422);
  }

  const currentHex = await rpc<string>("eth_blockNumber", []);
  const confirmations =
    Number(BigInt(currentHex) - BigInt(receipt.blockNumber)) + 1;
  const minConf = params.minConfirmations ?? 6;
  if (confirmations < minConf) {
    throw new AppError(
      "low_confirmations",
      `المعاملة تحتاج ${minConf} تأكيدات (حاليًا ${confirmations}) — أعد المحاولة بعد دقيقة.`,
      409,
    );
  }

  const target = norm(params.toAddress);
  const byAddress = new Map(
    Object.entries(BSC_TOKENS).map(([sym, t]) => [norm(t.address), { sym, ...t }]),
  );

  for (const log of receipt.logs) {
    const token = byAddress.get(norm(log.address));
    if (!token) continue;
    if (norm(log.topics[0] ?? "") !== norm(TRANSFER_TOPIC)) continue;
    // topics[2] عنوان المستلم مبطّن إلى 32 بايت.
    const to = norm(log.topics[2] ?? "").slice(-40);
    if (to !== target.slice(-40)) continue;

    return {
      token: token.sym,
      amount: toInternalAmount(log.data, token.decimals),
      from: "0x" + norm(receipt.from),
      confirmations,
    };
  }

  throw new AppError(
    "no_matching_transfer",
    "هذه المعاملة لا تحتوي تحويل عملة مقبولة إلى محفظة المتجر.",
    422,
  );
}
