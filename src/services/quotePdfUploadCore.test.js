import test from "node:test";
import assert from "node:assert/strict";
import { uploadQuotePdf } from "./quotePdfUploadCore.js";

test("successful upload returns its result", async () => {
  assert.deepEqual(await uploadQuotePdf(async () => ({ storagePath: "path" })), { storagePath: "path" });
});

test("failed upload reports that no quote was created and preserves cause", async () => {
  const uploadError = new Error("storage unavailable");
  await assert.rejects(
    () => uploadQuotePdf(async () => { throw uploadError; }),
    (error) => {
      assert.equal(error.cause, uploadError);
      assert.match(error.message, /Aucun devis n’a été créé/);
      return true;
    },
  );
});
