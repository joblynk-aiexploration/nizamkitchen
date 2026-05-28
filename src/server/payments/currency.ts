const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

export function currencyMinorUnit(currencyCode: string) {
  return ZERO_DECIMAL_CURRENCIES.has(normalizeCurrencyCode(currencyCode)) ? 0 : 2;
}

export function toMinorUnits(amount: number, currencyCode: string) {
  const factor = 10 ** currencyMinorUnit(currencyCode);
  return Math.round(amount * factor);
}

export function calculatePaymentBreakdown(params: {
  amount: number;
  platformCommissionPercent?: number | null;
  fixedCommissionAmount?: number | null;
  taxPercent?: number | null;
}) {
  const taxAmount = roundMoney(params.taxPercent ? (params.amount * params.taxPercent) / 100 : 0);
  const platformFeeAmount = roundMoney(
    (params.platformCommissionPercent ? (params.amount * params.platformCommissionPercent) / 100 : 0) +
      (params.fixedCommissionAmount ?? 0),
  );
  const sellerAmount = roundMoney(Math.max(params.amount - platformFeeAmount, 0));
  return { taxAmount, platformFeeAmount, sellerAmount };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
