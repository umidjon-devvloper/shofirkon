import { Schema, model, Document, Types } from 'mongoose';

export interface IFamily extends Document {
  familyId: string;
  mahallaId: Types.ObjectId;
  street: string;
  houseNumber: string;
  apartmentNumber?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const familySchema = new Schema<IFamily>(
  {
    familyId: { type: String, required: true, unique: true },
    mahallaId: { type: Schema.Types.ObjectId, ref: 'Mahalla', required: true },
    street: { type: String, required: true, trim: true },
    houseNumber: { type: String, required: true, trim: true },
    apartmentNumber: { type: String, trim: true },
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

export const Family = model<IFamily>('Family', familySchema);
