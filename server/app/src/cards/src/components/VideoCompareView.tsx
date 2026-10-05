import React, { useRef, useState, useEffect } from 'react';
import { Video, RefreshCw, CheckCircle, Eye, Layers, Film, Upload, Sparkles, Trash2 } from 'lucide-react';

interface VideoCompareViewProps {
  progress: number;
  duration: number;
  isPlaying: boolean;
  soundEnabled: boolean;
  onSeek: (progress: number) => void;
  onVideoLoaded?: (videoEl: HTMLVideoElement | null) => void;
}

const DB_NAME = 'LivingCreaturesVideoDB';
const STORE_NAME = 'videos';

// 众生之门原视频已缓存的 CDN 地址（各域名 assets 下，6s 原片，含 AAC 音轨）
const DEFAULT_VIDEO_URLS = [
  'https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4',
  'https://oc.iridescently.xyz/assets/luoxiaohei_ep29.mp4',
];

export const VideoCompareView: React.FC<VideoCompareViewProps> = ({
  progress,
  duration,
  isPlaying,
  soundEnabled,
  onSeek,
  onVideoLoaded,
}) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('众生之门原视频.mp4');
  const [videoSourceType, setVideoSourceType] = useState<'cdn' | 'local' | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [compareMode, setCompareMode] = useState<'sideBySide' | 'overlay' | 'timeline'>('sideBySide');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.5);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (onVideoLoaded) {
      onVideoLoaded(videoRef.current);
    }
  }, [videoSrc, onVideoLoaded]);

  // Initialize IndexedDB to load saved video automatically
  useEffect(() => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get('current_video');
      getReq.onsuccess = () => {
        if (getReq.result) {
          const blob = getReq.result.blob;
          const name = getReq.result.name;
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
          setVideoName(name || '众生之门原视频.mp4');
          setVideoSourceType('local');
        } else {
          // 未导入本地视频时，默认加载已缓存的 CDN 原视频（保留原声，避免 AI 配音兜底）
          setVideoSrc(DEFAULT_VIDEO_URLS[0]);
          setVideoName('众生之门原视频.mp4');
          setVideoSourceType('cdn');
        }
      };
    };
  }, []);

  // 原视频 CDN 源加载失败时，自动切换到备用域名缓存
  const handleVideoError = () => {
    if (videoSourceType !== 'cdn') return;
    const idx = DEFAULT_VIDEO_URLS.indexOf(videoSrc || '');
    const next = DEFAULT_VIDEO_URLS[idx + 1];
    if (next) {
      setVideoSrc(next);
    } else {
      console.warn('All CDN copies of 众生之门原视频 failed to load');
    }
  };

  // Save video blob to IndexedDB
  const saveVideoToDB = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setVideoSourceType('local');

    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ blob: file, name: file.name }, 'current_video');
    };
  };

  const removeSavedVideo = () => {
    if (videoSourceType === 'local') {
      // 清除本地 IndexedDB 缓存，回退到默认 CDN 原视频
      setVideoSrc(DEFAULT_VIDEO_URLS[0]);
      setVideoName('众生之门原视频.mp4');
      setVideoSourceType('cdn');
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete('current_video');
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      saveVideoToDB(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      saveVideoToDB(file);
    }
  };
  const updateVideoVolume = (vid: HTMLVideoElement) => {
    vid.muted = !soundEnabled;
    vid.volume = soundEnabled ? 1.0 : 0.0;
  };

  // Smooth video sync & audio volume control
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc) return;

    updateVideoVolume(vid);

    if (isPlaying) {
      // During active playback, let the native video play uninterrupted
      if (vid.paused) {
        vid.play().catch(() => {});
      }
      // Only seek if drastically out of sync (> 0.8s, e.g. user jumped keyframe)
      // to avoid audio buffer resets and stuttering
      if (isSynced) {
        const vidDuration = vid.duration || duration;
        const targetTime = progress * vidDuration;
        if (Math.abs(vid.currentTime - targetTime) > 0.8) {
          vid.currentTime = targetTime;
        }
      }
    } else {
      // When paused, allow precise frame scrubbing
      if (!vid.paused) {
        vid.pause();
      }
      if (isSynced) {
        const vidDuration = vid.duration || duration;
        const targetTime = progress * vidDuration;
        if (Math.abs(vid.currentTime - targetTime) > 0.03) {
          vid.currentTime = targetTime;
        }
      }
    }
  }, [progress, isPlaying, isSynced, soundEnabled, videoSrc, duration]);

  // Video timeupdate callback to update progress bar and smoothly fade volume
  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && isSynced && isPlaying && !vid.paused) {
      updateVideoVolume(vid);
      const vidDuration = vid.duration || duration;
      const videoProg = vid.currentTime / vidDuration;
      if (Math.abs(videoProg - progress) > 0.02) {
        onSeek(Math.min(1, Math.max(0, videoProg)));
      }
    }
  };

  const keyframeSteps = [
    { time: '0.00s - 0.12s', title: '小圆点聚拢', desc: '散落小圆点向中心聚拢成白色圆月', color: 'bg-amber-400' },
    { time: '0.12s - 0.25s', title: '光圈与风波', desc: '圆月四周发散光芒线段与脉冲光晕', color: 'bg-emerald-400' },
    { time: '0.25s - 0.55s', title: '草地生灵冒出', desc: '绿叶包裹圆月，鹿灵与鲸灵在两侧探头', color: 'bg-teal-400' },
    { time: '0.55s - 0.85s', title: '立体众生之门', desc: '展开立体绿色方盒，显示“众生之门”与英文字', color: 'bg-indigo-400' },
    { time: '0.85s - 1.00s', title: '语音播报', desc: '显示中文问候字幕，同步播放语音', color: 'bg-purple-400' },
  ];

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="w-full bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-4 my-3 text-slate-200 shadow-2xl backdrop-blur-md transition-all"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>原视频 1:1 逐帧画面比对引擎</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {videoSrc ? (videoSourceType === 'cdn' ? 'CDN 原视频缓存' : '本地视频已保存') : '支持拖入/载入'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {videoSrc
                ? videoSourceType === 'cdn'
                  ? `已载入: ${videoName} (CDN 缓存源 ${new URL(videoSrc).hostname})`
                  : `已载入: ${videoName} (通过IndexedDB永久保存)`
                : '受限于浏览器安全沙箱，直接选择一次您的 mp4 视频文件后将【永久自动保存】于本地'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCompareMode('sideBySide')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                compareMode === 'sideBySide'
                  ? 'bg-emerald-600 text-black font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>原视频画幅</span>
            </button>
            <button
              onClick={() => setCompareMode('overlay')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                compareMode === 'overlay'
                  ? 'bg-emerald-600 text-black font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>透明度重叠</span>
            </button>
            <button
              onClick={() => setCompareMode('timeline')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                compareMode === 'timeline'
                  ? 'bg-emerald-600 text-black font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>关键帧分解</span>
            </button>
          </div>

          {videoSrc && (
            <button
              onClick={() => setIsSynced(!isSynced)}
              className={`px-2.5 py-1 text-xs rounded-xl flex items-center gap-1.5 transition-all font-mono border ${
                isSynced
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSynced ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSynced ? '逐帧同步: 开' : '原生高帧率: 关'}</span>
            </button>
          )}

          {videoSrc && videoSourceType === 'local' && (
            <button
              onClick={removeSavedVideo}
              title="清除已存视频，回退到 CDN 原视频"
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <label className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer transition-all flex items-center gap-1.5 shadow-lg active:scale-95">
            <Upload className="w-3.5 h-3.5" />
            <span>{videoSrc ? '更换视频文件' : '选择 mp4 原视频文件'}</span>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Display Area */}
      {videoSrc ? (
        <div className="flex flex-col items-center justify-center gap-3">
          {/* Always Mounted Single Video Element */}
          <div
            className={`relative w-full max-h-[360px] flex items-center justify-center bg-black rounded-xl overflow-hidden border border-slate-800 ${
              compareMode === 'timeline' ? 'hidden' : 'block'
            }`}
          >
            {compareMode === 'overlay' && (
              <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 backdrop-blur-md">
                <span className="flex items-center gap-1.5 font-medium">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  原视频重叠透明度: <strong>{Math.round(overlayOpacity * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-36 accent-emerald-500 cursor-pointer"
                />
              </div>
            )}

            <video
              ref={videoRef}
              src={videoSrc}
              onTimeUpdate={handleTimeUpdate}
              onError={handleVideoError}
              controls
              style={{ opacity: compareMode === 'overlay' ? overlayOpacity : 1 }}
              className="max-h-[360px] w-auto object-contain rounded-xl transition-opacity"
            />
          </div>

          {compareMode === 'timeline' && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 w-full my-1">
              {keyframeSteps.map((step, idx) => {
                const stepThresholds = [0.0, 0.12, 0.25, 0.55, 0.85, 1.0];
                const isActive = progress >= stepThresholds[idx] && progress <= stepThresholds[idx + 1];
                return (
                  <div
                    key={idx}
                    onClick={() => onSeek(stepThresholds[idx])}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-lg scale-[1.02]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold text-emerald-400">{step.time}</span>
                        <span className={`w-2 h-2 rounded-full ${step.color}`} />
                      </div>
                      <h4 className="font-bold text-xs text-white mb-1">{step.title}</h4>
                      <p className="text-[10px] text-slate-400 leading-tight">{step.desc}</p>
                    </div>
                    {isActive && (
                      <span className="mt-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 w-fit font-mono flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> 联动对齐中
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between w-full text-xs text-slate-400 px-1 font-mono gap-2">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              当前同步播放帧: <strong className="text-white">{(progress * duration).toFixed(2)}s</strong> / {duration.toFixed(1)}s
            </span>
            <span className="text-slate-400">
              播放/暂停/拖拽进度条时，原视频与 React 画面将 100% 双向实时逐帧联动
            </span>
          </div>
        </div>
      ) : (
        /* Empty state drop zone */
        <label className="w-full py-8 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all group shadow-inner">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-7 h-7 text-emerald-400 animate-bounce" />
          </div>
          <p className="text-base font-bold text-white mb-1">
            点击此区域选择 或 直接把本地 mp4 视频拖拽入此区域
          </p>
          <p className="text-xs text-emerald-300/80 font-mono max-w-md">
            载入后应用将通过 IndexedDB 永久在您本地浏览器保存此视频，以后每次打开网站都会【自动免导入直接播放】！
          </p>
        </label>
      )}
    </div>
  );
};


