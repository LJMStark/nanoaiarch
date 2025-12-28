'use client';

import type { ProjectMessageItem } from '@/actions/project-message';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Download,
  Edit3,
  RefreshCw,
  Share2,
  Sparkles,
  User,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface MessageItemProps {
  message: ProjectMessageItem;
  isLast: boolean;
}

export function MessageItem({ message, isLast }: MessageItemProps) {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }
  return <AssistantMessage message={message} isLast={isLast} />;
}

function UserMessage({ message }: { message: ProjectMessageItem }) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-muted">
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.inputImage && (
          <div className="relative w-48 aspect-square rounded-lg overflow-hidden border">
            <Image
              src={`data:image/png;base64,${message.inputImage}`}
              alt="Reference image"
              fill
              className="object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  isLast,
}: {
  message: ProjectMessageItem;
  isLast: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isFailed = message.status === 'failed';

  const handleDownload = () => {
    if (!message.outputImage) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${message.outputImage}`;
    link.download = `generation-${message.id}.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!message.outputImage) return;

    try {
      // Convert base64 to blob
      const response = await fetch(
        `data:image/png;base64,${message.outputImage}`
      );
      const blob = await response.blob();
      const file = new File([blob], 'generation.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AI Generated Image',
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0 bg-primary">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3 min-w-0">
        {isFailed ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              {message.errorMessage || 'Generation failed'}
            </span>
          </div>
        ) : message.outputImage ? (
          <div
            className="relative group max-w-lg"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative rounded-xl overflow-hidden border bg-muted">
              <Image
                src={`data:image/png;base64,${message.outputImage}`}
                alt="Generated image"
                width={512}
                height={512}
                className="w-full h-auto"
              />

              {/* Hover overlay with actions */}
              <div
                className={cn(
                  'absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleDownload}
                        className="h-10 w-10"
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleShare}
                        className="h-10 w-10"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share</TooltipContent>
                  </Tooltip>

                  {isLast && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10"
                        >
                          <Edit3 className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>

            {/* Generation info */}
            {message.generationTime && (
              <div className="mt-1 text-xs text-muted-foreground">
                Generated in {(message.generationTime / 1000).toFixed(1)}s
                {message.creditsUsed && ` · ${message.creditsUsed} credits`}
              </div>
            )}
          </div>
        ) : null}

        {message.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}
