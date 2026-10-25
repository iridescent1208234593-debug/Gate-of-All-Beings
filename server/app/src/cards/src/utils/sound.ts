import siteDomains from '../../../../../../shared/site-domains.mjs';
// Web Audio API Synthesizer for high-quality sound effects

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playMoonChime(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15 * volume, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.65);
    });
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

export function playBushRustle(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
    filter.Q.setValueAtTime(3, ctx.currentTime);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2 * volume, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

export function playCreaturePop(volume = 0.5, pitchMultiplier = 1) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    const startFreq = 220 * pitchMultiplier;
    const endFreq = 660 * pitchMultiplier;
    
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

export function playGateUnfold(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3 * volume, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

// 众生之门原视频已缓存的 CDN 地址（各域名 assets 下，6s 原片，含 AAC 音轨）
const DEFAULT_VIDEO_AUDIO_URLS = [
  siteDomains.url('huiguan', '/assets/luoxiaohei_ep29.mp4'),
  siteDomains.url('oc', '/assets/luoxiaohei_ep29.mp4'),
];

let cdnAudioEl: HTMLAudioElement | null = null;
let cdnAudioUrlIndex = 0;

// 无挂载原视频时，播放已缓存的 CDN 原视频音频，替代 speechSynthesis AI 配音。
// 注意：这里必须用 <audio> 而不是隐藏的 <video>——手机端（微信/QQ 的 X5 内核等）
// 会把播放中的 <video> 交给原生播放器渲染，CSS 的 display/opacity 对其无效，
// 页面会被视频层盖住（表现为「打开 2D/3D 直接变成视频」）。

// 语音合成兜底：CDN 原声拿不到或被浏览器拒绝时，用系统 TTS 顶上，避免开场整段静默
function speakViaSynthesis(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stop prior speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.95;
  utterance.pitch = 1.1;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  // Try to find a nice female / natural Chinese voice
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'));
  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function playCdnOriginalAudio(text: string, onEnd?: () => void): boolean {
  try {
    if (!cdnAudioEl) {
      cdnAudioEl = document.createElement('audio');
      cdnAudioEl.style.display = 'none';
      cdnAudioEl.setAttribute('playsinline', 'true');
      cdnAudioEl.preload = 'auto';
      document.body.appendChild(cdnAudioEl);
      cdnAudioEl.addEventListener('error', () => {
        cdnAudioUrlIndex = (cdnAudioUrlIndex + 1) % DEFAULT_VIDEO_AUDIO_URLS.length;
      });
      cdnAudioEl.addEventListener('ended', () => {
        if (onEnd) onEnd();
      });
    }
    const url = DEFAULT_VIDEO_AUDIO_URLS[cdnAudioUrlIndex];
    if (cdnAudioEl.src !== url) {
      cdnAudioEl.src = url;
    }
    cdnAudioEl.muted = false;
    cdnAudioEl.volume = 1.0;
    const p = cdnAudioEl.play();
    // 播放被拒（无用户手势 / 移动端省电策略）或音轨不可用时，回退到语音合成
    if (p && typeof p.catch === 'function') p.catch(() => speakViaSynthesis(text, onEnd));
    return true;
  } catch (e) {
    console.warn('CDN original audio play failed:', e);
    return false;
  }
}

export function speakGreeting(text = '你好，欢迎来到众生之门', onEnd?: () => void, videoElement?: HTMLVideoElement | null) {
  if (videoElement && videoElement.src) {
    // Native video has its own high quality audio track playing in sync with video
    return;
  }

  // 无挂载原视频时，播放已缓存的 CDN 原视频音频（替代 speechSynthesis AI 配音）；
  // 资源不可用或被浏览器拒绝播放时，回退到语音合成，保证开场不会整段静默
  if (playCdnOriginalAudio(text, onEnd)) {
    return;
  }

  speakViaSynthesis(text, onEnd);
}
