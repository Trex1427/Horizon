function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeVoiceTranscript(value) {
  return normalizeText(value)
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryType(value) {
  const normalized = normalizeText(value);

  if (["revenu", "income", "recette"].includes(normalized)) {
    return "revenu";
  }

  if (["depense", "depenses", "dépense", "expense", "charges"].includes(normalized)) {
    return "depense";
  }

  return "depense";
}

function toSingularToken(token) {
  if (!token || token.length <= 3) {
    return token;
  }

  if (token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}

function buildCategoryAliases(categoryName) {
  const normalized = normalizeText(categoryName);
  const aliases = new Set([normalized]);
  const genericTokens = new Set([
    "compte",
    "professionnel",
    "personnel",
    "general",
    "autre",
    "autres",
    "divers",
  ]);

  const tokenAliases = normalized
    .split(/\s+/)
    .flatMap((token) => {
      const singular = toSingularToken(token);
      return [token, singular];
    })
    .filter((token) => token && token.length >= 3 && !genericTokens.has(token));
  tokenAliases.forEach((token) => aliases.add(token));

  if (normalized.includes("aliment")) {
    ["course", "courses", "supermarche", "nourriture", "alimentaire"].forEach((alias) => aliases.add(alias));
  }

  if (normalized.includes("transport")) {
    ["carburant", "essence", "gazole", "gasoil", "station", "bus", "metro", "train"].forEach((alias) => aliases.add(alias));
  }

  if (normalized.includes("salaire")) {
    ["salaire", "paie", "paye", "remuneration"].forEach((alias) => aliases.add(alias));
  }

  return Array.from(aliases).filter(Boolean);
}

function cleanDisplayText(value) {
  return String(value || "").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSimpleFrenchWordsNumber(text) {
  const units = {
    zero: 0,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
  };

  const tens = {
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
  };

  const tokens = normalizeText(text)
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(units, token)) {
      total += units[token];
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(tens, token)) {
      total += tens[token];
      continue;
    }

    if (token === "et") {
      continue;
    }

    return null;
  }

  return total > 0 ? total : null;
}

function parseAmount(transcript) {
  const normalized = normalizeVoiceTranscript(transcript);

  const frenchCurrencyMatch = normalized.match(
    /(\d{1,3}(?:\s\d{3})*|\d+)(?:[.,](\d{1,2}))?\s*(?:€|(?:euros?|euro|eur)\b)(?:\s*(?:et\s*)?(\d{1,2})(?:\s*centimes?)?)?/
  );

  if (frenchCurrencyMatch) {
    const euros = Number(String(frenchCurrencyMatch[1] || "").replace(/[\s\u00A0]/g, ""));
    const inlineCents = frenchCurrencyMatch[2] ? Number(frenchCurrencyMatch[2]) : null;
    const trailingCents = frenchCurrencyMatch[3] ? Number(frenchCurrencyMatch[3]) : null;
    const cents = Number.isFinite(inlineCents) ? inlineCents : trailingCents;

    if (Number.isFinite(euros)) {
      if (Number.isFinite(cents)) {
        return euros + cents / 100;
      }

      return euros;
    }
  }

  const wordsAmountMatch = normalized.match(/([a-z\s-]+)\s+euros?(?:\s+([a-z\s-]+))?/);
  if (wordsAmountMatch) {
    const euros = parseSimpleFrenchWordsNumber(wordsAmountMatch[1]);
    const cents = wordsAmountMatch[2] ? parseSimpleFrenchWordsNumber(wordsAmountMatch[2]) : 0;
    if (Number.isFinite(euros) && Number.isFinite(cents)) {
      return euros + cents / 100;
    }
  }

  return null;
}

function normalizeDraftAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeVoiceDraftContract(rawDraft = {}) {
  const amountFromDraft = rawDraft?.montant ?? rawDraft?.amount;
  const normalizedAmount = normalizeDraftAmount(amountFromDraft);

  return {
    ...rawDraft,
    montant: normalizedAmount,
  };
}

export function buildVoiceDraftForm(rawDraft = {}, defaults = {}) {
  const normalizedDraft = normalizeVoiceDraftContract(rawDraft);

  return {
    ...defaults,
    ...normalizedDraft,
    montant: normalizedDraft.montant !== null && normalizedDraft.montant !== undefined
      ? String(normalizedDraft.montant)
      : "",
  };
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateFromTranscript(transcript) {
  const normalized = normalizeText(transcript);
  const now = new Date();

  if (normalized.includes("aujourd")) {
    return toIsoDate(now);
  }

  if (normalized.includes("hier")) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toIsoDate(yesterday);
  }

  const explicitDate = normalized.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]);
    const rawYear = explicitDate[3] ? Number(explicitDate[3]) : now.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return toIsoDate(now);
}

function detectType(transcript) {
  const normalized = normalizeText(transcript);

  const incomeKeywords = ["revenu", "salaire", "gagne", "encaisse", "paiement client", "recu", "recette"];
  if (incomeKeywords.some((keyword) => normalized.includes(keyword))) {
    return "revenu";
  }

  return "depense";
}

function extractDescription(transcript) {
  const original = cleanDisplayText(transcript);
  const normalized = normalizeText(transcript);

  const merchantMatch = normalized.match(/chez\s+([a-z0-9\s'-]+)/i);
  if (merchantMatch) {
    const keyword = merchantMatch[1].trim();
    const start = normalizeText(original).indexOf(keyword);
    if (start >= 0) {
      return original.slice(start, start + keyword.length).trim();
    }

    return merchantMatch[1].trim();
  }

  const clientMatch = normalized.match(/paiement client\s+([a-z0-9\s'-]+)/i);
  if (clientMatch) {
    const keyword = clientMatch[1].trim();
    const start = normalizeText(original).indexOf(keyword);
    if (start >= 0) {
      return `Paiement client ${original.slice(start, start + keyword.length).trim()}`;
    }

    return `Paiement client ${clientMatch[1].trim()}`;
  }

  return original;
}

function matchCategory(transcript, categories = [], type = "depense") {
  const normalizedTranscript = normalizeText(transcript);
  const candidates = (categories || [])
    .filter((category) => String(category?.id || "").trim())
    .filter((category) => normalizeCategoryType(category?.type) === type)
    .map((category) => ({
      id: String(category.id).trim(),
      name: cleanDisplayText(category?.name),
      aliases: buildCategoryAliases(category?.name),
    }));

  const scored = candidates
    .map((category) => {
      const score = category.aliases.reduce((currentScore, alias) => {
        const normalizedAlias = normalizeText(alias);
        if (!normalizedAlias) {
          return currentScore;
        }

        const wholeWordRegex = new RegExp(`\\b${escapeRegExp(normalizedAlias)}\\b`, "i");
        if (!wholeWordRegex.test(normalizedTranscript)) {
          return currentScore;
        }

        if (normalizedAlias === normalizeText(category.name)) {
          return currentScore + 3;
        }

        return currentScore + 1;
      }, 0);

      return {
        ...category,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return {
      categoryId: null,
      categoryName: null,
    };
  }

  const topScore = scored[0].score;
  const topMatches = scored.filter((entry) => entry.score === topScore);

  if (topMatches.length !== 1) {
    return {
      categoryId: null,
      categoryName: null,
    };
  }

  const matched = topMatches[0];

  return {
    categoryId: matched.id || null,
    categoryName: matched.name || null,
  };
}

function matchAccount(transcript, accounts = []) {
  const normalizedTranscript = normalizeText(transcript);
  const matches = (accounts || []).filter((account) => {
    const normalizedName = normalizeText(account?.name || "");
    return normalizedName && normalizedTranscript.includes(normalizedName);
  });

  if (matches.length !== 1) {
    return null;
  }

  return matches[0]?.id || null;
}

export function parseVoiceTransactionDraft(transcript, options = {}) {
  const rawTranscript = cleanDisplayText(transcript);
  const categories = Array.isArray(options.categories) ? options.categories : [];
  const accounts = Array.isArray(options.accounts) ? options.accounts : [];

  const type = detectType(rawTranscript);
  const parsedAmount = parseAmount(rawTranscript);
  const category = matchCategory(rawTranscript, categories, type);

  return normalizeVoiceDraftContract({
    type,
    montant: parsedAmount,
    date: parseDateFromTranscript(rawTranscript),
    description: extractDescription(rawTranscript),
    categoryName: category.categoryName,
    categoryId: category.categoryId,
    accountId: matchAccount(rawTranscript, accounts),
    rawTranscript,
  });
}
