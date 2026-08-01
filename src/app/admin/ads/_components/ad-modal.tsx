"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AdStats, AdForm } from "../_lib/types";
import { EMPTY_FORM } from "../_lib/constants";
import { AdFormFields } from "./ad-form-fields";

interface AdModalProps {
  open: boolean;
  mode: "create" | "edit";
  ad?: AdStats;
  saving: boolean;
  onClose: () => void;
  onCreate: (form: AdForm) => Promise<boolean>;
  onEdit: (id: string, form: AdForm) => Promise<boolean>;
}

function adToForm(ad: AdStats): AdForm {
  return {
    brand: ad.brand,
    text: ad.text,
    description: ad.description ?? "",
    color: ad.color,
    bg_color: ad.bg_color,
    link: ad.link ?? "",
    vehicle: ad.vehicle as AdForm["vehicle"],
    priority: ad.priority,
    starts_at: ad.starts_at ? ad.starts_at.slice(0, 16) : "",
    ends_at: ad.ends_at ? ad.ends_at.slice(0, 16) : "",
  };
}

export function AdModal({
  open,
  mode,
  ad,
  saving,
  onClose,
  onCreate,
  onEdit,
}: AdModalProps) {
  const [form, setForm] = useState<AdForm>(() =>
    open && mode === "edit" && ad ? adToForm(ad) : EMPTY_FORM
  );
  const prevOpenRef = useRef(open);


  // Close on Escape
