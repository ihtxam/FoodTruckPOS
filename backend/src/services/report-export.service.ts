import * as XLSX from "xlsx";
import { PosReportsService, type ReportPreset } from "./pos-reports.service";

function money(n: number | undefined | null): string {
  return (Number(n) || 0).toFixed(2);
}

/**
 * Build OrderPin-inspired multi-sheet workbook (or CSV) from overview/EOD data.
 */
export class ReportExportService {
  static async buildOverviewWorkbook(
    merchantId: string,
    opts: { preset?: ReportPreset; from?: string; to?: string }
  ) {
    const overview = await PosReportsService.getOverviewDashboard(merchantId, opts);
    const eod = overview.eod;
    const store = overview.businessName || "Store";
    const period = overview.range.label;
    const generated = new Date().toISOString().replace("T", " ").slice(0, 19);

    const wb = XLSX.utils.book_new();

    // --- Report Info ---
    const infoSheet = XLSX.utils.aoa_to_sheet([
      ["Report Info"],
      ["Store Name", "Generation Time", "Time Period"],
      [store, generated, period],
    ]);
    XLSX.utils.book_append_sheet(wb, infoSheet, "Report Info");

    // --- Store orders overview ---
    const overviewRows: (string | number)[][] = [
      ["Sales summary"],
      ["", "Amount", "Qty"],
      ["Paid orders Qty", "-", eod.salesCount],
      ["Total paid", money(eod.revenue), "-"],
      ["Tax", money(eod.taxTotal), "-"],
      ["Total refund", money(eod.refundTotal), "-"],
      ["Actual sales", money(eod.netTotal), "-"],
      ["Refunded orders Qty", "-", eod.refundCount],
      ["Tips", money(eod.tipsTotal), "-"],
      [],
      ["Fee summary"],
      ["", "Amount", "Qty"],
      ["Product", money(eod.netTotal), "-"],
      ["Dishes discount", money(eod.discountTotal), "-"],
      ["Tax", money(eod.taxTotal), "-"],
      ["Total paid", money(eod.revenue), "-"],
      ["Total refund", money(eod.refundTotal), "-"],
      ["Net sales", money(eod.netTotal), "-"],
      ["Actual sales", money(eod.netTotal), "-"],
      ["Paid orders Qty", "-", eod.salesCount],
      [],
      ["Order type report"],
      ["Order types", "Amount", "Qty"],
      ...(eod.orderTypeRows || []).map((r) => [r.label, money(r.total), r.count]),
      ["Total", money(eod.revenue), eod.salesCount],
      [],
      ["Payment Method Report"],
      ["Payment method", "Amount", "Qty"],
      ...(eod.paymentRows || []).map((p) => [p.method, money(p.total), p.count]),
      ["Total", money(eod.grandTotal || eod.revenue), eod.salesCount],
      [],
      ["Tax"],
      ["Notes", "Amount", "Qty"],
      ...(eod.vatRows || []).map((v) => [v.label, money(v.tva), "-"]),
      ["Total tax", money(eod.taxTotal), "-"],
      [],
      ["Order Placed By Report"],
      ["Waiter", "Amount", "Qty"],
      ...(eod.userPerformance || []).map((u) => [u.name, money(u.total), u.salesCount]),
      [],
      ["Cash drawer / Funding"],
      ["Funding amount (sales + tips)", money(overview.kpis.fundingAmount), "-"],
      ...(eod.shiftCash || []).flatMap((s, i) => [
        [`Shift ${i + 1} opening float`, money(s.openingFloat), s.staffName || "-"],
        [`Shift ${i + 1} expected cash`, money(s.expectedCash), "-"],
        [`Shift ${i + 1} cash sales`, money(s.cashSales), "-"],
      ]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(overviewRows),
      "Store orders overview"
    );

    // --- Daily Report ---
    const dailySheet = XLSX.utils.aoa_to_sheet([
      [
        "Business Date",
        "Paid orders Qty",
        "Refunded orders Qty",
        "Cash",
        "Card/Terminal",
        "Total paid",
        "Total refund",
        "Total tax",
        "Net sales",
      ],
      [
        overview.range.from === overview.range.to
          ? overview.range.from
          : `${overview.range.from} ? ${overview.range.to}`,
        eod.salesCount,
        eod.refundCount,
        money(eod.cashTotal),
        money(eod.cardTotal + eod.terminalTotal),
        money(eod.revenue),
        money(eod.refundTotal),
        money(eod.taxTotal),
        money(eod.netTotal),
      ],
      ["Total amount of the report", money(eod.revenue)],
    ]);
    XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Report");

    // --- Product report ---
    const productRows: (string | number)[][] = [
      ["Product report"],
      [
        "Product",
        "Specification",
        "Qty",
        "Gross Sales",
        "Disc/Comps/Rewards",
        "Net sale",
        "Tax amount",
        "Total sales",
        "Refund",
      ],
      ...(eod.productsSold || []).map((p) => [
        p.name,
        "-",
        p.quantity,
        money(p.total),
        "0.00",
        money(p.total),
        "-",
        money(p.total),
        "0.00",
      ]),
      [
        "Total",
        "-",
        (eod.productsSold || []).reduce((s, p) => s + Number(p.quantity || 0), 0),
        money(eod.netTotal),
        "0.00",
        money(eod.netTotal),
        money(eod.taxTotal),
        money(eod.netTotal),
        "0.00",
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), "Product report");

    // --- Performance ---
    const staffTotal = (eod.userPerformance || []).reduce((s, u) => s + u.total, 0) || 1;
    const perfRows: (string | number)[][] = [
      ["Staff", "Product amount", "Amount Ratio", "Orders", "Order ratio"],
      ...(eod.userPerformance || []).map((u) => [
        u.name,
        money(u.total),
        `${((u.total / staffTotal) * 100).toFixed(2)}%`,
        u.salesCount,
        `${((u.salesCount / (eod.salesCount || 1)) * 100).toFixed(2)}%`,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perfRows), "Performance report");

    const safeName = store.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "Report";
    const filename = `Report ${safeName}_${overview.range.from}${
      overview.range.from !== overview.range.to ? `_${overview.range.to}` : ""
    }.xlsx`;

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { buffer, filename, overview, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  static async buildOverviewCsv(
    merchantId: string,
    opts: { preset?: ReportPreset; from?: string; to?: string }
  ) {
    const overview = await PosReportsService.getOverviewDashboard(merchantId, opts);
    const eod = overview.eod;
    const lines: string[] = [];
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...cells: (string | number)[]) => lines.push(cells.map(esc).join(","));

    row("Section", "Label", "Amount", "Qty");
    row("Summary", "Store", overview.businessName, "");
    row("Summary", "Period", overview.range.label, "");
    row("Summary", "Total Sales", money(overview.kpis.totalSales), overview.kpis.orders);
    row("Summary", "Net Sales", money(overview.kpis.netSales), "");
    row("Summary", "Funding Amount", money(overview.kpis.fundingAmount), "");
    row("Summary", "Tax", money(eod.taxTotal), "");
    row("Summary", "Tips", money(eod.tipsTotal), "");
    row("Summary", "Customers", overview.kpis.customers, "");
    for (const p of overview.paymentMethods) {
      row("Payment", p.label, money(p.total), p.count);
    }
    for (const o of overview.orderTypes) {
      row("Order type", o.label, money(o.total), o.count);
    }
    for (const p of overview.products) {
      row("Product", p.name, money(p.total), p.quantity);
    }
    for (const s of overview.staff) {
      row("Staff", s.name, money(s.total), s.salesCount);
    }

    const safeName = (overview.businessName || "Report").replace(/[^\w\- ]+/g, "").trim().slice(0, 40);
    const filename = `Report ${safeName}_${overview.range.from}.csv`;
    return {
      buffer: Buffer.from(lines.join("\n"), "utf8"),
      filename,
      overview,
      mime: "text/csv; charset=utf-8",
    };
  }
}
