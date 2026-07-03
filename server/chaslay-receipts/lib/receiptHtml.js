function money(currency, amount) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderReceiptPage(receipt) {
  const created = receipt.created_at
    ? new Date(receipt.created_at).toLocaleString()
    : new Date().toLocaleString();

  const itemRows = (receipt.items ?? [])
    .map((item) => {
      const label = item.variant_name
        ? `${item.product_name} (${item.variant_name})`
        : item.product_name;
      const discount = Number(item.line_discount ?? 0);
      const discountRow = discount > 0
        ? `<div class="discount">Item discount: -${money(receipt.currency, discount)}</div>`
        : '';
      return `
        <div class="item">
          <div class="item-top">
            <span>${item.quantity}� ${escapeHtml(label)}</span>
            <strong>${money(receipt.currency, item.line_subtotal ?? item.line_total)}</strong>
          </div>
          ${discountRow}
        </div>
      `;
    })
    .join('');

  const itemDiscountTotal = Number(receipt.item_discount_total ?? 0);
  const orderDiscount = Number(receipt.discount_amount ?? 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${escapeHtml(receipt.transaction_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#0f172a; }
    .card { max-width:560px; margin:0 auto; background:#fff; border-radius:16px; padding:24px; box-shadow:0 8px 24px rgba(15,23,42,.08); }
    h1 { margin:0 0 4px; font-size:24px; }
    .meta { color:#64748b; font-size:14px; margin-bottom:20px; }
    .item { padding:10px 0; border-bottom:1px solid #e2e8f0; }
    .item-top { display:flex; justify-content:space-between; gap:12px; }
    .discount { color:#ea580c; font-size:13px; margin-top:4px; }
    .summary { margin-top:16px; }
    .summary div { display:flex; justify-content:space-between; padding:4px 0; }
    .total { font-size:22px; font-weight:700; margin-top:12px; padding-top:12px; border-top:2px solid #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(receipt.business_name)}</h1>
    <div class="meta">
      Receipt #${escapeHtml(receipt.transaction_number)}<br>
      ${escapeHtml(created)} � ${escapeHtml(receipt.payment_method)}
    </div>
    ${itemRows}
    <div class="summary">
      ${itemDiscountTotal > 0 ? `<div><span>Item discounts</span><span>-${money(receipt.currency, itemDiscountTotal)}</span></div>` : ''}
      ${orderDiscount > 0 ? `<div><span>Discount</span><span>-${money(receipt.currency, orderDiscount)}</span></div>` : ''}
      ${receipt.tax_total ? `<div><span>Tax</span><span>${money(receipt.currency, receipt.tax_total)}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${money(receipt.currency, receipt.total)}</span></div>
    </div>
  </div>
</body>
</html>`;
}
