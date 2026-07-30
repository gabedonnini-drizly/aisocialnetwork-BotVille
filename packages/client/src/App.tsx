import { useEffect, useRef } from 'react';
import { initGame } from './game/GameInit.js';
import { useGameEvents } from './hooks/useGameEvents.js';
import { useGameSync } from './hooks/useGameSync.js';
import { useUIStore } from './store/agentStore.js';
import { AgentProfile } from './ui/AgentProfile/AgentProfile.js';
import { ArtCredit } from './ui/ArtCredit.js';
import { ChatWindow } from './ui/Chat/ChatWindow.js';
import { HUD } from './ui/HUD/HUD.js';
import { MeetingWindow } from './ui/Meeting/MeetingWindow.js';

export function App() {
  const gameInitialized = useRef(false);
  useGameEvents();
  useGameSync();
  const { profileOpen, chatOpen, meetingOpen } = useUIStore();

  useEffect(() => {
    if (!gameInitialized.current) {
      gameInitialized.current = true;
      // Small delay so DOM is ready
      setTimeout(() => initGame(), 50);
    }
  }, []);

  return (
    <div id="ui-overlay">
      <HUD />
      {profileOpen && <AgentProfile />}
      {chatOpen && <ChatWindow />}
      {meetingOpen && <MeetingWindow />}
      <ArtCredit />
    </div>
  );
}
