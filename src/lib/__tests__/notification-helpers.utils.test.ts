import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    getPushTokens,
    isRecentlyActive,
    cacheEmailFromAuth,
    getDeveloperEmail,
} from "../notification-helpers";

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockGetUserById = vi.fn();
const mockFrom = vi.fn();

function mockDoubleEq(result: unknown) {
    const secondEq = vi.fn().mockResolvedValue(result);

    const firstEq = vi.fn().mockReturnValue({
        eq: secondEq,
    });

    mockSelect.mockReturnValue({
        eq: firstEq,
    });

    return { firstEq, secondEq };
}

function mockSingleResult(result: unknown) {
    const single = vi.fn().mockResolvedValue(result);

    const eq = vi.fn().mockReturnValue({
        single,
    });

    mockSelect.mockReturnValue({
        eq,
    });

    return { eq, single };
}

vi.mock("../supabase", () => ({
    getSupabaseAdmin: () => ({
        from: mockFrom,
        auth: {
            admin: {
                getUserById: mockGetUserById,
            },
        },
    }),

}));

beforeEach(() => {
    vi.clearAllMocks();

    mockEq.mockImplementation(() => ({
        eq: mockEq,
        single: mockSingle,
    }));

    mockSelect.mockImplementation(() => ({
        eq: mockEq,
    }));

    mockUpdate.mockImplementation(() => ({
        eq: mockEq,
    }));

    mockFrom.mockImplementation(() => ({
        select: mockSelect,
        update: mockUpdate,
        upsert: mockUpsert,
    }));

});

describe("getPushTokens", () => {
    it("returns only active push subscriptions", async () => {
        const tokens = [
            { token: "abc123", platform: "web" },
            { token: "xyz789", platform: "ios" },
        ];

        const { firstEq, secondEq } = mockDoubleEq({
            data: tokens,
        });

        const result = await getPushTokens(42);

        expect(firstEq).toHaveBeenCalledWith("developer_id", 42);
        expect(secondEq).toHaveBeenCalledWith("active", true);
        expect(result).toEqual(tokens);
    });

    it("returns an empty array when no subscriptions exist", async () => {
        const secondEq = vi.fn().mockResolvedValue({
            data: null,
        });

        const firstEq = vi.fn().mockReturnValue({
            eq: secondEq,
        });

        mockSelect.mockReturnValue({
            eq: firstEq,
        });

        const result = await getPushTokens(99);

        expect(result).toEqual([]);
    });
});

describe("isRecentlyActive", () => {
    it("returns true when the developer was active recently", async () => {
        mockSingleResult({
            data: {
                last_active_at: new Date().toISOString(),
            },
        });

        const result = await isRecentlyActive(42);

        expect(result).toBe(true);
    });
});

describe("cacheEmailFromAuth", () => {
    it("updates developer email when auth user has an email", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {
                    email: "john@gmail.com",
                },
            },
        });

        const eq = vi.fn().mockResolvedValue({});

        mockUpdate.mockReturnValue({
            eq,
        });

        await cacheEmailFromAuth(42, "auth-user-id");

        expect(mockGetUserById).toHaveBeenCalledWith("auth-user-id");

        expect(mockFrom).toHaveBeenCalledWith("developers");

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "john@gmail.com",
                email_updated_at: expect.any(String),
            })
        );

        expect(eq).toHaveBeenCalledWith("id", 42);
    });

    it("does not update developer email when auth user has no email", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {},
            },
        });

        await cacheEmailFromAuth(42, "auth-user-id");

        expect(mockGetUserById).toHaveBeenCalledWith("auth-user-id");
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

describe("getDeveloperEmail", () => {
    it("returns developer email when already present", async () => {
        const { eq } = mockSingleResult({
            data: {
                email: "developer@example.com",
                claimed_by: null,
            },
        });

        const result = await getDeveloperEmail(100);

        expect(result).toBe("developer@example.com");

        expect(mockFrom).toHaveBeenCalledWith("developers");

        expect(mockSelect).toHaveBeenCalledWith("email, claimed_by");

        expect(eq).toHaveBeenCalledWith("id", 100);

        expect(mockGetUserById).not.toHaveBeenCalled();
    });


});
