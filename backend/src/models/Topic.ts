import mongoose, { Schema, type Document } from 'mongoose';

export interface TopicDoc extends Document {
  id: string;
  title: string;
  description: string;
  type: string;
  employment: string;
  employmentType: string | null;
  workplaceType: string | null;
  degrees: string[];
  fieldIds: string[];
  companyId: string | null;
  universityId: string | null;
  supervisorIds: string[];
  expertIds: string[];
}

const topicSchema = new Schema<TopicDoc>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  employment: { type: String, default: 'open' },
  employmentType: { type: String, default: null },
  workplaceType: { type: String, default: null },
  degrees: { type: [String], default: [] },
  fieldIds: { type: [String], default: [] },
  companyId: { type: String, default: null },
  universityId: { type: String, default: null },
  supervisorIds: { type: [String], default: [] },
  expertIds: { type: [String], default: [] },
});

// Text index for semantic search — title weighted higher
topicSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 3, description: 1 } }
);

export const Topic = mongoose.model<TopicDoc>('Topic', topicSchema);
