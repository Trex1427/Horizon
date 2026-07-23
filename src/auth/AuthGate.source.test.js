import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("AuthGate renders the email/password form and keeps Google sign-in", () => {
  const source = readFileSync(new URL("./AuthGate.jsx", import.meta.url), "utf8");

  assert.equal(source.includes('label="Email"'), true);
  assert.equal(source.includes('label="Mot de passe"'), true);
  assert.equal(source.includes('Se connecter avec un email'), true);
  assert.equal(source.includes("Continuer avec Google"), true);
  assert.equal(source.includes("signInWithGoogle"), true);
  assert.equal(source.includes("signInWithEmail"), true);
});

test("AuthGate does not expose sign-up or password reset paths", () => {
  const source = readFileSync(new URL("./AuthGate.jsx", import.meta.url), "utf8");

  assert.equal(source.includes("createUserWithEmailAndPassword"), false);
  assert.equal(source.includes("sendPasswordResetEmail"), false);
  assert.equal(source.includes("Mot de passe oublié"), false);
  assert.equal(source.includes("Créer un compte"), false);
});