import { useMemo, useState } from "react";
import { Alert, Box, Button, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from "@mui/material";

const DUPLICATE_DECISIONS = [
  { value: "review", label: "Les revoir une par une", helper: "Chaque doublon restera a verifier dans l'etape de validation." },
  { value: "skip", label: "Les ignorer", helper: "Ces operations ne seront pas importees." },
  { value: "import", label: "Les importer quand meme", helper: "Les doublons resteront selectionnes pour l'import." },
];

function getDuplicateLabel(status) {
  if (status === "exact_duplicate") {
    return "Doublon exact";
  }

  if (status === "probable_duplicate") {
    return "Doublon probable";
  }

  return "Doublon a verifier";
}

export default function ImportDuplicateStep({ rows = [], onApplyDecision, onContinue }) {
  const duplicateRows = useMemo(
    () => rows.filter((row) => row.duplicateStatus && row.duplicateStatus !== "new_transaction"),
    [rows]
  );
  const exactCount = duplicateRows.filter((row) => row.duplicateStatus === "exact_duplicate").length;
  const probableCount = duplicateRows.filter((row) => row.duplicateStatus === "probable_duplicate").length;
  const [decision, setDecision] = useState("");

  function applyDecision(nextDecision) {
    setDecision(nextDecision);
    onApplyDecision?.("exact_duplicate", nextDecision);
    onApplyDecision?.("probable_duplicate", nextDecision);
  }

  if (duplicateRows.length === 0) {
    return (
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 900 }}>Aucun doublon detecte.</Typography>
          <Typography variant="body2">Toutes les operations peuvent etre importees.</Typography>
        </Alert>

        <Box>
          <Button variant="contained" color="success" size="large" onClick={onContinue}>
            Continuer vers la validation -&gt;
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900, color: "#172a2f" }}>
          {duplicateRows.length} doublon{duplicateRows.length > 1 ? "s" : ""} probable{duplicateRows.length > 1 ? "s" : ""} trouve{duplicateRows.length > 1 ? "s" : ""}.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choisissez quoi faire.
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        Doublons exacts: {exactCount} - Doublons probables: {probableCount}
      </Alert>

      <FormControl>
        <RadioGroup value={decision} onChange={(event) => applyDecision(event.target.value)}>
          {DUPLICATE_DECISIONS.map((option) => (
            <Box key={option.value} sx={{ border: "1px solid rgba(20, 41, 43, 0.12)", borderRadius: 2, px: 1, py: 0.75, mb: 0.75 }}>
              <FormControlLabel
                value={option.value}
                control={<Radio />}
                label={<Typography sx={{ fontWeight: 800 }}>{option.label}</Typography>}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: 4 }}>
                {option.helper}
              </Typography>
            </Box>
          ))}
        </RadioGroup>
      </FormControl>

      <Stack spacing={1}>
        {duplicateRows.map((row) => (
          <Box data-import-duplicate-row="true" key={`${row.fingerprint}-${row.sourceRowIndex}`} sx={{ border: "1px solid rgba(20, 41, 43, 0.1)", borderRadius: 2, p: 1, bgcolor: "rgba(255,255,255,0.96)" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.5} justifyContent="space-between">
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.rawLabel || "Libelle a verifier"}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 900 }}>{Number(row.amount || 0).toFixed(2)} EUR</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {row.operationDate || "Date a verifier"} - {getDuplicateLabel(row.duplicateStatus)} - {row.duplicateReason || "raison a verifier"} - Decision: {row.userDecision}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box>
        <Button variant="contained" color="success" size="large" onClick={onContinue} disabled={!decision}>
          Continuer vers la validation -&gt;
        </Button>
      </Box>
    </Box>
  );
}
