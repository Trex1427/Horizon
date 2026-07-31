import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { buildVehicleCreatePayload, buildVehicleUpdatePayload, findActiveVehicleDuplicate, sortVehicles } from "./vehicleModel.js";
export { buildVehicleCreatePayload, buildVehicleUpdatePayload, calculateVehicleExpenses, findActiveVehicleDuplicate, sortVehicles } from "./vehicleModel.js";

const VEHICLES_COLLECTION = "vehicles";

export function subscribeVehicles(onData, onError, options = {}) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, VEHICLES_COLLECTION), where("ownerUid", "==", ownerUid)),
    (snapshot) => onData(sortVehicles(snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((vehicle) => options.includeDeleted === true || vehicle.isDeleted !== true))),
    (error) => onError?.(error),
  );
}

async function getOwnedVehicles() {
  const ownerUid = requireCurrentUid(auth);
  const snapshot = await getDocs(query(collection(db, VEHICLES_COLLECTION), where("ownerUid", "==", ownerUid)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

async function assertUniqueActiveName(name, excludedId = "") {
  if (findActiveVehicleDuplicate(await getOwnedVehicles(), name, excludedId)) {
    throw new Error("Un véhicule actif porte déjà ce nom.");
  }
}

export async function createVehicle(payload) {
  const normalized = buildVehicleCreatePayload(payload);
  await assertUniqueActiveName(normalized.name);
  return addDoc(collection(db, VEHICLES_COLLECTION), withOwnerUidForCreate(normalized, { auth }));
}

export async function updateVehicle(id, payload) {
  const normalized = buildVehicleUpdatePayload(payload);
  await assertUniqueActiveName(normalized.name, id);
  return updateDoc(doc(db, VEHICLES_COLLECTION, id), normalized);
}

export function deleteVehicle(id, { now = new Date() } = {}) {
  return updateDoc(doc(db, VEHICLES_COLLECTION, id), { isDeleted: true, updatedAt: now.toISOString() });
}

