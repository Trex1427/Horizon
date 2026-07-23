export function getSpeechRecognitionConstructor(targetWindow) {
  const safeWindow = targetWindow || (typeof window !== "undefined" ? window : undefined);
  if (!safeWindow) {
    return null;
  }

  return safeWindow.SpeechRecognition || safeWindow.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionAvailable(targetWindow) {
  return Boolean(getSpeechRecognitionConstructor(targetWindow));
}

export function mapSpeechRecognitionError(errorCode = "") {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Permission microphone refusee";
  }

  if (errorCode === "no-speech") {
    return "Aucune voix detectee";
  }

  if (errorCode === "audio-capture") {
    return "Microphone indisponible";
  }

  if (errorCode === "network") {
    return "Erreur reseau pendant la reconnaissance vocale";
  }

  return "Erreur de reconnaissance vocale";
}
