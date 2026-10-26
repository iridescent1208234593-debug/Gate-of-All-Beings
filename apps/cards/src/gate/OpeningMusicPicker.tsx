import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useOpeningMusic, type MusicChoice } from './OpeningMusic';
import './opening-music-picker.css';

const choices: { id: MusicChoice; label: string; detail?: string }[] = [
  { id: 'auto', label: '自动', detail: '推荐' },
  { id: 'ext', label: '配乐 1', detail: 'lxh demo1延长' },
  { id: 'demo2', label: '配乐 2', detail: 'lxh demo2 · 试听 / 未完成' },
  { id: 'mute', label: '静音' },
];

export function OpeningMusicPicker() {
  const music = useOpeningMusic();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const selected = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    (selected || menuRef.current?.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-music-choice]') || [])];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (!items.length) return;
        event.preventDefault();
        items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const label = music.choice === 'demo2' ? '配乐 2' : music.choice === 'ext' ? '配乐 1' : music.choice === 'mute' ? '静音' : '自动';
  return <div className="door-audio-choice" ref={rootRef}>
    <button type="button" className="door-sound" onClick={music.toggleMute}
      title={music.muted ? '开启声音' : '关闭声音'} aria-label={music.muted ? '开启声音' : '关闭声音'} aria-pressed={!music.muted}>
      {music.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
    <button ref={buttonRef} type="button" className="door-music-button" aria-haspopup="menu"
      aria-expanded={open} aria-controls="door-music-menu" title="选择开场配乐" onClick={() => setOpen(value => !value)}>
      曲 · {label}
    </button>
    <div id="door-music-menu" ref={menuRef} className="door-music-menu" role="menu" aria-label="开场配乐" hidden={!open}>
      {choices.map(option => <button key={option.id} type="button" role="menuitemradio" data-music-choice={option.id}
        aria-checked={music.choice === option.id} onClick={() => {
          music.choose(option.id); setOpen(false); buttonRef.current?.focus({ preventScroll: true });
        }}>
        <span>{option.label}</span>{option.detail && <small>{option.detail}</small>}
      </button>)}
      <p>配乐 · 小废物 老师</p>
    </div>
  </div>;
}
