'use client';

import { updateImageProject } from '@/actions/image-project';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { Check, Edit2, PanelLeftIcon, Settings2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function ConversationHeader() {
  const t = useTranslations('ArchPage');
  const { toggleSidebar, state } = useSidebar();
  const { projects, currentProjectId, updateProject } = useProjectStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleStartEdit = () => {
    setEditTitle(currentProject?.title ?? 'Untitled');
    setIsEditing(true);
  };

  const handleSaveTitle = async () => {
    if (!currentProjectId || !editTitle.trim()) {
      setIsEditing(false);
      return;
    }

    const result = await updateImageProject(currentProjectId, {
      title: editTitle.trim(),
    });

    if (result.success) {
      updateProject(currentProjectId, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <header className="flex items-center gap-2 h-14 border-b px-4 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
      >
        <PanelLeftIcon className="h-4 w-4" />
      </Button>

      <div className="flex-1 flex items-center gap-2">
        {currentProject ? (
          isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveTitle}
                className="h-7 w-48 text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleSaveTitle}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCancelEdit}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors group"
            >
              <span className="font-medium text-sm">
                {currentProject.title}
              </span>
              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )
        ) : (
          <span className="text-sm text-muted-foreground">
            Select or create a project
          </span>
        )}
      </div>

      {currentProject && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{currentProject.generationCount} generations</span>
          <span>·</span>
          <span>{currentProject.totalCreditsUsed} credits</span>
        </div>
      )}
    </header>
  );
}
