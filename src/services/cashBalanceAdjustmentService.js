import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid";
import {
  buildCashAdjustmentId,
  buildCashAdjustmentPayload,
} from "../utils/cashBalanceAdjustment.js";

const TRANSACTIONS_COLLECTION = "transactions";

export async function createCashBalanceAdjustment(payload) {
  const adjustment = withOwnerUidForCreate(buildCashAdjustmentPayload(payload), { auth });
  const id = buildCashAdjustmentId({
    ownerUid: adjustment.ownerUid,
    accountId: adjustment.accountId,
    date: adjustment.date,
    targetBalance: adjustment.targetBalance,
    kind: adjustment.adjustmentKind,
  });

  await setDoc(doc(db, TRANSACTIONS_COLLECTION, id), adjustment);
  return { id, adjustment };
}
