# 项目实验入口

这里保存与众生之门开发有关、尚未整合为生产模块的实验。不会由生产构建自动发布。研究总入口：[生命模拟研究](../doc/zszm-life-research/00-index.md)。

| 目录 | 定位与状态 | 入口 |
| --- | --- | --- |
| [zszm-life-runtime](zszm-life-runtime/README.md) | 早期生命模拟运行实验；保留实现与测试证据 | `runtime.py`、`async_world.py`，具体状态见子项目 README |
| zszm-life-stage2 | 候选系统与工具链验证；研究索引记录已收束，源码、构建和运行证据保留 | `scripts/`；[阶段记录](../doc/zszm-life-research/20-stage2-experiment-log.md) |
| [zszm-life-stage3](zszm-life-stage3/README.md) | 迁移、耦合与 oracle 实验；研究索引记录实验与独立审查完成 | `run_stage3.py`；[评审包](../doc/zszm-life-research/24-stage3-runtime-review-bundle.md) |
| zszm-life-stage4 | 自有最小运行时；正在开发，KEEP WITH LIMITS | `runtime/`、`evidence/`；[阶段说明](../doc/zszm-life-research/26-stage4-minimal-runtime.md) |

`runtimes/*-venv/`、安装的 JDK 和 `.godot/` 是本机依赖/缓存，保留文件但排除 Git。实验源码、外部项目、运行记录与截图不按“生成文件”一概删除。新增实验用 `<项目>-<阶段>/`，配 README，并在此索引。
