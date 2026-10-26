import { Component, type ReactNode } from 'react';

/** 内容位置的出错状态：共享 `.qc-loading[role=alert]`，写清原因并至少给一个恢复入口。 */
export function LoadError({ message, onRetry, page }: { message: string; onRetry?: () => void; page?: boolean }) {
  return <div className={`qc-loading${page ? ' qc-loading--page' : ''}`} role="alert">
    {message}
    <div className="qc-loading__actions">
      {onRetry && <button type="button" onClick={onRetry}>重试</button>}
      <button type="button" onClick={() => window.location.reload()}>重新加载页面</button>
    </div>
  </div>;
}

// 动态导入的分包没取到（断网、刚发布新版本旧文件已不在）。React.lazy 会缓存失败结果，只能整页重载。
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk|error loading/i;

type Props = { children: ReactNode; page?: boolean; resetKey?: unknown };
type State = { error: Error | null };

/**
 * 包住 Suspense / lazy 视图：分包加载失败或渲染出错时显示可恢复的错误，而不是白屏或停在加载线。
 * `resetKey` 变化（如切换视图）时自动清除错误，不必重挂子树。
 */
export class LoadBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('[LoadBoundary]', error); }
  componentDidUpdate(prev: Props) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = CHUNK_ERROR.test(String(error?.message || error));
    return <LoadError page={this.props.page}
      message={chunk ? '这部分页面没能加载，可能是网络中断或站点刚更新了版本。' : '这部分页面出了点问题，暂时无法显示。'}
      onRetry={chunk ? undefined : () => this.setState({ error: null })} />;
  }
}
