
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, MissionInfo, PlaneConfig } from './types';
import GameCanvas from './components/GameCanvas';
import { generateMissionBriefing, generateGameOverTaunt, generateWinMessage } from './services/geminiService';
import { PLAYER_PLANES } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [missionInfo, setMissionInfo] = useState<MissionInfo | null>(null);
  const [endGameMessage, setEndGameMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rivalDistance, setRivalDistance] = useState(10000);
  
  // New States
  const [selectedPlane, setSelectedPlane] = useState<PlaneConfig>(PLAYER_PLANES[0]);
  const [bossHp, setBossHp] = useState<{current: number, max: number, name: string} | null>(null);
  
  // Notification & Instruction State
  const [notification, setNotification] = useState<string | null>(null);
  const [currentBossName, setCurrentBossName] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem('skyDodge_highScore');
    if (stored) setHighScore(parseInt(stored));
  }, []);

  const startGame = useCallback(async () => {
    setIsLoading(true);
    const info = await generateMissionBriefing();
    setMissionInfo(info);
    setGameState(GameState.BRIEFING);
    setIsLoading(false);
  }, []);

  const startFlying = () => {
    setBossHp(null);
    setCurrentBossName("");
    setNotification(null);
    setInstruction("OBJECTIVE: Chase the Rival Ace. Aim with mouse and click to fire when in range!");
    setGameState(GameState.PLAYING);
    setScore(0);
  };

  const handleGameOver = useCallback(async (finalScore: number) => {
    setGameState(GameState.GAMEOVER);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('skyDodge_highScore', finalScore.toString());
    }
    const taunt = await generateGameOverTaunt(finalScore);
    setEndGameMessage(taunt);
  }, [highScore]);
  
  const handleGameWin = useCallback(async (finalScore: number) => {
    setGameState(GameState.WIN);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('skyDodge_highScore', finalScore.toString());
    }
    const message = await generateWinMessage(finalScore);
    setEndGameMessage(message);
  }, [highScore]);

  // Memoize this function to prevent GameCanvas re-initialization loops
  const updateBossHealth = useCallback((current: number, max: number, name: string) => {
      if (current <= 0) {
          setBossHp(null);
      } else {
          setBossHp({ current, max, name });
      }
  }, []);

  // Effect to trigger notifications when a new boss appears
  useEffect(() => {
    if (bossHp && bossHp.name !== currentBossName) {
      setCurrentBossName(bossHp.name);
      // REMOVED WARNING NOTIFICATION
      
      // Update instructions based on enemy type
      if (bossHp.name === "DEATH STAR") {
          setInstruction("TACTIC: The hull is heavily armored. Focus all fire on the central sphere structure to destroy it.");
      } else if (bossHp.name === "THE PLANET") {
          setInstruction("TACTIC: The planet is indestructible. Locate and destroy the Mansion structure on the North Pole.");
      }

    } else if (!bossHp && currentBossName) {
        // Boss defeated
        setCurrentBossName("");
        if (currentBossName === "DEATH STAR") {
             setInstruction("Analyzing sector... Proceed to the planetary surface.");
        }
    }
  }, [bossHp, currentBossName]);


  // Proximity Bar Calculations
  const maxDistance = 10000;
  const progressPercent = Math.max(0, Math.min(100, ((maxDistance - rivalDistance) / maxDistance) * 100));
  const isClose = rivalDistance < 1500;
  const isTargetLock = rivalDistance < 800;

  return (
    <div className="relative w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-white select-none overflow-hidden font-orbitron">
      
      {/* HUD Overlay */}
      {gameState === GameState.PLAYING && (
        <>
          {/* Notification Banner - REMOVED VISUALLY BUT LOGIC KEPT IN CASE WE WANT OTHER ALERTS */}
          {notification && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className="bg-red-500/80 text-white px-12 py-4 rounded border-2 border-red-400 shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-pulse">
                <h2 className="text-3xl font-bold tracking-[0.2em] uppercase italic">{notification}</h2>
              </div>
            </div>
          )}

          {/* Combat Intel (Bottom Right) */}
          <div className="absolute bottom-8 right-8 w-80 pointer-events-none z-10 hidden md:block">
            <div className="bg-slate-900/90 border-l-2 border-sky-500 p-4 rounded-r shadow-[0_0_20px_rgba(14,165,233,0.2)] transform skew-x-[-5deg]">
                 <h3 className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-2 border-b border-sky-500/30 pb-1 flex justify-between">
                    <span>Combat Intel</span>
                    <span className="animate-pulse">● REC</span>
                 </h3>
                 <p className="text-sm text-slate-200 leading-relaxed font-mono">{instruction || "Awaiting orders..."}</p>
            </div>
          </div>

          {/* Top Bar - Score & Info */}
          <div className="absolute top-0 w-full p-4 flex justify-between items-start pointer-events-none z-10">
            {/* Left Panel */}
            <div className="flex flex-col gap-1">
               <div className="bg-slate-900/80 border-l-4 border-sky-500 p-3 backdrop-blur-md skew-x-[-10deg]">
                  <p className="text-sky-400 text-[10px] uppercase tracking-widest skew-x-[10deg]">PILOT CALLSIGN</p>
                  <p className="text-xl font-bold skew-x-[10deg]">{missionInfo?.pilotCallsign || 'GHOST-1'}</p>
               </div>
               <div className="bg-slate-900/80 border-l-4 border-amber-500 p-3 backdrop-blur-md skew-x-[-10deg] mt-2">
                  <p className="text-amber-400 text-[10px] uppercase tracking-widest skew-x-[10deg]">SCORE</p>
                  <p className="text-2xl font-bold skew-x-[10deg] tracking-wider font-mono">{score.toString().padStart(6, '0')}</p>
               </div>
            </div>

            {/* Boss Health Bar (Center Top) */}
            {bossHp && (
                <div className="flex flex-col items-center justify-center w-1/3 absolute left-1/2 -translate-x-1/2">
                    <p className="text-rose-500 font-bold tracking-[0.3em] uppercase mb-1 text-sm animate-pulse">{bossHp.name} DETECTED</p>
                    <div className="w-full h-4 bg-slate-900 border border-rose-900 skew-x-[-20deg] relative overflow-hidden">
                        <div 
                            className="h-full bg-rose-600 transition-all duration-200"
                            style={{ width: `${(bossHp.current / bossHp.max) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Right Panel */}
            <div className="bg-slate-900/80 border-r-4 border-slate-500 p-3 backdrop-blur-md skew-x-[10deg] text-right">
               <p className="text-slate-400 text-[10px] uppercase tracking-widest skew-x-[-10deg]">RECORD</p>
               <p className="text-xl font-bold skew-x-[-10deg] text-slate-300 font-mono">{highScore.toString().padStart(6, '0')}</p>
            </div>
          </div>

          {/* Bottom Center - Target Tracking */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl pointer-events-none z-10 flex flex-col items-center gap-2">
            
            {isClose && !bossHp && (
               <div className="animate-pulse text-rose-500 font-bold tracking-[0.5em] text-sm uppercase mb-1 bg-black/50 px-4 py-1 rounded">
                  {isTargetLock ? '!!! TARGET LOCK AVAILABLE !!!' : 'TARGET ESCAPING - ENGAGE NITRO'}
               </div>
            )}

            <div className="w-full flex items-center gap-4 px-8">
              <span className="text-xs text-sky-400 w-16 text-right">10km</span>
              <div className="flex-1 h-3 bg-slate-800/80 border border-slate-600 rounded-full overflow-hidden relative skew-x-[-20deg]">
                <div 
                  className={`h-full transition-all duration-300 ease-out ${isClose || bossHp ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)]' : 'bg-sky-500'}`}
                  style={{ width: bossHp ? '100%' : `${100 - progressPercent}%` }}
                />
                {/* Distance Markers */}
                <div className="absolute top-0 left-1/4 h-full w-px bg-slate-600/50"></div>
                <div className="absolute top-0 left-1/2 h-full w-px bg-slate-600/50"></div>
                <div className="absolute top-0 left-3/4 h-full w-px bg-slate-600/50"></div>
              </div>
              <span className={`text-sm w-20 font-bold text-right font-mono ${isClose || bossHp ? 'text-rose-400' : 'text-sky-400'}`}>
                {rivalDistance}m
              </span>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Rival Proximity Sensor</p>
          </div>

          {/* Crosshair Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-center">
             <div className="w-[400px] h-[400px] border border-sky-500/20 rounded-full flex items-center justify-center relative">
                <div className="w-2 h-2 bg-sky-500/50 rounded-full"></div>
                <div className="absolute top-0 bottom-0 w-px bg-sky-500/10"></div>
                <div className="absolute left-0 right-0 h-px bg-sky-500/10"></div>
             </div>
          </div>
        </>
      )}

      {/* Briefing Screen (The missing piece) */}
      {gameState === GameState.BRIEFING && missionInfo && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center z-30">
          <div className="max-w-4xl w-full p-8 space-y-8">
            <div className="border-l-4 border-sky-500 pl-6">
              <h2 className="text-sm text-sky-500 tracking-[0.5em] uppercase mb-2">Incoming Transmission</h2>
              <h1 className="text-6xl font-bold text-white uppercase italic tracking-tighter">{missionInfo.name}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900/50 p-6 border border-slate-800 rounded">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Objective</h3>
                <p className="text-xl text-sky-100 font-light leading-relaxed">{missionInfo.objective}</p>
              </div>
              <div className="bg-slate-900/50 p-6 border border-slate-800 rounded flex flex-col justify-center">
                 <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-2">Assigned Pilot</h3>
                 <p className="text-4xl font-mono text-sky-400 font-bold">{missionInfo.pilotCallsign}</p>
                 <div className="mt-4 flex gap-4 text-xs text-slate-500 font-mono">
                    <span>AIRCRAFT: {selectedPlane.name}</span>
                    <span>STATUS: FUELED</span>
                 </div>
              </div>
            </div>

             <button 
              onClick={startFlying}
              className="w-full py-6 bg-sky-600 hover:bg-sky-500 text-white font-bold text-2xl tracking-[0.2em] uppercase rounded shadow-[0_0_40px_rgba(14,165,233,0.4)] transition-all transform hover:scale-[1.01] active:scale-[0.99] animate-pulse"
            >
              ENGAGE THRUSTERS
            </button>
          </div>
        </div>
      )}

      {/* Game View */}
      <div className="w-full h-full flex items-center justify-center bg-black">
        <GameCanvas 
          gameState={gameState} 
          onScoreUpdate={setScore} 
          onGameOver={handleGameOver}
          onGameWin={handleGameWin}
          onDistanceUpdate={setRivalDistance}
          onBossHealthUpdate={updateBossHealth}
          selectedPlane={selectedPlane}
        />
      </div>

      {/* Menu Screen */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center flex flex-col items-center justify-center z-20 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
          
          <div className="relative z-10 text-center space-y-8 p-10 bg-slate-900/60 border border-sky-500/30 rounded-lg shadow-[0_0_50px_rgba(14,165,233,0.15)] max-w-5xl w-full mx-4 my-10">
            <div className="space-y-2">
               <h1 className="text-7xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-sky-300 to-sky-600 drop-shadow-[0_0_25px_rgba(14,165,233,0.6)] tracking-tighter italic">
               SKY DASH
               </h1>
               <p className="text-slate-400 text-sm tracking-[0.5em] uppercase">Hyper-Sonic Interceptor Simulation</p>
            </div>

            {/* Plane Selection */}
            <div className="text-left w-full">
                <h3 className="text-sky-500 font-bold uppercase tracking-widest text-sm mb-4 border-b border-sky-500/30 pb-2">Select Aircraft</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLAYER_PLANES.map((plane) => (
                        <div 
                            key={plane.id}
                            onClick={() => setSelectedPlane(plane)}
                            className={`p-5 rounded border-2 transition-all cursor-pointer relative overflow-hidden group ${selectedPlane.id === plane.id ? 'bg-sky-900/40 border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)]' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}`}
                        >
                            <h4 className={`text-lg font-bold uppercase mb-1 ${selectedPlane.id === plane.id ? 'text-white' : 'text-slate-400'}`}>{plane.name}</h4>
                            <p className="text-xs text-slate-500 mb-4 h-10">{plane.description}</p>
                            
                            {/* Stats */}
                            <div className="space-y-2 text-[10px] font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">SPEED</span>
                                    <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-sky-500" style={{width: `${(plane.speed / 3) * 100}%`}}></div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">NITRO</span>
                                    <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500" style={{width: `${(plane.nitroSpeed / 8) * 100}%`}}></div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">AGILITY</span>
                                    <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{width: `${(plane.turnSpeed / 0.07) * 100}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-4">
               <div className="bg-slate-800/60 p-4 border-t border-sky-500 rounded hover:bg-slate-800/80 transition-colors">
                  <h3 className="text-sky-400 font-bold mb-1 text-sm">PHASE 1: RIVAL</h3>
                  <p className="text-xs text-slate-400">Chase down the escaping Ace.</p>
               </div>
               <div className="bg-slate-800/60 p-4 border-t border-amber-500 rounded hover:bg-slate-800/80 transition-colors">
                  <h3 className="text-amber-400 font-bold mb-1 text-sm">PHASE 2: STATION</h3>
                  <p className="text-xs text-slate-400">Destroy the Orbital Defense Platform.</p>
               </div>
               <div className="bg-slate-800/60 p-4 border-t border-rose-500 rounded hover:bg-slate-800/80 transition-colors">
                  <h3 className="text-rose-400 font-bold mb-1 text-sm">PHASE 3: PLANET</h3>
                  <p className="text-xs text-slate-400">Assault the HQ Mansion on the surface.</p>
               </div>
            </div>
            
            <button 
              onClick={startGame}
              disabled={isLoading}
              className={`w-full py-6 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-2xl tracking-widest uppercase rounded shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></span>
                  UPLINKING...
                </span>
              ) : 'INITIATE MISSION'}
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Win Screen */}
      {(gameState === GameState.GAMEOVER || gameState === GameState.WIN) && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-20">
          <div className={`text-center space-y-8 p-12 bg-slate-900 border ${gameState === GameState.WIN ? 'border-amber-500/40' : 'border-rose-500/40'} rounded-lg max-w-xl w-full mx-4 shadow-2xl relative overflow-hidden`}>
            
            {/* Status Header */}
            <div className="relative z-10">
               <h2 className={`${gameState === GameState.WIN ? 'text-amber-400' : 'text-rose-500'} font-bold text-6xl uppercase italic tracking-tighter mb-2`}>
                  {gameState === GameState.WIN ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
               </h2>
               <div className={`h-1 w-24 mx-auto ${gameState === GameState.WIN ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="bg-slate-950/50 p-6 border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Final Score</p>
                <p className="text-4xl font-bold text-white">{score}</p>
              </div>
              <div className="bg-slate-950/50 p-6 border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Global Best</p>
                <p className="text-4xl font-bold text-sky-400">{highScore}</p>
              </div>
            </div>

            {/* AI Comment */}
            <p className="text-slate-300 italic text-sm py-4 px-8 border-x border-slate-800 relative z-10 font-sans">
              "{endGameMessage || 'Data stream interrupted...'}"
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3 relative z-10">
              <button onClick={startGame} className="w-full py-4 bg-white text-slate-950 font-bold hover:bg-slate-200 transition-colors uppercase tracking-wider">
                Re-Deploy
              </button>
              <button onClick={() => setGameState(GameState.MENU)} className="w-full py-4 bg-transparent border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors uppercase tracking-wider">
                Abort to Menu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
