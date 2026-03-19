/**
 * Studyond API client — typed fetch wrappers for all backend endpoints.
 * All calls are relative (proxied by Vite dev server to http://localhost:5000).
 */

import type { StudentProfile, MatchCard, Thread, ThreadMessage, RoadmapStep, RoadmapStepId } from '@/types';

const BASE = '/api';

// ---- Generic fetch helper ----
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---- Student Profile ----

export type DBStudent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  studyProgramId: string;
  universityId: string;
  skills: string[];
  interests: string[];
  about: string | null;
  objectives: string[];
  fieldIds: string[];
  aiTags: string[];
  roadmapSteps: RoadmapStep[];
};

export async function fetchStudent(id: string): Promise<DBStudent> {
  return apiFetch<DBStudent>(`/students/${id}`);
}

export async function updateStudent(
  id: string,
  data: Partial<StudentProfile>
): Promise<DBStudent> {
  return apiFetch<DBStudent>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateStudentTags(id: string, tags: string[]): Promise<{ aiTags: string[] }> {
  return apiFetch(`/students/${id}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });
}

// ---- Threads ----

export async function fetchThreads(studentId: string): Promise<Thread[]> {
  return apiFetch<Thread[]>(`/students/${studentId}/threads`);
}

export async function createThread(studentId: string, card: MatchCard): Promise<Thread> {
  return apiFetch<Thread>(`/students/${studentId}/threads`, {
    method: 'POST',
    body: JSON.stringify({ card }),
  });
}

export async function deleteThread(studentId: string, threadId: string): Promise<void> {
  await apiFetch(`/students/${studentId}/threads/${threadId}`, { method: 'DELETE' });
}

export async function commitThread(
  studentId: string,
  threadId: string,
  stepId: RoadmapStepId
): Promise<{ thread: Thread; roadmapSteps: RoadmapStep[] }> {
  return apiFetch(`/students/${studentId}/threads/${threadId}/commit`, {
    method: 'PATCH',
    body: JSON.stringify({ stepId }),
  });
}

export async function uncommitThread(
  studentId: string,
  threadId: string
): Promise<{ roadmapSteps: RoadmapStep[]; threads: Thread[] }> {
  return apiFetch(`/students/${studentId}/threads/${threadId}/uncommit`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

export async function addThreadMessage(
  studentId: string,
  threadId: string,
  message: { role: 'user' | 'assistant'; content: string }
): Promise<ThreadMessage> {
  return apiFetch<ThreadMessage>(`/students/${studentId}/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export async function markThreadRead(studentId: string, threadId: string): Promise<void> {
  await apiFetch(`/students/${studentId}/threads/${threadId}/read`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

// ---- Tags ----

export async function extractTags(profile: Partial<StudentProfile>): Promise<string[]> {
  const data = await apiFetch<{ tags: string[] }>('/extract-tags', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
  return data.tags ?? [];
}

// ---- Seed (dev) ----

export async function triggerSeed(): Promise<{ ok: boolean; inserted: number; updated: number }> {
  return apiFetch('/seed');
}

// ---- Thread Chat (non-streaming) ----

export interface ThreadContext {
  entityName: string;
  entityType: string;
  topicTitle?: string;
  description: string;
  tags: string[];
  compatibilityScore?: number;
}

export async function sendThreadMessage(
  message: string,
  threadContext: ThreadContext,
  systemContext?: string
): Promise<string> {
  const data = await apiFetch<{ text: string; error?: string }>('/thread-chat', {
    method: 'POST',
    body: JSON.stringify({ message, threadContext, systemContext }),
  });
  if (!data.text) throw new Error(data.error ?? 'Empty response');
  return data.text;
}

export async function generateThreadQuestions(
  threadContext: ThreadContext
): Promise<string[]> {
  const data = await apiFetch<{ questions: string[] }>('/thread-chat', {
    method: 'POST',
    body: JSON.stringify({ suggestQuestions: true, threadContext }),
  });
  return data.questions ?? [];
}
