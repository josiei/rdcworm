import type { PlayerView } from "../net/protocol";

type Props = {
  player: PlayerView | undefined;
};

export default function Score({ player }: Props) {
  if (!player) {
    return (
      <div
        style={{
          position: "fixed",
          left: 12,
          top: 12,
          background: "rgba(0,0,0,0.5)",
          color: "white",
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: "ui-sans-serif, system-ui, Apple Color Emoji",
          fontSize: 14,
          width: 160,
        }}
      >
        <div style={{ opacity: 0.9, marginBottom: 8, fontWeight: 700 }}>Your Score</div>
        <div style={{ opacity: 0.7 }}>Connecting...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        top: 12,
        background: "rgba(0,0,0,0.5)",
        color: "white",
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: "ui-sans-serif, system-ui, Apple Color Emoji",
        fontSize: 14,
        width: 160,
      }}
    >
      <div style={{ opacity: 0.9, marginBottom: 8, fontWeight: 700 }}>Your Score</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          alignItems: "center",
          padding: "4px 0",
        }}
      >
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: 999,
              background: player.alive ? "#3bffa8" : "#ff6b6b",
              marginRight: 6,
              transform: "translateY(-1px)",
            }}
          />
          <span style={{ color: "#fff" }}>{player.name}</span>
        </div>
        <div style={{ opacity: 0.8, fontSize: 16, fontWeight: 600 }}>{player.score}</div>
      </div>
      {!player.alive && (
        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
          💀 You died! Refresh to respawn
        </div>
      )}
    </div>
  );
}
