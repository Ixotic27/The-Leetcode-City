import React, { useEffect, useRef, useState } from 'react';

export type CursorType = 'default' | 'pixel' | 'glow' | 'trail' | 'crosshair';

interface CursorSelectorProps {
  accentColor?: string;
}

const CURSOR_OPTIONS: { id: CursorType; label: string }[] = [
  { id: 'default', label: 'DEFAULT' },
  { id: 'pixel', label: 'PIXEL' },
  { id: 'glow', label: 'GLOW' },
  { id: 'trail', label: 'TRAIL' },
  { id: 'crosshair', label: 'CROSSHAIR' },
];

export const CursorSelector: React.FC<CursorSelectorProps> = ({ accentColor = '#3b82f6' }) => {
  const [activeCursor, setActiveCursor] = useState<CursorType>('default');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('leetcodecity_cursor') as CursorType;
      if (saved && CURSOR_OPTIONS.some(c => c.id === saved)) {
        setActiveCursor(saved);
        document.body.setAttribute('data-cursor', saved);
      }
    } catch (err) {
      console.warn('[CursorSelector] Failed to load cursor preference:', err);
    }

    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeCursor = (cursor: CursorType) => {
    setActiveCursor(cursor);
    document.body.setAttribute('data-cursor', cursor);
    setIsOpen(false);
    try {
      localStorage.setItem('leetcodecity_cursor', cursor);
    } catch (err) {
      console.warn('[CursorSelector] Failed to save cursor preference:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light text-cream"
        aria-expanded={isOpen}
        aria-label={`Cursor style: currently ${activeCursor}`}
        title="Select cursor style"
      >
        <span style={{ color: accentColor }} aria-hidden="true">&#9654;</span>
        <span>CURSOR: {activeCursor.toUpperCase()}</span>
        <span className="text-dim text-[8px] ml-1">&#9660;</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[130px] border-[3px] border-border bg-bg/95 p-1 backdrop-blur-md shadow-xl flex flex-col gap-1">
          {CURSOR_OPTIONS.map((opt) => {
            const isSelected = activeCursor === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => changeCursor(opt.id)}
                className={`flex items-center justify-between px-2 py-1.5 text-[10px] text-left transition-colors ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/50'
                    : 'text-cream hover:bg-border/40 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span style={{ color: accentColor }}>&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CursorSelector;
