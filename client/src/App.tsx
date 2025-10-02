import { useState, useEffect } from "react";
import JoinScreen from "./JoinScreen";
import Game from "./Game";

type JoinData = { name: string; color: string; avatar: string };

export default function App() {
  const [joined, setJoined] = useState<JoinData | null>(null);
  
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
