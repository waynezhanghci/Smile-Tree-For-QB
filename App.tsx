import React, { useEffect, useRef, useState, useCallback } from "react";
import SketchContainer from "./components/SketchContainer";
import { initializeVision, analyzeFrame } from "./services/visionService";
import { TreeState, FlowerStyle } from "./types";

type InteractionMode = 'click' | 'smile' | 'forever';

// Minimalist Flower Icon Component
const FlowerIcon = ({ style, isSelected }: { style: FlowerStyle, isSelected: boolean }) => {
  const baseClass = "w-8 h-8 transition-all duration-300";
  const stateClass = isSelected 
    ? "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] scale-110 opacity-100" 
    : "text-white/30 hover:text-white/60 hover:scale-105 opacity-70";

  return (
    <div className={`${baseClass} ${stateClass}`} title={style.charAt(0).toUpperCase() + style.slice(1)}>
      <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
        <g transform="translate(50,50)">
          {style === 'peach' && (
            [0, 72, 144, 216, 288].map(r => (
               <ellipse key={r} cx="0" cy="-25" rx="16" ry="20" transform={`rotate(${r})`} />
            ))
          )}
          {style === 'sakura' && (
             [0, 72, 144, 216, 288].map(r => (
               <path key={r} d="M0 0 Q -20 -25 0 -45 Q 20 -25 0 0" transform={`rotate(${r})`} />
            ))
          )}
          {style === 'delonix' && (
            [0, 72, 144, 216, 288].map(r => (
               <path key={r} d="M0 0 L -1.5 -26 A 6 8 0 1 1 1.5 -26 L 0 0" transform={`rotate(${r})`} />
            ))
          )}
          <circle cx="0" cy="0" r="8" fill="currentColor" className="opacity-50" />
        </g>
      </svg>
    </div>
  );
};

// Tree Count Icon Component
const TreeCountIcon = ({ count, isSelected }: { count: number, isSelected: boolean }) => {
  const baseClass = "w-8 h-8 transition-all duration-300";
  const stateClass = isSelected 
    ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] scale-110 opacity-100" 
    : "text-white/30 hover:text-white/60 hover:scale-105 opacity-70";

  // Simple branching tree path (fractal/deciduous style)
  const TreePath = ({ x, y, scale }: { x: number, y: number, scale: number }) => (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <path 
        d="M0 10 L0 -4 M0 1 L-5 -6 M0 1 L5 -6 M0 -4 L-3 -10 M0 -4 L3 -10" 
        stroke="currentColor" 
        strokeWidth="2" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </g>
  );

  return (
    <div className={`${baseClass} ${stateClass}`} title={`${count} Trees`}>
      <svg viewBox="0 0 24 24" className="w-full h-full">
        {count === 1 && <TreePath x={12} y={12} scale={1} />}
        {count === 2 && (
          <>
            <TreePath x={8} y={12} scale={0.8} />
            <TreePath x={16} y={12} scale={0.8} />
          </>
        )}
        {count === 3 && (
          <>
            <TreePath x={6} y={13} scale={0.6} />
            <TreePath x={12} y={11} scale={0.7} />
            <TreePath x={18} y={13} scale={0.6} />
          </>
        )}
      </svg>
    </div>
  );
};

// Reusable Toggle Button Component
const ModeToggle = ({ 
  isActive, 
  onClick, 
  iconPath, 
  label, 
  disabled = false 
}: { 
  isActive: boolean; 
  onClick: (e: React.MouseEvent) => void; 
  iconPath: string; 
  label: string;
  disabled?: boolean;
}) => {
  const baseClass = "flex items-center gap-3 transition-all duration-300 group";
  const stateClass = isActive
    ? "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] opacity-100 scale-105"
    : "text-white/30 hover:text-white/60 hover:scale-105 opacity-70";
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseClass} ${stateClass} ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
    >
      <div className="w-6 h-6">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <span className="text-sm font-bold tracking-wide">{label}</span>
    </button>
  );
};

const App: React.FC = () => {
  // App States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingSmile, setIsLoadingSmile] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [flowerStyle, setFlowerStyle] = useState<FlowerStyle>('peach');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('click');
  // 1 = 1 tree, 2 = 2 trees, 3 = 10 trees
  const [sceneMode, setSceneMode] = useState<number>(1); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isLooping = useRef(true); 
  const requestRef = useRef<number>(0);
  
  // Logic Refs
  const clickMoodRef = useRef<number>(-1); 
  
  // Tree State Ref
  const treeStateRef = useRef<TreeState>({
    mood: -1, 
    windForce: 0,
  });

  // NOTE: Removed useEffect for initializeVision to enable lazy loading

  const mainLoop = useCallback(() => {
    if (!isLooping.current) return;

    if (interactionMode === 'forever') {
      const time = performance.now() * 0.001; 
      const oscillation = Math.sin(time * 0.8); 
      const targetMood = 0.6 + (0.4 * (oscillation + 1) / 2);
      const gentleWind = 0.15 * Math.sin(time * 0.3);

      treeStateRef.current = {
        mood: targetMood,
        windForce: gentleWind
      };

    } else if (interactionMode === 'smile') {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && streamRef.current) {
        const { moodScore, movementScore } = analyzeFrame(videoRef.current);
        treeStateRef.current = {
          mood: moodScore,
          windForce: movementScore,
        };
      } else {
        treeStateRef.current = { mood: -0.5, windForce: 0 };
      }
    } else {
      const DECAY_RATE = 0.0015; 
      if (clickMoodRef.current > -1) {
        clickMoodRef.current -= DECAY_RATE;
      }
      if (clickMoodRef.current < -1) clickMoodRef.current = -1;

      treeStateRef.current = {
        mood: clickMoodRef.current,
        windForce: 0, 
      };
    }

    requestRef.current = requestAnimationFrame(mainLoop);
  }, [interactionMode]);

  useEffect(() => {
    isLooping.current = true;
    requestRef.current = requestAnimationFrame(mainLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [mainLoop]);

  const enableCamera = async () => {
    if (streamRef.current) return; 

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPermissionError(false);
    } catch (err) {
      console.error("Camera permission error:", err);
      setPermissionError(true);
      throw err; // Propagate error to handleModeChange
    }
  };

  const handleModeChange = async (mode: InteractionMode) => {
    if (mode === interactionMode) return;

    if (mode === 'smile') {
      setIsLoadingSmile(true);
      try {
        // 1. Lazy load models if not ready
        if (!modelsLoaded) {
          await initializeVision();
          setModelsLoaded(true);
        }
        // 2. Request Camera
        await enableCamera();
        // Only switch mode if camera success
        setInteractionMode('smile');
      } catch (error) {
        console.error("Failed to enter smile mode:", error);
        // Do NOT set back to click immediately so error UI can be seen if needed,
        // or effectively we just stay in current mode but permissionError is true
        // which triggers the overlay.
      } finally {
        setIsLoadingSmile(false);
      }
    } else {
      setInteractionMode(mode);
    }
  };

  const handleScreenClick = () => {
    if (interactionMode === 'click') {
      const BOOST = 0.7;
      clickMoodRef.current = Math.min(clickMoodRef.current + BOOST, 1.0);
    }
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden text-white font-['SimHei','Heiti_SC',sans-serif] bg-gradient-to-b from-[#111425] via-[#2a2d55] to-[#d8a895]"
      onClick={handleScreenClick} 
    >
      {!permissionError && (
        <SketchContainer 
          treeStateRef={treeStateRef} 
          flowerStyle={flowerStyle}
          sceneMode={sceneMode}
        />
      )}

      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-wider text-pink-200 opacity-90 drop-shadow-lg">
                Smile Tree
              </h1>
            </div>

            {/* Row 1: Flower Style Selector */}
            <div className="flex gap-4 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); setFlowerStyle('peach'); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <FlowerIcon style="peach" isSelected={flowerStyle === 'peach'} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setFlowerStyle('sakura'); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <FlowerIcon style="sakura" isSelected={flowerStyle === 'sakura'} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setFlowerStyle('delonix'); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <FlowerIcon style="delonix" isSelected={flowerStyle === 'delonix'} />
              </button>
            </div>

            {/* Row 2: Tree Count/Scene Selector */}
            <div className="flex gap-4 mt-1 border-t border-white/10 pt-4">
              <button
                onClick={(e) => { e.stopPropagation(); setSceneMode(1); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <TreeCountIcon count={1} isSelected={sceneMode === 1} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSceneMode(2); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <TreeCountIcon count={2} isSelected={sceneMode === 2} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSceneMode(3); }}
                className="outline-none focus:scale-110 transition-transform"
              >
                <TreeCountIcon count={3} isSelected={sceneMode === 3} />
              </button>
            </div>

            {/* Interaction Mode Switchers */}
            <div className="flex flex-col gap-4 mt-6">
              <ModeToggle 
                isActive={interactionMode === 'click'}
                onClick={(e) => { e.stopPropagation(); handleModeChange('click'); }}
                iconPath="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                label="点击花开"
              />
              <ModeToggle 
                isActive={interactionMode === 'smile'}
                onClick={(e) => { e.stopPropagation(); handleModeChange('smile'); }}
                iconPath="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                label={isLoadingSmile ? "启动中..." : "微笑花开"}
                disabled={isLoadingSmile}
              />
               <ModeToggle 
                isActive={interactionMode === 'forever'}
                onClick={(e) => { e.stopPropagation(); handleModeChange('forever'); }}
                iconPath="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                label="永远花开"
              />
            </div>
          </div>
        </div>

        {permissionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 pointer-events-auto">
            <div className="text-center max-w-lg p-6 border border-red-500/50 bg-red-900/20 rounded-xl">
              <h2 className="text-xl text-red-400 mb-2">需要摄像头权限</h2>
              <p className="text-gray-300 mb-4 text-sm">
                微笑开花模式需要使用摄像头来识别您的表情。请在浏览器设置中允许摄像头访问。
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); setInteractionMode('click'); setPermissionError(false); }}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-colors text-sm"
              >
                返回点击模式
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute opacity-0 pointer-events-none"
          style={{ width: 1, height: 1, top: 0, left: 0, zIndex: -1 }}
        />
      </div>
    </div>
  );
};

export default App;