import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

const STORAGE_KEY = "horizon-beta-journal";

function loadEntries() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function BetaJournalSection() {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  function handleAddEntry() {
    const text = draft.trim();
    if (!text) {
      return;
    }

    const nextEntries = [
      {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        note: text,
      },
      ...entries,
    ].slice(0, 50);

    setEntries(nextEntries);
    saveEntries(nextEntries);
    setDraft("");
  }

  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Typography variant="h6">Journal beta</Typography>
      <Alert severity="info">
        Notez ici les retours d'utilisation beta. Les notes restent locales sur cet appareil et ne contiennent aucun secret ni fichier bancaire brut.
      </Alert>

      <TextField
        label="Retour beta"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        multiline
        minRows={3}
        fullWidth
      />

      <Button variant="contained" onClick={handleAddEntry} sx={{ width: { xs: "100%", sm: "fit-content" } }}>
        Ajouter une note
      </Button>

      {entries.length === 0 ? (
        <Alert severity="info">Aucune note beta pour le moment.</Alert>
      ) : (
        <Stack spacing={1}>
          {entries.map((entry) => (
            <Box key={entry.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {new Date(entry.createdAt).toLocaleString("fr-FR")}
              </Typography>
              <Typography variant="body2">{entry.note}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}