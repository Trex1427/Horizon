export async function requestOrphanQuotePdfCleanup({ endpointUrl, token, storagePath, fetchImpl = fetch }) {
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ storagePath }),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Réponse invalide du service de nettoyage.");
  }
  if (!response.ok || body?.deleted !== true) {
    throw new Error(body?.error || "Le nettoyage du PDF a échoué.");
  }
  return body;
}
