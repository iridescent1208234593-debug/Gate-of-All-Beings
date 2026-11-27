# CI 回归入口与失败定位

## 两个检查名

- `regression`：分支 push 或手动触发时运行。
- `merge-gate`：Pull Request 事件运行，在 GitHub 生成的合并结果上运行。

两者使用同一个 `.github/workflows/regression.yml` job 和同一套构建、依赖审计与回归步骤；差别只有触发事件、合并检出和检查显示名。不要为了定位失败重复运行整套回归，先看失败步骤与 `regression-report` artifact。

## 本地入口

```powershell
# 只验证回归摘要记录逻辑
python -X utf8 tools/checks/test_regression.py

# 完整回归；只使用脚本创建的临时 test 存储
python -X utf8 tools/checks/regression.py --full --report $env:TEMP\regression-report.json

# 已有构建候选时，额外检查所有批准根域的门户路由
python -X utf8 tools/checks/regression.py --full `
  --modules <candidate>\modules `
  --report $env:TEMP\regression-report.json

# LAB Godot 客户端测试：apps/huiguan-lab/client/tests/ 下所有 `extends SceneTree` 的脚本
python -X utf8 tools/checks/lab-godot-client.py --godot E:\Iridescently\labs\Godot\Godot_v4.7.2-stable_win64.exe
```

LAB 客户端测试在 CI 中下载固定的 Godot 4.7.2（校验 SHA512），先 headless 导入工程再逐个运行。退出码非 0，或输出 `SCRIPT ERROR` / `Parse Error`，都算失败。新测试只要放进 `client/tests/`、首行写 `extends SceneTree`，就会自动纳入；只被 preload 的辅助脚本不用这样写。

## 失败定位

每个检查项会先打印模块名、完整 argv 和工作目录，失败时打印退出码。JSON 摘要中的失败项还包括 `command`、`command_text`、`cwd`、`exit_code` 和不含凭据的诊断提示；不会记录子进程环境变量或输出内容。

常见路径问题会在回归开始前直接指出：`--modules` 必须存在且为目录。Node/npm 缺失时保留可读的工具名运行，让失败项明确显示缺失的可执行文件，而不是把 `None` 传入子进程。

CI 依赖只在安装步骤执行一次：根 npm workspace、四个模块、activation-core 的 pnpm 依赖、Playwright Chromium 和 ffmpeg；后续 build、domain scan、regression 和 audit 复用同一工作区，不重复安装或无意义重跑。
