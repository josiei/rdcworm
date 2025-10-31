import { useState, useEffect } from "react";
import JoinScreen from "./JoinScreen";
import RoomLobby from "./RoomLobby";
import Game from "./Game";

type JoinData = { name: string; color: string; avatar: string };
type RoomSelection = { roomId: string; mode: "playing" | "spectating" };

type RoomInfo = {
  id: string;
  name: string;
  type: string;
  state: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  locked: boolean;
};

export default function App() {
  const [joined, setJoined] = useState<JoinData | null>(null);
  const [roomSelection, setRoomSelection] = useState<RoomSelection | null>(null);
  const [adminWs, setAdminWs] = useState<WebSocket | null>(null);
  const [liveRoomData, setLiveRoomData] = useState<RoomInfo[]>([]);
  
  // Check for admin token in URL
  const adminToken = new URLSearchParams(window.location.search).get('admin');
  
  // Lobby WebSocket connection for room status updates (and admin commands if admin)
  useEffect(() => {
    if (joined && !roomSelection) {
      const WS_URL = window.location.protocol === 'https:' 
        ? `wss://${window.location.host}` 
        : `ws://localhost:8080`;
      
      const ws = new WebSocket(WS_URL);
      
      ws.addEventListener("open", () => {
        console.log('[lobby] WebSocket connected for room status updates');
        const helloMsg: any = { 
          type: "hello", 
          name: joined.name,
          color: joined.color,
          avatar: joined.avatar,
          roomId: "chill",
          mode: "spectating" // Lobby connection doesn't spawn a worm
        };
        
        // Include admin token if present
        if (adminToken) {
          helloMsg.adminToken = adminToken;
        }
        
        ws.send(JSON.stringify(helloMsg));
        setAdminWs(ws);
      });
      
      ws.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "adminGranted") {
          console.log('[admin] ✅ Admin privileges granted');
        }
        if (msg.type === "roomStatus") {
          setLiveRoomData(msg.rooms);
        }
      });
      
      return () => {
        console.log('[lobby] Closing WebSocket');
        ws.close();
        setAdminWs(null);
      };
    }
  }, [joined, roomSelection, adminToken]);
  
  // Preload all game assets immediately when app starts
  useEffect(() => {
    const avatarPaths = [
      '/avatars/rdc-bloop.svg',
      '/avatars/rdc-cheesin.svg',
      '/avatars/rdc-eyes.svg',
      '/avatars/rdc-goofy.svg',
      '/avatars/rdc-peanut.svg',
      '/avatars/rdc-sunglasses.svg',
      '/avatars/rdc-zillow.svg',
      '/avatars/reba-side-smile.svg',
      '/avatars/reba-straight-smile.svg'
    ];
    
    const foodPaths = [
      '/foodAssets/rdc-bug.svg',
      '/foodAssets/rdc-jira.svg',
      '/foodAssets/rdc-zillow.svg'
    ];
    
    const allAssetPaths = [...avatarPaths, ...foodPaths];
    let loadedCount = 0;
    
    console.log(`🎮 Preloading ${allAssetPaths.length} game assets for smooth gameplay...`);
    
    const checkComplete = () => {
      loadedCount++;
      console.log(`📦 Asset loaded: ${loadedCount}/${allAssetPaths.length}`);
      if (loadedCount >= allAssetPaths.length) {
        console.log('✅ All game assets preloaded successfully! Game will be smooth.');
      }
    };
    
    allAssetPaths.forEach(path => {
      const img = new Image();
      img.onload = checkComplete;
      img.onerror = () => {
        console.warn('⚠️ Failed to preload asset:', path);
        checkComplete(); // Still count as loaded to prevent hanging
      };
      img.src = path;
    });
  }, []);

  // Step 1: Pick your worm
  if (!joined) {
    return <JoinScreen onJoin={(d) => setJoined(d)} />;
  }

  // Step 2: Choose a room
  if (!roomSelection) {
    return (
      <RoomLobby
        playerData={joined}
        onJoinRoom={(roomId, mode) => setRoomSelection({ roomId, mode })}
        isAdmin={!!adminToken}
        onAdminCommand={(cmd) => {
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            console.log('[admin] Sending command:', cmd);
            adminWs.send(JSON.stringify(cmd));
          } else {
            console.warn('[admin] WebSocket not ready, command not sent');
          }
        }}
        liveRoomData={liveRoomData.length > 0 ? liveRoomData.map(room => ({
          ...room,
          description: room.id === "deathmatch" 
            ? "Finals - Last worm standing wins"
            : room.id === "chill"
            ? "Casual play - No timers, just vibes"
            : "Tournament Qualifier - Top worm advances"
        })) : undefined}
      />
    );
  }

  // Step 3: Play the game
  return (
    <Game
      name={joined.name}
      color={joined.color}
      avatar={joined.avatar}
      roomId={roomSelection.roomId}
      mode={roomSelection.mode}
      adminToken={adminToken || undefined}
      onBackToLobby={() => setRoomSelection(null)}
    />
  );
}
