'use client';

import { updateImageProject } from '@/actions/image-project';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import LocaleSwitcher from '@/components/layout/locale-switcher';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcher } from '@/components/layout/mode-switcher';
import { UserButton } from '@/components/layout/user-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSidebar } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { LocaleLink } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { useProjectStore } from '@/stores/project-store';
import { Check, Edit2, PanelLeftIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function ConversationHeader() {
  const t = useTranslations('ArchPage');
  const ct = useTranslations('Common');
  const { toggleSidebar, state } = useSidebar();
  const { projects, currentProjectId, updateProject } = useProjectStore();
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;

  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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
      {/* Left: Logo + Sidebar Toggle */}
      <LocaleLink
        href="/"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <Logo className="h-6 w-6" />
      </LocaleLink>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
      >
        <PanelLeftIcon className="h-4 w-4" />
      </Button>

      {/* Center: Project Title */}
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

      {/* Right: Stats + Navigation Tools */}
      {currentProject && (
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span>{currentProject.generationCount} generations</span>
          <span>·</span>
          <span>{currentProject.totalCreditsUsed} credits</span>
        </div>
      )}

      <div className="flex items-center gap-2 ml-2">
        <LocaleSwitcher />
        <ModeSwitcher />
        {!mounted || isPending ? (
          <Skeleton className="size-8 border rounded-full" />
        ) : currentUser ? (
          <UserButton user={currentUser} />
        ) : (
          <div className="flex items-center gap-2">
            <LoginWrapper mode="modal" asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                {ct('login')}
              </Button>
            </LoginWrapper>
            <LocaleLink
              href={Routes.Register}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'hidden sm:inline-flex'
              )}
            >
              {ct('signUp')}
            </LocaleLink>
          </div>
        )}
      </div>
    </header>
  );
}
