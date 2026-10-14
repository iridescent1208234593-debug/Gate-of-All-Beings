import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import GameShell from './gate/GameShell';
import './index.css';

function mount() {
  const root = createRoot(document.getElementById('root')!);
  root.render(<StrictMode><GameShell /></StrictMode>);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    root.unmount();
  };
  (window as Window & { __iridescentlyDispose?: () => void }).__iridescentlyDispose = dispose;
  return dispose;
}

// Reuse the loaded React runtime when the shell mounts this application again.
(window as Window & { __iridescentlyMount?: () => () => void }).__iridescentlyMount = mount;
mount();
