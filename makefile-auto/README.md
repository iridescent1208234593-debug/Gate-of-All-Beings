# 本地开发 Makefile

在仓库根目录执行。Windows 和 Ubuntu 使用各自的 Makefile、虚拟环境与运行数据；Ubuntu/WSL 请使用 Linux 文件系统中的独立 Git 检出，不与 Windows 共用 `node_modules`。

仓库根目录的 `Makefile` 会自动选择对应系统的配置，因此在仓库根目录可以直接运行 `make help`、`make doctor`、`make setup` 等命令。下面的 `-f` 写法也仍然可用。

Windows 需要 GNU Make、Python 3.12、Node 22、Git 和 FFmpeg。默认优先使用仓库同级 `local-dev/node/node-v22.17.1-win-x64`，也可使用 PATH 里的 Node 22；Python 默认使用当前用户官方安装目录。工具不符合版本时先自行安装，脚本不会修改系统 PATH。

```powershell
make -f makefile-auto/Makefile.windows help
make -f makefile-auto/Makefile.windows doctor
make -f makefile-auto/Makefile.windows setup
make -f makefile-auto/Makefile.windows build
make -f makefile-auto/Makefile.windows seal
make -f makefile-auto/Makefile.windows start
make -f makefile-auto/Makefile.windows status
make -f makefile-auto/Makefile.windows smoke
make -f makefile-auto/Makefile.windows stop
```

Ubuntu 需要 GNU Make、Python 3.12（含 `venv` 和 pip）、Node 22、Git 和 FFmpeg。`NODE_HOME` 默认是 `~/.local/share/iridescently-local-dev/node/bin`，也可使用 PATH 里的 Node 22。

```bash
make -f makefile-auto/Makefile.ubuntu help
make -f makefile-auto/Makefile.ubuntu doctor
make -f makefile-auto/Makefile.ubuntu setup
make -f makefile-auto/Makefile.ubuntu build
make -f makefile-auto/Makefile.ubuntu seal
make -f makefile-auto/Makefile.ubuntu start
make -f makefile-auto/Makefile.ubuntu status
make -f makefile-auto/Makefile.ubuntu smoke
make -f makefile-auto/Makefile.ubuntu stop
```

`doctor` 只检查工具。`setup` 创建或复用虚拟环境、安装 Pillow 和缺失的项目依赖，初始化 development 存储，首次生成本地 SSO 密钥及画廊占位图。已有依赖目录、密钥、图片与数据库不会被覆盖；已有数据但缺少就绪标记时拒绝初始化。已有 `node_modules` 不会自动更新，若版本不一致需自行检查。两套 Makefile 强制使用 development，清除各存储子目录的环境覆盖，不连接生产、不启动 Tunnel。

Windows 默认使用仓库同级 `local-dev`，Ubuntu 默认使用 `~/.local/share/iridescently-local-dev`；可通过 make 变量 `LOCAL_DEV` 指定各自的绝对目录，例如 `make -f makefile-auto/Makefile.ubuntu LOCAL_DEV=/tmp/example doctor`。可以用 `PYTHON_BOOTSTRAP` 和 `NODE_HOME` 指定已安装的工具目录；`GALLERY_DIR` 可指向自己有权使用的本地素材。不要把这些目录指向生产数据或仓库内部。

`setup` 首次会创建最小世界观示例库（只有 `LOCAL TEST CHARACTER`）和画廊占位图，用于本地验证；已有同名数据库不会被覆盖。示例库参照仓库的 Portal 测试夹具，只覆盖部分接口，不等于真实资料或完整数据库，不适合生产。不会下载真实素材。`build` 会重建该 development 存储下的候选目录，并按现有构建脚本重新安装 `apps/www/gallery-engine/node_modules`；`seal` 更新该环境的本地 Release channel。请勿将现有候选当作备份。Release 使用 Git 已提交源码，封存要求候选来自同一干净提交；开发中先提交更改再构建。

服务启动成功后访问 http://127.0.0.1:8080/。`start` 不抢占其他进程的端口；遇到占用请先确认进程归属。日志位于 development 存储的 `cache/logs/local-runtime/`。启动、停止和状态检查的实际范围见 `tools/runtime/local-runtime.py`。

需要更换门户入口端口时，可运行 `make start 18080`，然后访问 `http://127.0.0.1:18080/`。仅更改门户入口，其他内部服务端口保持不变；`make status` 与 `make smoke` 会读取已记录的端口。直接运行冒烟脚本仍默认检查 8080，也可通过 `--port 18080` 指定端口。若服务已经运行，先执行 `make stop` 再用新端口启动。端口范围为 1–65535，不能与其他本地服务端口重复。
