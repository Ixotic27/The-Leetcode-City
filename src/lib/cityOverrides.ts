const TTL = 20 * 60 * 1000; // 20 minutes, must outlast Edge cache (s-maxage=300 + SWR=600)

export function applyLocalStorageOverrides(allDevs: any[]): void {
  try {
    const rawLoadout = localStorage.getItem("leetcodecity:loadout_override");
    if (rawLoadout) {
      const { developerId, loadout, ts } = JSON.parse(rawLoadout);
      if (Date.now() - ts < TTL) {
        const idx = allDevs.findIndex((d) => d.id === developerId);
        if (idx !== -1) allDevs[idx] = { ...allDevs[idx], loadout };
      } else {
        localStorage.removeItem("leetcodecity:loadout_override");
      }
    }

    const rawStyle = localStorage.getItem("leetcodecity:style_override");
    if (rawStyle) {
      const { developerId, value, ts } = JSON.parse(rawStyle);
      if (Date.now() - ts < TTL) {
        const idx = allDevs.findIndex((d) => d.id === developerId);
        if (idx !== -1)
          allDevs[idx] = { ...allDevs[idx], building_style: value };
      } else {
        localStorage.removeItem("leetcodecity:style_override");
      }
    }

    const rawColor = localStorage.getItem("leetcodecity:color_override");
    if (rawColor) {
      const { developerId, value, ts } = JSON.parse(rawColor);
      if (Date.now() - ts < TTL) {
        const idx = allDevs.findIndex((d) => d.id === developerId);
        if (idx !== -1) allDevs[idx] = { ...allDevs[idx], custom_color: value };
      } else {
        localStorage.removeItem("leetcodecity:color_override");
      }
    }

    const rawBillboard = localStorage.getItem(
      "leetcodecity:billboard_override",
    );
    if (rawBillboard) {
      const { developerId, value, ts } = JSON.parse(rawBillboard);
      if (Date.now() - ts < TTL) {
        const idx = allDevs.findIndex((d) => d.id === developerId);
        if (idx !== -1)
          allDevs[idx] = { ...allDevs[idx], billboard_images: value };
      } else {
        localStorage.removeItem("leetcodecity:billboard_override");
      }
    }
  } catch {}
}
