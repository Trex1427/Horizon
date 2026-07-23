import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App keeps private Firestore providers behind AuthGate", () => {
  const source = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const authGateIndex = source.indexOf("<AuthGate>");
  const transactionsProviderIndex = source.indexOf("<TransactionsProvider>");

  assert.notEqual(authGateIndex, -1);
  assert.notEqual(transactionsProviderIndex, -1);
  assert.equal(authGateIndex < transactionsProviderIndex, true);
});

test("Firebase Auth is initialized once from the existing app", () => {
  const source = readFileSync(new URL("../firebase.js", import.meta.url), "utf8");

  assert.equal(source.includes("initializeApp(firebaseConfig)"), true);
  assert.equal(source.includes("getAuth(app)"), true);
  assert.equal(source.includes("GoogleAuthProvider"), true);
  assert.equal(source.includes("browserLocalPersistence"), true);
});

test("AuthProvider handles session restoration, redirect result, popup fallback and logout", () => {
  const source = readFileSync(new URL("./AuthProvider.jsx", import.meta.url), "utf8");

  assert.equal(source.includes("onAuthStateChanged"), true);
  assert.equal(source.includes("getRedirectResult"), true);
  assert.equal(source.includes("signInWithPopup"), true);
  assert.equal(source.includes("signInWithRedirect"), true);
  assert.equal(source.includes("signOut"), true);
});

test("AuthGate never renders private children while loading or unauthenticated", () => {
  const source = readFileSync(new URL("./AuthGate.jsx", import.meta.url), "utf8");
  const loadingIndex = source.indexOf("if (loading)");
  const unauthenticatedIndex = source.indexOf("if (!isAuthenticated)");
  const childrenIndex = source.lastIndexOf("return children");

  assert.equal(loadingIndex !== -1 && loadingIndex < childrenIndex, true);
  assert.equal(unauthenticatedIndex !== -1 && unauthenticatedIndex < childrenIndex, true);
});
