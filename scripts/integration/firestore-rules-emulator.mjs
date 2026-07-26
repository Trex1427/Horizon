import assert from "node:assert/strict";

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre";
const HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required. Run with firebase emulators:exec --only firestore.");
}

const baseUrl = `${HOST.startsWith("http") ? HOST : `http://${HOST}`}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function authToken(uid) {
  const now = Math.floor(Date.now() / 1000);

  return [
    base64UrlJson({ alg: "none", typ: "JWT" }),
    base64UrlJson({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: now,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600,
      firebase: {
        identities: {},
        sign_in_provider: "custom",
      },
    }),
    "",
  ].join(".");
}

function headers(uid) {
  const requestHeaders = {
    "Content-Type": "application/json",
  };

  if (uid) {
    requestHeaders.Authorization = `Bearer ${authToken(uid)}`;
  }

  return requestHeaders;
}

function fields(ownerUid, extra = {}) {
  return {
    fields: {
      ownerUid: { stringValue: ownerUid },
      label: { stringValue: extra.label ?? "Rules test document" },
      amount: { integerValue: String(extra.amount ?? 1) },
    },
  };
}

async function request(method, path, { uid, body } = {}) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method,
    headers: headers(uid),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function runOwnerQuery(collectionName, uid, ownerUidFilter) {
  const response = await fetch(`${baseUrl}:runQuery`, {
    method: "POST",
    headers: headers(uid),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "ownerUid" },
            op: "EQUAL",
            value: { stringValue: ownerUidFilter },
          },
        },
      },
    }),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    payload: text ? JSON.parse(text) : null,
  };
}

function expectAllowed(result, label) {
  assert.equal(result.ok, true, `${label} should be allowed, got ${result.status}`);
}

function expectDenied(result, label) {
  assert.equal(result.ok, false, `${label} should be denied`);
  assert.equal(result.status, 403, `${label} should return 403, got ${result.status}`);
}

const ownerUid = "rules-owner";
const otherUid = "rules-other";
const unknownPath = "unknownCollection/rules-denied-document";
const protectedCollections = [
  "accounts",
  "transactions",
  "categories",
  "subcategories",
  "thirdParties",
  "activities",
  "projects",
  "budgets",
  "goals",
  "objectives",
  "fixedExpenses",
  "recurringIncome",
  "bankImports",
  "receiptDrafts",
  "transactionDrafts",
  "opportunities",
  "transfers",
];

for (const collectionName of protectedCollections) {
  const documentPath = `${collectionName}/rules-${collectionName}`;
  const otherDocumentPath = `${collectionName}/rules-other-${collectionName}`;

  expectAllowed(
    await request("PATCH", documentPath, {
      uid: ownerUid,
      body: fields(ownerUid, { label: `${collectionName} creation` }),
    }),
    `${collectionName} valid creation`,
  );

  expectAllowed(
    await request("PATCH", otherDocumentPath, {
      uid: otherUid,
      body: fields(otherUid, { label: `${collectionName} other owner creation` }),
    }),
    `${collectionName} second owner valid creation`,
  );

  expectAllowed(
    await request("GET", documentPath, { uid: ownerUid }),
    `${collectionName} authenticated owner read`,
  );

  expectDenied(
    await request("GET", documentPath, { uid: otherUid }),
    `${collectionName} read by another owner`,
  );

  expectDenied(
    await request("GET", documentPath),
    `${collectionName} anonymous read`,
  );

  expectAllowed(
    await runOwnerQuery(collectionName, ownerUid, ownerUid),
    `${collectionName} ownerUid-scoped query used by listeners`,
  );

  expectDenied(
    await request("GET", collectionName, { uid: ownerUid }),
    `${collectionName} unscoped collection query`,
  );

  expectDenied(
    await request("PATCH", `${collectionName}/rules-wrong-owner`, {
      uid: otherUid,
      body: fields(ownerUid),
    }),
    `${collectionName} write with mismatched ownerUid`,
  );

  expectAllowed(
    await request("PATCH", documentPath, {
      uid: ownerUid,
      body: fields(ownerUid, { label: `${collectionName} update`, amount: 2 }),
    }),
    `${collectionName} valid update`,
  );

  expectDenied(
    await request("PATCH", documentPath, {
      uid: ownerUid,
      body: fields(otherUid, { label: `${collectionName} owner transfer attempt` }),
    }),
    `${collectionName} ownerUid mutation`,
  );

  expectDenied(
    await request("PATCH", documentPath, {
      uid: otherUid,
      body: fields(ownerUid, { label: `${collectionName} update by another owner` }),
    }),
    `${collectionName} update by another owner`,
  );

  expectDenied(
    await request("DELETE", documentPath, { uid: otherUid }),
    `${collectionName} delete by non-owner`,
  );
}

expectDenied(
  await request("PATCH", unknownPath, {
    uid: ownerUid,
    body: fields(ownerUid),
  }),
  "unknown collection write",
);

for (const collectionName of protectedCollections) {
  expectAllowed(
    await request("DELETE", `${collectionName}/rules-${collectionName}`, { uid: ownerUid }),
    `${collectionName} delete by owner`,
  );
  expectAllowed(
    await request("DELETE", `${collectionName}/rules-other-${collectionName}`, { uid: otherUid }),
    `${collectionName} second owner cleanup`,
  );
}

console.log("Firestore rules emulator tests passed.");
