// client/src/ui/TournamentEndOverlay.tsx

type Props = {
  winnerName: string;
  winnerScore: number;
  onBackToLobby: () => void;
};

export default function TournamentEndOverlay({ winnerName, winnerScore, onBackToLobby }: Props) {
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
            marginBottom: 32,
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
        <button
          onClick={onBackToLobby}
          style={{
            marginTop: 48,
            padding: "16px 32px",
            background: "rgba(34, 204, 136, 0.9)",
            color: "#001015",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 16,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(34, 204, 136, 1)";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(34, 204, 136, 0.9)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          ← Back to Lobby
        </button>
      </div>
    </div>
  );
}
