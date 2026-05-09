# 仓库协作规范

> **Last verified**: 2026-05-09 against commit `0cf3f81`
> 任何 PR 修改了项目级约定时同步更新本文件。

## 项目结构

- `src/app/` — Next.js App Router 路由，路径含 `[locale]` 段（已锁定为 `zh`）
- `src/actions/` — Server Actions（数据修改）
- `src/ai/`、`src/payment/`、`src/credits/` — 领域功能
- `src/components/`、`src/hooks/`、`src/stores/`、`src/lib/` — 共享 UI/hooks/state/工具
- `src/db/` — Drizzle schema 和迁移
- `src/i18n/` 和 `messages/` — 国际化（仅 `zh.json`）
- `content/` — Blog/Docs MDX（docs 当前禁用）
- `public/` — 静态资源；`scripts/` — 维护脚本
- `src/test/` — Vitest 配置和辅助函数

## 构建、测试、开发命令

使用 `pnpm`（不用 npm/yarn）。
- `pnpm dev`：启动本地 Next.js 开发服务器
- `pnpm build`：生产构建
- `pnpm start`：运行生产服务器
- `pnpm lint` / `pnpm format`：Biome lint 与格式化
- `pnpm test`、`pnpm test:ui`、`pnpm test:coverage`：Vitest CLI / UI / 覆盖率
- `pnpm db:generate`、`pnpm db:migrate`、`pnpm db:push`、`pnpm db:studio`：Drizzle 迁移与数据查看
- `pnpm content`：重建 MDX 内容；`pnpm email`：邮件模板预览

## 编码规范与命名

- TypeScript + Next.js App Router；数据修改用 `src/actions/` 下的 Server Actions
- Biome 强制：2 空格缩进、单引号、分号、import 排序
- Import 用 `@/` 别名指向 `src/`
- 命名函数用 `function` 声明（不用箭头函数），public API 显式返回类型
- 代码注释用英文，UI 文案在 `messages/zh.json`

## 测试规范

- Vitest + React Testing Library + jsdom
- 测试位置 `src/**/__tests__/*.test.ts(x)`；setup 在 `src/test/setup.ts`
- 测试要确定性、聚焦行为
- 覆盖率目标：≥ 80%（当前 CI 待启用阈值，参见重构计划 Week 3）

## 提交与 PR 规范

- Commit 风格：`feat: ...`、`fix: ...`、`refactor: ...`、`chore: ...`、`perf: ...`、`test: ...`、`docs: ...`、`ci: ...`
- 提交粒度小，说清楚 "why" 而非 "what"
- PR 必须包含：简短摘要、关联 issue、测试输出；UI 变更需附截图或录屏
- 计划在 Week 3 引入 Conventional Commits + 自动 CHANGELOG

## 安全与配置

- 复制 `env.example` 为 `.env.local`，设置必需值：
  - `DATABASE_URL`、`BETTER_AUTH_SECRET`
  - `GEMINI_API_KEY`、`GEMINI_DEFAULT_MODEL`
  - `ZPAY_PID`、`ZPAY_KEY`、`ZPAY_NOTIFY_URL`、`ZPAY_RETURN_URL`
  - `ZPAY_PRICE_*`（套餐价格）
  - `NEXT_PUBLIC_BASE_URL`
- 可选维护变量：
  - `CRON_SECRET`（保护手动维护接口；图片生成超时恢复不依赖外部定时任务）
- ❌ 严禁提交密钥或生产凭证
- ⚠️ env.example 中的 `STRIPE_*`、`DUOMI_API_KEY`、`OPENAI_API_KEY` 等是模板残留，**不再使用**（计划 Week 8 删除）

## 关键技术决策提醒

- 支付：**zpay (Alipay)**，仅一次性付款，**不支持订阅**
- 认证：**Better Auth**，仅 email/password（社交登录已禁用）
- AI Provider：**Gemini**（via `@ai-sdk/google`）
- 语言：**仅中文**，不支持英文版
- 详细产品定位与架构见 [CLAUDE.md](./CLAUDE.md)
