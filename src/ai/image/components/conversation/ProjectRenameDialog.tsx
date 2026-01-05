'use client';

import { updateImageProject } from '@/actions/image-project';
import type { ImageProjectItem } from '@/actions/image-project';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ProjectRenameDialogProps {
  project: ImageProjectItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (projectId: string, newTitle: string) => void;
}

export function ProjectRenameDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectRenameDialogProps) {
  const t = useTranslations('ArchPage');
  const ct = useTranslations('Common');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes or project changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && project) {
      setTitle(project.title);
      setError('');
    } else {
      setTitle('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project) return;

    // Validation
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('projects.nameRequired'));
      return;
    }

    if (trimmedTitle.length > 60) {
      setError(t('projects.nameTooLong', { max: 60 }));
      return;
    }

    if (trimmedTitle === project.title) {
      // No change, just close
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await updateImageProject(project.id, {
        title: trimmedTitle,
      });

      if (result.success) {
        onSuccess(project.id, trimmedTitle);
        onOpenChange(false);
      } else {
        setError(result.error || t('projects.renameFailed'));
      }
    } catch (err) {
      setError(t('projects.renameUnexpected'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('projects.renameTitle')}</DialogTitle>
          <DialogDescription>
            {t('projects.renameDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">{t('projects.nameLabel')}</Label>
              <Input
                id="project-name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('projects.namePlaceholder')}
                maxLength={60}
                disabled={isSubmitting}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                {t('projects.characterCount', {
                  count: title.length,
                  max: 60,
                })}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {ct('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('projects.renaming')
                : t('projects.renameAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
