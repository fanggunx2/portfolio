# ポートフォリオサイト | Portfolio Website

日式侘寂风格的个人作品集网站。

## 機能 | Features

- 日式侘寂风格设计
- 响应式布局（支持手机/平板）
- 作品展示网格
- 后台管理（需登录）
- 作品上传与删除

## 仕組み | How It Works

公开的网站是**纯静态网页**，没有服务器和登录入口，可以免费托管。
后台（`/admin`）只在自己的 Mac 上运行，用来上传和编辑作品。

- 后台每次改动后，会自动把数据导出到 `client/public/data/`（`works.json`、`about.json`）
- 图片和视频保存在 `client/public/uploads/`
- 上传的图片会自动生成网页用的大图（WebP，最长边 2400px）和首页用的小图（`-thumb.webp`）
- 上传的视频会自动压缩为 H.264、20MB 以内（使用 macOS 自带功能，见 `scripts/compress-video.swift`）
- 原始文件保存在 `server/originals/`，只留在本机，不会发布
- 发布时把这两个文件夹和 `server/portfolio.db` 一起提交推送即可

## 起動方法 | How to Run（本地编辑）

```bash
npm run dev
```

- 网站预览：http://localhost:5173
- 后台：http://localhost:5173/admin （服务器只监听本机，外部无法访问）

## 打包 | Build

```bash
npm run build
```

生成的静态网站在 `client/dist/`。

## 公開 | Publish

网站托管在 EdgeOne Pages（国际版，国内可访问）。推送到 GitHub 的 `main` 分支后会自动构建发布，构建设置见 `edgeone.json`。

## 技術スタック | Tech Stack

- Frontend: React + TypeScript + Vite
- Local admin server: Node.js + Express
- Database: SQLite（exported to static JSON）
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
