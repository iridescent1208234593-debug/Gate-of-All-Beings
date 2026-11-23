# 生态模拟本地性能基准

从仓库根目录安装锁定的依赖（`npm ci`、`npm ci --prefix apps/ecology`），然后运行：

```sh
npm test --prefix apps/ecology
node --expose-gc apps/ecology/tests/benchmark-ecology.mjs 60
```

脚本使用种子 101，三档均运行模拟 60 秒，每 0.05 模拟秒调用一次 reducer；不读写存档、不联网。
前景相同的开局设置下，仅调整初始细胞与有机体数量。高档以现有配置上限开局，不改变运行时规则。
输出每档初始、峰值及分阶段活跃对象数（细胞、有机体、食物、植物），并给出 reducer 调用耗时和强制 GC 后
V8 堆的可重复采样办法。GC 不计入 reducer 耗时；堆差相对于该档开始前，不代表 GPU 分配或总体内存。

一次本地样本（Linux x64、Node 24.22.3，其他运行时和机器不可直接对比）：

| 档位 | 初始细胞/有机体 | 峰值细胞/有机体 | 60 秒活跃细胞/有机体 | reducer p50/p95 | 60 秒堆差 |
|---|---:|---:|---:|---:|---:|
| 低 | 20/2 | 71/3 | 56/3 | 0.523/1.322 ms | +1,274 KiB |
| 常规 | 80/8 | 115/18 | 59/18 | 0.915/1.935 ms | +584 KiB |
| 上限 | 130/24 | 130/24 | 57/11 | 1.018/1.996 ms | +148 KiB |

三档初始食物、植物均为 80、130；模拟中未超过既有种群上限。这里没有持续 GPU 曲线或泄漏结论。
Node 清理测试另用 Three.js 的真实几何、材质及纹理对象计数，验证共享资源只释放一次，
离场前通知 controls、renderer、丢弃上下文这三个入口，并停止信号绑定的事件。GPU 入口是桩，
不是已释放真实显存或已跑通完整 Shell 切换的证据。

## 浏览器基准和 Shell 进出验证

```sh
npx playwright install chromium
npm run build --prefix apps/ecology
node apps/ecology/tests/benchmark-browser.mjs 12
```

浏览器脚本使用实际 Shell 源码和本地构建的 Ecology 页面，在独立会话拦截所有网络请求，
以本地文件提供程序，使用假门户清单和一个邻接玩法占位页来专门验证 Ecology 进出。
同样三档种子和开局对象数，在 960×540 视口前台各执行约 12 个实际秒，每约 4 秒测量一次。
输出实测 RAF 回调频率（作为本方案的 FPS 指标）、实际 HUD 对象数、CDP JavaScript 堆和 DOM 数，
以及 Three.js 所用 WebGL2 API 的创建与删除调用计数。此计数不是显存字节数。
基准在软件 WebGL Chromium 153.0.8010.0、Linux x64 运行。另一个支持 WebGL 的 Chromium
可使用 `CHROMIUM_EXECUTABLE_PATH` 和 JSON 数组形式的 `CHROMIUM_ARGS`，不替换生产依赖。

| 档位 | 修复前 / 后 FPS | 修复前 / 后重复 HUD 写入 | 修复前堆首/末 | 修复后堆首/末 |
|---|---:|---:|---:|---:|
| 低 | 11.6 / 10.4 | 863 / 0 | 8,465 / 9,791 KiB | 8,471 / 9,775 KiB |
| 常规 | 10.9 / 11.2 | 831 / 0 | 9,241 / 15,386 KiB | 9,022 / 9,926 KiB |
| 上限 | 10.2 / 9.8 | 711 / 0 | 7,089 / 12,390 KiB | 9,674 / 16,308 KiB |

原来每帧无条件赋值会替换内容未变化的 HUD 文本节点。只调整这八个读数的 DOM 写入条件，
未改世界状态、物种、刷新频率、可见数值或渲染效果。这组结果验证了重复写入被消除，
未证明 FPS 或内存有稳定改善。三档修复前后稳定采样均观察到 4 个纹理、60 个 buffer、7 个 program、
16 个 VAO 的创建，未持续增加。测试通过构造页面可见性事件验证处理器暂停 RAF、再恢复，
没有模拟操作系统切后台的全部调度机制。随后在真正的 Shell 导航中退出游戏并重新进入：
旧 WebGL2 上下文触发浏览器 context-lost；离场后无 RAF 增长；回来只有一个未丢失的上下文。
挂载过程中不把 Chromium 垃圾回收抖动误认作泄漏。对照旧包可用
`ECOLOGY_BUILD_DIR=<旧构建目录> ECOLOGY_PROBE_BASELINE=1 node apps/ecology/tests/benchmark-browser.mjs 12`。
