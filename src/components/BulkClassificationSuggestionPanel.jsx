import { Button, Paper, Stack, Typography } from "@mui/material";

export default function BulkClassificationSuggestionPanel({
  suggestion = null,
  onAcceptSuggestion,
  onChooseAnotherCategory,
  acceptDisabled = false,
  applied = false,
}) {
  if (!suggestion) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        backgroundColor: "rgba(15, 23, 42, 0.03)",
      }}
    >
      <Stack spacing={0.75}>
        <Typography variant="overline" color="text.secondary">
          Suggestion
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
          {suggestion.sourceLabel}
        </Typography>

        <Stack spacing={0.25}>
          <Typography variant="body2" color="text.secondary">
            Catégorie suggérée :
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {suggestion.categoryName}
          </Typography>
        </Stack>

        {applied ? (
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
            Suggestion appliquée
          </Typography>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" size="small" onClick={onAcceptSuggestion} disabled={acceptDisabled} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>
            Accepter la suggestion
          </Button>
          <Button variant="text" size="small" onClick={onChooseAnotherCategory} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>
            Choisir une autre catégorie
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}