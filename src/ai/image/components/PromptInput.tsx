'use client';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { type Suggestion, getRandomSuggestions } from '../lib/suggestions';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  suggestions: Suggestion[];
  placeholder?: string;
  disabled?: boolean;
}

export function PromptInput({
  suggestions: initSuggestions,
  isLoading,
  onSubmit,
  placeholder = 'Enter your prompt here',
  disabled = false,
}: PromptInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initSuggestions);

  const updateSuggestions = () => {
    setSuggestions(getRandomSuggestions());
  };

  const handleSuggestionSelect = (prompt: string) => {
    setInput(prompt);
  };

  const handleSubmit = () => {
    if (!isLoading && !disabled && input.trim()) {
      onSubmit(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !disabled && input.trim()) {
        onSubmit(input);
      }
    }
  };

  return (
    <div className="w-full mb-8">
      <div className="bg-card rounded-xl p-4">
        <div className="flex flex-col gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={3}
            disabled={disabled || isLoading}
            className={cn(
              'text-base bg-transparent border-muted p-2 resize-none placeholder:text-muted-foreground text-foreground focus-visible:ring-0 focus-visible:ring-offset-0',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center justify-between space-x-2">
              {/* 刷新建议按钮 */}
              <button
                type="button"
                onClick={updateSuggestions}
                disabled={disabled}
                className="flex items-center justify-between cursor-pointer px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground group-hover:opacity-70" />
              </button>
              {/* 建议提示词 */}
              {suggestions.map((suggestion, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion.prompt)}
                  disabled={disabled}
                  className={cn(
                    'flex items-center justify-between cursor-pointer px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                    index > 2
                      ? 'hidden md:flex'
                      : index > 1
                        ? 'hidden sm:flex'
                        : ''
                  )}
                >
                  <span>
                    <span className="text-foreground text-xs sm:text-sm">
                      {suggestion.text.toLowerCase()}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-1 h-2 w-2 sm:h-3 sm:w-3 text-muted-foreground group-hover:opacity-70" />
                </button>
              ))}
            </div>
            {/* 提交按钮 */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || disabled || !input.trim()}
              className="h-8 w-8 cursor-pointer rounded-full bg-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 text-primary-foreground animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5 text-primary-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
