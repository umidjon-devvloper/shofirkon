import { Schema, model, Document, Types } from 'mongoose';

export interface ICitizen extends Document {
  fullName: string;
  gender: string;
  birthDate: Date;
  jshshir: string;
  documentNumber: string;
  phone?: string;
  familyId: Types.ObjectId;
  mahallaId: Types.ObjectId;
  isFamilyHead: boolean;
  maritalStatus: string;
  education: string;
  occupation: string;
  createdAt: Date;
  updatedAt: Date;
}

const citizenSchema = new Schema<ICitizen>(
  {
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, required: true, enum: ['Erkak', 'Ayol'] },
    birthDate: { type: Date, required: true },
    jshshir: { type: String, required: true, unique: true },
    documentNumber: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
    mahallaId: { type: Schema.Types.ObjectId, ref: 'Mahalla', required: true },
    isFamilyHead: { type: Boolean, default: false },
    maritalStatus: { type: String, required: true },
    education: { type: String, required: true },
    occupation: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Citizen = model<ICitizen>('Citizen', citizenSchema);
