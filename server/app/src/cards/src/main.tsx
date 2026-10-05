import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import GameShell from './gate/GameShell';
import './index.css';

const LegacyApp = lazy(() => import('./App'));
const legacy = ['2d', '3d', 'lab'].includes(new URLSearchParams(location.search).get('view') || '');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {legacy ? <><a href="/" style={{display:'block',padding:'15px 25px',color:'#365e4b'}}>← 返回众生之门 · 卡牌与会馆</a><Suspense fallback={<p>正在打开场景旧作…</p>}><LegacyApp /></Suspense></> : <GameShell />}
  </StrictMode>,
);
