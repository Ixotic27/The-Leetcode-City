"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ArcadeCustomMap } from "@/lib/arcade/types";

interface MapBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMap?: (map: ArcadeCustomMap) => void;
}

export function MapBrowserModal({ isOpen, onClose, onSelectMap }: MapBrowserModalProps) {
  const [maps, setMaps] = useState<ArcadeCustomMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // Form state for custom map creation
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("custom");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchMaps = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("q", search);
      if (category !== "all") queryParams.set("category", category);

      const res = await fetch(`/api/arcade/maps?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMaps(data.maps || []);
      }
    } catch (err) {
      console.error("[MapBrowserModal] Failed to fetch maps:", err);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    if (isOpen) {
      fetchMaps();
    }
  }, [isOpen, fetchMaps]);

  if (!isOpen) return null;

  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // Default initial layout payload
      const defaultMapJson = {
        name: newName,
        width: 25,
        height: 25,
        tileSize: 32,
        tileset: "/sprites/arcade/tileset.png",
        tilesetColumns: 8,
        layers: {
          ground: new Array(25 * 25).fill(1),
          collision: new Array(25 * 25).fill(0),
          abovePlayer: new Array(25 * 25).fill(0),
        },
        furniture: [],
        objects: [
          { type: "spawn", x: 12, y: 12 }
        ],
      };

      const res = await fetch("/api/arcade/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          category: newCategory,
          is_public: true,
          map_json: defaultMapJson,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create map");
      }

      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      fetchMaps();
      if (onSelectMap && data.map) {
        onSelectMap(data.map);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create map");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                E.Arcade Map Browser
              </h2>
              <p className="text-xs text-slate-400">Discover & load community created arcade maps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              {showCreate ? "Cancel" : "+ Create Map"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {showCreate ? (
          <form onSubmit={handleCreateMap} className="p-6 space-y-4 overflow-y-auto flex-1">
            <h3 className="text-lg font-semibold text-emerald-400">Create New Custom Map</h3>
            {errorMsg && (
              <div className="p-3 text-xs bg-red-950/80 border border-red-500/50 rounded-lg text-red-300">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Map Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Neon Cyber Arena"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe your map layout..."
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100"
              >
                <option value="custom">Custom</option>
                <option value="arena">Arena</option>
                <option value="social">Social Lounge</option>
                <option value="challenge">Challenge</option>
              </select>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white"
              >
                {isSubmitting ? "Creating..." : "Save & Create Map"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search maps by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100"
              >
                <option value="all">All Categories</option>
                <option value="custom">Custom</option>
                <option value="arena">Arena</option>
                <option value="social">Social Lounge</option>
                <option value="challenge">Challenge</option>
              </select>
            </div>

            {/* Map Grid */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                  Loading maps...
                </div>
              ) : maps.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                  No community maps found. Be the first to create one!
                </div>
              ) : (
                maps.map((map) => (
                  <div
                    key={map.id}
                    className="flex flex-col justify-between p-4 bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 rounded-xl transition-all hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-slate-100 truncate">{map.name}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {map.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {map.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-700/40 pt-3 text-[11px] text-slate-400">
                      <span>By {map.creator_name || "Unknown"}</span>
                      {onSelectMap && (
                        <button
                          onClick={() => {
                            onSelectMap(map);
                            onClose();
                          }}
                          className="px-2.5 py-1 font-medium bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-md transition-colors"
                        >
                          Load Map
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
