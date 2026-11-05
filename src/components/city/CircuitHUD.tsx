"use client";

import type { MutableRefObject } from "react";
import { formatCircuitTime, type CircuitTelemetry, type DriveInput } from "@/lib/city/driving";

interface Props {
  telemetry: CircuitTelemetry;
  onExit: () => void;
  onRestart: () => void;
  touchInput: MutableRefObject<DriveInput>;
}

export default function CircuitHUD({ telemetry, onExit, onRestart, touchInput }: Props) {
  const hold = (field: "throttle" | "steer" | "brake", value: number | boolean) => {
    Object.assign(touchInput.current, { [field]: field === "brake" ? Boolean(value) : Number(value) });
  };
  const release = (field: "throttle" | "steer" | "brake", value: number | boolean) => {
    if (touchInput.current[field] === value) hold(field, field === "brake" ? false : 0);
  };
  const control = (label: string, symbol: string, field: "throttle" | "steer" | "brake", value: number | boolean) => (
    <button
      type="button" aria-label={label}
      className="flex h-14 w-14 touch-none select-none items-center justify-center border-2 border-[#566779] bg-[#101a29]/95 text-xl text-cream active:border-[#ffa116] active:bg-[#ffa116]/20"
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(field, value); }}
      onPointerUp={() => release(field, value)}
      onPointerCancel={() => release(field, value)}
      onLostPointerCapture={() => release(field, value)}
      onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); hold(field, value); } }}
      onKeyUp={() => release(field, value)}
      onBlur={() => release(field, value)}
    >{symbol}</button>
  );

  const status = telemetry.paused ? "Paused while this window is inactive"
    : telemetry.wrongWay ? "Wrong way — follow the green marker"
      : !telemetry.valid ? "Lap invalid — cross the finish to try again"
        : "Follow the green checkpoint marker";

  return (
    <div className="pointer-events-none fixed inset-0 z-[45] font-pixel normal-case text-cream">
      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
        <div className="border-2 border-[#455467] bg-[#101a29]/95 px-3 py-3 shadow-lg sm:min-w-64 sm:px-4">
          <p className="text-[10px] text-[#ffa116] sm:text-xs">City circuit</p>
          <p className="mt-2 text-base tabular-nums sm:text-xl">{formatCircuitTime(telemetry.elapsedMs)}</p>
          <div className="mt-3 flex gap-4 text-[8px] tabular-nums sm:text-[10px]">
            <span>Lap {telemetry.lap}</span>
            <span>{telemetry.checkpoint === 0 ? "Finish" : `Gate ${telemetry.checkpoint}/${telemetry.checkpointCount - 1}`}</span>
          </div>
          <p className="mt-2 text-[8px] text-cream/65 sm:text-[9px]">Local best {formatCircuitTime(telemetry.bestMs)}</p>
          {telemetry.lastLapMs !== null && <p className="mt-1 text-[8px] text-cream/65 sm:text-[9px]">Last {formatCircuitTime(telemetry.lastLapMs)}</p>}
        </div>
        <div className="pointer-events-auto flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="min-h-11 border-2 border-[#455467] bg-[#101a29]/95 px-3 text-[9px] hover:border-[#ffa116]">Restart</button>
          <button onClick={onExit} className="min-h-11 border-2 border-[#ffa116] bg-[#101a29]/95 px-3 text-[9px] hover:bg-[#ffa116]/20">Exit drive <span className="hidden sm:inline">[Esc]</span></button>
        </div>
      </div>
      <div className="absolute inset-x-3 top-48 text-center text-[8px] sm:top-5 sm:mx-auto sm:max-w-md sm:text-[10px]" role="status" aria-live="polite">
        <span className={`inline-block bg-[#101a29]/95 px-3 py-2 ${telemetry.valid && !telemetry.wrongWay ? "text-cream" : "text-[#ffc085]"}`}>{status}</span>
      </div>
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center sm:bottom-8">
        <p className="text-3xl tabular-nums sm:text-4xl">{telemetry.speed}<span className="ml-2 text-[10px] text-cream/60">km/h</span></p>
        <p className="mt-2 hidden text-[9px] text-cream/65 sm:block">WASD / arrows · Space to brake · Esc to exit</p>
      </div>
      <div className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 flex gap-2 sm:bottom-5 sm:left-5">
        {control("Steer left", "←", "steer", -1)}
        {control("Steer right", "→", "steer", 1)}
      </div>
      <div className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-3 flex gap-2 sm:bottom-5 sm:right-5">
        {control("Brake", "■", "brake", true)}
        {control("Accelerate", "↑", "throttle", 1)}
      </div>
    </div>
  );
}
