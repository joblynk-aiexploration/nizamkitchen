import crypto from "node:crypto";
import { GroceryListExportType, Prisma } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  groceryListEmailPlaceholderSchema,
  groceryListShareCreateSchema,
  groceryPartnerSchema,
  type GroceryPartnerInput,
} from "@/lib/validation/grocery";
import { createAuditEvent } from "@/server/audit";
import { getGroceryList } from "@/server/grocery";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
type GroceryListForExport = NonNullable<Awaited<ReturnType<typeof getGroceryList>>>;

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hashShareToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textLinesForList(list: GroceryListForExport) {
  const lines = [
    "NizamKitchen Grocery List",
    list.name,
    `Generated ${new Date().toLocaleDateString("en-US")}`,
    `${list.items.length} items`,
    "",
  ];

  if (list.recipes.length) {
    lines.push("Sources:");
    for (const recipe of list.recipes) {
      lines.push(`- ${recipe.recipeNameSnapshot} (${recipe.targetServings} servings)`);
    }
    lines.push("");
  }

  const grouped = new Map<string, typeof list.items>();
  for (const item of list.items) {
    const group = grouped.get(item.category) ?? [];
    group.push(item);
    grouped.set(item.category, group);
  }

  for (const [category, items] of grouped.entries()) {
    lines.push(category.toUpperCase());
    for (const item of items) {
      lines.push(`[ ] ${item.canonicalIngredientName} - ${item.displayQuantity} ${item.displayUnit}`);
    }
    lines.push("");
  }

  if (list.warnings.length) {
    lines.push("Warnings:");
    for (const warning of list.warnings) {
      lines.push(`- ${warning.message}`);
    }
  }

  return lines;
}

export function groceryListToClipboardText(list: GroceryListForExport) {
  return textLinesForList(list).join("\n");
}

export function groceryListToCsv(list: GroceryListForExport) {
  const rows = [
    ["item name", "quantity", "unit", "category", "source recipes", "notes"],
    ...list.items.map((item) => [
      item.canonicalIngredientName,
      item.displayQuantity,
      item.displayUnit,
      item.category,
      item.sources.map((source) => source.recipeNameSnapshot).join("; "),
      item.notes ?? "",
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function groceryListToPdf(list: GroceryListForExport) {
  const lines = textLinesForList(list).slice(0, 42);
  const content = [
    "BT",
    "/F1 18 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -16 Td",
      `(${escapePdfText(line.slice(0, 95))}) Tj`,
    ]).filter(Boolean),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
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

export async function recordGroceryListExport(params: {
  groceryListId: string;
  organizationId: string;
  createdById: string;
  exportType: GroceryListExportType;
}) {
  const record = await prisma.groceryListExport.create({
    data: params,
  });

  await createAuditEvent({
    actorUserId: params.createdById,
    organizationId: params.organizationId,
    action: "grocery_list.exported",
    targetType: "grocery_list",
    targetId: params.groceryListId,
    details: { exportType: params.exportType },
  });

  return record;
}

export async function createGroceryListShare(
  groceryListId: string,
  organizationId: string,
  actorUserId: string,
  rawInput: unknown,
) {
  const parsed = groceryListShareCreateSchema.parse(rawInput);
  const list = await getGroceryList(groceryListId, organizationId);
  if (!list) throw new Error("Grocery list not found.");

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = parsed.expiresInDays
    ? new Date(Date.now() + parsed.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const share = await prisma.groceryListShare.create({
    data: {
      groceryListId,
      organizationId,
      tokenHash: hashShareToken(token),
      expiresAt,
      createdById: actorUserId,
    },
  });

  await recordGroceryListExport({
    groceryListId,
    organizationId,
    createdById: actorUserId,
    exportType: "share_link",
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    action: "grocery_list.share_created",
    targetType: "grocery_list_share",
    targetId: share.id,
    details: { groceryListId, expiresAt: expiresAt?.toISOString() ?? null },
  });

  return { share, token };
}

export async function listGroceryListShares(groceryListId: string, organizationId: string) {
  return prisma.groceryListShare.findMany({
    where: { groceryListId, organizationId },
    include: { createdBy: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeGroceryListShare(
  shareId: string,
  groceryListId: string,
  organizationId: string,
  actorUserId: string,
) {
  const share = await prisma.groceryListShare.findFirst({
    where: { id: shareId, groceryListId, organizationId },
  });
  if (!share) throw new Error("Share link not found.");

  const revoked = await prisma.groceryListShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    action: "grocery_list.share_revoked",
    targetType: "grocery_list_share",
    targetId: share.id,
    details: { groceryListId },
  });

  return revoked;
}

export async function getSharedGroceryList(token: string) {
  const share = await prisma.groceryListShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: {
      groceryList: {
        include: {
          recipes: { orderBy: { createdAt: "asc" } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: { sources: { orderBy: { createdAt: "asc" } } },
          },
          warnings: { orderBy: { severity: "asc" } },
        },
      },
    },
  });

  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) {
    return null;
  }

  return share;
}

export async function sendGroceryListEmailPlaceholder(params: {
  groceryListId: string;
  organizationId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = groceryListEmailPlaceholderSchema.parse(params.input);
  const list = await getGroceryList(params.groceryListId, params.organizationId);
  if (!list) throw new Error("Grocery list not found.");

  await prisma.emailLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.actorUserId,
      countryCode: list.countryCode,
      templateKey: "grocery_list.share_placeholder",
      recipientEmail: parsed.recipientEmail,
      deliveryStatus: "placeholder",
      metadata: {
        groceryListId: list.id,
        note: parsed.note ?? null,
      },
    },
  });

  await recordGroceryListExport({
    groceryListId: params.groceryListId,
    organizationId: params.organizationId,
    createdById: params.actorUserId,
    exportType: "share_link",
  });
}

export async function listActiveGroceryPartners(countryCode: string, organizationId: string) {
  const enabled = await isFeatureEnabled("grocery_partners", organizationId);
  if (!enabled) return [];

  return prisma.groceryPartner.findMany({
    where: { countryCode, status: "active" },
    orderBy: { name: "asc" },
  });
}

function parseSupportedRegions(input: GroceryPartnerInput["supportedRegions"]) {
  const trimmed = input?.trim();
  if (!trimmed) return Prisma.JsonNull;
  return trimmed.split(/\r?\n|,/).map((region) => region.trim()).filter(Boolean);
}

export async function listAdminGroceryPartners(session: Session, filters: { countryCode?: string; status?: string }) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  if (session.user.platformRole === "country_manager" && filters.countryCode) {
    assertCountryAccess(session, filters.countryCode);
  }

  return prisma.groceryPartner.findMany({
    where: {
      countryCode: session.user.platformRole === "country_manager"
        ? { in: session.countryAssignments.map((assignment) => assignment.countryCode) }
        : filters.countryCode || undefined,
      status: filters.status ? filters.status as never : undefined,
    },
    orderBy: { name: "asc" },
  });
}

export async function getAdminGroceryPartner(session: Session, id: string) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const partner = await prisma.groceryPartner.findUnique({ where: { id } });
  if (!partner) throw new Error("Grocery partner not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, partner.countryCode);
  return partner;
}

export async function upsertGroceryPartner(session: Session, id: string | null, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin", "country_manager"]);
  const parsed = groceryPartnerSchema.parse(input);
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, parsed.countryCode);

  const data = {
    countryCode: parsed.countryCode,
    name: parsed.name,
    slug: slugify(parsed.name),
    status: parsed.status,
    websiteUrl: parsed.websiteUrl || null,
    logoUrl: parsed.logoUrl || null,
    supportedRegions: parseSupportedRegions(parsed.supportedRegions),
    integrationType: parsed.integrationType,
    notes: parsed.notes || null,
  };

  const partner = id
    ? await prisma.groceryPartner.update({ where: { id }, data })
    : await prisma.groceryPartner.create({ data });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: partner.countryCode,
    action: id ? "grocery_partner.updated" : "grocery_partner.created",
    targetType: "grocery_partner",
    targetId: partner.id,
    details: data as Prisma.InputJsonValue,
  });

  return partner;
}
