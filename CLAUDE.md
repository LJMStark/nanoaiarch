# CLAUDE.md

> **Last verified**: 2026-05-13 against commit `cdd1efa4`
> **Maintenance rule**: 任何 PR 修改了支付/认证/AI Provider/i18n 配置时，必须同步更新本文件并刷新顶部时间戳与 commit hash。

本文件为 Claude Code (claude.ai/code) 在此仓库内工作时提供项目级上下文。

---

## 产品定位

**Arch AI** — 面向中文市场的建筑可视化 AI 产品，把草图、白模、平面图转成照片级渲染图。

- **目标用户**：建筑师、室内设计师、效果图工作室
- **市场**：仅中国大陆（China-only）
- **语言**：纯中文 UI（不支持英文版）
- **付费**：Alipay (zpay) 一次性付款，**不支持订阅**

---

## 开发命令

### 核心开发
- `pnpm dev` — 启动开发服务器（热重载）
- `pnpm build` — 构建生产包（含 type check + fumadocs-mdx）
- `pnpm start` — 启动生产服务器
- `pnpm lint` — Biome lint + 自动修复
- `pnpm lint:fix` — Biome lint 含 unsafe fix
- `pnpm format` — Biome 格式化

### 数据库（Drizzle ORM）
- `pnpm db:generate` — 根据 schema 变更生成迁移文件
- `pnpm db:migrate` — 应用待执行迁移
- `pnpm db:push` — 直接同步 schema（仅开发，跳过迁移）
- `pnpm db:studio` — 打开 Drizzle Studio

### 测试（Vitest）
- `pnpm test` — watch 模式
- `pnpm test:ui` — Vitest UI
- `pnpm test:coverage` — 覆盖率报告
- 测试位置：`src/**/__tests__/*.test.ts(x)`

### 内容与邮件
- `pnpm content` — 处理 MDX 内容（fumadocs）
- `pnpm email` — 邮件模板预览（端口 3333）

### 工具脚本
- `pnpm list-users` — 列出全部用户
- `pnpm list-contacts` — 列出 newsletter 联系人

---

## 项目架构

基于 Next.js 15 全栈 SaaS（前身为 MkSaaS 模板，已大幅改造）。

### 核心技术栈
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth — **仅 email/password**（Google/GitHub 社交登录在 `src/lib/auth.ts:87-105` 注释禁用）
- **Payments**: **zpay (Alipay)** — 仅支持一次性付款，**不支持订阅**。`src/payment/provider/zpay.ts:194` 显式抛出 "does not support subscription payments"
- **AI Provider**: Gemini API + Duomi API — 模型为 `gemini-3-pro-image-preview`（forma）、`gemini-3.1-flash-image-preview`（flash）和 `gpt-image-2`，见 `src/ai/image/lib/provider-config.ts`
- **UI**: Radix UI + TailwindCSS
- **State**: Zustand（含 localStorage 持久化）
- **i18n**: next-intl — **仅中文 (zh)**，英文版已删除
- **Content**: Fumadocs (docs 已禁用) + MDX (blog 已禁用)
- **Quality**: Biome (lint/format), Vitest (test)

### 关键架构模式

#### 1. AI Image Generation 系统 (`src/ai/image/`)

产品核心功能，多层架构：

**Provider 层** (`src/ai/image/lib/provider-config.ts`)
- Gemini API 与 Duomi API
- 支持模型：`forma` (gemini-3-pro-image-preview)、`flash` (gemini-3.1-flash-image-preview)、`gpt-image-2` (Duomi async)
- 图片质量配置：1K / 2K / 4K
- **积分消耗：1 credit/张**（`src/ai/image/lib/credit-costs.ts`）

**State Management** (Zustand stores)
- `src/stores/conversation-store.ts` — 消息历史（带持久化）
- `src/stores/project-store.ts` — 项目配置和草稿状态
- 已知问题：`currentProjectId` 在两个 store 并行维护，存在不一致风险（参见 `docs/baselines/` 重构计划）
- **持久化白名单**（`project-store` v4）：只持久 `imageQuality` 和 `selectedModel`。`currentProjectId` 故意**不**进 localStorage——见上文"工作台入口策略"。新增持久字段必须先扩 `PersistedProjectState`，否则 `partialize` 类型检查就会报错

**Components**（位于 `src/ai/image/components/`）
- `ArchPlayground.tsx` — 主 playground 页面
- `ConversationLayout.tsx` — 项目对话布局
- `ConversationInput.tsx` — 多图输入
- `MessageItem.tsx` — 消息展示（重试/下载/分享）
- `GenerationSettings.tsx` — 质量/宽高比控制
- `ReferenceImagesPreview.tsx` — 参考图预览

**数据流**
```
用户输入 → ConversationInput → Server Action (addUserMessage)
        → /api/generate-images → Gemini API → 轮询结果
        → Server Action (updateAssistantMessage) → 更新 store → UI 更新
```

**Recovery 系统** (`src/ai/image/hooks/use-generation-recovery.ts`)
- 页面挂载时检测中断的生成
- 从 localStorage 恢复 generating 状态
- 防止"卡住的 generating"孤儿消息
- ⚠️ 已知缺陷：失败判定过于激进（找不到消息立刻 markFailed），重构计划在 Week 4

**工作台入口策略 (Week 5)**
- 访问 `/ai/image`（无 query）→ **永远显示 TemplateShowcase 空状态**，不自动恢复上次项目
- `?new=1` → 服务端创建空项目并进入
- `?template=xxx` → 打开模板详情 modal，不自动选项目
- 进入具体项目只能通过：sidebar 点击、`?new=1` CTA、未来可能加的 URL projectId 参数
- 实现层面：`ConversationLayout` 默认 mode 为 `'blank'`；`useConversationInit` 永远传 `null` 给 `getConversationInitData`；后者不再有"无 requestedProjectId 时 fallback 到 `existingProjects[0]`"的兜底
- 副作用：刷新工作台会失去当前项目（需重新从 sidebar 点入），这是与 ChatGPT / Linear / Figma 等产品对齐的有意取舍

#### 2. Server Actions 模式 (`src/actions/`)

所有数据修改走 Next.js Server Actions：

```typescript
export async function actionName(params) {
  // 1. 鉴权
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  // 2. 校验（建议 Zod）
  const validated = schema.parse(params);

  // 3. DB 操作
  const db = await getDb();
  const result = await db.insert(...);

  // 4. 返回类型化响应
  return { success: true, data: result };
}
```

**关键 Server Actions**：
- `src/actions/project-message.ts` — 对话消息 CRUD
- `src/actions/project-message-recovery.ts` — lease-expiry 扫尾 + Duomi 异步任务结算（从 project-message.ts 拆出，避免单文件超过 1500 行）
- `src/actions/project-message-internal.ts` — 上面两个模块共享的类型与小工具
- `src/actions/image-project.ts` — 项目管理
- `src/actions/check-payment-completion.ts` — 支付完成验证

⚠️ **Next.js `'use server'` 重新导出陷阱**（Zeabur 生产构建会失败）：
不要在 `'use server'` 文件里写 `export { x } from './other'`——即使被导出的是 async 函数，Next.js 打包器也会把整个模块认成"完全没有 exports"，所有下游 import 全 resolve 失败。
正确做法：包成本地的薄 async wrapper。`project-message.ts:46-60` 是参考实现。

#### 3. 数据库 Schema (`src/db/schema.ts`)

**核心表**：
- `user` — 用户账户（Better Auth）
- `session` — 会话（含 IP / user-agent）
- `account` — OAuth provider 关联（当前社交登录禁用）
- `payment` — zpay 支付记录（含 invoice 去重）
- `creditTransaction` — 积分交易流水（注意：`paymentId` 字段实际存的是 `invoiceId`，schema 待修复）
- `creditHold` / `creditLedger` — 积分持有/账本（生成期间预扣）
- `imageProject` — AI 生成项目
- `projectMessage` — 对话消息（含 generation 元数据）

**索引策略**：
- 所有外键索引
- `user.role`、`customerId` 索引
- `payment.status/scene/type` 索引
- `imageProject.userId` 索引

**已知 schema 债务**（待 Week 8 处理）：
- `userCredit.lastRefreshAt` 已废弃但未删除
- `creditTransaction.paymentId` 名实不符（实为 invoiceId）
- 多个 JSON 字段存为 `text` 而非 `jsonb`

#### 4. 认证流程 (`src/lib/auth.ts`)

**Better Auth 配置**：
- Session cookie 缓存 1 小时
- Session 7 天过期
- 强制邮箱验证
- 注册自动发送欢迎邮件 + 发放注册礼积分（50 积分，30 天过期）
- **社交 Provider (Google/GitHub) 已注释禁用**（`src/lib/auth.ts:87-105`）
- Admin plugin（用于 banUser 等管理动作）

**Locale 处理**：
- 项目纯中文化后，`NEXT_LOCALE` cookie 锁定为 `zh`
- 邮件验证 URL 仍走 locale 注入（向前兼容，但实际只有 zh）

#### 5. 国际化 (`src/i18n/`)

**项目纯中文产品**，不支持英文版：

- `src/i18n/routing.ts` — 仅 `zh` locale
- `src/i18n/request.ts` — 服务端固定返回 zh
- `messages/zh.json` — 唯一翻译文件
- ❌ 已删除：`messages/en.json`、`LocaleSwitcher` 组件

**使用模式**：
```typescript
// Server Component
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('PageName');

// Client Component
import { useTranslations } from 'next-intl';
const t = useTranslations('PageName');
```

#### 6. 支付系统 (`src/payment/`)

**积分系统** (`src/credits/`)：
- 免费月度积分（自动续期）
- 注册礼积分（一次性，50 积分，30 天有效）
- 一次性购买积分包（basic/standard/pro × month/quarter/year，9 个 SKU）
- 流水记录在 `creditTransaction` 表
- 模块拆分（避免单文件 800+ 行）：
  - `credits.ts` — 公共入口、重新导出
  - `credits-hold.ts` — hold 生命周期（reserve → confirm/release）
  - `credits-internal.ts` — 两个文件共享的 ledger/balance 工具

**zpay 集成** (`src/payment/provider/zpay.ts`)：
- ⚠️ **仅支持一次性付款**，不支持订阅
- creditPackages 中的 `interval: 'month'` 字段表示积分有效期，不是自动续费
- Webhook：`/api/webhooks/zpay` 处理 GET + POST 两种回调
- 套餐：
  - `pricePlans.free` — 免费版（50 积分/月）
  - `pricePlans.lifetime` — 终身版（**当前 disabled**）
  - `creditPackages.*` — 9 个一次性积分包

**已知缺陷**（Week 1 已修复）：
- `holdCredits` check-then-act 并发缝隙
- Lifetime webhook 月度积分错发风险

### 目录结构

```
src/
├── app/[locale]/    # Next.js routes (locale 锁定 zh)
├── actions/          # Server Actions (数据修改)
├── ai/image/         # AI 图像生成（产品核心）
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── config/
├── components/       # 通用 UI 组件
├── db/              # Drizzle schema + migrations
├── stores/          # Zustand state
├── lib/             # 工具函数
├── hooks/           # 全局 React hooks
├── config/          # 应用配置（pricing/website）
├── i18n/            # 国际化（仅 zh）
├── mail/            # 邮件模板
├── payment/         # 支付集成（zpay only）
└── credits/         # 积分系统
```

---

## 编码规范

**TypeScript**:
- 命名函数使用 `function` 关键字（不用箭头函数）
- public 函数显式返回类型
- 路径别名 `@/*` → `src/*`

**注释**:
- 代码注释用英文
- UI 文案在 `messages/zh.json`
- public API 加 JSDoc

**State**:
- Zustand 管客户端状态（按需持久化）
- 服务端状态走 Server Actions
- ❌ 不用 React Context 做全局状态

**错误处理**:
- Server Actions 返回 `{ success: boolean, error?: string, data?: T }`
- 客户端错误用 `error.tsx` 边界
- 404 用 `not-found.tsx`

**Imports**:
- 顺序：external → internal → relative
- Biome 自动排序

---

## 测试策略

**当前覆盖**：
- Server Actions: `src/actions/__tests__/`
- 组件: `src/ai/image/components/conversation/__tests__/`
- Credits 模块: `src/credits/__tests__/`
- Payment Provider: `src/payment/provider/__tests__/`

**Stack**: Vitest + React Testing Library + jsdom

**测试模板**：
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

**覆盖缺口**（Week 3 补齐）：
- Webhook 入口零测试
- 无 E2E（计划引入 Playwright）
- 无真 DB 集成测试（计划引入 Testcontainers）

---

## 环境变量

**必需变量**（详见 `env.example`）：
- `DATABASE_URL` — PostgreSQL 连接串
- `BETTER_AUTH_SECRET` — Auth 加密密钥
- `GEMINI_API_KEY` — Gemini AI Provider key
- `GEMINI_DEFAULT_MODEL` — 默认 `gemini-3-pro-image-preview`
- `DUOMI_API_KEY` — Duomi GPT Image 2 key
- `ZPAY_PID` / `ZPAY_KEY` — zpay 商户 ID 与密钥
- `ZPAY_NOTIFY_URL` / `ZPAY_RETURN_URL` — zpay 回调地址
- `ZPAY_PRICE_*` — 9 个套餐价格配置
- `NEXT_PUBLIC_BASE_URL` — 应用 base URL

**可选维护变量**：
- `CRON_SECRET` — 保护手动维护接口的 Bearer token；图片生成超时恢复不依赖外部定时任务

**已废弃变量**（仍在 env.example 中，待 Week 8 删除）：
- ❌ `STRIPE_SECRET_KEY`、`STRIPE_*` — 项目用 zpay
- ❌ `AI_GATEWAY_API_KEY` / `FAL_API_KEY` / `FIREWORKS_API_KEY` / `OPENAI_API_KEY` / `REPLICATE_API_TOKEN` / `DEEPSEEK_API_KEY` — Legacy 模板残留

**图片上传**：
- 最大 body size 10MB（`next.config.ts`）
- 可设 `DISABLE_IMAGE_OPTIMIZATION=true` 跳过 Next.js 图像优化

---

## 性能注意事项

**Next.js 15 优化**：
- 默认 Server Components
- 客户端组件标 `'use client'`
- 重组件用 `next/dynamic` 懒加载
- `next/image` 远程域名白名单

**已知性能债务**（Week 6 处理）：
- `src/ai/image/components/` 39/39 全部 `'use client'`，待部分 RSC 化
- `MessageList` 无虚拟化，长对话会卡顿
- 重复依赖：`framer-motion` + `motion`、`@radix-ui/*` + `radix-ui`

**数据库**：
- Drizzle 连接池
- 外键 + 常用查询全索引
- 注意 N+1 问题，用 join

**State**：
- Zustand slice 防止不必要重渲染
- 持久化只存关键 ID/枚举，**不存 base64 图片**
- 热路径用 `useCallback`/`useMemo`

---

## 常见开发流程

**新增 Server Action**：
1. 在 `src/actions/[feature].ts` 创建
2. 加鉴权 + Zod 校验
3. 执行 DB 操作
4. 返回 `{ success, data?, error? }`
5. 在组件中导入使用

**新增数据库表**：
1. 在 `src/db/schema.ts` 定义
2. `pnpm db:generate` 生成迁移
3. `pnpm db:migrate` 应用迁移
4. 必要时更新 TS 类型

**新增路由**：
1. 在 `src/app/[locale]/[route]/page.tsx` 创建
2. 在 `messages/zh.json` 加翻译键
3. Server 组件用 `getTranslations()`，客户端用 `useTranslations()`

**调试图像生成**：
1. 检查 localStorage 中 `conversation-store`
2. 验证 `isGenerating` 和 `generatingMessageId` 状态
3. 查 Server Action 日志看 API 错误
4. 查 `projectMessage` 表看卡住的消息
5. 必要时手动调用 recovery hook 重置

---

## 重要约定

- 包管理：**pnpm**（不用 npm/yarn）
- 数据库：PostgreSQL（Drizzle adapter）
- Lint+Format：Biome（不用 ESLint/Prettier）
- Server Actions body 限制 10MB
- 图像生成走轮询（**不是 streaming**）
- 路由结构带 `[locale]` 段，但已锁定为 `zh`
- 认证：Better Auth（**不是 NextAuth**）
- 支付：**zpay**（**不是 Stripe**）；webhook 端点须正确配置签名

---

## 相关资源

- 项目计划与重构路线：`/Users/demon/.claude/plans/abundant-sparking-lampson.md`
- Better Auth 文档：https://www.better-auth.com/docs
- zpay 文档：参见 `src/payment/provider/zpay.ts` 内联注释
- Gemini API 文档：https://ai.google.dev/
- Duomi API 文档：https://duomiapi.com/

---

## 架构债务清单（参考重构计划）

以下问题已识别并安排修复时间表，详见 `/Users/demon/.claude/plans/abundant-sparking-lampson.md`：

| 优先级 | 问题 | 计划修复 |
|---|---|---|
| ~~CRITICAL~~ | ~~`holdCredits` 并发缝隙~~ | 已修复（Week 1） |
| ~~CRITICAL~~ | ~~Lifetime webhook 月度积分错发~~ | 已修复（Week 1） |
| ~~CRITICAL~~ | ~~文档与代码失同步~~ | 已修复（Week 1） |
| ~~CRITICAL~~ | ~~缺生产错误监控 (Sentry)~~ | 已取消 — 看部署平台自带日志即可 |
| HIGH | `busyProjectId` 防护失效 | Week 2 |
| HIGH | 双 store `currentProjectId` 不同步 | Week 2 |
| ~~HIGH~~ | ~~`MessageItem.tsx` 重复代码~~ | 已修复（Week 5，提取 `ImageActionRow`） |
| HIGH | Admin bypass 无审计 | Week 2 |
| HIGH | CI 不跑 lint/typecheck/build | Week 3 |
| HIGH | 无 E2E、无真 DB 集成测试 | Week 3 |
| ~~MEDIUM~~ | ~~`/ai/image` 默默恢复上次项目~~ | 已修复（Week 5，见"工作台入口策略"） |
| ~~MEDIUM~~ | ~~新建项目时短暂 skeleton 闪烁~~ | 已修复（Week 5，temp→real ID 跳过 refetch） |
