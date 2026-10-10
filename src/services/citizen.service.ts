import { Citizen, ICitizen } from '../models/Citizen';

export interface UpsertCitizenInput {
  fullName: string;
  gender: string;
  birthDate: Date;
  jshshir: string;
  documentNumber: string;
  phone?: string;
  familyId: string;
  mahallaId: string;
  isFamilyHead: boolean;
  maritalStatus: string;
  education: string;
  occupation: string;
}

export async function upsertCitizen(input: UpsertCitizenInput): Promise<{ citizen: ICitizen; isUpdate: boolean }> {
  const existing = await Citizen.findOne({ jshshir: input.jshshir });
  const isUpdate = !!existing;
  const oldFamilyId = existing ? String(existing.familyId) : null;

  if (input.isFamilyHead) {
    await Citizen.updateMany(
      { familyId: input.familyId, isFamilyHead: true, jshshir: { $ne: input.jshshir } },
      { isFamilyHead: false }
    );
  }

  const citizen = await Citizen.findOneAndUpdate(
    { jshshir: input.jshshir },
    { $set: input },
    { new: true, upsert: true }
  );

  if (oldFamilyId && oldFamilyId !== input.familyId) {
    const oldFamilyHasHead = await Citizen.findOne({ familyId: oldFamilyId, isFamilyHead: true });
    if (!oldFamilyHasHead) {
      const earliest = await Citizen.findOne({ familyId: oldFamilyId }).sort({ createdAt: 1 });
      if (earliest) {
        await Citizen.updateOne({ _id: earliest._id }, { isFamilyHead: true });
      }
    }
  }

  return { citizen: citizen!, isUpdate };
}
