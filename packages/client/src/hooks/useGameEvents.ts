import { useEffect } from 'react';
import { GameBridge, type GameEvents } from '../game/GameBridge.js';
import { useUIStore } from '../store/agentStore.js';
import { useWorldStore } from '../store/worldStore.js';

export function useGameEvents() {
  const { openProfile, setScene } = useUIStore();

  useEffect(() => {
    const onAgentClicked = ({ agentId }: GameEvents['agent:clicked']) => {
      openProfile(agentId);
    };
    const onSceneChanged = ({ scene }: GameEvents['scene:changed']) => {
      setScene(scene);
    };
    const onTimeChanged = ({ hour }: GameEvents['time:changed']) => {
      useWorldStore.getState().setTimeOfDay(hour);
    };

    GameBridge.on('agent:clicked', onAgentClicked);
    GameBridge.on('scene:changed', onSceneChanged);
    GameBridge.on('time:changed', onTimeChanged);

    return () => {
      GameBridge.off('agent:clicked', onAgentClicked);
      GameBridge.off('scene:changed', onSceneChanged);
      GameBridge.off('time:changed', onTimeChanged);
    };
  }, [openProfile, setScene]);
}
