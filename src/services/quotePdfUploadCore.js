export async function uploadQuotePdf(uploadOperation) {
  try {
    return await uploadOperation();
  } catch (uploadError) {
    throw new Error("Le téléversement du PDF a échoué. Aucun devis n’a été créé.", {
      cause: uploadError,
    });
  }
}
