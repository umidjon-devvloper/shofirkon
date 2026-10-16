import { Schema, model, Document } from 'mongoose';

export interface ICitizenReference extends Document {
  jshshir: string;
  fullName: string;
  fullNameCyrillic?: string;
  passport?: string;
  birthDate?: Date;
  phone?: string;
  address?: string;
  mahallaName?: string;
  gender?: string;
  sources: string[];
  createdAt: Date;
  updatedAt: Date;
}

const citizenReferenceSchema = new Schema<ICitizenReference>(
  {
    jshshir: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    fullNameCyrillic: { type: String, trim: true },
    passport: { type: String, trim: true },
    birthDate: { type: Date },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    mahallaName: { type: String, trim: true },
    gender: { type: String, enum: ['Erkak', 'Ayol'] },
    sources: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const CitizenReference = model<ICitizenReference>('CitizenReference', citizenReferenceSchema);
