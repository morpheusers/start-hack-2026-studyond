import mongoose, { Schema, type Document } from 'mongoose';

export interface CompanyDoc extends Document {
  id: string;
  name: string;
  description: string;
  about: string | null;
  size: string;
  domains: string[];
}

const companySchema = new Schema<CompanyDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  about: { type: String, default: null },
  size: { type: String, default: '' },
  domains: { type: [String], default: [] },
});

// Text index — name and domains weighted highest
companySchema.index(
  { name: 'text', description: 'text', about: 'text', domains: 'text' },
  { weights: { name: 4, domains: 3, description: 2, about: 1 } }
);

export const Company = mongoose.model<CompanyDoc>('Company', companySchema);
