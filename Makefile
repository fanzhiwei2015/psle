COMPOSE ?= docker compose
ROOT_DIR := $(CURDIR)
BACKEND_DIR := $(ROOT_DIR)/backend
FRONTEND_DIR := $(ROOT_DIR)/frontend

.PHONY: help install dev-backend dev-frontend up down restart rebuild reset logs logs-backend logs-frontend logs-mysql ps clean

help:
	@echo "可用命令:"
	@echo "  make install       安装前后端依赖"
	@echo "  make dev-backend   本地运行 Go 后端"
	@echo "  make dev-frontend  本地运行前端 Vite"
	@echo "  make up            启动 docker compose 开发环境"
	@echo "  make down          停止 docker compose 环境"
	@echo "  make restart       重启 docker compose 环境"
	@echo "  make rebuild       重新构建并启动服务"
	@echo "  make reset         删除卷后重建环境"
	@echo "  make logs          查看全部日志"
	@echo "  make logs-backend  查看后端日志"
	@echo "  make logs-frontend 查看前端日志"
	@echo "  make logs-mysql    查看 MySQL 日志"
	@echo "  make ps            查看容器状态"
	@echo "  make clean         清理前端构建产物"

install:
	cd "$(BACKEND_DIR)" && go mod tidy
	cd "$(FRONTEND_DIR)" && npm install

dev-backend:
	cd "$(BACKEND_DIR)" && go run ./cmd/server

dev-frontend:
	cd "$(FRONTEND_DIR)" && npm run dev

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

rebuild:
	$(COMPOSE) up --build -d

reset:
	$(COMPOSE) down -v
	$(COMPOSE) up --build -d

logs:
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f backend

logs-frontend:
	$(COMPOSE) logs -f frontend

logs-mysql:
	$(COMPOSE) logs -f mysql

ps:
	$(COMPOSE) ps

clean:
	rm -rf "$(FRONTEND_DIR)/dist" "$(FRONTEND_DIR)/node_modules" "$(BACKEND_DIR)/bin"
