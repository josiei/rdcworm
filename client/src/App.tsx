import { useState } from "react";
import JoinScreen from "./JoinScreen";
import Game from "./Game";

type JoinData = { name: string; color: string; avatar: string };

export default function App() {
  const [joined, setJoined] = useState<JoinData | null>(null);

  if (!joined) {
    return <JoinScreen onJoin={(d) => setJoined(d)} />;
  }

  return (
    <Game
      name={joined.name}
      color={joined.color}
      avatar={joined.avatar}
      // serverUrl="ws://localhost:8080" // change if needed
    />
  );
}
