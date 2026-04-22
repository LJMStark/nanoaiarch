import type { ImageProjectItem } from '@/ai/image/lib/workspace-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../project-store';

function createProject(
  id: string,
  aspectRatio: string | null = '16:9'
): ImageProjectItem {
  const now = new Date('2026-04-22T00:00:00.000Z');

  return {
    id,
    title: `Project ${id}`,
    coverImage: null,
    templateId: null,
    stylePreset: null,
    aspectRatio,
    model: 'forma',
    messageCount: 0,
    generationCount: 0,
    totalCreditsUsed: 0,
    status: 'active',
    isPinned: false,
    lastActiveAt: now,
    createdAt: now,
  };
}

describe('project-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.getState().reset();
  });

  it('keeps auto as the default aspect ratio when selecting an existing project', () => {
    const store = useProjectStore.getState();

    store.setProjects([createProject('project-1', '16:9')]);
    store.selectProject('project-1');

    const nextState = useProjectStore.getState();
    expect(nextState.currentProjectId).toBe('project-1');
    expect(nextState.aspectRatio).toBe('auto');
  });

  it('still applies the template aspect ratio when a template creates or selects a project', () => {
    const store = useProjectStore.getState();

    store.selectProjectWithTemplate('project-1', {
      promptTemplate: 'draw a chair',
      defaultAspectRatio: '3:4',
    });

    const nextState = useProjectStore.getState();
    expect(nextState.currentProjectId).toBe('project-1');
    expect(nextState.aspectRatio).toBe('3:4');
    expect(nextState.draftPrompt).toBe('draw a chair');
  });
});
