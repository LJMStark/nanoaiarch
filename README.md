# Arch AI

面向中文市场的建筑可视化 AI 产品。把草图、白模、平面图转成照片级渲染图。

## 概览

- **目标用户**：建筑师、室内设计师、效果图工作室
- **市场**：中国大陆
- **技术栈**：Next.js 15 + TypeScript + PostgreSQL + Drizzle ORM + Better Auth + zpay (Alipay) + Gemini API
- **语言**：仅中文（中国本地化产品）

## 开发

```bash
pnpm install   # 安装依赖
pnpm dev       # 启动开发服务器
pnpm build     # 生产构建
pnpm test      # 运行测试
```

完整命令清单与项目架构见 [CLAUDE.md](./CLAUDE.md)。

## 文档

- 项目级架构与约定：[CLAUDE.md](./CLAUDE.md)
- 仓库协作规范：[AGENTS.md](./AGENTS.md)
- 重构路线图：参见 `~/.claude/plans/abundant-sparking-lampson.md`

## License

见 [LICENSE](./LICENSE)。
