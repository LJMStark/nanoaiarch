'use client';

import {
  archiveProject,
  createImageProject,
  deleteImageProject,
  toggleProjectPin,
} from '@/actions/image-project';
import type { ImageProjectItem } from '@/actions/image-project';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import {
  Archive,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProjectRenameDialog } from './ProjectRenameDialog';

export function ProjectSidebar() {
  const t = useTranslations('ArchPage');
  const [isCreating, setIsCreating] = useState(false);
  const [renameProject, setRenameProject] = useState<ImageProjectItem | null>(
    null
  );

  const {
    projects,
    currentProjectId,
    isLoadingProjects,
    addProject,
    updateProject,
    removeProject,
    selectProject,
  } = useProjectStore();

  const { clearMessages } = useConversationStore();

  const pinnedProjects = projects.filter((p) => p.isPinned);
  const recentProjects = projects.filter((p) => !p.isPinned);

  const handleNewProject = async () => {
    setIsCreating(true);
    try {
      const result = await createImageProject();
      if (result.success && result.data) {
        addProject(result.data);
        selectProject(result.data.id);
        clearMessages();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePin = async (
    project: ImageProjectItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const result = await toggleProjectPin(project.id);
    if (result.success) {
      updateProject(project.id, { isPinned: result.isPinned });
    }
  };

  const handleArchive = async (
    project: ImageProjectItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const result = await archiveProject(project.id);
    if (result.success) {
      removeProject(project.id);
    }
  };

  const handleDelete = async (
    project: ImageProjectItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const result = await deleteImageProject(project.id);
    if (result.success) {
      removeProject(project.id);
    }
  };

  const handleRename = (project: ImageProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameProject(project);
  };

  const handleRenameSuccess = (projectId: string, newTitle: string) => {
    updateProject(projectId, { title: newTitle });
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="border-b">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewProject}
                disabled={isCreating}
                tooltip={t('projects.new')}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                <span>{t('projects.new')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {isLoadingProjects ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {pinnedProjects.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Pin className="h-3 w-3 mr-1" />
                    {t('projects.pinned')}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {pinnedProjects.map((project) => (
                        <ProjectListItem
                          key={project.id}
                          project={project}
                          isActive={currentProjectId === project.id}
                          onSelect={() => selectProject(project.id)}
                          onTogglePin={(e) => handleTogglePin(project, e)}
                          onRename={(e) => handleRename(project, e)}
                          onArchive={(e) => handleArchive(project, e)}
                          onDelete={(e) => handleDelete(project, e)}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              <SidebarGroup>
                <SidebarGroupLabel>{t('projects.recent')}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentProjects.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{t('projects.emptyTitle')}</p>
                        <p className="text-xs mt-1">
                          {t('projects.emptyDescription')}
                        </p>
                      </div>
                    ) : (
                      recentProjects.map((project) => (
                        <ProjectListItem
                          key={project.id}
                          project={project}
                          isActive={currentProjectId === project.id}
                          onSelect={() => selectProject(project.id)}
                          onTogglePin={(e) => handleTogglePin(project, e)}
                          onRename={(e) => handleRename(project, e)}
                          onArchive={(e) => handleArchive(project, e)}
                          onDelete={(e) => handleDelete(project, e)}
                        />
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t">
          <div className="p-3 text-xs text-muted-foreground text-center">
            {t('projects.count', { count: projects.length })}
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ProjectRenameDialog
        project={renameProject}
        open={!!renameProject}
        onOpenChange={(open) => !open && setRenameProject(null)}
        onSuccess={handleRenameSuccess}
      />
    </>
  );
}

interface ProjectListItemProps {
  project: ImageProjectItem;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ProjectListItem({
  project,
  isActive,
  onSelect,
  onTogglePin,
  onRename,
  onArchive,
  onDelete,
}: ProjectListItemProps) {
  const t = useTranslations('ArchPage');
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('projects.today');
    if (days === 1) return t('projects.yesterday');
    if (days < 7) return t('projects.daysAgo', { count: days });
    return new Date(date).toLocaleDateString();
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onSelect}
        isActive={isActive}
        tooltip={project.title}
        className="group/item"
      >
        {project.coverImage && typeof project.coverImage === 'string' ? (
          <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0 bg-muted">
            <img
              src={`data:image/png;base64,${project.coverImage}`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement?.classList.add('hidden');
              }}
            />
          </div>
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate flex-1">{project.title}</span>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity">
          {formatDate(project.lastActiveAt)}
        </span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction>
            <MoreHorizontal className="h-4 w-4" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={onTogglePin}>
            <Pin className="h-4 w-4 mr-2" />
            {project.isPinned ? t('projects.unpin') : t('projects.pin')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('projects.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" />
            {t('projects.archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('projects.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
