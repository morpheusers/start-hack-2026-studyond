import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fetchStudent, fetchThreads } from '@/api';

const DEMO_STUDENT_ID = 'student-01';

/**
 * On app mount: fetch the student profile + threads from MongoDB and hydrate
 * the Zustand store. Falls back to localStorage data if the API is unavailable.
 */
export function useInitializeApp() {
  const { hydrateFromDB, profile } = useAppStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        const [student, threads] = await Promise.all([
          fetchStudent(DEMO_STUDENT_ID),
          fetchThreads(DEMO_STUDENT_ID),
        ]);

        hydrateFromDB({
          profile: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            degree: student.degree as 'bsc' | 'msc' | 'phd',
            // Display-only fields — keep from existing store if not in DB
            university: profile.university,
            studyProgram: profile.studyProgram,
            studyProgramId: student.studyProgramId,
            universityId: student.universityId,
            skills: student.skills,
            interests: student.interests.length > 0 ? student.interests : profile.interests,
            about: student.about ?? profile.about,
            objectives: student.objectives,
          },
          profileTags: student.aiTags.length > 0 ? student.aiTags : undefined,
          savedThreads: threads.map((t) => ({
            ...t,
            // Ensure Date objects (JSON deserialization gives strings)
            lastActivity: new Date(t.lastActivity),
            closedAt: t.closedAt ? new Date(t.closedAt) : null,
            messages: t.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          })),
          roadmapSteps: student.roadmapSteps.map((s) => ({
            ...s,
            committedAt: s.committedAt ? new Date(s.committedAt) : null,
          })),
        });

        console.log('[App] Hydrated from MongoDB');
      } catch (err) {
        console.warn('[App] Could not reach API, using localStorage state:', err);
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
