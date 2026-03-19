import mongoose, { Schema, type Document } from 'mongoose';

// ---- Roadmap step (embedded) ----
export interface RoadmapStepDoc {
  id: 'topic' | 'supervisor' | 'company';
  label: string;
  description: string;
  status: 'open' | 'committed';
  committedThreadId: string | null;
  committedAt: Date | null;
}

export interface StudentDoc extends Document {
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
  roadmapSteps: RoadmapStepDoc[];
}

const roadmapStepSchema = new Schema<RoadmapStepDoc>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['open', 'committed'], default: 'open' },
    committedThreadId: { type: String, default: null },
    committedAt: { type: Date, default: null },
  },
  { _id: false }
);

const studentSchema = new Schema<StudentDoc>({
  id: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  degree: { type: String, required: true },
  studyProgramId: { type: String, required: true },
  universityId: { type: String, required: true },
  skills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  about: { type: String, default: null },
  objectives: { type: [String], default: [] },
  fieldIds: { type: [String], default: [] },
  aiTags: { type: [String], default: [] },
  roadmapSteps: { type: [roadmapStepSchema], default: [] },
});

export const Student = mongoose.model<StudentDoc>('Student', studentSchema);

// Default roadmap steps factory
export function defaultRoadmapSteps(): RoadmapStepDoc[] {
  return [
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
}
