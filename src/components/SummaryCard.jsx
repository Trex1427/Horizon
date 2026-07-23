import { Card, CardContent, Typography } from "@mui/material";

export default function SummaryCard({ title, value, color = "primary.main", subtitle }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
