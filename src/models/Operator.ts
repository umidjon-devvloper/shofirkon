import { Schema, model, Document, Types } from 'mongoose';

export interface IOperator extends Document {
  telegramId: number;
  mahallaId: Types.ObjectId;
  isAuthenticated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const operatorSchema = new Schema<IOperator>(
  {
    telegramId: { type: Number, required: true, unique: true },
    mahallaId: { type: Schema.Types.ObjectId, ref: 'Mahalla', required: true },
    isAuthenticated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Operator = model<IOperator>('Operator', operatorSchema);
