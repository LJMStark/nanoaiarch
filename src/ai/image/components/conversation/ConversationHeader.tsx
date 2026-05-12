'use client';

import { updateImageProjectRequest } from '@/ai/image/lib/workspace-client';
import { LoginWrapper } from '@/components/auth/login-wrapper';
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
import { useEffect, useRef, useState } from 'react';

// Track whether the next blur on the input should skip the auto-save.
// Cancel/Esc set this to 'cancel' so the upcoming (or already-fired) blur is a no-op.
// Save sets this to 'save' so blur doesn't double-submit when the user clicks Save.
type PendingAction = 'cancel' | 'save' | null;

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
  const [isSaving, setIsSaving] = useState(false);
  // Snapshot of the title at edit-start so we can detect "no change" and rollback on failure.
  const originalTitleRef = useRef<string>('');
  const pendingActionRef = useRef<PendingAction>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleStartEdit = () => {
    const initial = currentProject?.title ?? t('projects.untitled');
    originalTitleRef.current = initial;
    pendingActionRef.current = null;
    setEditTitle(initial);
    setIsEditing(true);
  };

  const exitEditMode = () => {
    pendingActionRef.current = null;
    setIsEditing(false);
  };

  const handleSaveTitle = async () => {
    if (!currentProjectId) {
      exitEditMode();
      return;
    }

    const trimmed = editTitle.trim();

    // Empty title => treat as cancel (preserve original)
    if (!trimmed) {
      setEditTitle(originalTitleRef.current);
      exitEditMode();
      return;
    }

    // No change => skip the network request, just close.
    if (trimmed === originalTitleRef.current) {
      exitEditMode();
      return;
    }

    // Prevent duplicate submits while a request is in flight.
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateImageProjectRequest(currentProjectId, {
        title: trimmed,
      });

      if (result.success) {
        updateProject(currentProjectId, { title: trimmed });
        exitEditMode();
      } else {
        // Failure rollback: revert to original and keep editor open so the user can retry.
        setEditTitle(originalTitleRef.current);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    pendingActionRef.current = 'cancel';
    setEditTitle(originalTitleRef.current);
    setIsEditing(false);
  };

  const handleBlur = () => {
    // Cancel was clicked (or Esc fired) — do NOT save.
    if (pendingActionRef.current === 'cancel') {
      pendingActionRef.current = null;
      return;
    }
    // Save button already handled it — avoid double submission.
    if (pendingActionRef.current === 'save') {
      pendingActionRef.current = null;
      return;
    }
    // GitHub/Notion behavior: bare blur submits.
    handleSaveTitle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pendingActionRef.current = 'save';
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
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
                onBlur={handleBlur}
                maxLength={200}
                disabled={isSaving}
                className="h-7 w-48 text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isSaving || !editTitle.trim()}
                data-testid="project-title-save"
                aria-label={ct('save')}
                // onMouseDown fires BEFORE the input's blur; mark intent so blur
                // doesn't double-submit, then let onClick run the actual save.
                onMouseDown={() => {
                  pendingActionRef.current = 'save';
                }}
                onClick={handleSaveTitle}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-testid="project-title-cancel"
                aria-label={ct('cancel')}
                // Critical: preventDefault on mousedown stops focus from leaving
                // the input, which prevents the blur->save race. We also run
                // the cancel synchronously here (rather than waiting for click)
                // so the rollback is immediate even if the click is missed.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCancelEdit();
                }}
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
            {t('projects.selectPrompt')}
          </span>
        )}
      </div>

      {/* Right: Stats + Navigation Tools */}
      {currentProject && (
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t('projects.generations', {
              count: currentProject.generationCount,
            })}
          </span>
          <span>·</span>
          <span>
            {t('projects.credits', {
              count: currentProject.totalCreditsUsed,
            })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 ml-2">
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
