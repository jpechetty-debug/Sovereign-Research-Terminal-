export function formatCurrency(price: number, ticker: string): string {
  const isIndian = ticker.endsWith('.NS') || ticker.endsWith('.BO');
  const currencySymbol = isIndian ? '₹' : '$';
  const locale = isIndian ? 'en-IN' : 'en-US';
  return `${currencySymbol}${price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
