export async function commitFirestoreWithStorageCompensation({
  commitFirestore,
  storagePath = "",
  cleanupUploadedPdf,
  successValue,
  logger = console,
  failureMessage = "L’enregistrement du devis a échoué. Aucun devis n’a été créé.",
}) {
  try {
    await commitFirestore();
    return successValue;
  } catch (firestoreError) {
    if (storagePath) {
      try {
        await cleanupUploadedPdf(storagePath);
      } catch (cleanupError) {
        logger.error("document_pdf_compensation:orphan_possible", {
          storagePath,
          firestoreError,
          cleanupError,
        });
      }
    }
    throw new Error(failureMessage, { cause: firestoreError });
  }
}