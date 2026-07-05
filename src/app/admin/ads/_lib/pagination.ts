export const ADS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_ADS_PAGE_SIZE = 10;

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export function getPaginationStateForFilterChange(
  state: PaginationState,
  key: keyof import("./types").AdsFilters,
  value: number | string,
): PaginationState {
  if (key === "pageSize") {
    return { page: 1, pageSize: Number(value) || DEFAULT_ADS_PAGE_SIZE };
  }

  return { page: 1, pageSize: state.pageSize };
}

export function getPaginatedItems<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_ADS_PAGE_SIZE;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const clampedPage = Math.min(safePage, totalPages);
  const start = (clampedPage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: items.slice(start, end),
    page: clampedPage,
    pageSize: safePageSize,
    totalPages,
    totalItems,
  };
}
