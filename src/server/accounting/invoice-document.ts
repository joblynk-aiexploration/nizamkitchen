import type { AccountingDocument, CheckoutQuoteLine, PaymentOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InvoiceDocument = AccountingDocument & {
  paymentOrder: PaymentOrder;
  organization: {
    id: string;
    name: string;
    countryCode: string;
    currencyCode: string;
  };
  customerOrganizationName?: string | null;
  sellerOrganizationName?: string | null;
  checkoutQuoteLines?: CheckoutQuoteLine[];
};

export type InvoiceBrandingSettings = {
  name: string;
  legalName: string;
  addressLines: string[];
  phone?: string | null;
  email: string;
  website: string;
  taxId?: string | null;
  accentColor: string;
  defaultNotes: string;
  paymentTerms: string;
  footerText: string;
  showZeroDiscountRow: boolean;
  showProviderRow: boolean;
};

export type InvoiceLineItem = {
  description: string;
  details: string;
  quantity: number;
  unitPrice: number;
  taxFee: number;
  discount: number;
  amount: number;
};

export const NIZAMKITCHEN_BILLING_BRAND: InvoiceBrandingSettings = {
  name: "NizamKitchen",
  legalName: "NizamKitchen",
  addressLines: ["Frisco, Texas", "United States"],
  email: "billing@nizamkitchen.dev",
  website: "https://nk.friscodawah.org",
  phone: null,
  taxId: null,
  accentColor: "#0f766e",
  defaultNotes: "Thank you for using NizamKitchen. This document was generated from a secure payment and accounting record.",
  paymentTerms: "Due on receipt unless otherwise stated.",
  footerText: "This invoice was generated electronically and does not require a signature.",
  showZeroDiscountRow: true,
  showProviderRow: true,
};

export async function getInvoiceBrandingSettings() {
  const keys = [
    "invoice.company_display_name",
    "invoice.company_legal_name",
    "invoice.billing_address",
    "invoice.billing_email",
    "invoice.support_phone",
    "invoice.website",
    "invoice.tax_id",
    "invoice.accent_color",
    "invoice.default_notes",
    "invoice.payment_terms",
    "invoice.footer_text",
    "invoice.show_zero_discount_row",
    "invoice.show_provider_row",
  ];
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const setting = (key: string) => rows.find((row) => row.key === key)?.value;
  const text = (key: string, fallback: string) => {
    const value = setting(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  const optionalText = (key: string, fallback?: string | null) => {
    const value = setting(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback ?? null;
  };
  const bool = (key: string, fallback: boolean) => {
    const value = setting(key);
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return fallback;
  };

  return {
    name: text("invoice.company_display_name", NIZAMKITCHEN_BILLING_BRAND.name),
    legalName: text("invoice.company_legal_name", NIZAMKITCHEN_BILLING_BRAND.legalName),
    addressLines: text("invoice.billing_address", NIZAMKITCHEN_BILLING_BRAND.addressLines.join("\n")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    email: text("invoice.billing_email", NIZAMKITCHEN_BILLING_BRAND.email),
    phone: optionalText("invoice.support_phone", NIZAMKITCHEN_BILLING_BRAND.phone),
    website: text("invoice.website", NIZAMKITCHEN_BILLING_BRAND.website),
    taxId: optionalText("invoice.tax_id", NIZAMKITCHEN_BILLING_BRAND.taxId),
    accentColor: text("invoice.accent_color", NIZAMKITCHEN_BILLING_BRAND.accentColor),
    defaultNotes: text("invoice.default_notes", NIZAMKITCHEN_BILLING_BRAND.defaultNotes),
    paymentTerms: text("invoice.payment_terms", NIZAMKITCHEN_BILLING_BRAND.paymentTerms),
    footerText: text("invoice.footer_text", NIZAMKITCHEN_BILLING_BRAND.footerText),
    showZeroDiscountRow: bool("invoice.show_zero_discount_row", NIZAMKITCHEN_BILLING_BRAND.showZeroDiscountRow),
    showProviderRow: bool("invoice.show_provider_row", NIZAMKITCHEN_BILLING_BRAND.showProviderRow),
  } satisfies InvoiceBrandingSettings;
}

export function formatInvoiceMoney(currencyCode: string, amount: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount ?? 0));
}

export function formatInvoiceDate(value: Date | string | null | undefined) {
  if (!value) return "Due on receipt";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

export function invoiceTitle(document: Pick<InvoiceDocument, "documentType">) {
  return document.documentType === "invoice" ? "Invoice" : "Receipt";
}

export function sourceLabel(module: string) {
  if (module === "subscription") return "NizamKitchen subscription";
  if (module === "food_order") return "Food order";
  if (module === "home_chef_request") return "Home chef request";
  if (module === "catering_order") return "Catering order";
  if (module === "restaurant_order") return "Restaurant order";
  if (module === "manual_invoice") return "Manual invoice";
  return module.replace(/_/g, " ");
}

export function buildInvoiceLines(document: InvoiceDocument) {
  const quoteLines = customerVisibleDocumentQuoteLines(document.checkoutQuoteLines ?? []);
  if (quoteLines.length) {
    return quoteLines.map((line) => {
      const amount = Number(line.amount ?? 0);
      const isDiscount = line.lineType === "discount" || amount < 0;
      return {
        description: line.label,
        details: line.description ?? invoiceStatusLabel(line.lineType),
        quantity: 1,
        unitPrice: isDiscount ? 0 : amount,
        taxFee: line.lineType === "tax" ? amount : 0,
        discount: isDiscount ? Math.abs(amount) : 0,
        amount,
      };
    }) satisfies InvoiceLineItem[];
  }

  const tax = Number(document.taxAmount ?? 0);
  const discount = Number(document.paymentOrder.discountAmount ?? 0);
  const platformCredit = Number(document.paymentOrder.platformCreditAmount ?? 0);
  const subtotalBeforeDiscount = Number(document.subtotalAmount ?? 0) + discount + platformCredit;

  return [
    {
      description: sourceLabel(document.paymentOrder.module),
      details: `Reference ${document.paymentOrder.moduleEntityId}`,
      quantity: 1,
      unitPrice: subtotalBeforeDiscount,
      taxFee: tax,
      discount: discount + platformCredit,
      amount: Number(document.totalAmount ?? 0),
    },
  ] satisfies InvoiceLineItem[];
}

function customerVisibleDocumentQuoteLines(lines: CheckoutQuoteLine[]) {
  return [...lines]
    .filter((line) => {
      const metadata = line.metadataJson;
      const internal = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "internal" in metadata
        ? (metadata as Record<string, unknown>).internal === true
        : false;
      return !internal && line.lineType !== "commission" && line.lineType !== "payout" && line.lineType !== "total";
    })
    .filter((line) => Number(line.amount ?? 0) !== 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function invoiceStatusLabel(value: string | null | undefined) {
  if (!value) return "Not applicable";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function amountPaid(document: InvoiceDocument) {
  if (["paid", "partially_refunded", "refunded"].includes(document.paymentOrder.status)) return Number(document.totalAmount ?? 0);
  return 0;
}

export function balanceDue(document: InvoiceDocument) {
  return Math.max(0, Number(document.totalAmount ?? 0) - amountPaid(document));
}

export function invoicePdfFilename(document: Pick<InvoiceDocument, "documentNumber" | "documentType">) {
  const prefix = document.documentType === "invoice" ? "Invoice" : "Receipt";
  const safeNumber = document.documentNumber.replace(/[^a-z0-9-]+/gi, "-");
  return `${prefix}-${safeNumber}.pdf`;
}

export function providerLabel(provider: string | null | undefined) {
  if (!provider || provider === "manual") return "Not applicable";
  return invoiceStatusLabel(provider);
}

export function renderInvoicePdf(document: InvoiceDocument, branding: InvoiceBrandingSettings = NIZAMKITCHEN_BILLING_BRAND) {
  return enterpriseInvoicePdf(document, branding);
}

export async function storeInvoicePdfIfStorageAvailable(
  session: unknown,
  document: InvoiceDocument,
  branding: InvoiceBrandingSettings = NIZAMKITCHEN_BILLING_BRAND,
) {
  if (document.pdfFileId) return document.pdfFileId;

  try {
    const { uploadStorageFile } = await import("@/server/storage/storage-service");
    const pdf = renderInvoicePdf(document, branding);
    const file = new File([pdf], invoicePdfFilename(document), { type: "application/pdf" });
    const stored = await uploadStorageFile(session as never, {
      file,
      module: "system",
      purpose: "general_document",
      visibility: "private",
      entityType: "accounting_document",
      entityId: document.id,
      altText: `${invoiceTitle(document)} ${document.documentNumber}`,
      caption: "Generated invoice PDF",
    });
    await prisma.accountingDocument.update({ where: { id: document.id }, data: { pdfFileId: stored.id } });
    return stored.id;
  } catch {
    return null;
  }
}

function enterpriseInvoicePdf(document: InvoiceDocument, branding: InvoiceBrandingSettings) {
  const commands: string[] = [];
  const title = invoiceTitle(document).toUpperCase();
  const lines = buildInvoiceLines(document);
  const paidAmount = amountPaid(document);
  const dueAmount = balanceDue(document);
  const accent = hexToRgb(branding.accentColor);

  rect(commands, 0, 0, 612, 792, [0.97, 0.98, 0.98]);
  rect(commands, 44, 52, 524, 688, [1, 1, 1]);
  strokeRect(commands, 44, 52, 524, 688, [0.86, 0.89, 0.92]);

  rect(commands, 44, 648, 524, 92, [0.03, 0.18, 0.29]);
  rect(commands, 44, 648, 524, 8, accent);
  rect(commands, 68, 686, 42, 34, accent);
  text(commands, "NK", 80, 697, 15, "F1", [1, 1, 1]);
  text(commands, branding.name, 122, 708, 17, "F1", [1, 1, 1]);
  text(commands, branding.legalName, 122, 690, 10, "F2", [0.82, 0.94, 0.92]);
  text(commands, branding.addressLines.join(", "), 122, 676, 9, "F2", [0.82, 0.94, 0.92]);
  text(commands, [branding.email, branding.phone, branding.website].filter(Boolean).join("  -  "), 122, 662, 9, "F2", [0.82, 0.94, 0.92]);
  text(commands, title, 444, 706, 22, "F1", [1, 1, 1]);
  text(commands, document.documentNumber, 388, 683, 10, "F2", [0.82, 0.94, 0.92]);
  badge(commands, invoiceStatusLabel(document.paymentOrder.status), 464, 660, document.paymentOrder.status === "paid" ? [0.06, 0.45, 0.32] : [0.85, 0.47, 0.06]);

  sectionTitle(commands, "Bill to", 68, 620, accent);
  textBlock(commands, [
    document.customerOrganizationName ?? document.organization.name,
    `Country: ${document.countryCode}`,
    `Customer ID: ${document.customerOrganizationId ?? document.organizationId}`,
  ], 68, 602, 220);

  sectionTitle(commands, document.sellerOrganizationName ? "Marketplace seller" : "Service provider", 318, 620, accent);
  textBlock(commands, [
    document.sellerOrganizationName ?? branding.legalName,
    document.sellerOrganizationName ? "Marketplace seller organization" : "NizamKitchen subscription and platform services",
    ...(branding.taxId ? [`Tax ID: ${branding.taxId}`] : []),
  ], 318, 602, 220);

  const metaY = 540;
  infoCard(commands, "Invoice number", document.documentNumber, 68, metaY, 148);
  infoCard(commands, "Issue date", formatInvoiceDate(document.issuedAt), 224, metaY, 96);
  infoCard(commands, "Due date", document.dueAt ? formatInvoiceDate(document.dueAt) : "Due on receipt", 328, metaY, 100);
  infoCard(commands, "Currency", document.currencyCode, 436, metaY, 80);
  infoCard(commands, "Provider", branding.showProviderRow ? providerLabel(document.paymentOrder.provider) : "Not applicable", 68, 486, 112);
  infoCard(commands, "Payment", invoiceStatusLabel(document.paymentOrder.status), 188, 486, 104);
  infoCard(commands, "Paid date", document.paymentOrder.paidAt ? formatInvoiceDate(document.paymentOrder.paidAt) : "Not paid", 300, 486, 110);
  infoCard(commands, "Reference", document.paymentOrder.moduleEntityId.slice(0, 18), 418, 486, 98);

  rect(commands, 68, 410, 476, 44, [0.96, 0.99, 0.98]);
  text(commands, "Payment summary", 84, 436, 10, "F1", [0.1, 0.16, 0.22]);
  text(commands, "Amount paid", 236, 436, 8, "F2", [0.43, 0.49, 0.56]);
  text(commands, formatInvoiceMoney(document.currencyCode, paidAmount), 236, 420, 14, "F1", [0.06, 0.45, 0.32]);
  text(commands, "Balance due", 392, 436, 8, "F2", [0.43, 0.49, 0.56]);
  text(commands, formatInvoiceMoney(document.currencyCode, dueAmount), 392, 420, 14, "F1", dueAmount > 0 ? [0.75, 0.2, 0.16] : [0.06, 0.45, 0.32]);

  text(commands, "Line items", 68, 388, 11, "F1", [0.1, 0.16, 0.22]);
  rect(commands, 68, 354, 476, 24, accent);
  text(commands, "#", 82, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Description", 112, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Qty", 314, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Unit", 350, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Tax", 410, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Discount", 458, 362, 8.5, "F1", [1, 1, 1]);
  text(commands, "Total", 520, 362, 8.5, "F1", [1, 1, 1]);

  let rowY = 326;
  lines.slice(0, 6).forEach((line, index) => {
    if (index % 2 === 0) rect(commands, 68, rowY - 9, 476, 34, [0.98, 0.99, 1]);
    strokeRect(commands, 68, rowY - 9, 476, 34, [0.93, 0.95, 0.97]);
    text(commands, String(index + 1), 82, rowY + 8, 8.5, "F2", [0.1, 0.16, 0.22]);
    text(commands, line.description, 112, rowY + 10, 8.5, "F1", [0.1, 0.16, 0.22]);
    text(commands, line.details, 112, rowY - 3, 6.8, "F2", [0.43, 0.49, 0.56]);
    text(commands, String(line.quantity), 316, rowY + 6, 8.5, "F2", [0.1, 0.16, 0.22]);
    text(commands, formatInvoiceMoney(document.currencyCode, line.unitPrice), 350, rowY + 6, 7.2, "F2", [0.1, 0.16, 0.22]);
    text(commands, formatInvoiceMoney(document.currencyCode, line.taxFee), 410, rowY + 6, 7.2, "F2", [0.1, 0.16, 0.22]);
    text(commands, formatInvoiceMoney(document.currencyCode, line.discount), 458, rowY + 6, 7.2, "F2", [0.1, 0.16, 0.22]);
    text(commands, formatInvoiceMoney(document.currencyCode, line.amount), 520, rowY + 6, 7.2, "F1", [0.1, 0.16, 0.22]);
    rowY -= 36;
  });

  const detailsY = Math.min(178, Math.max(126, rowY - 150));
  rect(commands, 68, detailsY, 236, 132, [0.98, 0.99, 0.99]);
  strokeRect(commands, 68, detailsY, 236, 132, [0.9, 0.93, 0.95]);
  text(commands, "Notes and terms", 84, detailsY + 108, 10, "F1", [0.1, 0.16, 0.22]);
  textBlock(commands, wrapText(branding.defaultNotes, 42).concat(wrapText(branding.paymentTerms, 42)), 84, detailsY + 90, 190, 7.8);

  rect(commands, 332, detailsY, 212, 132, [0.97, 0.98, 0.99]);
  strokeRect(commands, 332, detailsY, 212, 132, [0.86, 0.89, 0.92]);
  text(commands, "Invoice summary", 350, detailsY + 110, 10, "F1", [0.1, 0.16, 0.22]);
  totalRow(commands, "Subtotal", formatInvoiceMoney(document.currencyCode, document.subtotalAmount), 350, detailsY + 92);
  if (branding.showZeroDiscountRow || Number(document.paymentOrder.discountAmount ?? 0) > 0) {
    totalRow(commands, "Discount", formatInvoiceMoney(document.currencyCode, document.paymentOrder.discountAmount ?? 0), 350, detailsY + 76);
  }
  totalRow(commands, "Taxes / fees", formatInvoiceMoney(document.currencyCode, document.taxAmount), 350, detailsY + 60);
  totalRow(commands, "Amount paid", formatInvoiceMoney(document.currencyCode, paidAmount), 350, detailsY + 44);
  totalRow(commands, "Balance due", formatInvoiceMoney(document.currencyCode, dueAmount), 350, detailsY + 30);
  rect(commands, 344, detailsY + 2, 188, 20, [1, 1, 1]);
  strokeRect(commands, 344, detailsY + 2, 188, 20, [0.82, 0.87, 0.9]);
  text(commands, "Total", 356, detailsY + 9, 10, "F1", [0.1, 0.16, 0.22]);
  text(commands, formatInvoiceMoney(document.currencyCode, document.totalAmount), 456, detailsY + 9, 11, "F1", [0.1, 0.16, 0.22]);

  rect(commands, 68, 92, 476, 1, [0.88, 0.91, 0.94]);
  text(commands, branding.footerText, 68, 72, 7.6, "F2", [0.43, 0.49, 0.56]);
  text(commands, `Generated ${formatInvoiceDate(new Date())} | Support: ${branding.email} | ${branding.website}`, 68, 58, 7.6, "F2", [0.43, 0.49, 0.56]);

  const content = [
    ...commands,
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `6 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function sectionTitle(commands: string[], value: string, x: number, y: number, color: [number, number, number]) {
  text(commands, value.toUpperCase(), x, y, 8, "F1", color);
}

function infoCard(commands: string[], label: string, value: string, x: number, y: number, width: number) {
  rect(commands, x, y, width, 42, [0.98, 0.99, 1]);
  strokeRect(commands, x, y, width, 42, [0.88, 0.91, 0.94]);
  text(commands, label.toUpperCase(), x + 10, y + 26, 6.5, "F1", [0.43, 0.49, 0.56]);
  text(commands, value, x + 10, y + 10, 8.5, "F2", [0.1, 0.16, 0.22]);
}

function badge(commands: string[], label: string, x: number, y: number, color: [number, number, number]) {
  rect(commands, x, y, 72, 20, color);
  text(commands, label.toUpperCase().slice(0, 12), x + 9, y + 7, 7, "F1", [1, 1, 1]);
}

function totalRow(commands: string[], label: string, value: string, x: number, y: number) {
  text(commands, label, x, y, 8.5, "F2", [0.43, 0.49, 0.56]);
  text(commands, value, x + 100, y, 8.5, "F1", [0.1, 0.16, 0.22]);
}

function textBlock(commands: string[], lines: string[], x: number, y: number, _width: number, size = 9) {
  lines.slice(0, 8).forEach((line, index) => {
    text(commands, line, x, y - index * (size + 5), index === 0 ? size + 1 : size, index === 0 ? "F1" : "F2", index === 0 ? [0.1, 0.16, 0.22] : [0.43, 0.49, 0.56]);
  });
}

function text(commands: string[], value: string, x: number, y: number, size: number, font: "F1" | "F2", color: [number, number, number]) {
  commands.push(`${color.map((part) => part.toFixed(3)).join(" ")} rg`);
  commands.push("BT");
  commands.push(`/${font} ${size} Tf`);
  commands.push(`${x} ${y} Td`);
  commands.push(`(${escapePdfText(value.slice(0, 90))}) Tj`);
  commands.push("ET");
}

function rect(commands: string[], x: number, y: number, width: number, height: number, color: [number, number, number]) {
  commands.push(`${color.map((part) => part.toFixed(3)).join(" ")} rg`);
  commands.push(`${x} ${y} ${width} ${height} re f`);
}

function strokeRect(commands: string[], x: number, y: number, width: number, height: number, color: [number, number, number]) {
  commands.push(`${color.map((part) => part.toFixed(3)).join(" ")} RG`);
  commands.push(`0.8 w ${x} ${y} ${width} ${height} re S`);
}

function wrapText(value: string, width: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = value.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return [0.06, 0.45, 0.43];
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
