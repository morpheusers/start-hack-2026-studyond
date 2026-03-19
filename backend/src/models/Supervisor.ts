import mongoose, { Schema, type Document } from 'mongoose';

export interface SupervisorDoc extends Document {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  universityId: string;
  researchInterests: string[];
  about: string | null;
  objectives: string[];
  fieldIds: string[];
}

const supervisorSchema = new Schema<SupervisorDoc>({
  id: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  title: { type: String, required: true },
  universityId: { type: String, required: true },
  researchInterests: { type: [String], default: [] },
  about: { type: String, default: null },
  objectives: { type: [String], default: [] },
  fieldIds: { type: [String], default: [] },
});

// Text index weighted toward research interests
supervisorSchema.index(
  { researchInterests: 'text', about: 'text', firstName: 'text', lastName: 'text' },
  { weights: { researchInterests: 3, about: 2, firstName: 1, lastName: 1 } }
);

export const Supervisor = mongoose.model<SupervisorDoc>('Supervisor', supervisorSchema);
