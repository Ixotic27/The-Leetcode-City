import crypto from "crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock("../supabase", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("../supabase-server", () => ({
  createServerSupabase: vi.fn()
}));

import { encryptHiddenTests } from "../arena";

const originalArenaCryptoKey = process.env.ARENA_CRYPTO_KEY;
const validArenaCryptoKey = "a".repeat(64);

function decryptHiddenTests(
  encryptedData: string,
  ivHex: string,
  secret: string
): unknown {
  const key = crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest();

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    iv
  );

  let decrypted = decipher.update(
    encryptedData,
    "hex",
    "utf8"
  );
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

describe("arena hidden-test encryption", () => {
  beforeEach(() => {
    delete process.env.ARENA_CRYPTO_KEY;
  });

  afterEach(() => {
    if (originalArenaCryptoKey === undefined) {
      delete process.env.ARENA_CRYPTO_KEY;
    } else {
      process.env.ARENA_CRYPTO_KEY =
        originalArenaCryptoKey;
    }
  });

  it("rejects encryption when ARENA_CRYPTO_KEY is missing", () => {
    expect(() => encryptHiddenTests([])).toThrow(
      "ARENA_CRYPTO_KEY must be configured"
    );
  });

  it("rejects encryption when the key is too short", () => {
    process.env.ARENA_CRYPTO_KEY = "short-key";

    expect(() => encryptHiddenTests([])).toThrow(
      "ARENA_CRYPTO_KEY must contain at least 32 characters"
    );
  });

  it("encrypts hidden tests using a configured key", () => {
    process.env.ARENA_CRYPTO_KEY = validArenaCryptoKey;

    const tests = [
      {
        input: "1 2",
        output: "3"
      }
    ];

    const result = encryptHiddenTests(tests);

    expect(result.iv).toMatch(/^[0-9a-f]{32}$/);
    expect(result.encryptedData).toMatch(/^[0-9a-f]+$/);
    expect(result.encryptedData).not.toContain(
      JSON.stringify(tests)
    );
  });

  it("produces output that can be decrypted with the configured key", () => {
    process.env.ARENA_CRYPTO_KEY = validArenaCryptoKey;

    const tests = [
      {
        input: "5 7",
        output: "12"
      }
    ];

    const result = encryptHiddenTests(tests);

    expect(
      decryptHiddenTests(
        result.encryptedData,
        result.iv,
        validArenaCryptoKey
      )
    ).toEqual(tests);
  });

  it("uses a fresh IV for each encryption", () => {
    process.env.ARENA_CRYPTO_KEY = validArenaCryptoKey;

    const tests = [
      {
        input: "10",
        output: "20"
      }
    ];

    const first = encryptHiddenTests(tests);
    const second = encryptHiddenTests(tests);

    expect(first.iv).not.toBe(second.iv);
    expect(first.encryptedData).not.toBe(
      second.encryptedData
    );
  });
});
