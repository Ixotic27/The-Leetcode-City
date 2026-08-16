import { sendNotificationAsync } from "../notifications";
import { buildButton } from "../email-template";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://theleetcodecity.tech";

const MILESTONE_MESSAGES: Record<number, { badge: string; tagline: string }> = {
  7: { badge: "7 DAYS", tagline: "You're on fire!" },
  30: { badge: "30 DAYS", tagline: "A whole month. Legendary." },
  100: { badge: "100 DAYS", tagline: "Triple digits. Unstoppable." },
  365: { badge: "1 YEAR", tagline: "One full year. You're a legend." },
};

export function sendStreakMilestoneNotification(
  devId: number,
  login: string,
  streak: number,
  longestStreak: number,
  rewardItemName?: string,
) {
  const milestoneInfo = MILESTONE_MESSAGES[streak];
  if (!milestoneInfo) return;

  const rewardHtml = rewardItemName
    ? `<p style="color: #ffa116; font-size: 14px;">Reward unlocked: <strong>${rewardItemName}</strong></p>`
    : "";

  void (async () => {
    try {
      await sendNotificationAsync({
        type: "streak_milestone",
        category: "social",
        developerId: devId,
        dedupKey: `streak_milestone:${devId}:${streak}`,
        title: `${streak}-day streak! ${milestoneInfo.tagline}`,
        body: `${streak}-day streak! ${milestoneInfo.tagline}${rewardItemName ? ` Reward: ${rewardItemName}` : ""}`,
        html: `
          <div style="text-align: center;">
            <p style=" display: inline-block; padding: 8px 16px; margin: 0; border: 2px solid #ffa116; border-radius: 6px; background: #2a2a2a; color: #ffa116; font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              ${milestoneInfo.badge}
            </p>
            <p style="color: #ffa116; font-size: 24px; font-weight: bold; margin: 8px 0;">
              ${streak}-day streak!
            </p>
            <p style="color: #f0f0f0; font-size: 16px; margin-top: 0;">
              ${milestoneInfo.tagline}
            </p>
          </div>
          ${rewardHtml}
          <p style="color: #666; font-size: 13px; text-align: center;">
            Longest streak: ${longestStreak} days
          </p>
          ${buildButton("Keep It Going", `${BASE_URL}/?user=${login}`)}
        `,
        actionUrl: `${BASE_URL}/?user=${login}`,
        priority: "high",
        channels: ["email"],
      });
    } catch (err: unknown) {
      console.error("[streak] notification failed", err);
    }
  })();
}