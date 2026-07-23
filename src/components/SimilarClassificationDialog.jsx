import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

export default function SimilarClassificationDialog({ open, suggestion, loading = false, onCancel, onConfirm }) {
  const count = suggestion?.transactions?.length || 0;

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle>{count} transaction{count > 1 ? "s" : ""} similaire{count > 1 ? "s" : ""}</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography><strong>Intitulé :</strong> {suggestion?.title}</Typography>
            <Typography><strong>Type :</strong> {suggestion?.typeLabel}</Typography>
            <Typography><strong>Période :</strong> {suggestion?.periodLabel}</Typography>
          </Box>
          <Box>
            <Typography fontWeight={700}>Classement à appliquer :</Typography>
            {(suggestion?.fields || []).map((field) => (
              <Typography key={field.key}>• {field.label} : {field.value}</Typography>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onCancel} disabled={loading}>Non, uniquement cette transaction</Button>
        <Button onClick={onConfirm} disabled={loading || count === 0} variant="contained">
          Appliquer aux {count} transaction{count > 1 ? "s" : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
