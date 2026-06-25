"use client";

const ACCENT = "#ffa116";

export default function SolanaModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg border-[2px] border-border bg-bg-raised p-6"
        style={{ borderColor: ACCENT }}
      >
        <h2
          className="mb-5 font-pixel text-2xl tracking-wider"
          style={{ color: ACCENT }}
        >
          SOLANA DEVELOPER HUB
        </h2>

        {/* Wallet */}
        <div
          className="mb-5 border-[2px] border-border p-3"
          style={{ borderColor: `${ACCENT}60` }}
        >
          <p className="font-bold text-cream">
            🟢 Phantom Wallet Connected
          </p>

          <p className="mt-2 text-sm text-muted">
            Wallet: 7xQm...A8K2
          </p>
        </div>

        {/* Programs */}
        <div className="mb-5">
          <h3
            className="mb-3 font-bold tracking-wide"
            style={{ color: ACCENT }}
          >
            DEPLOYED PROGRAMS
          </h3>

          <ul className="space-y-2 text-sm">
            <li
              className="border-[2px] border-border p-2 text-cream"
              style={{ borderColor: `${ACCENT}60` }}
            >
              Token Vault Program
            </li>

            <li
              className="border-[2px] border-border p-2 text-cream"
              style={{ borderColor: `${ACCENT}60` }}
            >
              NFT Marketplace Contract
            </li>

            <li
              className="border-[2px] border-border p-2 text-cream"
              style={{ borderColor: `${ACCENT}60` }}
            >
              DAO Governance Program
            </li>
          </ul>
        </div>

        {/* Achievements */}
        <div className="mb-6">
          <h3
            className="mb-3 font-bold tracking-wide"
            style={{ color: ACCENT }}
          >
            WEB3 ACHIEVEMENTS
          </h3>

          <ul className="space-y-2 text-sm text-muted">
            <li>🏆 10+ Smart Contracts Deployed</li>
            <li>⚡ 50K+ Transactions Processed</li>
            <li>🌟 Open Source Solana Contributor</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="btn-press w-full border-[2px] py-2 font-pixel font-bold transition-all hover:brightness-110"
          style={{
            borderColor: ACCENT,
            backgroundColor: ACCENT,
            color: "#0d0f0e",
            boxShadow: `3px 3px 0 0 ${ACCENT}66`,
          }}
        >
          CLOSE
        </button>

        <p className="mt-4 text-center font-pixel text-[10px] tracking-wider text-muted">
          ESC TO CLOSE
        </p>
      </div>
    </div>
  );
}