import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre";
const HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required. Run with firebase emulators:exec --only firestore.");
}

const adminApp = initializeApp({ projectId: PROJECT_ID });
const adminDb = getFirestore(adminApp);

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
      firebase: { identities: {}, sign_in_provider: "custom" },
    }),
    "",
  ].join(".");
}

function headers(uid) {
  const requestHeaders = { "Content-Type": "application/json" };
  if (uid) requestHeaders.Authorization = `Bearer ${authToken(uid)}`;
  return requestHeaders;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Invalid number for firestore encoding: ${value}`);
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  throw new Error(`Unsupported firestore value type: ${typeof value}`);
}

function toFirestoreFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function documentName(path) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

function commitWriteUpdate(path, fields, options = {}) {
  const write = {
    update: {
      name: documentName(path),
      fields: toFirestoreFields(fields),
    },
  };

  if (Array.isArray(options.updateMask) && options.updateMask.length) {
    write.updateMask = { fieldPaths: options.updateMask };
    write.currentDocument = { exists: true };
  }

  if (Array.isArray(options.transforms) && options.transforms.length) {
    write.updateTransforms = options.transforms.map((fieldPath) => ({
      fieldPath,
      setToServerValue: "REQUEST_TIME",
    }));
  }

  return write;
}

async function commit(uid, writes) {
  const response = await fetch(`${baseUrl}:commit`, {
    method: "POST",
    headers: headers(uid),
    body: JSON.stringify({ writes }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, payload };
}

async function patchDocument(uid, path, fields) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "PATCH",
    headers: headers(uid),
    body: JSON.stringify({ fields: toFirestoreFields(fields) }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, payload };
}

async function deleteDocument(uid, path) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "DELETE",
    headers: headers(uid),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, payload };
}

async function getDocument(uid, path) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "GET",
    headers: headers(uid),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, payload };
}

async function runStructuredQuery(uid, structuredQuery) {
  const response = await fetch(`${baseUrl}:runQuery`, {
    method: "POST",
    headers: headers(uid),
    body: JSON.stringify({ structuredQuery }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, payload };
}

function readIntegerField(fieldValue) {
  if (!fieldValue) return null;
  if (fieldValue.integerValue !== undefined) return Number(fieldValue.integerValue);
  if (fieldValue.doubleValue !== undefined) return Number(fieldValue.doubleValue);
  return null;
}

async function createPaymentWithServiceGuard({ uid, parentDocId, paymentDocId, amount, paymentDate }) {
  const parentResult = await getDocument(uid, `debtsReceivables/${parentDocId}`);
  if (!parentResult.ok) {
    return { ok: false, reason: "parent_unreadable", status: parentResult.status };
  }

  const parentAmount = readIntegerField(parentResult.payload?.fields?.amount);
  if (!Number.isFinite(parentAmount) || parentAmount <= 0) {
    return { ok: false, reason: "parent_amount_invalid" };
  }

  const activePaymentsResult = await runStructuredQuery(uid, {
    from: [{ collectionId: "debtReceivablePayments" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "ownerUid" },
              op: "EQUAL",
              value: { stringValue: uid },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "debtReceivableId" },
              op: "EQUAL",
              value: { stringValue: parentDocId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "isDeleted" },
              op: "EQUAL",
              value: { booleanValue: false },
            },
          },
        ],
      },
    },
  });

  if (!activePaymentsResult.ok) {
    return { ok: false, reason: "payments_unreadable", status: activePaymentsResult.status };
  }

  const activePaid = (activePaymentsResult.payload || []).reduce((sum, row) => {
    const amountField = row?.document?.fields?.amount;
    const parsed = readIntegerField(amountField);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  if (activePaid + amount > parentAmount) {
    return { ok: false, reason: "overpayment_refused" };
  }

  const createResult = await commit(uid, [
    paymentCreateWrite(paymentDocId, paymentBaseFields({ amount, paymentDate })),
    parentMutationWrite(revision + 1, paymentDocId),
  ]);

  if (createResult.ok) {
    revision += 1;
  }

  return createResult;
}

function expectAllowed(result, label) {
  assert.equal(result.ok, true, `${label} should be allowed, got ${result.status}`);
}

function expectDenied(result, label) {
  assert.equal(result.ok, false, `${label} should be denied`);
  assert.equal(result.status, 403, `${label} should return 403, got ${result.status}`);
}

async function seedLegacyParent(path, data) {
  await adminDb.doc(path).set(data, { merge: false });
}

const ownerUid = "debt-owner";
const otherUid = "debt-other";
const parentId = "dr-main";
const parentPath = `debtsReceivables/${parentId}`;
const otherParentId = "dr-other-owner";
const otherParentPath = `debtsReceivables/${otherParentId}`;
const deletedParentId = "dr-deleted";
const deletedParentPath = `debtsReceivables/${deletedParentId}`;
const legacyParentId = "dr-legacy-status";
const legacyParentPath = `debtsReceivables/${legacyParentId}`;
const paymentId = "pay-main";
const paymentPath = `debtReceivablePayments/${paymentId}`;

let revision = 0;

function parentBaseFields(uid) {
  return {
    ownerUid: uid,
    type: "debt",
    label: "Dette test",
    amount: 100,
    thirdPartyId: "tp-test",
    dueDate: "2026-12-31",
    notes: "test",
    isDeleted: false,
    paymentsRevision: 0,
  };
}

function paymentBaseFields({ uid = ownerUid, debtReceivableId = parentId, amount = 20, paymentDate = "2026-07-25", note = "Paiement test" } = {}) {
  return {
    ownerUid: uid,
    debtReceivableId,
    amount,
    paymentDate,
    note,
    transactionId: null,
    isDeleted: false,
  };
}

function parentMutationWrite(nextRevisionValue, mutationId, extra = {}, extraMask = []) {
  const fields = {
    paymentsRevision: nextRevisionValue,
    paymentsMutationId: mutationId,
    ...extra,
  };
  const updateMask = ["paymentsRevision", "paymentsMutationId", ...extraMask];
  return commitWriteUpdate(parentPath, fields, { updateMask });
}

function paymentCreateWrite(targetPaymentId, fields) {
  return commitWriteUpdate(
    `debtReceivablePayments/${targetPaymentId}`,
    {
      ...fields,
      createdAt: null,
      updatedAt: null,
    },
    { transforms: ["createdAt", "updatedAt"] },
  );
}

function paymentUpdateWrite(targetPaymentId, fields, updateMask, transforms = ["updatedAt"]) {
  return commitWriteUpdate(
    `debtReceivablePayments/${targetPaymentId}`,
    {
      ...fields,
      updatedAt: null,
    },
    { updateMask, transforms },
  );
}

expectDenied(
  await patchDocument(ownerUid, "debtsReceivables/dr-invalid-paid-create", {
    ...parentBaseFields(ownerUid),
    paidAmount: 10,
  }),
  "creation parent avec paidAmount",
);

expectDenied(
  await patchDocument(ownerUid, "debtsReceivables/dr-invalid-remaining-create", {
    ...parentBaseFields(ownerUid),
    remainingAmount: 90,
  }),
  "creation parent avec remainingAmount",
);

expectDenied(
  await patchDocument(ownerUid, "debtsReceivables/dr-invalid-status-create", {
    ...parentBaseFields(ownerUid),
    status: "open",
  }),
  "creation parent avec status",
);

expectAllowed(
  await patchDocument(ownerUid, parentPath, parentBaseFields(ownerUid)),
  "creation parent valide avec paymentsRevision 0",
);

expectAllowed(
  await patchDocument(otherUid, otherParentPath, parentBaseFields(otherUid)),
  "creation parent autre utilisateur",
);

expectAllowed(
  await patchDocument(ownerUid, deletedParentPath, parentBaseFields(ownerUid)),
  "creation parent futur supprime",
);

expectAllowed(
  await commit(ownerUid, [
    commitWriteUpdate(
      deletedParentPath,
      { isDeleted: true },
      { updateMask: ["isDeleted"] },
    ),
  ]),
  "suppression logique parent deleted fixture",
);

await seedLegacyParent(legacyParentPath, {
  ownerUid,
  type: "debt",
  label: "Legacy",
  amount: 100,
  thirdPartyId: "tp-test",
  dueDate: "2026-12-31",
  notes: "legacy",
  status: "open",
  isDeleted: false,
  updatedAt: new Date(),
  createdAt: new Date(),
  paymentsRevision: 0,
});

expectDenied(
  await commit(ownerUid, [
    commitWriteUpdate(legacyParentPath, { status: "closed" }, { updateMask: ["status"] }),
  ]),
  "modification ancien status persistant",
);

expectDenied(
  await fetch(`${baseUrl}/${legacyParentPath}?updateMask.fieldPaths=status`, {
    method: "PATCH",
    headers: headers(ownerUid),
    body: JSON.stringify({ fields: {} }),
  }).then(async (response) => ({
    ok: response.ok,
    status: response.status,
    payload: (await response.text()) || null,
  })),
  "suppression ancien status persistant",
);

expectDenied(
  await commit(ownerUid, [
    commitWriteUpdate(parentPath, { paidAmount: 1 }, { updateMask: ["paidAmount"] }),
  ]),
  "ajout de paidAmount",
);

expectDenied(
  await commit(ownerUid, [
    commitWriteUpdate(parentPath, { remainingAmount: 99 }, { updateMask: ["remainingAmount"] }),
  ]),
  "ajout de remainingAmount",
);

expectAllowed(
  await commit(ownerUid, [
    commitWriteUpdate(parentPath, { notes: "Update ordinaire" }, { updateMask: ["notes"] }),
  ]),
  "update parent ordinaire sans champs calcules",
);

expectDenied(
  await commit(ownerUid, [
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "mutation parent sans ecriture reelle paiement",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-no-parent", paymentBaseFields({ amount: 10, paymentDate: "2026-07-25" })),
  ]),
  "ecriture paiement sans mutation parent",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-wrong-marker", paymentBaseFields({ amount: 10, paymentDate: "2026-07-25" })),
    parentMutationWrite(revision + 1, "wrong-id"),
  ]),
  "mauvaise valeur paymentsMutationId",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-bad-revision", paymentBaseFields({ amount: 10, paymentDate: "2026-07-25" })),
    parentMutationWrite(revision + 2, "pay-bad-revision"),
  ]),
  "mauvais increment paymentsRevision",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-parent-business-change", paymentBaseFields({ amount: 10, paymentDate: "2026-07-25" })),
    parentMutationWrite(revision + 1, "pay-parent-business-change", { label: "Nouveau label" }, ["label"]),
  ]),
  "modification champ metier parent pendant mutation paiement",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-negative", paymentBaseFields({ amount: -10 })),
    parentMutationWrite(revision + 1, "pay-negative"),
  ]),
  "montant negatif refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-zero", paymentBaseFields({ amount: 0 })),
    parentMutationWrite(revision + 1, "pay-zero"),
  ]),
  "montant nul refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-invalid-date", paymentBaseFields({ paymentDate: "2026/07/25" })),
    parentMutationWrite(revision + 1, "pay-invalid-date"),
  ]),
  "date invalide refusee",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-unknown-field", {
      ...paymentBaseFields(),
      unexpectedField: "nope",
    }),
    parentMutationWrite(revision + 1, "pay-unknown-field"),
  ]),
  "champ inconnu refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-parent-inexistant", paymentBaseFields({ debtReceivableId: "dr-missing" })),
    commitWriteUpdate(
      "debtsReceivables/dr-missing",
      { paymentsRevision: 1, paymentsMutationId: "pay-parent-inexistant" },
      { updateMask: ["paymentsRevision", "paymentsMutationId"] },
    ),
  ]),
  "parent inexistant refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-parent-autre-owner", paymentBaseFields({ debtReceivableId: otherParentId })),
    commitWriteUpdate(
      otherParentPath,
      { paymentsRevision: 1, paymentsMutationId: "pay-parent-autre-owner" },
      { updateMask: ["paymentsRevision", "paymentsMutationId"] },
    ),
  ]),
  "parent autre utilisateur refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentCreateWrite("pay-parent-deleted", paymentBaseFields({ debtReceivableId: deletedParentId })),
    commitWriteUpdate(
      deletedParentPath,
      { paymentsRevision: 1, paymentsMutationId: "pay-parent-deleted" },
      { updateMask: ["paymentsRevision", "paymentsMutationId"] },
    ),
  ]),
  "parent supprime refuse",
);

expectAllowed(
  await commit(ownerUid, [
    paymentCreateWrite(paymentId, paymentBaseFields({ amount: 30, paymentDate: "2026-07-25" })),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "creation valide d'un paiement",
);
revision += 1;

expectAllowed(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { amount: 25, paymentDate: "2026-07-26", note: "modification 1" },
      ["amount", "paymentDate", "note"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "modification valide paiement",
);
revision += 1;

expectAllowed(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { amount: 20, paymentDate: "2026-07-27", note: "modification 2" },
      ["amount", "paymentDate", "note"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "deux modifications successives meme paiement",
);
revision += 1;

expectDenied(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { ownerUid: "attacker" },
      ["ownerUid"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "changement ownerUid refuse",
);

expectDenied(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { debtReceivableId: "dr-other" },
      ["debtReceivableId"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "changement debtReceivableId refuse",
);

expectAllowed(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { isDeleted: true, deletedAt: null },
      ["isDeleted", "deletedAt"],
      ["updatedAt", "deletedAt"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "suppression logique valide",
);
revision += 1;

expectDenied(
  await deleteDocument(ownerUid, paymentPath),
  "suppression physique refusee",
);

expectDenied(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { isDeleted: false },
      ["isDeleted"],
      ["updatedAt"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "restauration refusee",
);

expectDenied(
  await commit(ownerUid, [
    paymentUpdateWrite(
      paymentId,
      { note: "tentative apres suppression" },
      ["note"],
    ),
    parentMutationWrite(revision + 1, paymentId),
  ]),
  "modification paiement supprime refusee",
);

expectAllowed(
  await createPaymentWithServiceGuard({
    uid: ownerUid,
    parentDocId: parentId,
    paymentDocId: "pay-over-base",
    amount: 95,
    paymentDate: "2026-07-25",
  }),
  "preparation overpayment de base",
);

const overpaymentResult = await createPaymentWithServiceGuard({
  uid: ownerUid,
  parentDocId: parentId,
  paymentDocId: "pay-over-1",
  amount: 10,
  paymentDate: "2026-07-25",
});
assert.equal(overpaymentResult.ok, false, "depassement montant total refuse");
assert.equal(overpaymentResult.reason, "overpayment_refused", "depassement montant total refuse");

expectDenied(
  await commit(otherUid, [
    paymentCreateWrite("pay-cross-user", paymentBaseFields({ uid: otherUid, debtReceivableId: parentId, amount: 5 })),
    commitWriteUpdate(
      parentPath,
      { paymentsRevision: revision + 1, paymentsMutationId: "pay-cross-user" },
      { updateMask: ["paymentsRevision", "paymentsMutationId"] },
    ),
  ]),
  "isolation multi-utilisateur verifiee",
);

expectAllowed(
  await commit(ownerUid, [
    paymentCreateWrite("pay-tech-only", paymentBaseFields({ amount: 10, paymentDate: "2026-07-28" })),
    parentMutationWrite(revision + 1, "pay-tech-only"),
  ]),
  "mutation limitee aux deux champs techniques autorisee",
);
revision += 1;

console.log("Debt receivable payments rules emulator tests passed.");
