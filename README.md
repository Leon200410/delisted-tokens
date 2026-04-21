# Delisted Tokens App

## 目录结构

- `frontend`: Next.js + React 前端页面
- `backend`: Node.js + Express 后端 API

## 运行步骤

### 1) 启动后端

```bash
cd backend
npm install
npm run dev
```

后端默认地址: `http://localhost:4000`

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址: `http://localhost:3000`

## API 约定

- `GET /api/health`: 健康检查
- `GET /api/exchanges`: 支持的交易所列表
- `GET /api/delisted/:exchangeId`: 获取某交易所下架币种

说明: 当前 `backend/src/services/delisted.service.js` 为占位实现，后续你提供抓取逻辑后可直接替换。
