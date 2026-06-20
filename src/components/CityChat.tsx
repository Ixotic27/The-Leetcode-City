"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import type { ChatMessage, ConnectionStatus } from "@/lib/multiplayer/types";

// ─── Props ──────────────────────────────────────────────────
interface CityChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  status: ConnectionStatus;
  isJoined: boolean;
  playerCount: number;
  accentColor?: string;
}

// ─── Time formatting ────────────────────────────────────────
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ─── Single Message ─────────────────────────────────────────
const ChatBubble = memo(function ChatBubble({
  msg,
  accent,
}: {
  msg: ChatMessage;
  accent: string;
}) {
  return (
    <div
      className="group flex items-start gap-1.5 px-2 py-0.5 hover:bg-white/[0.03] transition-colors"
      style={{ animationDelay: "0ms" }}
    >
      <span className="text-[9px] text-muted/50 mt-[2px] flex-shrink-0 font-mono select-none">
        {formatTime(msg.ts)}
      </span>
      <span
        className="text-[10px] font-semibold flex-shrink-0"
        style={{ color: msg.isSelf ? accent : "#8c8c9c" }}
      >
        {msg.login}
      </span>
      <span className="text-[10px] text-cream/90 break-words min-w-0">
        {msg.text}
      </span>
    </div>
  );
});

// ─── Component ──────────────────────────────────────────────
export default function CityChat({
  messages,
  onSend,
  status,
  isJoined,
  playerCount,
  accentColor = "#ffa116",
}: CityChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hasUnread, setHasUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMsgCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isOpen]);

  // Track unread
  useEffect(() => {
    if (!isOpen && messages.length > lastMsgCountRef.current) {
      setHasUnread(true);
    }
    lastMsgCountRef.current = messages.length;
  }, [messages.length, isOpen]);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (input.trim().length === 0) return;
    onSend(input);
    setInput("");
    inputRef.current?.focus();
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
      // Prevent the game from capturing chat keystrokes
      e.stopPropagation();
    },
    [handleSend],
  );

  // Minimized button
  if (!isOpen) {
    return (
      <button
        id="city-chat-toggle"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-2.5 border-[3px] border-border bg-bg/80 px-5 py-2 text-[10px] backdrop-blur-md transition-all hover:border-border-light hover:bg-bg/90 min-w-[130px]"
        style={{
          fontFamily: "'Press Start 2P', 'Courier New', monospace",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 2h12v9H5l-3 3V2z"
            stroke={accentColor}
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="5" cy="6.5" r="0.8" fill={accentColor} />
          <circle cx="8" cy="6.5" r="0.8" fill={accentColor} />
          <circle cx="11" cy="6.5" r="0.8" fill={accentColor} />
        </svg>
        <span className="text-muted">CHAT</span>
        {hasUnread && (
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <span className="text-muted/60">
          {playerCount > 0 ? `(${playerCount})` : ""}
        </span>
      </button>
    );
  }
 
  // Expanded chat panel
  return (
    <div
      id="city-chat-panel"
      className="fixed bottom-4 right-4 z-50 flex flex-col border-[3px] border-border bg-bg/90 backdrop-blur-md"
      style={{
        width: "min(340px, calc(100vw - 32px))",
        height: "280px",
        fontFamily: "'Press Start 2P', 'Courier New', monospace",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b-[2px] border-border">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                status === "connected"
                  ? "#4ade80"
                  : status === "reconnecting"
                    ? "#fbbf24"
                    : "#f87171",
              animation:
                status === "connected"
                  ? "pulse 2s infinite"
                  : status === "reconnecting"
                    ? "pulse 1s infinite"
                    : "none",
            }}
          />
          <span className="text-[9px] text-muted">
            {status === "connected"
              ? `${playerCount} online`
              : status === "reconnecting"
                ? "reconnecting..."
                : "disconnected"}
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[10px] text-muted hover:text-cream transition-colors px-1"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-thin"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: `${accentColor}33 transparent`,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <span className="text-[10px] text-muted/60">
              {isJoined
                ? "No messages yet. Say hello! 👋"
                : "Sign in to chat with other devs"}
            </span>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} accent={accentColor} />
          ))
        )}
      </div>

      {/* Input */}
      {isJoined ? (
        <div className="flex items-center gap-1 px-2 py-1.5 border-t-[2px] border-border">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            maxLength={120}
            autoComplete="off"
            className="flex-1 bg-transparent text-[10px] text-cream outline-none placeholder:text-muted/40"
            style={{ caretColor: accentColor }}
          />
          <button
            onClick={handleSend}
            disabled={input.trim().length === 0}
            className="px-2 py-0.5 text-[9px] border-[2px] border-border transition-colors disabled:opacity-30"
            style={{
              color: input.trim().length > 0 ? accentColor : undefined,
              borderColor:
                input.trim().length > 0 ? `${accentColor}44` : undefined,
            }}
          >
            ▶
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 border-t-[2px] border-border text-center">
          <span className="text-[9px] text-muted/60">
            Sign in to send messages
          </span>
        </div>
      )}
    </div>
  );
}
