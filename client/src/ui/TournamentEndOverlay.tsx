// client/src/ui/TournamentEndOverlay.tsx

type Props = {
  winnerName: string;
  winnerScore: number;
};

export default function TournamentEndOverlay({ winnerName, winnerScore }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.85)",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            marginBottom: 16,
            color: "#22cc88",
          }}
        >
          🏆 ROUND COMPLETE! 🏆
        </div>
        <div
          style={{
            fontSize: 32,
            marginBottom: 8,
          }}
        >
          Winner: <span style={{ color: "#22cc88", fontWeight: 600 }}>{winnerName}</span>
        </div>
        <div
          style={{
            fontSize: 24,
            opacity: 0.8,
          }}
        >
          Final Score: {winnerScore}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 18,
            opacity: 0.6,
          }}
        >
          🎉 Congratulations! 🎉
        </div>
      </div>
    </div>
  );
}
