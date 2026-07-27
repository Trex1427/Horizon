import assert from "node:assert/strict";

const projectId = process.env.GCLOUD_PROJECT || "budget-alexandre";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
const origin = `http://${host}/v1/projects/${projectId}/databases/(default)`;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const uid = "atomicity-owner";
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
  aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid,
  iat: now, exp: now + 3600, auth_time: now, firebase: { identities: {}, sign_in_provider: "custom" },
})}.`;
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
async function rejectBatchAndAssertOwnedWriteAbsent({ suffix, documentOwner, quoteOwner, ownedPath }) {
  const quoteId = `atomicity-quote-${suffix}`;
  const documentId = `atomicity-document-${suffix}`;
  const documentName = `projects/${projectId}/databases/(default)/documents/documents/${documentId}`;
  const quoteName = `projects/${projectId}/databases/(default)/documents/workQuotes/${quoteId}`;
  const response = await fetch(`${origin}/documents:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      writes: [
        { update: { name: documentName, fields: { ownerUid: { stringValue: documentOwner }, entityId: { stringValue: quoteId } } } },
        { update: { name: quoteName, fields: { ownerUid: { stringValue: quoteOwner }, documentId: { stringValue: documentId } } } },
      ],
    }),
  });
  assert.equal(response.ok, false, "the mixed-owner batch must be rejected");
  const collectionId = ownedPath === "quote" ? "workQuotes" : "documents";
  const ownedId = ownedPath === "quote" ? quoteId : documentId;
  const queryResponse = await fetch(`${origin}/documents:runQuery`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: { field: { fieldPath: "ownerUid" }, op: "EQUAL", value: { stringValue: uid } },
        },
      },
    }),
  });
  assert.equal(queryResponse.ok, true, `owner query for ${collectionId} must be allowed`);
  const matches = (await queryResponse.json()).filter((entry) => entry.document?.name?.endsWith(`/${ownedId}`));
}

await rejectBatchAndAssertOwnedWriteAbsent({
  suffix: "quote", documentOwner: "foreign-owner", quoteOwner: uid, ownedPath: "quote",
});
await rejectBatchAndAssertOwnedWriteAbsent({
  suffix: "document", documentOwner: uid, quoteOwner: "foreign-owner", ownedPath: "document",
});

console.log("Work quote/document atomic batch failure: OK");
