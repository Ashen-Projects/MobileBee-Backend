import { z } from 'zod';

const money = z.coerce.number().finite().min(0).max(999999999.99);
const note = z.string().trim().max(2000).optional();

export const openDrawerSchema = z.object({
  note,
  openingCash: money,
}).strict();

export const closeDrawerSchema = z.object({
  cashExpenseAmount: money.default(0),
  countedBankTransferTotal: money.default(0),
  countedCardTotal: money.default(0),
  countedCash: money,
  note,
}).strict();
