export async function commitFirestoreWithStorageCompensation({
  commitFirestore,
  storagePath = "",
  cleanupUploadedPdf,
  successValue,
  logger = console,
}) {
  try {
    await commitFirestore();
    return successValue;
  } catch (firestoreError) {
    if (storagePath) {
      try {
        await cleanupUploadedPdf(storagePath);
      } catch (cleanupError) {
        logger.error("quote_pdf_compensation:orphan_possible", {
          storagePath,
          firestoreError,
          cleanupError,
        });
      }
    }
    throw new Error("L’enregistrement du devis a échoué. Aucun devis n’a été créé.", {
      cause: firestoreError,
    });
  }
}
