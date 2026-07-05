import { describe, expect, it } from "vitest";
import { getPaginationStateForFilterChange, getPaginatedItems } from "../pagination";

describe("admin ads pagination", () => {
  it("navigates to the next and previous pages", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);

    const firstPage = getPaginatedItems(items, 1, 10);
    expect(firstPage.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(firstPage.totalPages).toBe(3);

    const secondPage = getPaginatedItems(items, 2, 10);
    expect(secondPage.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(secondPage.page).toBe(2);
  });

  it("changes page size and clamps the page to a valid range", () => {
    const items = Array.from({ length: 30 }, (_, index) => index + 1);

    const pageSize25 = getPaginatedItems(items, 2, 25);
    expect(pageSize25.items).toEqual([26, 27, 28, 29, 30]);
    expect(pageSize25.totalPages).toBe(2);

    const pageSize50 = getPaginatedItems(items, 3, 50);
    expect(pageSize50.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(pageSize50.page).toBe(1);
  });

  it("resets pagination when filters or page size change", () => {
    const state = { page: 3, pageSize: 25 };

    const afterStatusChange = getPaginationStateForFilterChange(state, "status", "paused");
    expect(afterStatusChange).toEqual({ page: 1, pageSize: 25 });

    const afterPageSizeChange = getPaginationStateForFilterChange(state, "pageSize", 50);
    expect(afterPageSizeChange).toEqual({ page: 1, pageSize: 50 });
  });
});
