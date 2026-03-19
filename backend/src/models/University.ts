import mongoose, { Schema, type Document } from 'mongoose';

export interface UniversityDoc extends Document {
  id: string;
  name: string;
  country: string;
  domains: string[];
  about: string | null;
}

const universitySchema = new Schema<UniversityDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  country: { type: String, default: 'Switzerland' },
  domains: { type: [String], default: [] },
  about: { type: String, default: null },
});

export const University = mongoose.model<UniversityDoc>('University', universitySchema);
