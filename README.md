# ポートフォリオサイト | Portfolio Website

日式侘寂风格的个人作品集网站。

## 機能 | Features

- 日式侘寂风格设计
- 响应式布局（支持手机/平板）
- 作品展示网格
- 后台管理（需登录）
- 作品上传与删除

## 起動方法 | How to Run

```bash
cd portfolio
npm run dev
```

打开浏览器访问 http://localhost:5173

## 管理画面 | Admin

访问 http://localhost:5173/admin

- ユーザー名: admin
- パスワード: portfolio123

## 技術スタック | Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: SQLite
- Auth: JWT + bcrypt

## 構造 | Structure

```
portfolio/
├── client/          # React 前端
│   └── src/
│       ├── pages/   # 页面组件
│       └── App.tsx
├── server/          # Express 后端
│   ├── index.js    # 服务器入口
│   ├── database.js
│   └── uploads/   # 上传的图片
└── package.json
```
