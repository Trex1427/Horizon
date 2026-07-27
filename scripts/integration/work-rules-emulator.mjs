import assert from "node:assert/strict";

const projectId = process.env.GCLOUD_PROJECT || "budget-alexandre";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const token = (uid) => {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { identities: {}, sign_in_provider: "custom" } })}.`;
};
const headers = (uid) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token(uid)}` });
const payload = (ownerUid, extra = {}) => ({ fields: {
  ownerUid: { stringValue: ownerUid }, name: { stringValue: "Test" }, ...extra,
} });
async function write(collection, id, uid, ownerUid, extra) {
  return fetch(`${base}/${collection}/${id}`, { method: "PATCH", headers: headers(uid), body: JSON.stringify(payload(ownerUid, extra)) });
}
async function read(collection, id, uid) {
  return fetch(`${base}/${collection}/${id}`, { headers: headers(uid) });
}

for (const collection of ["professionalActivities", "workQuotes", "documents"]) {
  const id = `work-rules-${collection}`;
  assert.equal((await write(collection, id, "owner-a", "owner-a")).ok, true, `${collection} owner create`);
  assert.equal((await read(collection, id, "owner-a")).ok, true, `${collection} owner read`);
  assert.equal((await read(collection, id, "owner-b")).ok, false, `${collection} foreign read`);
  assert.equal((await write(collection, `${id}-foreign`, "owner-b", "owner-a")).ok, false, `${collection} foreign owner create`);
}
console.log("Work Firestore rules isolation: OK");
