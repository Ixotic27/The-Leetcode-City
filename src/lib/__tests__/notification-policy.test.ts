import { describe, expect, it } from "vitest";
import { evaluateNotificationPolicy } from "../notification-policy";

describe("evaluateNotificationPolicy", () => {
  it("skips channels that are disabled by preference", () => {
    const decision = evaluateNotificationPolicy({
      channel: "email",
      payload: {
        type: "welcome",
        category: "transactional",
        developerId: 1,
        dedupKey: "welcome:1",
        title: "Welcome",
        body: "Hello",
      },
      prefs: {
        email_enabled: false,
        push_enabled: true,
        transactional: true,
        social: true,
        digest: true,
        marketing: false,
        streak_reminders: true,
        digest_frequency: "realtime",
        quiet_hours_start: null,
        quiet_hours_end: null,
        channel_overrides: {},
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.skipReason).toBe("channel_disabled");
  });

  it("respects channel overrides over category toggles", () => {
    const decision = evaluateNotificationPolicy({
      channel: "email",
      payload: {
        type: "welcome",
        category: "marketing",
        developerId: 1,
        dedupKey: "welcome:1",
        title: "Welcome",
        body: "Hello",
      },
      prefs: {
        email_enabled: true,
        push_enabled: true,
        transactional: true,
        social: true,
        digest: true,
        marketing: false,
        streak_reminders: true,
        digest_frequency: "realtime",
        quiet_hours_start: null,
        quiet_hours_end: null,
        channel_overrides: {
          email: {
            marketing: true,
          },
        },
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.skipReason).toBeUndefined();
  });

  it("allows batching for low-priority payloads when digest mode is not realtime", () => {
    const decision = evaluateNotificationPolicy({
      channel: "email",
      payload: {
        type: "raid_alert",
        category: "social",
        developerId: 1,
        dedupKey: "raid:1",
        title: "Raid",
        body: "Raid",
        priority: "low",
        batchKey: "social:raid",
      },
      prefs: {
        email_enabled: true,
        push_enabled: true,
        transactional: true,
        social: true,
        digest: true,
        marketing: false,
        streak_reminders: true,
        digest_frequency: "daily",
        quiet_hours_start: null,
        quiet_hours_end: null,
        channel_overrides: {},
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.shouldBatch).toBe(true);
  });

  it("never batches high-priority or force-send notifications", () => {
    const decision = evaluateNotificationPolicy({
      channel: "email",
      payload: {
        type: "purchase_receipt",
        category: "transactional",
        developerId: 1,
        dedupKey: "receipt:1",
        title: "Receipt",
        body: "Receipt",
        priority: "high",
        batchKey: "transactions:1",
        forceSend: true,
      },
      prefs: {
        email_enabled: true,
        push_enabled: true,
        transactional: true,
        social: true,
        digest: true,
        marketing: false,
        streak_reminders: true,
        digest_frequency: "daily",
        quiet_hours_start: null,
        quiet_hours_end: null,
        channel_overrides: {},
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.shouldBatch).toBe(false);
  });
});
