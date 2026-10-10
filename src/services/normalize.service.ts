import { Citizen } from '../models/Citizen';
import { Family } from '../models/Family';

export async function normalizeFamilyHeads(): Promise<void> {
  const families = await Family.find().lean();

  for (const family of families) {
    const citizens = await Citizen.find({ familyId: family._id })
      .sort({ createdAt: 1 })
      .lean();

    if (citizens.length === 0) continue;

    const heads = citizens.filter((c) => c.isFamilyHead);

    if (heads.length === 1) continue;

    await Citizen.updateMany(
      { familyId: family._id },
      { isFamilyHead: false }
    );

    await Citizen.updateOne(
      { _id: citizens[0]._id },
      { isFamilyHead: true }
    );

    console.log(`🔧 ${family.familyId}: ${citizens[0].fullName} → Oila boshlig'i`);
  }
}
