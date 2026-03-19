import type { RoadmapStep } from '@/types';

// Default 3-step dynamic checklist — all start open, completable in any order
export const INITIAL_ROADMAP_STEPS: RoadmapStep[] = [
  {
    id: 'topic',
    label: 'Find a Topic',
    description: 'Choose a research question that anchors your thesis.',
    status: 'open',
    committedThreadId: null,
    committedAt: null,
  },
  {
    id: 'supervisor',
    label: 'Find a Supervisor',
    description: 'Secure an academic guide who will evaluate your work.',
    status: 'open',
    committedThreadId: null,
    committedAt: null,
  },
  {
    id: 'company',
    label: 'Find a Company',
    description: 'Partner with a company for real-world data and context.',
    status: 'open',
    committedThreadId: null,
    committedAt: null,
  },
];
