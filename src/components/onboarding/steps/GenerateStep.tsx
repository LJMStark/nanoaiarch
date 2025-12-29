'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useOnboardingStore } from '@/stores/onboarding-store';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRef, useState } from 'react';

// API 响应类型
interface GenerateImageResponse {
  image?: string;
  text?: string;
  error?: string;
  creditsUsed?: number;
}

// 对话消息类型
interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // base64
}

export function GenerateStep() {
  const t = useTranslations('Onboarding');
  const { toast } = useToast();
  const {
    prevStep,
    nextStep,
    selectedTemplateName,
    isGenerating,
    setIsGenerating,
    generatedImageUrl,
    setGeneratedImage,
  } = useOnboardingStore();

  // 初始生成状态
  const [prompt, setPrompt] = useState(t('generate.defaultPrompt'));
  const [error, setError] = useState<string | null>(null);

  // 对话式编辑状态
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null); // base64
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);

  // 初始生成
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          modelId: 'forma',
        }),
      });

      const data: GenerateImageResponse = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 402) {
          setError(t('generate.insufficientCredits'));
        } else if (response.status === 401) {
          setError(t('generate.unauthorized'));
        } else {
          setError(data.error || t('generate.error'));
        }
        setIsGenerating(false);
        return;
      }

      if (data.image) {
        setCurrentImage(data.image);
        setGeneratedImage(`data:image/png;base64,${data.image}`);
        setHasGenerated(true);

        // 初始化对话历史
        setMessages([
          { role: 'user', content: prompt.trim() },
          {
            role: 'model',
            content: data.text || 'Image generated',
            image: data.image,
          },
        ]);

        toast({
          title: t('generate.success'),
          description: data.creditsUsed
            ? t('generate.creditsUsed', { credits: data.creditsUsed })
            : undefined,
        });
      } else {
        setError(t('generate.noImage'));
      }
    } catch {
      setError(t('generate.error'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 对话式编辑
  const handleEdit = async () => {
    if (!editPrompt.trim() || !currentImage) return;

    setIsEditing(true);
    setError(null);

    // 构建对话历史（包含当前图像）
    const editMessages: ConversationMessage[] = [
      ...messages,
      { role: 'user', content: editPrompt.trim() },
    ];

    try {
      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: editMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            image: msg.image,
          })),
          modelId: 'forma',
        }),
      });

      const data: GenerateImageResponse = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 402) {
          setError(t('generate.insufficientCredits'));
        } else {
          setError(data.error || t('generate.editError'));
        }
        setIsEditing(false);
        return;
      }

      if (data.image) {
        setCurrentImage(data.image);
        setGeneratedImage(`data:image/png;base64,${data.image}`);

        // 更新对话历史
        setMessages([
          ...editMessages,
          {
            role: 'model',
            content: data.text || 'Image edited',
            image: data.image,
          },
        ]);

        setEditPrompt('');
        toast({
          title: t('generate.editSuccess'),
          description: data.creditsUsed
            ? t('generate.creditsUsed', { credits: data.creditsUsed })
            : undefined,
        });
      } else {
        setError(t('generate.noImage'));
      }
    } catch {
      setError(t('generate.editError'));
    } finally {
      setIsEditing(false);
    }
  };

  // 重新生成
  const handleRegenerate = () => {
    setHasGenerated(false);
    setCurrentImage(null);
    setMessages([]);
    setEditPrompt('');
  };

  // 完成并进入下一步
  const handleComplete = () => {
    nextStep();
  };

  // 按 Enter 发送编辑
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isEditing) {
      e.preventDefault();
      handleEdit();
    }
  };

  // 未生成状态：显示初始 prompt 输入
  if (!hasGenerated) {
    return (
      <div className="flex flex-col px-6 py-4">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold mb-2">{t('generate.title')}</h2>
          <p className="text-muted-foreground">
            {selectedTemplateName
              ? t('generate.descriptionWithTemplate', {
                  template: selectedTemplateName,
                })
              : t('generate.description')}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('generate.promptLabel')}
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('generate.promptPlaceholder')}
              className="min-h-[100px] resize-none"
              disabled={isGenerating}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={isGenerating}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('generate.back')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1 gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('generate.generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('generate.generate')}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // 已生成状态：显示图像 + 对话式编辑
  return (
    <div className="flex flex-col px-6 py-4">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold mb-2">{t('generate.editTitle')}</h2>
        <p className="text-muted-foreground">{t('generate.editDescription')}</p>
      </div>

      {/* 生成的图像 */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-4">
        {currentImage && (
          <Image
            src={`data:image/png;base64,${currentImage}`}
            alt="Generated image"
            fill
            className="object-cover"
          />
        )}
        {isEditing && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('generate.editing')}
            </div>
          </div>
        )}
      </div>

      {/* 对话编辑输入 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('generate.chatLabel')}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            ref={editInputRef}
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder={t('generate.editPlaceholder')}
            disabled={isEditing}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleEdit}
            disabled={isEditing || !editPrompt.trim()}
          >
            {isEditing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t('generate.editHint')}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg mb-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={isEditing}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t('generate.regenerate')}
        </Button>
        <Button
          onClick={handleComplete}
          disabled={isEditing}
          className="flex-1 gap-2"
        >
          <Check className="h-4 w-4" />
          {t('generate.complete')}
        </Button>
      </div>
    </div>
  );
}
