export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export type PaginationInput = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  startItem: number;
  endItem: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function firstValue(value: string | string[] | number | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function positiveInteger(value: string | string[] | number | undefined, fallback: number) {
  const raw = firstValue(value);
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPaginationInput(
  params: { page?: string | string[] | number; pageSize?: string | string[] | number } = {},
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
): PaginationInput {
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  const pageSize = Math.min(
    positiveInteger(params.pageSize, options.defaultPageSize ?? DEFAULT_PAGE_SIZE),
    maxPageSize,
  );
  const page = positiveInteger(params.page, 1);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function getPaginationMeta(totalItems: number, input: PaginationInput): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const startItem = totalItems === 0 ? 0 : (page - 1) * input.pageSize + 1;
  const endItem = Math.min(page * input.pageSize, totalItems);

  return {
    page,
    pageSize: input.pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    startItem,
    endItem,
  };
}

export function pageHref(basePath: string, searchParams: SearchParamsRecord | undefined, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "page" || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function paginatedQuery<T>(
  totalItemsPromise: Promise<number>,
  itemsPromiseFactory: (input: PaginationInput) => Promise<T[]>,
  params: { page?: string | string[] | number; pageSize?: string | string[] | number } = {},
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
) {
  const requested = getPaginationInput(params, options);
  const totalItems = await totalItemsPromise;
  const meta = getPaginationMeta(totalItems, requested);
  const input = {
    ...requested,
    page: meta.page,
    skip: (meta.page - 1) * requested.pageSize,
  };
  const items = await itemsPromiseFactory(input);

  return { items, pagination: meta };
}
