import {
  Banner,
  DynamicCodeBlock,
  File,
  Files,
  Folder,
  ImageZoom,
  InlineTOC,
} from '@/components/docs/lazy';
import BannerImage from '@/public/images/docs/banner.png';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card } from 'fumadocs-ui/components/card';
import { Heading } from 'fumadocs-ui/components/heading';
import { RootToggle } from 'fumadocs-ui/components/layout/root-toggle';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Home } from 'lucide-react';
import type { ReactNode } from 'react';
import { Wrapper } from './wrapper';

export function heading(): ReactNode {
  return (
    <Wrapper>
      <div className="rounded-lg bg-fd-background p-4 prose-no-margin">
        <Heading id="preview" as="h3">
          示例标题
        </Heading>
        <Heading id="preview" as="h3">
          你好，<code>世界</code>。
        </Heading>
      </div>
    </Wrapper>
  );
}

export function card(): ReactNode {
  return (
    <Wrapper>
      <div className="rounded-lg bg-fd-background">
        <Card
          href="#"
          icon={<Home />}
          title="示例卡片"
          description="了解缓存与重新验证"
        />
      </div>
    </Wrapper>
  );
}

export function tabs(): ReactNode {
  return (
    <Wrapper>
      <div className="space-y-4 rounded-xl bg-fd-background p-4 text-sm">
        <Tabs
          groupId="language"
          persist
          items={['Javascript', 'Rust', 'Typescript']}
        >
          <Tab value="Javascript">Javascript 示例</Tab>
          <Tab value="Rust">Rust 示例</Tab>
          <Tab value="Typescript">不同标签内容也可以正常工作</Tab>
        </Tabs>

        <Tabs groupId="language" persist items={['Javascript', 'Rust']}>
          <Tab value="Javascript">选中项会共享，刷新后仍会保留</Tab>
          <Tab value="Rust">选中项会共享，刷新后仍会保留</Tab>
        </Tabs>
      </div>
    </Wrapper>
  );
}

export function typeTable(): ReactNode {
  return (
    <Wrapper>
      <div className="rounded-xl bg-fd-background">
        <TypeTable
          type={{
            percentage: {
              description: '显示滚动按钮所需的滚动位置比例',
              type: 'number',
              default: '0.2',
            },
          }}
        />
      </div>
    </Wrapper>
  );
}

export function zoomImage(): ReactNode {
  return (
    <Wrapper>
      <ImageZoom
        alt="文档横幅"
        src={BannerImage}
        className="!my-0 rounded-xl bg-fd-background"
        priority
      />
    </Wrapper>
  );
}

export function accordion(): ReactNode {
  return (
    <Wrapper>
      <Accordions type="single" collapsible>
        <Accordion id="what-is-fumadocs" title="Fumadocs 是什么？">
          一个用于构建文档站点的框架
        </Accordion>
        <Accordion id="ux" title="我们重视什么？">
          我们重视体验顺手的网站
        </Accordion>
      </Accordions>
    </Wrapper>
  );
}

export function callout(): ReactNode {
  return (
    <Wrapper>
      <Callout title="提示">示例内容</Callout>
    </Wrapper>
  );
}

export function files(): ReactNode {
  return (
    <Wrapper>
      <Files>
        <Folder name="app" defaultOpen>
          <Folder name="[id]" defaultOpen>
            <File name="page.tsx" />
          </Folder>
          <File name="layout.tsx" />
          <File name="page.tsx" />
          <File name="global.css" />
        </Folder>
        <Folder name="components">
          <File name="button.tsx" />
          <File name="tabs.tsx" />
          <File name="dialog.tsx" />
          <Folder name="empty" />
        </Folder>
        <File name="package.json" />
      </Files>
    </Wrapper>
  );
}

export function inlineTOC(): ReactNode {
  return (
    <Wrapper>
      <InlineTOC
        items={[
          { title: '欢迎', url: '#welcome', depth: 2 },
          { title: '入门', url: '#getting-started', depth: 3 },
          { title: '用法', url: '#usage', depth: 3 },
          { title: '样式', url: '#styling', depth: 3 },
          { title: '参考', url: '#reference', depth: 2 },
          { title: '组件', url: '#components', depth: 3 },
          { title: 'APIs', url: '#api', depth: 3 },
          { title: '致谢', url: '#credits', depth: 2 },
        ]}
      />
    </Wrapper>
  );
}

export function steps(): ReactNode {
  return (
    <Wrapper>
      <div className="rounded-xl bg-fd-background p-3">
        <Steps>
          <Step>
            <h4>购买咖啡</h4>
            <p>这里是一段示例文字</p>
          </Step>
          <Step>
            <h4>前往办公室</h4>
            <p>这里是一段示例文字</p>
          </Step>
          <Step>
            <h4>参加会议</h4>
            <p>这里是一段示例文字</p>
          </Step>
        </Steps>
      </div>
    </Wrapper>
  );
}

export function rootToggle(): ReactNode {
  return (
    <Wrapper>
      <div className="not-prose mx-auto grid max-w-[240px] rounded-lg bg-fd-background">
        <RootToggle
          className="p-3"
          options={[
            {
              title: '示例页面',
              description: '根切换器的示例项目',
              url: '/docs/ui',
            },
            {
              title: '其他页面',
              description: '根切换器的示例项目',
              url: '/docs/headless',
            },
          ]}
        />
      </div>
    </Wrapper>
  );
}

export function dynamicCodeBlock() {
  return (
    <Wrapper>
      <DynamicCodeBlock />
    </Wrapper>
  );
}

export function banner(): ReactNode {
  return (
    <Wrapper>
      <div className="flex flex-col gap-4">
        <Banner className="z-0" changeLayout={false}>
          注意，Fumadocs v99 已发布
        </Banner>

        <Banner
          className="z-0"
          id="test-rainbow"
          variant="rainbow"
          changeLayout={false}
        >
          使用 <code>rainbow</code> 变体
        </Banner>

        <Banner className="z-0" id="test" changeLayout={false}>
          注意，这条横幅可以关闭
        </Banner>
      </div>
    </Wrapper>
  );
}
