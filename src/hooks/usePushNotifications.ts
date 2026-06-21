"use client";

import { useState, useEffect, useCallback } from "react";

export type SubscriptionState =
  | "loading"
  | "unsupported"
  | "denied"
  | "unsubscribed"
  | "subscribed";

interface UsePushNotificationsReturn {
  state: SubscriptionState;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  error: string | null;
}

// ── Utility ──────────────────────────────────────────────────────────────────

// The VAPID public key is stored as URL-safe base64; the browser's
// pushManager.subscribe() needs it as a Uint8Array (applicationServerKey).
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}

// Best-effort platform label stored alongside the subscription so the server
// can log which devices a push was delivered to.
function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications(developerId: number): UsePushNotificationsReturn {
  const [state, setState] = useState<SubscriptionState>("loading");
  const [error, setError] = useState<string | null>(null);

  // On mount: detect support + check if already subscribed
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Check if there's an existing active subscription
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    });
  }, []);

  // ── Subscribe ──────────────────────────────────────────────────────────────

  const subscribe = useCallback(async () => {
    setError(null);
    setState("loading");

    try {
      // Register the service worker if not already registered.
      // navigator.serviceWorker.register() is idempotent — safe to call repeatedly.
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;

      // Ask the browser for notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      // NEXT_PUBLIC_VAPID_PUBLIC_KEY must be set in .env.local
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. " +
          "Run `npx web-push generate-vapid-keys` and add it to .env.local"
        );
      }

      // Create the push subscription in the browser
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true, // required — browser will always show a notification
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Persist the subscription in the database via our API route
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerId,
          subscription: subscription.toJSON(), // { endpoint, keys: { p256dh, auth } }
          platform: getPlatform(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save subscription: ${text}`);
      }

      setState("subscribed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to subscribe";
      setError(msg);
      setState("unsubscribed");
      console.error("[usePushNotifications] subscribe error:", err);
    }
  }, [developerId]);

  // ── Unsubscribe ────────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    setError(null);
    setState("loading");

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // Remove from browser
        await subscription.unsubscribe();

        // Mark inactive in the database
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            developerId,
            endpoint: subscription.endpoint,
          }),
        });
      }

      setState("unsubscribed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to unsubscribe";
      setError(msg);
      setState("subscribed"); // Roll back — we don't know if it actually unsubscribed
      console.error("[usePushNotifications] unsubscribe error:", err);
    }
  }, [developerId]);

  return { state, subscribe, unsubscribe, error };
}