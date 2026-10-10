import { Schema, model, Document } from 'mongoose';

export interface IMahalla extends Document {
  name: string;
  login: string;
  passwordHash: string;
  district: string;
  region: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mahallaSchema = new Schema<IMahalla>(
  {
    name: { type: String, required: true, trim: true },
    login: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    district: { type: String, default: 'Shofirkon' },
    region: { type: String, default: 'Buxoro' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Mahalla = model<IMahalla>('Mahalla', mahallaSchema);
