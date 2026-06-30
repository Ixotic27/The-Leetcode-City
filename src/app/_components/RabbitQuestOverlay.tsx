"use client";

interface RabbitQuestOverlayProps {
  rabbitCinematic: boolean;
  rabbitCinematicPhase: number;
  rabbitHintFlash: string | null;
  onEndRabbitCinematic: () => void;
}

export default function RabbitQuestOverlay({
  rabbitCinematic,
  rabbitCinematicPhase,
  rabbitHintFlash,
  onEndRabbitCinematic,
}: RabbitQuestOverlayProps) {
  return (
    <>
      {rabbitCinematic && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 origin-top bg-black/80 transition-transform duration-700"
            style={{
              height: "12%",
              transform: rabbitCinematicPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 origin-bottom bg-black/80 transition-transform duration-700"
            style={{
              height: "18%",
              transform: rabbitCinematicPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
            }}
          />

          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,161,22,0.08) 1px, rgba(255,161,22,0.08) 2px)",
              backgroundSize: "100% 2px",
            }}
          />

          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center"
            style={{ height: "18%" }}
          >
            {["Follow the white rabbit...", "It hides among the plazas..."].map(
              (text, i) => (
                <p
                  key={i}
                  className="absolute text-center font-pixel normal-case px-4"
                  style={{
                    fontSize: "clamp(0.85rem, 3vw, 1.5rem)",
                    letterSpacing: "0.08em",
                    color: "#ffa116",
                    textShadow:
                      "0 0 20px rgba(255,161,22,0.5), 0 0 40px rgba(255,161,22,0.2)",
                    opacity: rabbitCinematicPhase === i ? 1 : 0,
                    transition: "opacity 0.7s ease-in-out",
                  }}
                >
                  {text}
                </p>
              ),
            )}
          </div>

          <button
            className="pointer-events-auto absolute top-4 right-4 z-[60] font-pixel text-[10px] sm:text-[12px] tracking-wider border border-[#ffa116]/40 px-3 py-1.5 transition-colors hover:bg-[#ffa116]/10"
            style={{
              color: "#ffa116",
              textShadow: "0 0 8px rgba(255,161,22,0.3)",
            }}
            onClick={onEndRabbitCinematic}
          >
            SKIP
          </button>
        </div>
      )}

      {rabbitHintFlash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ animation: "rabbitHintAnim 3s ease-in-out forwards" }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <p
            className="relative font-pixel text-[14px] sm:text-[16px] tracking-widest text-center px-4"
            style={{
              color: "#ffa116",
              textShadow:
                "0 0 15px rgba(255,161,22,0.5), 0 0 30px rgba(255,161,22,0.2)",
            }}
          >
            {rabbitHintFlash}
          </p>
          <style jsx>{`
            @keyframes rabbitHintAnim {
              0% {
                opacity: 0;
              }
              15% {
                opacity: 1;
              }
              70% {
                opacity: 1;
              }
              100% {
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
