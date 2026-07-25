export interface SlotInfo {
  userId: string;
  totalSlots: number;
  usedSlots: number;
  plan: 'free' | 'pro';
}

export const FREE_SLOT_LIMIT = 4;
export const PRO_SLOT_LIMIT = 12;
