// client/src/RoomLobby.tsx

type RoomInfo = {
  id: string;
  name: string;
  type: string;
  state: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  locked: boolean;
  description?: string;
};

type Props = {
  playerData: { name: string; color: string; avatar: string };
  onJoinRoom: (roomId: string, mode: "playing" | "spectating") => void;
  isAdmin?: boolean;
  onAdminCommand?: (command: any) => void;
  liveRoomData?: RoomInfo[];
};

export default function RoomLobby({ playerData, onJoinRoom, isAdmin, onAdminCommand, liveRoomData }: Props) {
  // Use live data if available, otherwise fallback to defaults
  const rooms: RoomInfo[] = liveRoomData || [
    {
      id: "arena1",
      name: "Arena 1",
      type: "tournament",
      state: "waiting",
      playerCount: 0,
      spectatorCount: 0,
      maxPlayers: 20,
      locked: false,
      description: "Tournament Qualifier - Top worm advances"
    },
    {
      id: "arena2",
      name: "Arena 2",
      type: "tournament",
      state: "waiting",
      playerCount: 0,
      spectatorCount: 0,
      maxPlayers: 20,
      locked: false,
      description: "Tournament Qualifier - Top worm advances"
    },
    {
      id: "arena3",
      name: "Arena 3",
      type: "tournament",
      state: "waiting",
      playerCount: 0,
      spectatorCount: 0,
      maxPlayers: 20,
      locked: false,
      description: "Tournament Qualifier - Top worm advances"
    },
    {
      id: "deathmatch",
      name: "Deathmatch Finals 🏆",
      type: "tournament",
      state: "waiting",
      playerCount: 0,
      spectatorCount: 0,
      maxPlayers: 12,
      locked: true,
      description: "Finals - Last worm standing wins"
    },
    {
      id: "chill",
      name: "Chill Zone 🌴",
      type: "casual",
      state: "freeplay",
      playerCount: 0,
      spectatorCount: 0,
      maxPlayers: 30,
      locked: false,
      description: "Casual play - No timers, just vibes"
    }
  ];

  const tournamentRooms = rooms.filter(r => r.type === "tournament" && r.id !== "deathmatch");
  const deathmatchRoom = rooms.find(r => r.id === "deathmatch");
  const casualRooms = rooms.filter(r => r.type === "casual");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: "95vw",
        maxHeight: "90vh",
        margin: "5vh auto",
        padding: 24,
        borderRadius: 12,
        background: "rgba(0,0,0,0.35)",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        overflowY: "auto",
      }}
    >
      {/* Header with player info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <img src={playerData.avatar} width={40} height={40} alt="" />
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>🏆 RDC Worm Tournament</h2>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Playing as <span style={{ color: playerData.color, fontWeight: 600 }}>{playerData.name}</span>
            {isAdmin && <span style={{ marginLeft: 8, color: "#ff6b6b", fontWeight: 600 }}>🔧 ADMIN</span>}
          </div>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && onAdminCommand && (
        <div style={{ 
          padding: 12, 
          background: "rgba(255, 107, 107, 0.1)", 
          border: "2px solid rgba(255, 107, 107, 0.3)",
          borderRadius: 6,
          marginBottom: 8
        }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 13, opacity: 0.8, letterSpacing: "0.5px" }}>
            🔧 ADMIN CONTROLS
          </h3>
          <div style={{ display: "grid", gap: 6 }}>
            <button
              onClick={() => onAdminCommand({ type: "admin:startTournament", roomIds: ["arena1", "arena2", "arena3"] })}
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
              ▶️ Start All Qualifiers
            </button>
            <button
              onClick={() => onAdminCommand({ type: "admin:startTournament", roomIds: ["deathmatch"] })}
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
              🏆 Start Deathmatch Finals
            </button>
            <button
              onClick={() => onAdminCommand({ type: "admin:resetTournament" })}
              style={{
                padding: "6px 12px",
                background: "rgba(255, 255, 255, 0.1)",
                color: "white",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 4,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              🔄 Reset Tournament
            </button>
          </div>
        </div>
      )}

      {/* All Rooms in Horizontal Layout */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 13, opacity: 0.6, letterSpacing: "0.5px" }}>TOURNAMENT ARENAS</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {tournamentRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={(mode) => onJoinRoom(room.id, mode)}
            />
          ))}
        </div>
      </div>

      {/* Deathmatch and Casual in same row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {deathmatchRoom && (
          <div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 13, opacity: 0.6, letterSpacing: "0.5px" }}>FINALS</h3>
            <RoomCard
              room={deathmatchRoom}
              onJoin={(mode) => onJoinRoom(deathmatchRoom.id, mode)}
            />
          </div>
        )}
        
        <div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 13, opacity: 0.6, letterSpacing: "0.5px" }}>CASUAL PLAY</h3>
          {casualRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={(mode) => onJoinRoom(room.id, mode)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, onJoin }: { room: RoomInfo; onJoin: (mode: "playing" | "spectating") => void }) {
  const isFull = room.playerCount >= room.maxPlayers;
  const canJoin = !room.locked && !isFull;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 6,
        background: "rgba(255,255,255,0.05)",
        border: room.locked ? "2px solid rgba(255,107,107,0.3)" : "2px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Room name and status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{room.name}</div>
        {(room.locked || room.state === "active" || room.type === "tournament") && (
          <div
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 4,
              background: room.locked
                ? "rgba(255,107,107,0.2)"
                : room.state === "active"
                ? "rgba(34,204,136,0.2)"
                : "rgba(255,255,255,0.1)",
              color: room.locked ? "#ff6b6b" : room.state === "active" ? "#22cc88" : "white",
            }}
          >
            {room.locked ? "🔒 Locked" : room.state === "active" ? "⚡ Live" : "⏳ Waiting"}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{room.description}</div>

      {/* Player count */}
      <div style={{ fontSize: 12, marginBottom: 8, display: "flex", gap: 12 }}>
        <span>
          👥 {room.playerCount} {room.playerCount === 1 ? 'worm' : 'worms'}
        </span>
        {room.spectatorCount > 0 && (
          <span style={{ opacity: 0.6 }}>👁️ {room.spectatorCount}</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onJoin("playing")}
          disabled={!canJoin}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 6,
            background: canJoin ? "#22cc88" : "rgba(255,255,255,0.1)",
            color: canJoin ? "#001015" : "rgba(255,255,255,0.3)",
            fontWeight: 600,
            cursor: canJoin ? "pointer" : "not-allowed",
            border: "none",
            fontSize: 14,
          }}
        >
          {isFull ? "Full" : room.locked ? "Locked" : "Join"}
        </button>
        <button
          onClick={() => onJoin("spectating")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.1)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            fontSize: 14,
          }}
        >
          Spectate
        </button>
      </div>
    </div>
  );
}
