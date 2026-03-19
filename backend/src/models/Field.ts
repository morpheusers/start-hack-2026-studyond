import mongoose, { Schema, type Document } from 'mongoose';

export interface FieldDoc extends Document {
  id: string;
  name: string;
}

const fieldSchema = new Schema<FieldDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});

export const Field = mongoose.model<FieldDoc>('Field', fieldSchema);
