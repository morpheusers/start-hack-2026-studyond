// ============================================================
// Core domain types for the Studyond Thesis Journey App
// ============================================================

export type Degree = 'bsc' | 'msc' | 'phd';
export type EntityType = 'company' | 'supervisor' | 'topic';

// ---- Student Profile ----

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  degree: Degree;
  university: string;       // display-only — not stored in DB directly
  studyProgram: string;     // display-only — not stored in DB directly
  studyProgramId?: string;
  universityId?: string;
  skills: string[];
  interests: string[];
  about: string;
  objectives: string[];
}

// ---- Match Card (produced by AI swipe deck) ----

export interface MatchCard {
  id: string;
  entityType: EntityType;
  entityId: string;
  name: string;
  subtitle: string;           // company domain, prof title, or topic company name
  imageUrl: string | null;
  compatibilityScore: number; // 1.0–5.0
  description: string;        // 2-3 sentence AI-generated rationale ("why this matches you")
  tags: string[];             // all tags equal, e.g. ["#NLP", "#Hybrid", "#Fintech"]
  topicTitle?: string;        // the actual thesis topic title (for topic-type cards)
  university?: string;        // for supervisor/topic cards
  // Frontend-only computed field — not returned by the API
  initials?: string;
}

// Compute initials from a display name (frontend utility)
export function computeInitials(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---- Roadmap ----

export type RoadmapStepId = 'topic' | 'supervisor' | 'company';
export type RoadmapStepStatus = 'open' | 'committed';

export interface RoadmapStep {
  id: RoadmapStepId;
  label: string;
  description: string;
  status: RoadmapStepStatus;
  committedThreadId: string | null;
  committedAt: Date | null;
}

// ---- Thread (a saved match → becomes a conversation) ----

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Thread {
  id: string;          // same as the MatchCard.id it was created from
  card: MatchCard;
  messages: ThreadMessage[];
  lastActivity: Date;
  isRead: boolean;
  closedStepId: string | null;  // which roadmap step this thread closed; null = not committed
  closedAt: Date | null;        // when committed; null = not committed
}

// Derived helper
export function isThreadCommitted(thread: Thread): boolean {
  return thread.closedStepId !== null;
}

// ---- Chat message (AI SDK compatible) ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ---- AI Response parsing ----

export interface ParsedAIResponse {
  text: string;
  matches: MatchCard[] | null;
}
