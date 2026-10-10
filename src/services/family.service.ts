import { Family, IFamily } from '../models/Family';
import { Counter } from '../models/Counter';

async function getNextFamilyId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    'familyId',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `OILA-${String(counter!.seq).padStart(6, '0')}`;
}

interface CreateFamilyInput {
  mahallaId: string;
  street: string;
  houseNumber: string;
  apartmentNumber?: string;
}

export async function createFamily(input: CreateFamilyInput): Promise<IFamily> {
  const familyId = await getNextFamilyId();

  return Family.create({
    familyId,
    mahallaId: input.mahallaId,
    street: input.street,
    houseNumber: input.houseNumber,
    apartmentNumber: input.apartmentNumber || undefined,
  });
}
