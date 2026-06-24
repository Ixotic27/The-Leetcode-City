"use client";

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
    <div className="w-full max-w-lg rounded-lg border-2 border-purple-500 bg-[#0f172a] p-6 text-white">
      <h2 className="mb-4 text-2xl font-bold text-purple-400">
        SOLANA DEVELOPER HUB
      </h2>

      <div className="mb-4 rounded border border-purple-500 p-3">
        <p className="text-green-400">
          🟢 Phantom Wallet Connected
        </p>

        <p className="mt-2 text-sm text-gray-300">
          Wallet: 7xQm...A8K2
        </p>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 font-semibold text-purple-300">
          Deployed Programs
        </h3>

        <ul className="space-y-2 text-sm">
          <li className="rounded border p-2">
            Token Vault Program
          </li>

          <li className="rounded border p-2">
            NFT Marketplace Contract
          </li>

          <li className="rounded border p-2">
            DAO Governance Program
          </li>
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 font-semibold text-purple-300">
          Web3 Achievements
        </h3>

        <ul className="space-y-2 text-sm">
          <li>🏆 10+ Smart Contracts Deployed</li>
          <li>⚡ 50K+ Transactions Processed</li>
          <li>🌟 Open Source Solana Contributor</li>
        </ul>
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full rounded bg-purple-600 py-2 hover:bg-purple-700"
      >
        Close
      </button>
    </div>
  </div>
);
}