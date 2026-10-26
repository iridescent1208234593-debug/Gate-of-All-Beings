const siteDomains = createRequire(import.meta.url)('../../../../packages/site-domains/index.js');
import { createRequire } from 'node:module';
// 重生之门：纯静态项目，vite 仅用作静态服务器（未装依赖，走 npx 缓存）
// root 指向 public，/ 直接命中 index.html
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const huiguanRoot = path.join(projectRoot, 'portal/huiguan')
const sharedUiRoot = path.join(projectRoot, 'packages/shared-ui')

export default {
  root: 'public',
  // public/ui/images 是 junction（指向 shared-ui -> design-system/ui），
  // 关闭 symlink 解析，让 CSS url(../images/...) 保持相对路径，避免 vite 生成 @fs 路径被 403
  resolve: {
    symlinks: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    allowedHosts: siteDomains.allowedHosts,
    // public/ui/images 是 junction（真实指向 portal/huiguan/design-system/ui），
    // 必须把 junction 真实路径加入 fs.allow，否则 vite 生成的 /@fs/ 图片请求会被 403
    fs: {
      allow: [
        '.',
        huiguanRoot,
        sharedUiRoot,
      ],
    },
  },
}
