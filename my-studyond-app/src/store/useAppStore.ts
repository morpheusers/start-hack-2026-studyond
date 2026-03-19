import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StudentProfile,
  MatchCard,
  Thread,
  ThreadMessage,
  RoadmapStep,
  RoadmapStepId,
} from '@/types';
import { MOCK_STUDENT, MOCK_PROFILE_TAGS } from '@/data/mockStudent';
import { INITIAL_ROADMAP_STEPS } from '@/data/roadmapSteps';

// ---- Helper: compute initials from name ----
function getInitials(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---- Helper: enrich a card with frontend-only initials ----
function enrichCard(card: MatchCard): MatchCard {
  return card.initials ? card : { ...card, initials: getInitials(card.name) };
}

// ---- Store interface ----

interface AppState {
  // ---- Student Profile ----
  profile: StudentProfile;
  profileTags: string[];

  // ---- Chatbot ----
  swipeDeck: MatchCard[];
  deckVisible: boolean;

  // ---- Saved Threads (DM inbox) ----
  savedThreads: Thread[];

  // ---- Roadmap ----
  roadmapSteps: RoadmapStep[];

  // ---- UI State ----
  hasExploredTopics: boolean;

  // ---- Actions ----

  // Profile
  updateProfile: (data: Partial<StudentProfile>) => void;
  setProfileTags: (tags: string[]) => void;

  // Swipe deck
  setSwipeDeck: (cards: MatchCard[]) => void;
  setDeckVisible: (visible: boolean) => void;

  // Threads
  saveThread: (card: MatchCard) => void;
  removeThread: (threadId: string) => void;
  addMessageToThread: (threadId: string, message: ThreadMessage) => void;
  markThreadRead: (threadId: string) => void;

  // Commit / Uncommit — new dynamic model
  commitToThread: (threadId: string, stepId: RoadmapStepId) => void;
  uncommitThread: (threadId: string) => void;

  // Roadmap
  setRoadmapSteps: (steps: RoadmapStep[]) => void;
  hydrateFromDB: (data: {
    profile?: StudentProfile;
    profileTags?: string[];
    savedThreads?: Thread[];
    roadmapSteps?: RoadmapStep[];
  }) => void;

  // Helpers
  getThread: (threadId: string) => Thread | undefined;
  getCommittedThreadIds: () => string[];
  buildSystemContext: () => string;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ---- Initial State ----
      profile: MOCK_STUDENT,
      profileTags: MOCK_PROFILE_TAGS,
      swipeDeck: [],
      deckVisible: false,
      savedThreads: [],
      roadmapSteps: INITIAL_ROADMAP_STEPS,
      hasExploredTopics: false,

      // ---- Profile Actions ----
      updateProfile: (data) =>
        set((state) => ({ profile: { ...state.profile, ...data } })),

      setProfileTags: (tags) => set({ profileTags: tags }),

      // ---- Swipe Deck Actions ----
      setSwipeDeck: (cards) =>
        set({ swipeDeck: cards.map(enrichCard), deckVisible: cards.length > 0 }),

      setDeckVisible: (visible) => set({ deckVisible: visible }),

      // ---- Thread Actions ----
      saveThread: (card) => {
        const state = get();
        const enriched = enrichCard(card);

        // Don't duplicate
        if (state.savedThreads.find((t) => t.id === enriched.id)) return;

        const thread: Thread = {
          id: enriched.id,
          card: enriched,
          messages: [
            {
              id: `msg-init-${enriched.id}`,
              role: 'assistant',
              content: `Hi! I'm here to help you explore the thesis opportunity with **${enriched.name}**.${
                enriched.topicTitle ? ` The topic is: *${enriched.topicTitle}*.` : ''
              }\n\nFeel free to ask me anything — about the research scope, what skills you'd need, how to reach out, or whether it fits your timeline.`,
              timestamp: new Date(),
            },
          ],
          lastActivity: new Date(),
          isRead: false,
          closedStepId: null,
          closedAt: null,
        };

        set((state) => ({ savedThreads: [thread, ...state.savedThreads] }));
      },

      removeThread: (threadId) =>
        set((state) => {
          const thread = state.savedThreads.find((t) => t.id === threadId);
          // If this thread closed a roadmap step, reopen it
          let roadmapSteps = state.roadmapSteps;
          if (thread?.closedStepId) {
            roadmapSteps = roadmapSteps.map((s) =>
              s.id === thread.closedStepId
                ? { ...s, status: 'open' as const, committedThreadId: null, committedAt: null }
                : s
            );
          }
          return {
            savedThreads: state.savedThreads.filter((t) => t.id !== threadId),
            roadmapSteps,
          };
        }),

      addMessageToThread: (threadId, message) =>
        set((state) => ({
          savedThreads: state.savedThreads.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, message], lastActivity: new Date() }
              : t
          ),
        })),

      markThreadRead: (threadId) =>
        set((state) => ({
          savedThreads: state.savedThreads.map((t) =>
            t.id === threadId ? { ...t, isRead: true } : t
          ),
        })),

      // Commit thread to a roadmap step
      commitToThread: (threadId, stepId) => {
        const now = new Date();
        set((state) => {
          // If this step is already committed by another thread, uncommit that first
          const previousCommit = state.savedThreads.find(
            (t) => t.closedStepId === stepId && t.id !== threadId
          );

          return {
            roadmapSteps: state.roadmapSteps.map((s) =>
              s.id === stepId
                ? { ...s, status: 'committed' as const, committedThreadId: threadId, committedAt: now }
                : s
            ),
            savedThreads: state.savedThreads.map((t) => {
              if (t.id === threadId) return { ...t, closedStepId: stepId, closedAt: now };
              if (previousCommit && t.id === previousCommit.id) return { ...t, closedStepId: null, closedAt: null };
              return t;
            }),
          };
        });
      },

      // Cascade uncommit: revert this thread AND all threads committed after it
      uncommitThread: (threadId) => {
        set((state) => {
          const thread = state.savedThreads.find((t) => t.id === threadId);
          if (!thread?.closedAt) return {};

          const closedAt = thread.closedAt;

          // Collect all threads committed at or after this one
          const toUncommit = state.savedThreads.filter(
            (t) => t.closedStepId !== null && t.closedAt && t.closedAt >= closedAt
          );
          const stepIdsToRevert = new Set(toUncommit.map((t) => t.closedStepId).filter(Boolean));
          const threadIdsToRevert = new Set(toUncommit.map((t) => t.id));

          return {
            roadmapSteps: state.roadmapSteps.map((s) =>
              stepIdsToRevert.has(s.id)
                ? { ...s, status: 'open' as const, committedThreadId: null, committedAt: null }
                : s
            ),
            savedThreads: state.savedThreads.map((t) =>
              threadIdsToRevert.has(t.id) ? { ...t, closedStepId: null, closedAt: null } : t
            ),
          };
        });
      },

      // ---- Roadmap Actions ----
      setRoadmapSteps: (steps) => set({ roadmapSteps: steps }),

      // Hydrate from DB — called on app init, overrides localStorage
      hydrateFromDB: ({ profile, profileTags, savedThreads, roadmapSteps }) => {
        set((_state) => ({
          ...(profile && { profile }),
          ...(profileTags && { profileTags }),
          ...(savedThreads && { savedThreads: savedThreads.map((t) => ({ ...t, card: enrichCard(t.card) })) }),
          ...(roadmapSteps && { roadmapSteps }),
        }));
      },

      // ---- Helpers ----
      getThread: (threadId) => get().savedThreads.find((t) => t.id === threadId),

      getCommittedThreadIds: () =>
        get()
          .roadmapSteps.filter((s) => s.status === 'committed' && s.committedThreadId)
          .map((s) => s.committedThreadId!),

      buildSystemContext: () => {
        const { profile, profileTags, roadmapSteps, savedThreads } = get();

        const committedSteps = roadmapSteps
          .filter((s) => s.status === 'committed' && s.committedThreadId)
          .map((s) => {
            const thread = savedThreads.find((t) => t.id === s.committedThreadId);
            const detail = thread?.card.topicTitle
              ? `"${thread.card.topicTitle}" via ${thread.card.name}`
              : thread?.card.name ?? s.committedThreadId;
            return `  ✓ ${s.label}: ${detail}`;
          });

        const openSteps = roadmapSteps
          .filter((s) => s.status === 'open')
          .map((s) => `  ○ ${s.label}`);

        return `## Student Profile
Name: ${profile.firstName} ${profile.lastName}
Degree: ${profile.degree.toUpperCase()} · ${profile.studyProgram} at ${profile.university}
Email: ${profile.email}

Skills: ${profile.skills.join(', ')}
Interests: ${profile.interests.join(', ')}
AI Profile Tags: ${profileTags.join(', ')}

About: ${profile.about}
Objectives: ${profile.objectives.join(', ')}${
  committedSteps.length > 0
    ? `\n\n## Thesis Decisions (committed)\n${committedSteps.join('\n')}`
    : ''
}${
  openSteps.length > 0
    ? `\n\n## Still Searching\n${openSteps.join('\n')}`
    : ''
}`;
      },
    }),
    {
      name: 'studyond-app-state',
      partialize: (state) => ({
        profile: state.profile,
        profileTags: state.profileTags,
        savedThreads: state.savedThreads,
        roadmapSteps: state.roadmapSteps,
        hasExploredTopics: state.hasExploredTopics,
      }),
    }
  )
);
