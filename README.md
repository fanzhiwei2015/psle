# PSLE 考试题目管理系统

一个参考 `my_assets` 项目结构初始化的题库管理系统，包含：

- `frontend/`：React + Vite 前端管理界面
- `backend/`：Golang 后端 API
- `database/`：MySQL 初始化脚本
- `docker-compose.yml`：开发/部署容器编排
- `Makefile`：统一管理开发与 Docker 命令

## 目录结构

```text
psle/
├── backend/
├── database/
├── frontend/
├── docker-compose.yml
└── Makefile
```

## 功能范围

当前初始化版本支持：

- 题目列表查询
- 题目按关键词、学科、状态筛选
- 题目新增、编辑、删除
- MySQL 初始化建表和种子数据
- Docker Compose 一键启动前后端与数据库

## 快速开始

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 安装依赖：

```bash
make install
```

3. 启动容器环境：

```bash
make up
```

启动后访问：

- 前端：`http://localhost:3001`
- 后端健康检查：`http://localhost:8081/healthz`

## 常用命令

```bash
make help
make install
make up
make down
make rebuild
make logs
make logs-backend
make logs-frontend
make logs-mysql
```

## 本地开发

如果你希望前后端分开跑：

```bash
make dev-backend
make dev-frontend
```

默认数据库连接：

- Host: `127.0.0.1`
- Port: `3307`
- Database: `psle_db`
- User: `psle`
- Password: `psle_password`
