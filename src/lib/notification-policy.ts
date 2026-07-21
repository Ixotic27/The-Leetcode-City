import type { Channel, NotificationCategory, NotificationPayload } from "./notifications";

export interface NotificationPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  transactional: boolean;
  social: boolean;
  digest: boolean;
  marketing: boolean;
  streak_reminders: boolean;
  digest_frequency: "realtime" | "hourly" | "daily" | "weekly";
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  channel_overrides: Record<string, Record<string, boolean>>;
}

export interface NotificationPolicyDecision {
  allowed: boolean;
  skipReason?: string;
  shouldBatch: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
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
  channel_overrides: {},
};

export function evaluateNotificationPolicy({
  channel,
  payload,
  prefs,
}: {
  channel: Channel;
  payload: NotificationPayload;
  prefs: NotificationPrefs;
}): NotificationPolicyDecision {
  if (!payload.forceSend) {
    if (channel === "email" && !prefs.email_enabled) {
      return { allowed: false, skipReason: "channel_disabled", shouldBatch: false };
    }
    if (channel === "push" && !prefs.push_enabled) {
      return { allowed: false, skipReason: "channel_disabled", shouldBatch: false };
    }
  }

  if (!payload.forceSend && !getCategoryEnabled(prefs, channel, payload.category)) {
    return { allowed: false, skipReason: "category_disabled", shouldBatch: false };
  }

  return {
    allowed: true,
    shouldBatch: shouldBatch(payload, prefs),
  };
}

function getCategoryEnabled(
  prefs: NotificationPrefs,
  channel: Channel,
  category: NotificationCategory,
): boolean {
  const override = prefs.channel_overrides?.[channel]?.[category];
  if (typeof override === "boolean") return override;
  return prefs[category] ?? true;
}

function shouldBatch(payload: NotificationPayload, prefs: NotificationPrefs): boolean {
  if (payload.priority === "high") return false;
  if (payload.forceSend) return false;
  if (!payload.batchKey) return false;
  if (prefs.digest_frequency === "realtime") return false;
  return true;
}
