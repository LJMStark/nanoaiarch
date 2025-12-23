'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Coins,
  Download,
  Loader2,
  LogIn,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useImageGeneration } from '../hooks/use-image-generation';
import { imageHelpers } from '../lib/image-helpers';
import type { Suggestion } from '../lib/suggestions';
import { EditHistory } from './EditHistory';
import { ImageUploader } from './ImageUploader';
import { ModeSwitcher } from './ModeSwitcher';
import { ModelSelector } from './ModelSelector';
import { PromptInput } from './PromptInput';
import { Stopwatch } from './Stopwatch';

export function ImagePlayground({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const {
    image,
    error,
    timing,
    isLoading,
    activePrompt,
    mode,
    selectedModel,
    referenceImage,
    editHistory,
    lastCreditsUsed,
    creditErrorType,
    setMode,
    setSelectedModel,
    setReferenceImage,
    generateImage,
    editImage,
    resetState,
    clearEditHistory,
    selectHistoryItem,
  } = useImageGeneration();

  const [isZoomed, setIsZoomed] = useState(false);

  // 处理提示词提交
  const handlePromptSubmit = async (prompt: string) => {
    if (mode === 'edit') {
      await editImage(prompt);
    } else {
      await generateImage(prompt);
    }
  };

  // 处理图片下载/分享
  const handleShareOrDownload = async () => {
    if (image?.image) {
      await imageHelpers.shareOrDownload(image.image, 'forma');
    }
  };

  // 处理模式切换
  const handleModeChange = (newMode: typeof mode) => {
    setMode(newMode);
    resetState();
  };

  return (
    <div className="rounded-lg bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* 顶部控制栏 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ModeSwitcher
            mode={mode}
            onModeChange={handleModeChange}
            disabled={isLoading}
          />
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            disabled={isLoading}
            className="sm:w-64"
          />
        </div>

        {/* 编辑模式：图片上传区域 */}
        {mode === 'edit' && (
          <div className="mb-6">
            <ImageUploader
              currentImage={referenceImage ?? undefined}
              onImageSelect={setReferenceImage}
              onImageClear={() => {
                setReferenceImage(null);
                resetState();
              }}
              disabled={isLoading}
            />
          </div>
        )}

        {/* 提示词输入 */}
        <PromptInput
          onSubmit={handlePromptSubmit}
          isLoading={isLoading}
          suggestions={suggestions}
          placeholder={
            mode === 'edit'
              ? 'Describe how you want to edit the image...'
              : 'Describe the image you want to create...'
          }
          disabled={mode === 'edit' && !referenceImage}
        />

        {/* 错误提示 */}
        {error && (
          <Alert
            variant={
              creditErrorType === 'insufficient_credits'
                ? 'default'
                : 'destructive'
            }
            className="mt-4"
          >
            {creditErrorType === 'unauthorized' ? (
              <LogIn className="h-4 w-4" />
            ) : creditErrorType === 'insufficient_credits' ? (
              <Coins className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              {creditErrorType === 'unauthorized' && (
                <Button asChild size="sm" variant="outline" className="ml-4">
                  <Link href="/login">Sign In</Link>
                </Button>
              )}
              {creditErrorType === 'insufficient_credits' && (
                <Button asChild size="sm" variant="outline" className="ml-4">
                  <Link href="/dashboard/billing">Buy Credits</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 生成结果展示 */}
        <div className="mt-8">
          {/* 加载状态 */}
          {isLoading && !image?.image && (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <Stopwatch startTime={timing?.startTime} />
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'edit' ? 'Editing image...' : 'Generating image...'}
              </p>
            </div>
          )}

          {/* 图片展示 */}
          {image?.image && (
            <div className="space-y-4">
              {/* 图片卡片 */}
              <div
                className={cn(
                  'group relative overflow-hidden rounded-lg border bg-muted',
                  'cursor-zoom-in transition-shadow hover:shadow-lg'
                )}
                onClick={() => setIsZoomed(true)}
              >
                <div className="aspect-square relative">
                  <Image
                    src={`data:image/png;base64,${image.image}`}
                    alt={activePrompt || 'Generated image'}
                    fill
                    className="object-contain"
                    priority
                  />

                  {/* 加载中覆盖层 */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareOrDownload();
                      }}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                  </div>

                  {/* 耗时和积分显示 */}
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    {timing?.elapsed && (
                      <div className="rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                        {(timing.elapsed / 1000).toFixed(1)}s
                      </div>
                    )}
                    {lastCreditsUsed && (
                      <div className="flex items-center gap-1 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                        <Coins className="h-3 w-3" />
                        {lastCreditsUsed}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 模型返回的文本描述 */}
              {image.text && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">{image.text}</p>
                </div>
              )}

              {/* 当前提示词 */}
              {activePrompt && (
                <p className="text-center text-sm text-muted-foreground">
                  &ldquo;{activePrompt}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && !image?.image && !error && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {mode === 'edit'
                  ? 'Upload an image and describe your edit'
                  : 'Describe your image'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'edit'
                  ? 'Upload an image above, then describe how you want to modify it'
                  : 'Enter a prompt above to generate an image with AI'}
              </p>
            </div>
          )}
        </div>

        {/* 编辑历史 */}
        {mode === 'edit' && editHistory.length > 0 && (
          <div className="mt-8">
            <EditHistory
              history={editHistory}
              onSelectItem={selectHistoryItem}
              onClearHistory={clearEditHistory}
            />
          </div>
        )}

        {/* 全屏预览模态框 */}
        {isZoomed && image?.image && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
            onClick={() => setIsZoomed(false)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]">
              <Image
                src={`data:image/png;base64,${image.image}`}
                alt={activePrompt || 'Generated image'}
                width={1024}
                height={1024}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            </div>
            <p className="absolute bottom-4 text-sm text-muted-foreground">
              Press Escape or click anywhere to close
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
