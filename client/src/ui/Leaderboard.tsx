import type { PlayerView } from "../net/protocol";

export default function Leaderboard({ players }: { players: PlayerView[] }) {
  const top = [...players]
    .filter((p) => p.alive)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        top: 12,
        background: "rgba(0,0,0,0.5)",
        color: "white",
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: "ui-sans-serif, system-ui, Apple Color Emoji",
        fontSize: 14,
        width: 200,
      }}
    >
      <div style={{ opacity: 0.9, marginBottom: 8, fontWeight: 700 }}>Leaderboard</div>
      {top.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No players yet</div>
      ) : (
        top.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
              padding: "4px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ opacity: 0.6, marginRight: 6 }}>{i + 1}.</span>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: p.alive ? "#3bffa8" : "#999",
                  marginRight: 6,
                  transform: "translateY(-1px)",
                }}
              />
              <span style={{ color: "#fff" }}>{p.name}</span>
            </div>
            <div style={{ opacity: 0.8 }}>{p.score}</div>
          </div>
        ))
      )}
    </div>
  );
}
