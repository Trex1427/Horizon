import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthorizationState,
  isPopupRedirectError,
  mapAuthError,
  parseAllowedFirebaseUids,
} from "./authConfig.js";

test("parseAllowedFirebaseUids supports empty and multiple values", () => {
  assert.deepEqual(parseAllowedFirebaseUids(""), []);
  assert.deepEqual(parseAllowedFirebaseUids(" uid-a,uid-b , , uid-c "), ["uid-a", "uid-b", "uid-c"]);
});

test("getAuthorizationState allows local diagnostics only in development with empty allowlist", () => {
  assert.deepEqual(getAuthorizationState({ uid: "uid-a", allowedUids: [], isDevelopment: true }), {
    isAuthorized: true,
    reason: "development-allowlist-empty",
    shouldShowLocalDiagnostic: true,
  });

  assert.deepEqual(getAuthorizationState({ uid: "uid-a", allowedUids: [], isDevelopment: false }), {
    isAuthorized: false,
    reason: "allowlist-empty",
    shouldShowLocalDiagnostic: false,
  });
});

test("getAuthorizationState accepts only configured UIDs", () => {
  assert.equal(getAuthorizationState({ uid: "uid-a", allowedUids: ["uid-a", "uid-b"] }).isAuthorized, true);
  assert.equal(getAuthorizationState({ uid: "uid-c", allowedUids: ["uid-a", "uid-b"] }).isAuthorized, false);
});

test("getAuthorizationState keeps private app hidden while auth is unresolved or absent", () => {
  const state = getAuthorizationState({ uid: "", allowedUids: ["uid-a"], isDevelopment: true });
  assert.equal(state.isAuthorized, false);
  assert.equal(state.reason, "missing-user");
});

test("popup errors can fall back to redirect and auth messages stay user-facing", () => {
  assert.equal(isPopupRedirectError({ code: "auth/popup-blocked" }), true);
  assert.equal(isPopupRedirectError({ code: "auth/unauthorized-domain" }), false);
  assert.match(mapAuthError({ code: "auth/popup-blocked" }), /redirection sécurisée/);
  assert.match(mapAuthError({ code: "auth/unauthorized-domain" }), /domaine/);
});

test("email/password auth messages stay user-friendly", () => {
  assert.match(mapAuthError({ code: "auth/invalid-email" }), /Adresse e-mail invalide/);
  assert.match(mapAuthError({ code: "auth/wrong-password" }), /Adresse e-mail ou mot de passe incorrect/);
  assert.match(mapAuthError({ code: "auth/too-many-requests" }), /Trop de tentatives/);
  assert.match(mapAuthError({ code: "auth/network-request-failed" }), /Problème réseau/);
  assert.match(mapAuthError({ code: "auth/internal-error" }), /Connexion impossible/);
});
