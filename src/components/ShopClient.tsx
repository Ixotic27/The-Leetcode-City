"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { ShopItem } from "@/lib/items";
import { levelFromXp } from "@/lib/xp";
import {
  ZONE_ITEMS,
  ZONE_LABELS,
  ITEM_NAMES,
  ITEM_EMOJIS,
  FACES_ITEMS,
  RAID_VEHICLE_ITEMS,
  RAID_TAG_ITEMS,
  RAID_BOOST_ITEMS,
  RAID_CONSUMABLE_ITEMS,
  ITEM_UNLOCK_LEVELS,
  ACHIEVEMENT_ITEMS,
} from "@/lib/zones";
import {
  trackShopPageView,
  trackShopItemViewed,
  trackCheckoutStarted,
  trackPurchaseCompleted,
  trackFreeItemClaimed,
  trackItemEquipped,
} from "@/lib/himetrica";

/** Must match FREE_CLAIM_ITEM in lib/items.ts */
const FREE_CLAIM_ITEM = "flag";

const ShopPreview = dynamic(() => import("./ShopPreview"), { ssr: false });
const RaidVehiclePreview = dynamic(() => import("./RaidVehiclePreview"), { ssr: false });

export interface BuildingDims {
  width: number;
  height: number;
  depth: number;
}

interface Loadout {
  crown: string | null;
  roof: string | null;
  aura: string | null;
  faces: string | null;
}

// A11: Scarcity helpers
function getScarcityInfo(item: ShopItem, soldCount: number) {
  const now = Date.now();

  // Temporal scarcity
  if (item.available_until) {
    const deadline = new Date(item.available_until).getTime();
    if (deadline <= now) return { expired: true, label: "Ended", color: "#666" };
    const diff = deadline - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const label = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
    return { expired: false, label, color: days <= 3 ? "#ff6b6b" : "#f0a030", urgency: days <= 3 };
  }

  // Quantity scarcity
  if (item.max_quantity != null) {
    const remaining = Math.max(0, item.max_quantity - soldCount);
    if (remaining === 0) return { expired: true, label: "Sold out", color: "#666" };
    return {
      expired: false,
      label: `${remaining} left`,
      color: remaining <= 5 ? "#ff6b6b" : "#f0a030",
      urgency: remaining <= 5,
    };
  }

  return null;
}

interface Props {
  githubLogin: string;
  developerId: number;
  items: ShopItem[];
  ownedItems: string[];
  initialCustomColor: string | null;
  initialBillboardImages: string[];
  initialLedBannerText: string | null;
  initialSelectedTitle?: string | null;
  ownedTitles?: string[];
  billboardSlots: number;
  buildingDims: BuildingDims;
  achievements?: string[];
  initialLoadout?: Loadout | null;
  initialRaidLoadout?: { vehicle: string; tag: string } | null;
  purchasedItem?: string | null;
  giftedItem?: string | null;
  giftedTo?: string | null;
  streakFreezesAvailable?: number;
  popularItems?: string[];
  purchaseCounts?: Record<string, number>;
  totalPurchaseCounts?: Record<string, number>;
  initialPoints?: number;
  initialBuildingStyle?: string;
  consumablesInventory?: { item_id: string; quantity: number; weekly_uses: number; last_reset_week: string }[];
  xpLevel?: number;
  acceptedMedium?: number;
  acceptedHard?: number;
}

interface PixModalData {
  brCode: string;
  brCodeBase64: string;
  purchaseId: string;
  itemId: string;
  itemName: string;
  githubLogin: string;
}

const ACCENT = "#ffa116";
const SHADOW = "#5a7a00";
const PENDING_BILLBOARD_KEY = "pending_billboard";

// Save a File as base64 in localStorage for persistence across redirects
function savePendingBillboard(file: File): void {
  const reader = new FileReader();
  reader.onloadend = () => {
    try {
      localStorage.setItem(
        PENDING_BILLBOARD_KEY,
        JSON.stringify({ data: reader.result, type: file.type, name: file.name })
      );
    } catch (err) { console.warn("[components/ShopClient.tsx] non-critical error:", err); }
  };
  reader.readAsDataURL(file);
}

function getPendingBillboard(): { data: string; type: string; name: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_BILLBOARD_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[components/ShopClient.tsx] error:", err);
    return null;
  }
}

function clearPendingBillboard(): void {
  try {
    localStorage.removeItem(PENDING_BILLBOARD_KEY);
  } catch (err) { console.warn("[components/ShopClient.tsx] non-critical error:", err); }
}

// Convert a base64 data URL to a File
function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], name, { type });
}

const PIX_EXPIRY_SECONDS = 900; // 15 minutes


function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─── PIX Modal ─────────────────────────────────────────────── */

function PixModal({
  data,
  onClose,
  onCompleted,
}: {
  data: PixModalData;
  onClose: () => void;
  onCompleted: (itemId: string) => void;
}) {
  const [countdown, setCountdown] = useState(PIX_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"polling" | "completed" | "expired">("polling");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll for payment status
  useEffect(() => {
    if (status !== "polling") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/status?purchase_id=${data.purchaseId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === "completed") {
          trackPurchaseCompleted(data.itemId, 0, "abacatepay");
          setStatus("completed");
        }
      } catch (err) { console.warn("[components/ShopClient.tsx] non-critical error:", err); }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, data.purchaseId]);

  // Stop intervals when done
  useEffect(() => {
    if (status === "completed" || status === "expired") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [status]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.warn("[components/ShopClient.tsx] non-critical error:", err); }
  }, [data.brCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative mx-4 w-full max-w-sm border-[2px] border-border bg-bg p-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-xs text-muted hover:text-cream"
        >
          &#10005;
        </button>

        <h3 className="mb-1 text-xs" style={{ color: ACCENT }}>
          PIX Payment
        </h3>
        <p className="mb-4 text-[9px] text-muted normal-case">
          {data.itemName}
        </p>

        {status === "completed" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-sm" style={{ color: ACCENT }}>
              &#10003; Payment confirmed!
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <a
                href={`/?user=${data.githubLogin}`}
                className="btn-press px-4 py-2 text-[10px] text-bg"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `2px 2px 0 0 ${SHADOW}`,
                }}
              >
                View on map
              </a>
              <button
                onClick={() => onCompleted(data.purchaseId)}
                className="border-[2px] border-border px-4 py-2 text-[10px] text-cream hover:border-border-light"
              >
                Close
              </button>
            </div>
          </div>
        ) : status === "expired" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-xs text-red-400">QR code expired</p>
            <p className="text-[9px] text-muted normal-case">
              Close and try again to generate a new code.
            </p>
            <button
              onClick={onClose}
              className="mt-3 border-[2px] border-border px-4 py-2 text-[10px] text-cream hover:border-border-light"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* QR code */}
            <div className="mb-4 flex justify-center">
              {data.brCodeBase64 ? (
                <img
                  src={data.brCodeBase64}
                  alt="PIX QR Code"
                  className="h-48 w-48"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center border-[2px] border-border text-[9px] text-muted">
                  QR code unavailable
                </div>
              )}
            </div>

            {/* PIX code + copy */}
            <div className="mb-4">
              <p className="mb-1 text-[8px] text-muted">PIX code (copy &amp; paste):</p>
              <div className="flex items-stretch gap-1">
                <div className="flex-1 overflow-hidden border-[2px] border-border bg-bg-card px-2 py-1.5">
                  <p className="truncate text-[8px] text-cream normal-case">
                    {data.brCode}
                  </p>
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 border-[2px] px-3 text-[9px] transition-colors"
                  style={{
                    borderColor: copied ? ACCENT : "var(--color-border)",
                    color: copied ? ACCENT : "var(--color-cream)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Timer + status */}
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-muted normal-case">
                Expires in{" "}
                <span style={{ color: countdown < 60 ? "#ef4444" : ACCENT }}>
                  {formatCountdown(countdown)}
                </span>
              </p>
              <p className="text-[9px] text-muted normal-case animate-pulse">
                Checking payment...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Color Picker Panel ──────────────────────────────────────── */

function ColorPickerPanel({
  currentColor,
  isOwned,
  onPreview,
  onSave,
  onRemove,
}: {
  currentColor: string | null;
  isOwned: boolean;
  onPreview: (color: string | null) => void;
  onSave: (color: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const [color, setColor] = useState(currentColor || ACCENT);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "removed" | null>(null);

  // Sync internal state when saved color changes externally (e.g. after remove)
  useEffect(() => {
    setColor(currentColor || ACCENT);
  }, [currentColor]);

  const handleChange = (newColor: string) => {
    setColor(newColor);
    onPreview(newColor);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const ok = await onSave(color);
    setSaving(false);
    if (ok) {
      setFeedback("saved");
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setFeedback(null);
    const ok = await onRemove();
    setSaving(false);
    if (ok) {
      setFeedback("removed");
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3 border-[2px] border-border/50 bg-bg/50 px-3 py-2">
      <input
        type="color"
        value={color}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 w-10 cursor-pointer border-[2px] border-border bg-transparent"
      />
      <span className="text-[10px] text-muted normal-case">{color}</span>
      {isOwned ? (
        <div className="ml-auto flex items-center gap-1.5">
          {currentColor && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="border-[2px] border-border px-2 py-1 text-[10px] text-muted hover:text-cream disabled:opacity-40"
            >
              {feedback === "removed" ? "Removed!" : "Remove"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-press px-3 py-1 text-[10px] text-bg disabled:opacity-40"
            style={{
              backgroundColor: feedback === "saved" ? "#39d353" : ACCENT,
              boxShadow: `2px 2px 0 0 ${SHADOW}`,
            }}
          >
            {saving ? "..." : feedback === "saved" ? "Saved!" : "Save"}
          </button>
        </div>
      ) : (
        <span className="ml-auto text-[9px] text-dim normal-case">Preview only</span>
      )}
    </div>
  );
}

/* ─── Billboard Upload Panel (Multi-Slot) ─────────────────────── */

function BillboardUploadPanel({
  images,
  slotCount,
  isOwned,
  autoUploading,
  onImagesChange,
  onPreviewChange,
}: {
  images: string[];
  slotCount: number;
  isOwned: boolean;
  autoUploading?: boolean;
  onImagesChange: (images: string[]) => void;
  onPreviewChange: (images: string[]) => void;
}) {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [savedSlot, setSavedSlot] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleFileChange = useCallback((slotIndex: number) => {
    const file = fileRefs.current[slotIndex]?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Create preview: copy current images and replace this slot
    const newImages = [...images];
    while (newImages.length <= slotIndex) newImages.push("");
    newImages[slotIndex] = url;
    onPreviewChange(newImages);
    // Save to localStorage so it survives Stripe redirect
    if (!isOwned) {
      savePendingBillboard(file);
    }
  }, [images, isOwned, onPreviewChange]);

  const handleUpload = useCallback(async (slotIndex: number) => {
    const file = fileRefs.current[slotIndex]?.files?.[0];
    if (!file) return;

    setUploadingSlot(slotIndex);
    setSavedSlot(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slot_index", slotIndex.toString());

      const res = await fetch("/api/customizations/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.images) {
          onImagesChange(data.images);
        }
        setSavedSlot(slotIndex);
        setTimeout(() => setSavedSlot(null), 2000);
      }
    } catch (err) {
      console.warn("[components/ShopClient.tsx] error:", err);
      // ignore
    } finally {
      setUploadingSlot(null);
    }
  }, [onImagesChange]);

  // Show at least 1 slot for non-owners (preview), or slotCount for owners
  const displaySlots = isOwned ? Math.max(slotCount, 1) : 1;

  return (
    <div className="mt-2 border-[2px] border-border/50 bg-bg/50 px-3 py-2">
      {isOwned ? (
        <>
          {autoUploading && (
            <div className="mb-2 border-[2px] border-dashed px-3 py-2 text-[10px] normal-case animate-pulse" style={{ borderColor: ACCENT, color: ACCENT }}>
              Uploading your billboard image...
            </div>
          )}
          {!autoUploading && images.filter(Boolean).length === 0 && (
            <div className="mb-2 border-[2px] border-dashed px-3 py-2 text-[10px] normal-case" style={{ borderColor: ACCENT, color: ACCENT }}>
              Upload an image to each slot below to display on your building!
            </div>
          )}
          <p className="mb-2 text-[9px] text-muted normal-case">
            {slotCount} billboard slot{slotCount !== 1 ? "s" : ""} — upload an image for each. Buy more to unlock more slots.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: displaySlots }).map((_, i) => {
              const img = images[i];
              const isUploading = uploadingSlot === i;
              const isSaved = savedSlot === i;

              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 border-[2px] border-border/30 bg-bg-card p-2"
                >
                  <p className="text-[8px] text-dim">Slot {i + 1}</p>
                  {img ? (
                    <Image
                      src={img}
                      alt={`Billboard ${i + 1}`}
                      width={120}
                      height={40}
                      className="h-10 w-full border-[1px] border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-full items-center justify-center border-[1px] border-border/30 bg-bg/50 text-[8px] text-dim">
                      Empty
                    </div>
                  )}
                  <input
                    ref={(el) => { fileRefs.current[i] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={() => handleFileChange(i)}
                    className="w-full text-[8px] text-muted normal-case file:mr-1 file:border-[1px] file:border-border file:bg-bg file:px-1 file:py-0.5 file:text-[8px] file:text-cream"
                  />
                  <button
                    onClick={() => handleUpload(i)}
                    disabled={isUploading}
                    className="btn-press w-full px-2 py-0.5 text-[9px] text-bg disabled:opacity-40"
                    style={{
                      backgroundColor: isSaved ? "#39d353" : ACCENT,
                      boxShadow: `1px 1px 0 0 ${SHADOW}`,
                    }}
                  >
                    {isUploading ? "..." : isSaved ? "Saved!" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[8px] text-dim normal-case">
            PNG, JPEG, WebP or GIF. Max 2 MB.
          </p>
        </>
      ) : (
        <>
          <p className="mb-2 text-[9px] text-muted normal-case">
            Try it — pick an image to preview on the 3D building. Purchase to save.
          </p>
          <div className="flex items-center gap-3">
            {images[0] && (
              <Image
                src={images[0]}
                alt="Billboard preview"
                width={56}
                height={40}
                className="h-10 w-14 border-[2px] border-border object-cover"
              />
            )}
            <input
              ref={(el) => { fileRefs.current[0] = el; }}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={() => handleFileChange(0)}
              className="min-w-0 flex-1 text-[9px] text-muted normal-case file:mr-2 file:border-[2px] file:border-border file:bg-bg-card file:px-2 file:py-1 file:text-[9px] file:text-cream"
            />
          </div>
          <p className="mt-1 text-[8px] text-dim normal-case">
            PNG, JPEG, WebP or GIF. Max 2 MB. Each purchase = 1 billboard slot.
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Shop Client ───────────────────────────────────────────── */

export default function ShopClient({
  githubLogin,
  developerId,
  items,
  ownedItems,
  initialCustomColor,
  initialBillboardImages,
  initialLedBannerText,
  initialSelectedTitle = null,
  ownedTitles = [],
  billboardSlots: initialBillboardSlots,
  buildingDims,
  achievements = [],
  initialLoadout = null,
  initialRaidLoadout = null,
  purchasedItem = null,
  giftedItem = null,
  giftedTo = null,
  streakFreezesAvailable = 0,
  popularItems = [],
  purchaseCounts = {},
  totalPurchaseCounts = {},
  initialPoints = 0,
  initialBuildingStyle = "tower",
  consumablesInventory = [],
  xpLevel: initialXpLevel = 1,
  acceptedMedium = 0,
  acceptedHard = 0,
}: Props) {
  const formatPrice = (item: ShopItem): string => {
    const USD_TO_INR = 85;
    const amountINR = Math.max(1, Math.ceil((item.price_usd_cents / 100) * USD_TO_INR));
    return `₹${amountINR}`;
  };

  // Reactive XP level — updated locally after XP code redemption
  const [xpLevel, setXpLevel] = useState(initialXpLevel);
  const isDevAccount = ["ishant_27", "ixotic", "ixotic27"].includes(githubLogin.toLowerCase());
  const [devModeEnabled, setDevModeEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("leetcodecity:dev_mode");
      if (stored === "true") {
        setDevModeEnabled(true);
      }
    }
  }, []);
  // Loadout state
  const [loadout, setLoadout] = useState<Loadout>(
    initialLoadout ?? { crown: null, roof: null, aura: null, faces: null }
  );
  const loadoutRef = useRef(loadout);
  loadoutRef.current = loadout;

  // Raid loadout state
  const [raidLoadout, setRaidLoadout] = useState<{ vehicle: string; tag: string }>(
    initialRaidLoadout ?? { vehicle: "airplane", tag: "default" }
  );

  const [owned, setOwned] = useState<string[]>(ownedItems);
  const [points, setPoints] = useState(initialPoints ?? 0);
  const [bStyle, setBStyle] = useState(initialBuildingStyle);
  const [isTogglingStyle, setIsTogglingStyle] = useState(false);
  const [freezeCount, setFreezeCount] = useState(streakFreezesAvailable);
  const [buyingItem, setBuyingItem] = useState<string | null>(null);
  const [buyingProvider, setBuyingProvider] = useState<"stripe" | "nowpayments" | "abacatepay" | "cashfree" | "points" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [highlightItem, setHighlightItem] = useState<string | null>(null);
  const [confirmBuyItem, setConfirmBuyItem] = useState<string | null>(null);
  const [verifyingStar, setVerifyingStar] = useState(false);
  const [starVerifyStep, setStarVerifyStep] = useState<"idle" | "opened" | "verifying">("idle");
  const [activeTab, setActiveTab] = useState<"building" | "raid" | "consumables" | "points">(() => {
    if (purchasedItem && [...RAID_VEHICLE_ITEMS, ...RAID_TAG_ITEMS, ...RAID_BOOST_ITEMS].includes(purchasedItem)) return "raid";
    if (purchasedItem && RAID_CONSUMABLE_ITEMS.includes(purchasedItem)) return "consumables";
    return "building";
  });

  const [pixModal, setPixModal] = useState<PixModalData | null>(null);
  const [customColor, setCustomColor] = useState<string | null>(initialCustomColor);
  const [ledBannerText, setLedBannerText] = useState<string | null>(initialLedBannerText ?? null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(initialSelectedTitle ?? "auto");
  const [billboardImages, setBillboardImages] = useState<string[]>(initialBillboardImages);
  const [billboardSlots, setBillboardSlots] = useState(initialBillboardSlots);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [previewLedBannerText, setPreviewLedBannerText] = useState<string | null>(null);
  const [previewBillboardImages, setPreviewBillboardImages] = useState<string[] | null>(null);
  const [savingCustomization, setSavingCustomization] = useState<string | null>(null);
  const [savedCustomization, setSavedCustomization] = useState<string | null>(null);
  const [autoUploading, setAutoUploading] = useState(false);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(purchasedItem);
  const [giftToast, setGiftToast] = useState<{ item: string; to: string } | null>(
    giftedItem && giftedTo ? { item: giftedItem, to: giftedTo } : null
  );

  // Track shop page view on mount
  useEffect(() => {
    trackShopPageView();
    sessionStorage.setItem("leetcodecity:refresh_city", "true");
    // Fire-and-forget daily mission tracking
    fetch("/api/dailies/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mission_id: "visit_shop" }),
    }).catch(() => { });
  }, []);

  // Post-purchase: show toast + auto-equip if zone is empty + switch tab
  const ALL_RAID_ITEMS = [...RAID_VEHICLE_ITEMS, ...RAID_TAG_ITEMS, ...RAID_BOOST_ITEMS];
  useEffect(() => {
    if (!purchasedItem) return;
    const shopItem = items.find((i) => i.id === purchasedItem);
    trackPurchaseCompleted(purchasedItem, shopItem?.price_usd_cents ?? 0, "stripe");
    // Clear toast after 5s
    const timer = setTimeout(() => setPurchaseToast(null), 5000);
    // Switch to correct tab
    if (ALL_RAID_ITEMS.includes(purchasedItem)) {
      setActiveTab("raid");
    } else {
      setActiveTab("building");
    }
    // Streak freeze: increment local count
    if (purchasedItem === "streak_freeze") {
      setFreezeCount((prev) => Math.min(prev + 1, 2));
    }
    // Auto-equip if the item belongs to a zone and that zone is empty
    for (const [zone, zoneItems] of Object.entries(ZONE_ITEMS)) {
      if (zoneItems.includes(purchasedItem)) {
        const zoneKey = zone as keyof Loadout;
        setLoadout((prev) => {
          if (prev[zoneKey]) return prev; // zone already has something equipped
          return { ...prev, [zoneKey]: purchasedItem };
        });
        setHasChanges(true);
        break;
      }
    }
    // Clean URL param
    window.history.replaceState({}, "", window.location.pathname);
    return () => clearTimeout(timer);
  }, [purchasedItem]);

  // Post-gift: show gift toast
  useEffect(() => {
    if (!giftedItem || !giftedTo) return;
    const shopItem = items.find((i) => i.id === giftedItem);
    trackPurchaseCompleted(giftedItem, shopItem?.price_usd_cents ?? 0, "stripe");
    const timer = setTimeout(() => setGiftToast(null), 5000);
    window.history.replaceState({}, "", window.location.pathname);
    return () => clearTimeout(timer);
  }, [giftedItem, giftedTo]);

  // Default loadout for new users: if no initialLoadout and user owns flag, show flag
  const effectiveLoadout: Loadout = {
    crown: loadout.crown ?? (!initialLoadout && owned.includes("flag") ? "flag" : null),
    roof: loadout.roof,
    aura: loadout.aura,
    faces: loadout.faces,
  };

  // Dismiss buy confirmation popover on click outside
  useEffect(() => {
    if (!confirmBuyItem) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-buy-popover]")) {
        setConfirmBuyItem(null);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [confirmBuyItem]);

  // Unsaved changes warning
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // Save billboard local override on changes
  const isFirstBillboardRender = useRef(true);
  useEffect(() => {
    if (isFirstBillboardRender.current) {
      isFirstBillboardRender.current = false;
      return;
    }
    try {
      if (billboardImages && billboardImages.length > 0) {
        localStorage.setItem(
          "leetcodecity:billboard_override",
          JSON.stringify({ developerId, value: billboardImages, ts: Date.now() })
        );
      } else {
        localStorage.removeItem("leetcodecity:billboard_override");
      }
    } catch (err) {
      console.warn("[ShopClient] Failed to save billboard override:", err);
    }
  }, [billboardImages, developerId]);

  // Auto-upload pending billboard image after purchase redirect
  useEffect(() => {
    if (billboardSlots <= 0) return;
    if (billboardImages[0]) return;

    const pending = getPendingBillboard();
    if (!pending) return;

    setAutoUploading(true);
    const file = dataUrlToFile(pending.data, pending.name, pending.type);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("slot_index", "0");

    fetch("/api/customizations/upload", { method: "POST", body: formData })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.images) {
            setBillboardImages(data.images);
          }
        }
      })
      .finally(() => {
        clearPendingBillboard();
        setAutoUploading(false);
      });
  }, [billboardSlots]); // only run on mount / when slots change

  // ─── Handlers ─────────────────────────────────────────────

  const handleToggleStyle = async (newStyle: string) => {
    if (isTogglingStyle) return;
    setIsTogglingStyle(true);
    const oldStyle = bStyle;
    setBStyle(newStyle); // Optimistic UI update

    try {
      const res = await fetch("/api/shop/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerId,
          itemId: "building_style",
          config: { style: newStyle },
        }),
      });
      if (!res.ok) {
        setBStyle(oldStyle); // Revert on failure
        const data = await res.json().catch(() => ({}));
        setError(`Failed to save style: ${data.error || res.statusText}`);
      } else {
        try {
          localStorage.setItem(
            "leetcodecity:style_override",
            JSON.stringify({ developerId, value: newStyle, ts: Date.now() })
          )
        } catch (e) {
            console.warn("[ShopClient] localStorage write failed:", e);
        }
      }
    } catch (e: any) {
      setBStyle(oldStyle);
      setError(`Network error: ${e.message}`);
    } finally {
      setIsTogglingStyle(false);
    }
  };

  const handleEquip = useCallback((zone: keyof Loadout, itemId: string) => {
    trackItemEquipped(itemId, zone);
    setLoadout((prev) => ({ ...prev, [zone]: itemId }));
    setHasChanges(true);
    setSaved(false);
    setConfirmBuyItem(null);
  }, []);

  const handleUnequip = useCallback((zone: keyof Loadout) => {
    setLoadout((prev) => ({ ...prev, [zone]: null }));
    setHasChanges(true);
    setSaved(false);
    setHighlightItem(null);
    setConfirmBuyItem(null);
  }, []);

  const handleSaveLoadout = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = loadoutRef.current;
      const res = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dev_mode: devModeEnabled }),
      });
      if (res.ok) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);
        try {
          localStorage.setItem(
            "leetcodecity:loadout_override",
            JSON.stringify({ developerId, loadout: payload, ts: Date.now() }),
          );
        } catch (err) { console.warn("[components/ShopClient.tsx] non-critical error:", err); } 
        window.dispatchEvent(new CustomEvent("leetcodecity:loadout-saved"));
      } else {
        setError("Failed to save. Try again.");
      }
    } catch (err) {
      console.warn("[components/ShopClient.tsx] error:", err);
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSaveCustomization = async (itemId: string, payload: Record<string, any>) => {
    setSavingCustomization(itemId);
    setSavedCustomization(null);
    try {
      const res = await fetch(`/api/customizations?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, ...payload, dev_mode: devModeEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(`Failed to save ${itemId}: ${data.error || res.statusText}`);
      } else {
        setSavedCustomization(itemId);
        setTimeout(() => setSavedCustomization(null), 2000);
        try{
          if (itemId === "custom_color") {
            if (payload.color) {
              localStorage.setItem(
                "leetcodecity:color_override",
                JSON.stringify({ developerId, value: payload.color, ts: Date.now() })
              );
            } else {
              localStorage.removeItem("leetcodecity:color_override");
            }
          }
          if (itemId === "led_banner") {
            if (payload.text) {
              localStorage.setItem(
                "leetcodecity:led_banner_override",
                JSON.stringify({ developerId, value: payload.text, ts: Date.now() })
              );
            } else {
              localStorage.removeItem("leetcodecity:led_banner_override");
            }
          }
        } catch (err) {
            console.warn("[ShopClient] localStorage write failed:", err);
        }
      }
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setSavingCustomization(null);
    }
  };

  const claimFreeItem = useCallback(async () => {
    if (buyingItem) return;
    setBuyingItem(FREE_CLAIM_ITEM);
    setError(null);

    try {
      const res = await fetch("/api/claim-free-item", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setOwned((prev) =>
            prev.includes(FREE_CLAIM_ITEM) ? prev : [...prev, FREE_CLAIM_ITEM]
          );
        } else {
          setError(data.error || "Failed to claim free item");
        }
        return;
      }

      trackFreeItemClaimed();
      setOwned((prev) =>
        prev.includes(FREE_CLAIM_ITEM) ? prev : [...prev, FREE_CLAIM_ITEM]
      );
    } catch (err) {
      console.warn("[components/ShopClient.tsx] error:", err);
      setError("Network error. Try again.");
    } finally {
      setBuyingItem(null);
    }
  }, [buyingItem]);

  const verifyLeetCodeStar = useCallback(async () => {
    if (verifyingStar) return;
    setVerifyingStar(true);
    setStarVerifyStep("verifying");
    setError(null);

    try {
      const res = await fetch("/api/verify-github-star", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setStarVerifyStep("opened");
        return;
      }

      if (data.verified) {
        setOwned((prev) => prev.includes("github_star") ? prev : [...prev, "github_star"]);
        // Auto-equip in crown if nothing equipped
        if (!loadout.crown) {
          setLoadout((prev) => ({ ...prev, crown: "github_star" }));
          setHasChanges(true);
        }
        setStarVerifyStep("idle");
      } else {
        setError("Star not found — make sure you starred the repo first!");
        setStarVerifyStep("opened");
      }
    } catch (err) {
      console.warn("[components/ShopClient.tsx] error:", err);
      setError("Network error. Try again.");
      setStarVerifyStep("opened");
    } finally {
      setVerifyingStar(false);
    }
  }, [loadout.crown, verifyingStar]);

  // Auto-verify when user returns from LeetCode tab
  useEffect(() => {
    if (starVerifyStep !== "opened") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") verifyLeetCodeStar();
    };
    const onFocus = () => verifyLeetCodeStar();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [starVerifyStep, verifyLeetCodeStar]);

  const handleSetRaidVehicle = useCallback(async (vehicleId: string) => {
    const res = await fetch("/api/raid/loadout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle: vehicleId, tag: raidLoadout.tag }),
    });
    if (res.ok) {
      setRaidLoadout((prev) => ({ ...prev, vehicle: vehicleId }));
    }
  }, [raidLoadout.tag]);


  const checkout = useCallback(
    async (itemId: string, provider: "stripe" | "nowpayments" | "abacatepay" | "cashfree" = "stripe") => {
      if (buyingItem) return;
      setBuyingItem(itemId);
      setBuyingProvider(provider);
      setError(null);

      const shopItem = items.find((i) => i.id === itemId);
      trackCheckoutStarted(itemId, provider, shopItem?.price_usd_cents ?? 0, false);

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, provider, dev_mode: devModeEnabled }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            if (itemId === "billboard") {
              setError(data.error || "Max billboard slots reached");
            } else {
              setError("You already own this item");
              setOwned((prev) =>
                prev.includes(itemId) ? prev : [...prev, itemId]
              );
            }
          } else {
            setError(data.error || "Checkout failed");
          }
          return;
        }

        if (data.paymentSessionId) {
          // Cashfree: load SDK and open checkout
          try {
            const { load } = await import("@cashfreepayments/cashfree-js");
            const cashfreeEnv = process.env.NEXT_PUBLIC_CASHFREE_ENV === "PRODUCTION" ? "production" : "sandbox";
            const cashfree = await load({ mode: cashfreeEnv as "sandbox" | "production" });
            const result = await cashfree.checkout({
              paymentSessionId: data.paymentSessionId,
              redirectTarget: "_self",
            });
            if (result.error) {
              setError(result.error.message || "Payment failed");
            }
          } catch (sdkErr) {
            console.error("Cashfree SDK error:", sdkErr);
            setError("Payment gateway failed to load. Try again.");
          }
        } else if (data.brCode) {
          const item = items.find((i) => i.id === itemId);
          setPixModal({
            brCode: data.brCode,
            brCodeBase64: data.brCodeBase64,
            purchaseId: data.purchase_id,
            itemId,
            itemName: item?.name ?? "Item",
            githubLogin,
          });
        } else if (data.url) {
          window.location.href = data.url;
        }
      } catch (err) {
        console.warn("[components/ShopClient.tsx] error:", err);
        setError("Network error. Try again.");
      } finally {
        setBuyingItem(null);
        setBuyingProvider(null);
      }
    },
    [buyingItem, items, githubLogin, devModeEnabled]
  );

  const handleBuyWithPoints = useCallback(
    async (itemId: string) => {
      setBuyingItem(itemId);
      setBuyingProvider("points");
      setError(null);
      try {
        const res = await fetch("/api/shop/buy-with-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, dev_mode: devModeEnabled }),
        });
        const data = await res.json();
        if (res.ok) {
          setOwned((prev) => [...prev, itemId]);
          setPoints(data.points_remaining);
          setPurchaseToast(itemId);
          setTimeout(() => setPurchaseToast(null), 5000);
          trackPurchaseCompleted(itemId, 0, "points");
        } else {
          setError(data.error || "Failed to buy item.");
        }
      } catch (err) {
        console.warn("[components/ShopClient.tsx] error:", err);
        setError("Network error. Try again.");
      } finally {
        setBuyingItem(null);
        setBuyingProvider(null);
      }
    },
    [githubLogin, devModeEnabled]
  );

  // ─── Redeem Code Handler ───────────────────────────────────
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemState, setRedeemState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [redeemMsg, setRedeemMsg] = useState("");

  const handleRedeem = async () => {
    const trimmed = redeemCode.trim().toUpperCase();
    if (!trimmed) return;
    setRedeemState("loading");
    setRedeemMsg("");
    try {
      const isXPCode = trimmed.startsWith("CITY-XP");
      const isAllItemsCode = trimmed.startsWith("CITY-ALL-");
      const endpoint = isXPCode
        ? "/api/shop/redeem-xp"
        : isAllItemsCode
          ? "/api/shop/redeem-special"
          : "/api/shop/redeem";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        if (!isXPCode && !isAllItemsCode && data.item_id) {
          setOwned((prev) => prev.includes(data.item_id) ? prev : [...prev, data.item_id]);
        }
        if (isAllItemsCode && Array.isArray(data.granted_items)) {
          // Add all newly unlocked items to local owned state
          setOwned((prev) => {
            const newItems = (data.granted_items as string[]).filter(id => !prev.includes(id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
        if (isXPCode && (data.xp_granted || data.new_xp_total)) {
          if (data.new_xp_total) {
            setXpLevel(levelFromXp(data.new_xp_total));
          } else {
            setXpLevel((prev) => Math.max(prev, levelFromXp((prev === 1 ? 0 : prev * 25) + data.xp_granted)));
          }
          fetch("/api/me").then(r => r.json()).then(d => {
            if (d?.xp_level) setXpLevel(d.xp_level);
          }).catch(() => {});
        }
        setRedeemState("success");
        setRedeemMsg(data.message ?? (
          isXPCode ? `🎉 XP claimed successfully!` :
          isAllItemsCode ? `🎁 Items unlocked!` :
          `🎉 ${data.item_name} added to your inventory!`
        ));
        setRedeemCode("");
        setTimeout(() => setRedeemState("idle"), 5000);
      } else {
        setRedeemState("error");
        setRedeemMsg(data.error ?? "Invalid or expired code.");
        setTimeout(() => setRedeemState("idle"), 4000);
      }
    } catch (err) {
      console.warn("[components/ShopClient.tsx] error:", err);
      setRedeemState("error");
      setRedeemMsg("Network error. Please try again.");
      setTimeout(() => setRedeemState("idle"), 4000);
    }
  };

  const handlePixCompleted = useCallback(
    (_purchaseId: string) => {
      if (pixModal) {
        const itemId = pixModal.itemId;
        if (itemId) {
          setOwned((prev) =>
            prev.includes(itemId) ? prev : [...prev, itemId]
          );
          if (itemId === "billboard") {
            setBillboardSlots((prev) => prev + 1);
            const pending = getPendingBillboard();
            if (pending) {
              const file = dataUrlToFile(pending.data, pending.name, pending.type);
              const formData = new FormData();
              formData.append("file", file);
              formData.append("slot_index", "0");
              fetch("/api/customizations/upload", { method: "POST", body: formData })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json();
                    if (data.images) setBillboardImages(data.images);
                  }
                })
                .finally(() => clearPendingBillboard());
            }
          }
        }
      }
      setPixModal(null);
    },
    [pixModal, items]
  );

  // ─── Helpers ─────────────────────────────────────────────

  /** Find the zone a given item belongs to (crown/roof/aura) */
  function getItemZone(itemId: string): keyof Loadout | null {
    for (const [zone, zoneItems] of Object.entries(ZONE_ITEMS)) {
      if (zoneItems.includes(itemId)) return zone as keyof Loadout;
    }
    return null;
  }

  /** Get the ShopItem record for an item_id */
  function getShopItem(itemId: string): ShopItem | undefined {
    return items.find((i) => i.id === itemId);
  }

  // ─── Empty state ─────────────────────────────────────────

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[10px] text-muted normal-case">
        No items available yet. Check back soon!
      </p>
    );
  }

  // ─── Render ───────────────────────────────────────────────

  const ownedFacesItems = (isDevAccount && devModeEnabled)
    ? FACES_ITEMS
    : owned.filter((id) => FACES_ITEMS.includes(id));

  const saveButton = (
    <button
      onClick={handleSaveLoadout}
      disabled={!hasChanges || saving}
      className="btn-press w-full py-2.5 text-xs text-bg disabled:opacity-40"
      style={{
        backgroundColor: saved ? "#39d353" : ACCENT,
        boxShadow: `2px 2px 0 0 ${SHADOW}`,
      }}
    >
      {saving ? "Saving..." : saved ? "Saved!" : "Save Loadout"}
    </button>
  );

  return (
    <>
      {/* Purchase success toast */}
      {purchaseToast && (() => {
        const isRaidItem = ALL_RAID_ITEMS.includes(purchaseToast);
        const isConsumable = purchaseToast === "streak_freeze";
        const toastMsg = isConsumable
          ? "Added to your inventory!"
          : isRaidItem
            ? "Unlocked! Ready for your next battle."
            : "Purchased! Equip it below.";
        const toastBg = isRaidItem ? "#ff5555" : ACCENT;
        const toastBorder = isRaidItem ? "#aa2222" : SHADOW;
        return (
          <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
            <div
              className="flex items-center gap-2 border-[3px] px-5 py-2.5 text-[10px] text-bg"
              style={{ backgroundColor: toastBg, borderColor: toastBorder }}
            >
              <span className="text-base">{ITEM_EMOJIS[purchaseToast] ?? "🎉"}</span>
              <span>{ITEM_NAMES[purchaseToast] ?? purchaseToast} {toastMsg}</span>
            </div>
          </div>
        );
      })()}

      {/* Gift success toast */}
      {giftToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-2 border-[3px] px-5 py-2.5 text-[10px] text-bg"
            style={{ backgroundColor: ACCENT, borderColor: SHADOW }}
          >
            <span className="text-base">🎁</span>
            <span>{ITEM_NAMES[giftToast.item] ?? giftToast.item} sent to {giftToast.to}!</span>
          </div>
        </div>
      )}

      {/* Checkout loading overlay */}
      {buyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="border-[3px] border-border bg-bg p-6 text-center">
            <div className="mb-3 text-2xl animate-pulse">{ITEM_EMOJIS[buyingItem] ?? "🛒"}</div>
            <p className="text-xs text-cream">{buyingProvider === "abacatepay" ? "Generating PIX..." : buyingProvider === "cashfree" ? "Opening UPI..." : "Redirecting to checkout..."}</p>
            <p className="mt-1 text-[9px] text-muted normal-case">Please wait</p>
          </div>
        </div>
      )}

      {/* PIX Modal */}
      {pixModal && (
        <PixModal
          data={pixModal}
          onClose={() => setPixModal(null)}
          onCompleted={handlePixCompleted}
        />
      )}

      {error && (
        <div className="mb-4 border-[2px] border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-400 normal-case">
          {error}
        </div>
      )}

      {/* Shop Header with Points */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight text-cream">SHOP</h2>
        <div className="flex items-center gap-2 border-[2px] border-border bg-bg-card px-3 py-1.5">
          <span className="text-[10px] text-muted">BALANCE:</span>
          <span className="text-sm font-bold" style={{ color: ACCENT }}>
            {points.toLocaleString()} [P]
          </span>
        </div>
      </div>

      {/* Developer Mode Toggle */}
      {isDevAccount && (
        <div className="mb-5 flex items-center justify-between border-[3px] border-dashed border-[#ffa116]/40 bg-[#ffa116]/5 p-4 transition-all hover:border-[#ffa116]/70">
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider" style={{ color: ACCENT }}>
              🛠️ DEVELOPER MODE
            </span>
            <span className="text-[9px] text-muted normal-case mt-0.5">
              {devModeEnabled
                ? "Bypass payment gateways & get items instantly for free (DEV MODE ACTIVE)"
                : "Developer bypass inactive. You will be prompted for real payment"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextVal = !devModeEnabled;
              setDevModeEnabled(nextVal);
              localStorage.setItem("leetcodecity:dev_mode", nextVal ? "true" : "false");
            }}
            className={`relative inline-flex h-6 w-11 items-center border-[2px] transition-all cursor-pointer focus:outline-none ${
              devModeEnabled ? "bg-[#39d353] border-[#238636]" : "bg-bg-card border-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform transition-all ${
                devModeEnabled ? "translate-x-5 bg-bg" : "translate-x-1 bg-muted"
              }`}
            />
          </button>
        </div>
      )}

      {/* ─── Redeem a Code ─────────────────────────────────── */}
      <div className="mb-5 border-[2px] border-border bg-bg-raised p-4">
        <p className="mb-3 text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>🎟 Redeem a Code</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="CITY-ITEM-XXXX"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && redeemState === "idle" && handleRedeem()}
            maxLength={30}
            className="flex-1 border-[2px] border-border bg-bg px-3 py-2 text-[11px] text-cream placeholder:text-muted/50 uppercase tracking-wider focus:border-border-light focus:outline-none"
            disabled={redeemState === "loading"}
          />
          <button
            onClick={handleRedeem}
            disabled={!redeemCode.trim() || redeemState === "loading"}
            className="btn-press px-4 py-2 text-[10px] text-bg disabled:opacity-40"
            style={{ backgroundColor: redeemState === "success" ? "#39d353" : ACCENT, boxShadow: `2px 2px 0 0 ${SHADOW}` }}
          >
            {redeemState === "loading" ? "..." : redeemState === "success" ? "✓" : "Redeem"}
          </button>
        </div>
        {redeemMsg && (
          <p className={`mt-2 text-[9px] normal-case ${redeemState === "success" ? "text-green-400" : "text-red-400"}`}>
            {redeemMsg}
          </p>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab("building")}
          className={`px-5 py-2 text-[11px] border-[2px] transition-colors ${activeTab === "building"
            ? "bg-bg-card border-cream/20 text-cream"
            : "border-border text-muted hover:text-cream hover:border-border-light"
            }`}
        >
          BUILDING
        </button>
        <button
          onClick={() => setActiveTab("raid")}
          className={`px-5 py-2 text-[11px] border-[2px] transition-colors ${activeTab === "raid"
            ? "bg-bg-card border-cream/20"
            : "border-border text-muted hover:text-cream hover:border-border-light"
            }`}
          style={{ color: activeTab === "raid" ? "#ff5555" : undefined }}
        >
          BATTLE
        </button>
        <button
          onClick={() => setActiveTab("consumables")}
          className={`px-5 py-2 text-[11px] border-[2px] transition-colors ${activeTab === "consumables"
            ? "bg-bg-card border-cream/20"
            : "border-border text-muted hover:text-cream hover:border-border-light"
            }`}
          style={{ color: activeTab === "consumables" ? "#ffaa00" : undefined }}
        >
          CONSUMABLES
        </button>
        <button
          onClick={() => setActiveTab("points")}
          className={`px-5 py-2 text-[11px] border-[2px] transition-colors ${activeTab === "points"
            ? "bg-bg-card border-cream/20"
            : "border-border text-muted hover:text-cream hover:border-border-light"
            }`}
          style={{
            color: activeTab === "points" ? ACCENT : undefined,
            borderColor: activeTab === "points" ? `${ACCENT}44` : undefined
          }}
        >
          POINT SHOP [P]
        </button>
      </div>

      {/* ─── Building and Point Shop Tabs Layout ─── */}
      {(activeTab === "building" || activeTab === "points") && (
        <div className="lg:flex lg:gap-6">
          {/* Left column: Preview (persistent across building & points tabs) */}
          <div className="lg:w-[360px] lg:shrink-0">
            <div className="lg:sticky lg:top-6">
              <ShopPreview
                loadout={effectiveLoadout}
                ownedFacesItems={ownedFacesItems}
                customColor={previewColor ?? customColor}
                ledBannerText={previewLedBannerText ?? ledBannerText}
                billboardImages={previewBillboardImages ?? billboardImages}
                buildingDims={buildingDims}
                highlightItemId={highlightItem}
                buildingStyle={bStyle}
              />
              {/* Save button (desktop, below preview) - only on building tab */}
              {activeTab === "building" && (
                <div className="hidden lg:block mt-4">
                  {saveButton}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Tab Content */}
          <div className="mt-5 lg:mt-0 min-w-0 flex-1">
            {activeTab === "building" && (
              <>
                <div className="space-y-5">
                {isDevAccount && (
                <div className="border-[3px] border-border bg-bg-raised p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm" style={{ color: ACCENT }}>
                      Building Style
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStyle("tower")}
                      disabled={isTogglingStyle}
                      className={`flex-1 border-[2px] py-2 text-[10px] transition-all ${bStyle === "tower" ? "border-[#39d353] bg-[rgba(57,211,83,0.1)] text-cream" : "border-border text-muted hover:border-border-light bg-bg-card"
                        }`}
                    >
                      Tower
                    </button>
                    <button
                      onClick={() => handleToggleStyle("bungalow")}
                      disabled={isTogglingStyle}
                      className={`flex-1 border-[2px] py-2 text-[10px] transition-all ${bStyle === "bungalow" ? "border-[#39d353] bg-[rgba(57,211,83,0.1)] text-cream" : "border-border text-muted hover:border-border-light bg-bg-card"
                        }`}
                    >
                      Bungalow
                    </button>
                  </div>
                  <p className="mt-2 text-[8px] text-dim normal-case">
                    *Exclusive dev option: switch between high-rise tower and sprawling bungalow layout.
                  </p>
                </div>
              )}
              {/* Zone sections: CROWN, ROOF, AURA */}
              {(Object.entries(ZONE_ITEMS) as [string, string[]][]).map(([zone, zoneItemIds]) => {
                const zoneKey = zone as keyof Loadout;
                const equippedId = effectiveLoadout[zoneKey];
                const equippedName = equippedId ? (ITEM_NAMES[equippedId] ?? equippedId) : "None";
                const ownedCount = zoneItemIds.filter((id) => owned.includes(id)).length;

                return (
                  <div key={zone} className="border-[3px] border-border bg-bg-raised p-4">
                    {/* Zone header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm" style={{ color: ACCENT }}>
                        {ZONE_LABELS[zone] ?? zone}
                      </h3>
                      <span className="text-[9px] text-muted normal-case">
                        {ownedCount}/{zoneItemIds.length} owned · equipped: {equippedName}
                      </span>
                    </div>

                    {/* Item cards grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {zoneItemIds.map((itemId) => {
                        const isOwned = owned.includes(itemId) || (isDevAccount && devModeEnabled);
                        const isEquipped = equippedId === itemId;
                        const shopItem = getShopItem(itemId);
                        const isFreeItem = itemId === FREE_CLAIM_ITEM;
                        const achUnlock = ACHIEVEMENT_ITEMS[itemId];
                        const hasAchievement = achUnlock && achievements.includes(achUnlock.achievement);
                        const isBuying = buyingItem === itemId;

                        const isLeetCodeStar = itemId === "github_star";

                        const reqLevel = ITEM_UNLOCK_LEVELS[itemId];
                        const isLevelLocked = reqLevel && xpLevel < reqLevel;

                        // Badge text
                        let badge: string;
                        let badgeColor: string;
                        if (isEquipped) {
                          badge = "EQUIPPED";
                          badgeColor = "#39d353";
                        } else if (isOwned) {
                          badge = "\u2713";
                          badgeColor = ACCENT;
                        } else if (isLeetCodeStar) {
                          badge = "\u2B50 STAR TO UNLOCK";
                          badgeColor = "#FFD700";
                        } else if (itemId === "scouting_satellite" && !isOwned) {
                          const met = acceptedMedium >= 10 || acceptedHard >= 5;
                          badge = met ? "Unlockable!" : "LC QUEST LCKD";
                          badgeColor = met ? "#39d353" : "#f0a030";
                        } else if (isLevelLocked && !isOwned) {
                          badge = `LVL ${reqLevel} REQ`;
                          badgeColor = "#f0a030";
                        } else if (isFreeItem) {
                          badge = "FREE";
                          badgeColor = ACCENT;
                        } else if (achUnlock && !shopItem?.price_usd_cents) {
                          badge = hasAchievement ? "Unlockable!" : achUnlock.label.split("(")[0].trim();
                          badgeColor = hasAchievement ? "#39d353" : "#a0a0b0";
                        } else if (shopItem) {
                          badge = formatPrice(shopItem);
                          badgeColor = "#a0a0b0";
                        } else {
                          badge = "";
                          badgeColor = "#a0a0b0";
                        }

                        const isConfirming = confirmBuyItem === itemId;

                        // Click handler
                        const handleClick = () => {
                          setHighlightItem(itemId);
                          if (isEquipped) {
                            handleUnequip(zoneKey);
                          } else if (isOwned) {
                            handleEquip(zoneKey, itemId);
                          } else if (isLeetCodeStar && !isOwned) {
                            // Step 1: open repo, Step 2: verify
                            if (starVerifyStep === "idle") {
                              window.open("https://github.com/Ixotic27/The-Leetcode-City", "_blank");
                              setStarVerifyStep("opened");
                            } else if (starVerifyStep === "opened") {
                              verifyLeetCodeStar();
                            }
                          } else if (isFreeItem) {
                            claimFreeItem();
                          } else if (shopItem && shopItem.price_usd_cents > 0) {
                            // Don't allow buying if level locked or quest locked
                            if (isLevelLocked && !isOwned) return;
                            if (itemId === "scouting_satellite" && !isOwned && !(acceptedMedium >= 10 || acceptedHard >= 5)) return;

                            if (!isConfirming) trackShopItemViewed(itemId, zone, shopItem.price_usd_cents);
                            setConfirmBuyItem(isConfirming ? null : itemId);
                          }
                        };

                        const isPopular = popularItems.includes(itemId);
                        const scarcity = shopItem ? getScarcityInfo(shopItem, totalPurchaseCounts[itemId] ?? 0) : null;
                        const isSoldOut = scarcity?.expired === true;

                        return (
                          <div key={itemId} className="relative" data-buy-popover>
                            {/* A11: Scarcity badge (takes priority over popularity) */}
                            {scarcity && !isOwned && !isEquipped && (
                              <span
                                className="absolute top-1 right-1 z-10 px-1 py-px text-[7px] font-bold"
                                style={{
                                  backgroundColor: `${scarcity.color}20`,
                                  color: scarcity.color,
                                  border: `1px solid ${scarcity.color}40`,
                                }}
                              >
                                {shopItem?.is_exclusive && "💎 "}{scarcity.label}
                              </span>
                            )}
                            {/* A10: Popularity badge (only if no scarcity badge) */}
                            {!scarcity && isPopular && !isOwned && !isEquipped && (
                              <span
                                className="absolute top-1 right-1 z-10 px-1 py-px text-[7px] font-bold"
                                style={{
                                  backgroundColor: popularItems[0] === itemId ? "rgba(255,107,107,0.15)" : "rgba(255,161,22,0.15)",
                                  color: popularItems[0] === itemId ? "#ff6b6b" : ACCENT,
                                  border: `1px solid ${popularItems[0] === itemId ? "rgba(255,107,107,0.3)" : "rgba(255,161,22,0.3)"}`,
                                }}
                              >
                                {popularItems[0] === itemId ? "\uD83D\uDD25 Popular" : "\u2B50 Trending"}
                              </span>
                            )}
                            <button
                              onClick={isSoldOut && !isOwned ? undefined : handleClick}
                              disabled={isBuying || (isSoldOut && !isOwned)}
                              onMouseEnter={() => setHighlightItem(itemId)}
                              onMouseLeave={() => setHighlightItem(null)}
                              className={[
                                "flex flex-col items-center justify-center p-2 transition-all w-full aspect-square",
                                isEquipped ? "border-[3px]" : "border-[2px]",
                                isEquipped ? "border-[#39d353]" : isConfirming ? "border-[var(--color-border-light)]" : "border-border",
                                isEquipped ? "bg-[rgba(57,211,83,0.1)]" : "bg-bg-card",
                                !isOwned && !isEquipped ? "opacity-60" : "",
                                "hover:border-border-light",
                              ].join(" ")}
                            >
                              <span className="text-3xl">{ITEM_EMOJIS[itemId] ?? "?"}</span>
                              <span className="mt-1 text-[10px] text-cream truncate w-full text-center">
                                {ITEM_NAMES[itemId] ?? itemId}
                              </span>
                              <span
                                className={`mt-0.5 ${badge.startsWith("$") ? "text-[10px] font-bold" : "text-[9px]"}`}
                                style={{ color: badgeColor }}
                              >
                                {isBuying ? "..." : isLeetCodeStar && !isOwned && !isEquipped ? (
                                  verifyingStar ? "Verifying..." : starVerifyStep === "opened" ? "Verify \u2B50" : badge
                                ) : badge}
                              </span>
                              {/* A13: Social proof - weekly purchase count */}
                              {(purchaseCounts[itemId] ?? 0) >= 3 && !isOwned && (
                                <span className="mt-0.5 text-[8px] text-dim">
                                  {purchaseCounts[itemId]} purchased this week
                                </span>
                              )}
                            </button>


                            


                            {/* Buy confirmation popover */}
                            {isConfirming && shopItem && (
                              <div data-buy-popover className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 w-36 border-[2px] border-border bg-bg p-2 shadow-lg">
                                <p className="text-[9px] text-cream text-center mb-1.5">
                                  {ITEM_NAMES[itemId]}
                                </p>
                                <div className="flex flex-col items-center justify-center mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] line-through text-muted opacity-60">
                                      {formatPrice({ ...shopItem, price_usd_cents: shopItem.price_usd_cents * 10 })}
                                    </span>
                                    <span className="text-[12px] font-bold text-[#39d353]">
                                      {formatPrice(shopItem)}
                                    </span>
                                  </div>
                                  <span className="text-[8px] font-bold bg-[#39d353]/20 text-[#39d353] px-1 py-0.5 rounded mt-0.5">
                                    90% OFF LAUNCH SALE
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {isDevAccount && devModeEnabled && (
                                    <p className="text-[8px] text-center mb-1 font-bold animate-pulse text-green-400">
                                      DEV: FREE FOR TESTING ACTIVE
                                    </p>
                                  )}
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); }}
                                      className="flex-1 border-[2px] border-border py-1 text-[9px] text-muted hover:text-cream"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); checkout(itemId, "cashfree"); }}
                                      disabled={isBuying}
                                      className="btn-press flex-1 py-1 text-[9px] text-bg disabled:opacity-40"
                                      style={{ backgroundColor: ACCENT, boxShadow: `1px 1px 0 0 ${SHADOW}` }}
                                    >
                                      {isBuying ? "..." : "Buy"}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={true}
                                    className="w-full py-1 text-[9px] text-muted border-[1px] border-dashed border-border cursor-not-allowed text-center bg-transparent mt-1"
                                  >
                                    Crypto (Coming Soon)
                                  </button>
                                  {shopItem && shopItem.price_points != null && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); handleBuyWithPoints(itemId); }}
                                      disabled={isBuying || points < (shopItem.price_points ?? 0)}
                                      className="btn-press w-full py-1 text-[9px] text-bg disabled:opacity-40"
                                      style={{ backgroundColor: "#39d353", boxShadow: "1px 1px 0 0 #238636" }}
                                    >
                                      {isBuying ? "..." : points < (shopItem.price_points ?? 0) ? `Not enough points (${shopItem.price_points})` : `Buy with ${shopItem.price_points} Points`}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Full-width panels below the grid for equipped face items */}
                    {equippedId === "custom_color" && (owned.includes("custom_color") || (isDevAccount && devModeEnabled)) && (
                      <div className="mt-3 border-[2px] border-border/50 bg-bg/50 px-4 py-3">
                        <p className="mb-2 text-[9px] text-muted normal-case">Custom Building Color</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={customColor ?? "#ffffff"}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="h-8 w-16 cursor-pointer border-[2px] border-border bg-bg-raised p-1 hover:border-border-light"
                          />
                          <span className="flex-1 text-[10px] text-cream font-mono">{customColor ?? "#ffffff"}</span>
                          <button
                            onClick={() => handleSaveCustomization("custom_color", { color: customColor })}
                            disabled={savingCustomization === "custom_color"}
                            className="btn-press px-4 py-1.5 text-[9px] text-bg disabled:opacity-40"
                            style={{ backgroundColor: savedCustomization === "custom_color" ? "#39d353" : ACCENT, boxShadow: `1px 1px 0 0 ${SHADOW}` }}
                          >
                            {savingCustomization === "custom_color" ? "Saving..." : savedCustomization === "custom_color" ? "Saved!" : "Save Color"}
                          </button>
                        </div>
                      </div>
                    )}

                    {equippedId === "led_banner" && (owned.includes("led_banner") || (isDevAccount && devModeEnabled)) && (
                      <div className="mt-3 border-[2px] border-border/50 bg-bg/50 px-4 py-3">
                        <p className="mb-2 text-[9px] text-muted normal-case">LED Banner Text</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={ledBannerText ?? ""}
                            placeholder="Your text here"
                            onChange={(e) => setLedBannerText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 h-8 px-3 border-[2px] border-border bg-bg-raised text-[10px] text-cream"
                          />
                          <button
                            onClick={() => handleSaveCustomization("led_banner", { text: ledBannerText })}
                            disabled={savingCustomization === "led_banner"}
                            className="btn-press px-4 py-1.5 text-[9px] text-bg disabled:opacity-40"
                            style={{ backgroundColor: savedCustomization === "led_banner" ? "#39d353" : ACCENT, boxShadow: `1px 1px 0 0 ${SHADOW}` }}
                          >
                            {savingCustomization === "led_banner" ? "Saving..." : savedCustomization === "led_banner" ? "Saved!" : "Save Text"}
                          </button>
                        </div>
                      </div>
                    )}

                    {equippedId === "billboard" && (owned.includes("billboard") || (isDevAccount && devModeEnabled)) && (
                      <div className="mt-3">
                        <BillboardUploadPanel
                          images={billboardImages}
                          slotCount={billboardSlots}
                          isOwned={true}
                          autoUploading={autoUploading}
                          onImagesChange={setBillboardImages}
                          onPreviewChange={setPreviewBillboardImages}
                        />
                      </div>
                    )}
                  </div>
                );
              })}



              {/* Consumables section */}
              {(() => {
                const freezeItem = getShopItem("streak_freeze");
                if (!freezeItem) return null;
                const atMax = freezeCount >= 2;
                const isBuying = buyingItem === "streak_freeze";
                const isConfirming = confirmBuyItem === "streak_freeze";
                return (
                  <div className="border-[3px] border-border bg-bg-raised p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm" style={{ color: ACCENT }}>
                        Consumables
                      </h3>
                      <span className="text-[9px] text-muted normal-case">
                        one-time use items
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="relative" data-buy-popover>
                        <button
                          onClick={() => {
                            if (atMax) return;
                            if (!isConfirming) trackShopItemViewed("streak_freeze", "consumable", freezeItem.price_usd_cents);
                            setConfirmBuyItem(isConfirming ? null : "streak_freeze");
                          }}
                          disabled={isBuying || atMax}
                          className={[
                            "flex flex-col items-center justify-center p-2 transition-all w-full aspect-square",
                            "border-[2px]",
                            isConfirming ? "border-[var(--color-border-light)]" : "border-border",
                            "bg-bg-card",
                            atMax ? "opacity-40" : "",
                            "hover:border-border-light",
                          ].join(" ")}
                        >
                          <span className="text-3xl">{ITEM_EMOJIS.streak_freeze}</span>
                          <span className="mt-1 text-[10px] text-cream truncate w-full text-center">
                            {ITEM_NAMES.streak_freeze}
                          </span>
                          <span className="mt-0.5 text-[9px]" style={{ color: atMax ? "#ff4444" : "#a0a0b0" }}>
                            {isBuying ? "..." : atMax ? "MAX (2/2)" : `${freezeCount}/2 stored`}
                          </span>
                        </button>

                        {isConfirming && (
                          <div data-buy-popover className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 w-36 border-[2px] border-border bg-bg p-2 shadow-lg">
                            <p className="text-[9px] text-cream text-center mb-1.5">
                              {ITEM_NAMES.streak_freeze}
                            </p>
                            <p className="text-[8px] text-muted text-center mb-1 normal-case">
                              Protects 1 day of absence
                            </p>
                            <p className="text-[10px] text-center mb-2" style={{ color: ACCENT }}>
                              {formatPrice(freezeItem)}
                            </p>
                            <div className="flex flex-col gap-1">
                              {isDevAccount && devModeEnabled && (
                                <p className="text-[8px] text-center mb-1 font-bold animate-pulse text-green-400">
                                  DEV: FREE FOR TESTING ACTIVE
                                </p>
                              )}
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); }}
                                  className="flex-1 border-[2px] border-border py-1 text-[9px] text-muted hover:text-cream"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); checkout("streak_freeze", "cashfree"); }}
                                  disabled={isBuying}
                                  className="btn-press flex-1 py-1 text-[9px] text-bg disabled:opacity-40"
                                  style={{ backgroundColor: ACCENT, boxShadow: `1px 1px 0 0 ${SHADOW}` }}
                                >
                                  {isBuying ? "..." : "Buy"}
                                </button>
                              </div>
                              <button
                                type="button"
                                disabled={true}
                                className="w-full py-1 text-[9px] text-muted border-[1px] border-dashed border-border cursor-not-allowed text-center bg-transparent mt-1"
                              >
                                Crypto (Coming Soon)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Payment note */}
              <p className="text-center text-[10px] text-dim normal-case">
                Payment via UPI & Crypto (Coming Soon)
              </p>
                </div>

                {/* Mobile: Save sticky bottom */}
                <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-bg border-t-[3px] border-border lg:hidden">
                  {saveButton}
                </div>
              </>
            )}

            {activeTab === "points" && (
              <div className="space-y-6">
                <div className="border-[3px] border-border bg-bg-raised p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 flex items-center justify-center bg-bg-card border-[2px] border-border text-xl"
                      style={{ color: ACCENT }}
                    >
                      💎
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-cream">PREMIUM POINT SHOP</h3>
                      <p className="text-[9px] text-muted normal-case">Redeem points for exclusive items and power-ups.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {items.filter(item => item.price_points != null && item.price_points > 0).map(item => {
                      const itemId = item.id;
                      const isOwned = owned.includes(itemId) || (isDevAccount && devModeEnabled);
                      const isConsumable = itemId === "streak_freeze";
                      const isMaxed = isConsumable && freezeCount >= 2;
                      const canAfford = points >= (item.price_points ?? 0);
                      const isBuying = buyingItem === itemId;
                      const isConfirming = confirmBuyItem === itemId;

                      let statusLabel = "";
                      let statusColor = "#a0a0b0";

                      if (isOwned && !isConsumable) {
                        statusLabel = "OWNED";
                        statusColor = ACCENT;
                      } else if (isMaxed) {
                        statusLabel = "MAXED";
                        statusColor = "#ff4444";
                      } else {
                        statusLabel = `${item.price_points} [P]`;
                        statusColor = canAfford ? "#39d353" : "#ff4444";
                      }

                      return (
                        <div key={itemId} className="relative" data-buy-popover>
                          <button
                            onClick={() => {
                              // Preview logic: if it's a building item, equip it for preview
                              const zone = (Object.keys(ZONE_ITEMS) as (keyof Loadout)[]).find(z => ZONE_ITEMS[z].includes(itemId));
                              if (zone) {
                                handleEquip(zone, itemId);
                              }
                              setHighlightItem(itemId);

                              if (isMaxed) return;
                              if (isOwned && !isConsumable) return;
                              setConfirmBuyItem(isConfirming ? null : itemId);
                            }}
                            disabled={isBuying || isMaxed}
                            onMouseEnter={() => setHighlightItem(itemId)}
                            onMouseLeave={() => setHighlightItem(null)}
                            className={[
                              "flex flex-col items-center justify-center p-2 transition-all w-full aspect-square",
                              "border-[2px]",
                              isOwned && !isConsumable ? "border-[#39d353] bg-[rgba(57,211,83,0.1)]" : "border-border bg-bg-card",
                              isConfirming ? "border-cream" : "hover:border-border-light",
                              (isOwned && !isConsumable) || isMaxed ? "opacity-60" : ""
                            ].join(" ")}
                          >
                            <span className="text-3xl">{ITEM_EMOJIS[itemId] ?? "🎁"}</span>
                            <span className="mt-1 text-[10px] text-cream truncate w-full text-center">
                              {ITEM_NAMES[itemId] ?? itemId}
                            </span>
                            <span className="mt-0.5 text-[9px] font-bold" style={{ color: statusColor }}>
                              {isBuying ? "..." : statusLabel}
                            </span>
                            {isConsumable && (
                              <span className="mt-0.5 text-[8px] text-dim">{freezeCount}/2</span>
                            )}
                          </button>

                          {/* Popover confirmation */}
                          {isConfirming && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 w-36 border-[2px] border-border bg-bg p-2 shadow-lg text-center">
                              <p className="text-[9px] text-cream mb-1.5">Redeem {ITEM_NAMES[itemId]}?</p>
                              <p className="text-[10px] font-bold mb-2" style={{ color: "#39d353" }}>
                                {item.price_points} Points
                              </p>
                              {isDevAccount && devModeEnabled && (
                                <p className="text-[8px] text-center mb-1 font-bold animate-pulse text-green-400">
                                  DEV: FREE ACTIVE
                                </p>
                              )}
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); }}
                                  className="flex-1 border-[2px] border-border py-1 text-[9px] text-muted hover:text-cream"
                                >
                                  No
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmBuyItem(null); handleBuyWithPoints(itemId); }}
                                  disabled={!(canAfford || (isDevAccount && devModeEnabled)) || isBuying}
                                  className="btn-press flex-1 py-1 text-[9px] text-bg disabled:opacity-40"
                                  style={{ backgroundColor: "#39d353", boxShadow: `1px 1px 0 0 #238636` }}
                                >
                                  {isBuying ? "..." : "Yes"}
                                </button>
                              </div>
                              {!(canAfford || (isDevAccount && devModeEnabled)) && <p className="mt-1.5 text-[8px] text-red-400 normal-case">Not enough points!</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 border-[2px] border-dashed border-border/40 bg-bg-card/50 text-center">
                  <p className="text-[10px] text-muted normal-case italic">
                    Earn points via daily check-ins (+5pts) and daily tasks (+15pts).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Raid Tab ─── */}
      {activeTab === "raid" && (
        <div className="max-w-[640px] mx-auto space-y-5">
          <div className="border-[3px] border-border bg-bg-raised p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm" style={{ color: "#ff5555" }}>
                Battle
              </h3>
              <span className="text-[9px] text-muted normal-case">
                vehicles, tags & boosts
              </span>
            </div>

            {/* --- Vehicles Sub-Section --- */}
            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted">Vehicles</p>
            <div className="grid grid-cols-2 gap-3 mb-0">
              {/* Airplane - free default */}
              <button
                onClick={() => handleSetRaidVehicle("airplane")}
                className={[
                  "w-full overflow-hidden transition-colors border-[2px]",
                  raidLoadout.vehicle === "airplane"
                    ? "border-[#39d353] bg-[rgba(57,211,83,0.05)]"
                    : "border-[#39d353]/40 bg-[rgba(57,211,83,0.02)] hover:border-[#39d353]/70",
                ].join(" ")}
              >
                <div className="h-24 bg-black/20 relative">
                  <RaidVehiclePreview vehicleType="airplane" />
                  {raidLoadout.vehicle === "airplane" && (
                    <span className="absolute top-1 right-1 text-[8px] font-bold px-1 bg-[#39d353]/20 text-[#39d353] border border-[#39d353]/30">ACTIVE</span>
                  )}
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[10px] text-cream">✈️ Airplane</span>
                  <span className="text-[10px]" style={{ color: ACCENT }}>✓</span>
                </div>
              </button>

              {RAID_VEHICLE_ITEMS.map((itemId) => {
                const reqLevel = ITEM_UNLOCK_LEVELS[itemId];
                const isLevelLocked = reqLevel && xpLevel < reqLevel;
                const isAccessible = owned.includes(itemId) || !isLevelLocked || (isDevAccount && devModeEnabled);
                const isActive = isAccessible && raidLoadout.vehicle === itemId;

                return (
                  <div key={itemId} className="relative">
                    <button
                      onClick={() => {
                        if (isAccessible) {
                          handleSetRaidVehicle(itemId);
                        }
                      }}
                      className={[
                        "w-full overflow-hidden transition-colors",
                        "border-[2px]",
                        isAccessible
                          ? isActive
                            ? "border-[#39d353] bg-[rgba(57,211,83,0.05)]"
                            : "border-[#39d353]/40 bg-[rgba(57,211,83,0.02)] hover:border-[#39d353]/70"
                          : "border-border hover:border-orange-500/40 opacity-70",
                        !isAccessible ? "bg-bg-card" : "",
                      ].join(" ")}
                    >
                      <div className="h-24 bg-black/20 relative">
                        <RaidVehiclePreview vehicleType={itemId} />
                        {isActive && (
                          <span className="absolute top-1 right-1 text-[8px] font-bold px-1 bg-[#39d353]/20 text-[#39d353] border border-[#39d353]/30">ACTIVE</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[10px] text-cream">
                          {ITEM_EMOJIS[itemId] ?? "?"} {ITEM_NAMES[itemId] ?? itemId}
                        </span>
                        {isAccessible ? (
                          <span className="text-[10px]" style={{ color: ACCENT }}>✓</span>
                        ) : (
                          <span className="text-[10px] font-bold text-orange-400">
                            LVL {reqLevel} REQ
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <hr className="my-4 border-red-500/20" />

            {/* --- Graffiti Tags Sub-Section --- */}
            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted">Graffiti Tags</p>
            {(() => {
              const TAG_COLORS: Record<string, string> = {
                tag_neon: "#00ffff",
                tag_fire: "#ff6600",
                tag_gold: "#ffd700",
              };
              return (
                <div className="grid grid-cols-3 gap-2 mb-0">
                  {RAID_TAG_ITEMS.map((itemId) => {
                    const reqLevel = ITEM_UNLOCK_LEVELS[itemId];
                    const isLevelLocked = reqLevel && xpLevel < reqLevel;
                    const isAccessible = owned.includes(itemId) || !isLevelLocked || (isDevAccount && devModeEnabled);

                    return (
                      <div key={itemId} className="relative">
                        <div
                          className={[
                            "relative flex flex-col items-center justify-center p-2 transition-all w-full aspect-square",
                            "border-[2px]",
                            isAccessible
                              ? "border-[#39d353] bg-[rgba(57,211,83,0.05)]"
                              : "border-border opacity-70 bg-bg-card",
                          ].join(" ")}
                        >
                          <div className="absolute top-0 left-0 h-1 w-full" style={{ backgroundColor: TAG_COLORS[itemId] ?? "#fff" }} />
                          <span className="text-2xl">{ITEM_EMOJIS[itemId] ?? "?"}</span>
                          <span className="mt-1 text-[9px] text-cream truncate w-full text-center">{ITEM_NAMES[itemId] ?? itemId}</span>
                          {isAccessible ? (
                            <span className="mt-0.5 text-[8px]" style={{ color: ACCENT }}>UNLOCKED</span>
                          ) : (
                            <span className="mt-0.5 text-[8px] font-bold text-orange-400">
                              LVL {reqLevel} REQ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <hr className="my-4 border-red-500/20" />

            {/* --- Boosts Sub-Section --- */}
            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted">Boosts (consumable)</p>
            {(() => {
              const BOOST_BONUSES: Record<string, number> = {
                raid_boost_small: 5,
                raid_boost_medium: 10,
                raid_boost_large: 20,
              };
              return (
                <div className="grid grid-cols-3 gap-2">
                  {RAID_BOOST_ITEMS.map((itemId) => {
                    const reqLevel = ITEM_UNLOCK_LEVELS[itemId];
                    const isLevelLocked = reqLevel && xpLevel < reqLevel;
                    const isAccessible = !isLevelLocked;

                    return (
                      <div key={itemId} className="relative">
                        <div
                          className={[
                            "relative flex flex-col items-center justify-center p-2 transition-all w-full aspect-square",
                            "border-dashed border-[2px]",
                            isAccessible
                              ? "border-orange-500/50 bg-[rgba(255,165,0,0.05)]"
                              : "border-orange-500/20 opacity-60 bg-bg-card",
                          ].join(" ")}
                        >
                          <span className="absolute top-1 right-1 text-[8px] font-bold px-1 bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            +{BOOST_BONUSES[itemId]} ATK
                          </span>
                          <span className="text-2xl">{ITEM_EMOJIS[itemId] ?? "?"}</span>
                          <span className="mt-1 text-[9px] text-cream truncate w-full text-center">{ITEM_NAMES[itemId] ?? itemId}</span>
                          {isAccessible ? (
                            <span className="mt-0.5 text-[8px]" style={{ color: "#ffaa00" }}>UNLOCKED</span>
                          ) : (
                            <span className="mt-0.5 text-[8px] font-bold text-orange-400">
                              LVL {reqLevel} REQ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <p className="text-center text-[10px] text-dim normal-case">
            Payment via Stripe
          </p>
        </div>
      )}

      {/* ─── Consumables Tab ─── */}
      {activeTab === "consumables" && (
        <div className="max-w-[640px] mx-auto space-y-5">
          <div className="border-[3px] border-border bg-bg-raised p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm" style={{ color: "#ffaa00" }}>
                Consumables
              </h3>
              <span className="text-[9px] text-muted normal-case">
                Single-use combat items
              </span>
            </div>

            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted">Defenses & Offenses</p>
            <div className="grid grid-cols-2 gap-3 mb-0">
              {RAID_CONSUMABLE_ITEMS.map((itemId) => {
                const reqLevel = ITEM_UNLOCK_LEVELS[itemId];
                
                // Scouting Satellite exception: has a quest requirement
                let isLevelLocked = reqLevel && xpLevel < reqLevel;
                if (itemId === "scouting_satellite" && !(acceptedMedium >= 10 || acceptedHard >= 5)) {
                  isLevelLocked = true;
                }
                const isAccessible = !isLevelLocked || (isDevAccount && devModeEnabled);
                
                // Get inventory counts
                const inventory = consumablesInventory.find(c => c.item_id === itemId);
                let weeklyUses = inventory?.weekly_uses ?? 0;
                
                // Check if week reset
                if (inventory?.last_reset_week) {
                  const now = new Date();
                  const currentWeekStr = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))).toISOString().split('T')[0];
                  if (new Date(inventory.last_reset_week).toISOString().split('T')[0] !== currentWeekStr) {
                    weeklyUses = 0;
                  }
                }

                return (
                  <div key={itemId} className="relative">
                    <div
                      className={[
                        "w-full overflow-hidden transition-colors border-[2px]",
                        isAccessible ? "border-[#ffaa00]/40 bg-[rgba(255,170,0,0.05)]" : "border-border opacity-70 bg-bg-card",
                        "p-3 flex flex-col items-center",
                      ].join(" ")}
                    >
                      <span className="text-3xl mb-2">{ITEM_EMOJIS[itemId] ?? "?"}</span>
                      <span className="text-[10px] text-cream mb-1 text-center font-bold">
                        {ITEM_NAMES[itemId] ?? itemId}
                      </span>
                      {isAccessible ? (
                        <>
                          <span className="mt-0.5 text-[8px] font-bold" style={{ color: "#ffaa00" }}>UNLOCKED</span>
                          <span className="mt-2 text-[8px] text-muted">
                            Used: {weeklyUses}/3
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="mt-0.5 text-[8px] font-bold text-orange-400">
                            {itemId === "scouting_satellite" ? "QUEST REQ" : `LVL ${reqLevel} REQ`}
                          </span>
                          <span className="mt-2 text-[8px] text-muted">
                            Used: 0/3
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 p-4 border-[2px] border-dashed border-[#ffaa00]/30 bg-[#ffaa00]/5 text-center">
              <p className="text-[10px] text-muted normal-case italic">
                Each offensive or defensive item has a strict global limit: 3 uses per player, per week. Defenses automatically equip while you're offline to block incoming Raids unless EMP'd. Use sabotage viruses and EMP devices wisely before executing a raid!
              </p>
            </div>
          </div>
          <p className="text-center text-[10px] text-dim normal-case">
            Payment via Stripe
          </p>
        </div>
      )}


    </>
  );
}
