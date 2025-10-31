// client/src/ui/TournamentTimer.tsx

type Props = {
  remaining: number; // seconds
  duration: number; // seconds
};

export default function TournamentTimer({ remaining, duration }: Props) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percentage = (remaining / duration) * 100;
  
  // Color based on time remaining
  const color = remaining < 60 ? "#ff6b6b" : remaining < 180 ? "#ffa500" : "#22cc88";
  
  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 24px",
        background: "rgba(0, 0, 0, 0.8)",
        border: `2px solid ${color}`,
        borderRadius: 8,
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 16,
        fontWeight: 600,
        zIndex: 100,
        minWidth: 200,
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 4, fontSize: 12, opacity: 0.7 }}>
        TOURNAMENT ROUND
      </div>
      <div style={{ fontSize: 24, color, fontVariantNumeric: "tabular-nums" }}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
      <div
        style={{
          marginTop: 8,
          height: 4,
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: color,
            transition: "width 1s linear",
          }}
        />
      </div>
    </div>
  );
}
