"use client";

import React from "react";
import RaidPreviewModal from "@/components/RaidPreviewModal";
import RaidOverlay from "@/components/RaidOverlay";
import { useCity } from "@/context/CityContext";

export default function RaidSystem() {
  const { raidState, raidActions } = useCity();

  return (
    <>
      {/* Raid Preview Modal */}
      {raidState.phase === "preview" && raidState.previewData && (
        <RaidPreviewModal
          preview={raidState.previewData}
          loading={raidState.loading}
          error={raidState.error}
          onRaid={(boostPurchaseId, vehicleId, offensiveItemId) =>
            raidActions.executeRaid(boostPurchaseId, vehicleId, offensiveItemId)
          }
          onCancel={raidActions.exitRaid}
        />
      )}

      {/* Raid Overlay (cinema bars + text + share) */}
      {raidState.phase !== "idle" && raidState.phase !== "preview" && (
        <RaidOverlay
          phase={raidState.phase}
          raidData={raidState.raidData}
          onSkip={raidActions.skipToShare}
          onExit={raidActions.exitRaid}
        />
      )}
    </>
  );
}
