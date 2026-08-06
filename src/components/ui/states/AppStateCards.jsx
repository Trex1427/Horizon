import { Card, CardContent, Typography } from "@mui/material";

export function LoadingMessageCard({
  title = "Chargement...",
  description = "Preparation des donnees.",
  titleSx = {},
  cardSx = {},
  contentSx = {},
}) {
  return (
    <Card sx={{ mb: 1.25, borderRadius: 2, border: "1px solid rgba(20, 41, 43, 0.1)", boxShadow: "0 8px 24px rgba(23, 42, 47, 0.08)", ...cardSx }}>
      <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 }, ...contentSx }}>
        <Typography sx={{ fontWeight: 800, color: "#172a2f", ...titleSx }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function ResultsEmptyCard({ title, description, cardSx = {}, contentSx = {} }) {
  return (
    <Card sx={{ mb: 1.25, borderRadius: 2, border: "1px solid rgba(15, 95, 143, 0.14)", boxShadow: "0 8px 24px rgba(23, 42, 47, 0.08)", ...cardSx }}>
      <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 }, ...contentSx }}>
        <Typography sx={{ fontWeight: 900, color: "#0f5f8f" }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}