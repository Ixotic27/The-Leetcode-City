import { sendNotificationAsync } from "../notifications";
import { buildButton } from "../email-template";
import { ITEM_NAMES } from "../zones";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://theleetcodecity.com";

export function sendGiftReceivedNotification(
  receiverId: number,
  giverLogin: string,
  receiverLogin: string,
  purchaseId: string | number,
  itemId: string,
) {
  const itemName = ITEM_NAMES[itemId] ?? itemId;

  sendNotificationAsync({
    type: "gift_received",
    category: "social",
    developerId: receiverId,
    dedupKey: `gift_received:${purchaseId}`,
    title: `@${giverLogin} gifted you ${itemName}!`,
    body: `@${giverLogin} sent you ${itemName}. It's now on your building!`,
    html: `
      <p style="color: #f0f0f0; font-size: 16px;">You received a gift!</p>
      <p style="color: #f0f0f0;">
        <strong>@${giverLogin}</strong> gifted you
        <strong style="color: #ffa116;">${itemName}</strong>.
        It's now available on your building!
      </p>
      ${buildButton("Check Your Building", `${BASE_URL}/?user=${receiverLogin}`)}
    `,
    actionUrl: `${BASE_URL}/?user=${receiverLogin}`,
    priority: "high",
    channels: ["email"],
  });
}
