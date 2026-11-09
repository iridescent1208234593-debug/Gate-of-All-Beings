# 根据运行 make 的系统选择对应配置；WSL 使用 Linux 配置。
ifeq ($(OS),Windows_NT)
include makefile-auto/Makefile.windows
else ifeq ($(shell uname -s),Linux)
include makefile-auto/Makefile.ubuntu
else
$(error 不支持此操作系统，目前仅支持 Windows 和 Linux)
endif
