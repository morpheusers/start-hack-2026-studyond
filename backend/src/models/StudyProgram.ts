import mongoose, { Schema, type Document } from 'mongoose';

export interface StudyProgramDoc extends Document {
  id: string;
  name: string;
  degree: string;
  universityId: string;
  about: string | null;
}

const studyProgramSchema = new Schema<StudyProgramDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  degree: { type: String, required: true },
  universityId: { type: String, required: true },
  about: { type: String, default: null },
});

export const StudyProgram = mongoose.model<StudyProgramDoc>('StudyProgram', studyProgramSchema);
