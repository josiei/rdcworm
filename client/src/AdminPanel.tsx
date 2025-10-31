// client/src/AdminPanel.tsx
import { useState, useEffect } from "react";

type RoomStatus = {
  id: string;
  name: string;
  type: string;
  state: string;
  playerCount: number;
  maxPlayers: number;
};

type Props = {
  onSendCommand: (command: any) => void;
};

export default function AdminPanel({ onSendCommand }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms] = useState<RoomStatus[]>([]); // TODO: Update from server messages

  // Request room status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      onSendCommand({ type: "admin:getRoomStatus" });
    }, 2000);
    return () => clearInterval(interval);
  }, [onSendCommand]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          padding: "8px 16px",
          background: "rgba(255, 107, 107, 0.9)",
          color: "white",
          border: "2px solid rgba(255, 255, 255, 0.3)",
          borderRadius: 6,
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
          zIndex: 1000,
        }}
      >
        🔧 Admin
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        width: 320,
        maxHeight: "90vh",
        background: "rgba(0, 0, 0, 0.9)",
        border: "2px solid rgba(255, 107, 107, 0.5)",
        borderRadius: 8,
        padding: 16,
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
        overflowY: "auto",
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>🔧 Admin Panel</div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: 20,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Tournament Controls */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, letterSpacing: "0.5px" }}>
          TOURNAMENT CONTROLS
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            onClick={() => onSendCommand({ type: "admin:startTournament", roomIds: ["arena1", "arena2", "arena3"] })}
            style={{
              padding: "8px 12px",
              background: "#22cc88",
              color: "#001015",
              border: "none",
              borderRadius: 4,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ▶️ Start Qualifiers
          </button>
          <button
            onClick={() => onSendCommand({ type: "admin:startTournament", roomIds: ["deathmatch"] })}
            style={{
              padding: "8px 12px",
              background: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: 4,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            🏆 Start Finals
          </button>
          <button
            onClick={() => onSendCommand({ type: "admin:resetTournament" })}
            style={{
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 4,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            🔄 Reset All
          </button>
        </div>
      </div>

      {/* Room Status */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, letterSpacing: "0.5px" }}>
          ROOM STATUS
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {rooms.length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: 12 }}>Loading...</div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                style={{
                  padding: 8,
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: 4,
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{room.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background:
                        room.state === "active"
                          ? "rgba(34, 204, 136, 0.2)"
                          : room.state === "finished"
                          ? "rgba(255, 107, 107, 0.2)"
                          : "rgba(255, 255, 255, 0.1)",
                      color:
                        room.state === "active"
                          ? "#22cc88"
                          : room.state === "finished"
                          ? "#ff6b6b"
                          : "white",
                    }}
                  >
                    {room.state}
                  </div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  👥 {room.playerCount}/{room.maxPlayers} players
                </div>
                {room.type === "tournament" && (
                  <button
                    onClick={() => onSendCommand({ type: "admin:endRound", roomId: room.id })}
                    style={{
                      marginTop: 6,
                      padding: "4px 8px",
                      background: "rgba(255, 107, 107, 0.2)",
                      color: "#ff6b6b",
                      border: "1px solid rgba(255, 107, 107, 0.3)",
                      borderRadius: 3,
                      fontSize: 11,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    ⏹️ End Round
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
