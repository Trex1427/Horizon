import { Box, Card, CardContent, Typography } from "@mui/material";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

export default function CategorySummary({ categories }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {categories.map((category) => (
        <Card key={category.name}>
          <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
            <Typography>{getSafeCategoryLabel(category.name)}</Typography>
            <Typography fontWeight={700}>{category.amount} €</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
