"use client";

const ACCENT = "#ffa116";

export default function SolanaModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border-2 bg-[#0d0d0f] p-6 text-white shadow-2xl"
        style={{ borderColor: ACCENT }}
      >
        <h2
          className="mb-4 text-2xl font-bold font-pixel tracking-wide"
          style={{ color: ACCENT }}
        >
          SOLANA DEVELOPER HUB
        </h2>

        {/* Wallet */}
        <div
          className="mb-5 rounded border p-3"
          style={{ borderColor: `${ACCENT}60` }}
        >
          <p className="font-semibold text-green-400">
            🟢 Phantom Wallet Connected
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Wallet: 7xQm...A8K2
          </p>
        </div>

        {/* Programs */}
        <div className="mb-5">
          <h3
            className="mb-3 font-semibold"
            style={{ color: ACCENT }}
          >
            Deployed Programs
          </h3>

          <ul className="space-y-2 text-sm">
            <li
              className="rounded border p-2"
              style={{ borderColor: `${ACCENT}60` }}
            >
              Token Vault Program
            </li>

            <li
              className="rounded border p-2"
              style={{ borderColor: `${ACCENT}60` }}
            >
              NFT Marketplace Contract
            </li>

            <li
              className="rounded border p-2"
              style={{ borderColor: `${ACCENT}60` }}
            >
              DAO Governance Program
            </li>
          </ul>
        </div>

        {/* Achievements */}
        <div className="mb-5">
          <h3
            className="mb-3 font-semibold"
            style={{ color: ACCENT }}
          >
            Web3 Achievements
          </h3>

          <ul className="space-y-2 text-sm text-gray-300">
            <li>🏆 10+ Smart Contracts Deployed</li>
            <li>⚡ 50K+ Transactions Processed</li>
            <li>🌟 Open Source Solana Contributor</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded py-2 font-pixel text-black transition-opacity hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          CLOSE
        </button>

        <p className="mt-4 text-center text-[10px] tracking-wider text-gray-500 font-pixel">
          ESC TO CLOSE
        </p>
      </div>
    </div>
  );
}