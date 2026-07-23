import { Alert, Box, Button, Typography } from "@mui/material";

const ACCEPTED_IMPORT_FILES = ".csv,.ofx,.qif,.xlsx,.xls,.pdf,.xml,.camt,.sta,.mt940";

export default function ImportFileStep({ fileName = "", formatInfo = null, error = "", onFileSelected }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Selectionnez un releve bancaire. Horizon peut verifier les operations des fichiers CSV et PDF Revolut.
      </Typography>

      <Button component="label" variant="contained">
        Choisir un fichier
        <input
          hidden
          type="file"
          accept={ACCEPTED_IMPORT_FILES}
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            onFileSelected?.(file);
            event.target.value = "";
          }}
        />
      </Button>

      {fileName && (
        <Typography variant="body2">
          Fichier selectionne : {fileName}
        </Typography>
      )}

      {formatInfo && (
        <Alert severity={formatInfo.supported ? "success" : "warning"}>
          Format detecte : {formatInfo.displayLabel || formatInfo.format} ({formatInfo.detectionSource})
          {!formatInfo.supported ? " — ce format sera ajoute dans une phase ulterieure." : ""}
        </Alert>
      )}

      {error && (
        <Alert severity="error">{error}</Alert>
      )}
    </Box>
  );
}
