import { Box, Card, CardContent, Typography } from "@mui/material";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";

export default function TransactionList({ transactions }) {
  return (
    <Box>
      {transactions.map((transaction) => (
        (() => {
          const normalizedType = normalizeTransactionType(transaction.type);
          const amountColor = normalizedType === "depense"
            ? "error.main"
            : normalizedType === "revenu"
              ? "success.main"
              : "warning.main";
          const amountPrefix = normalizedType === "depense"
            ? "-"
            : normalizedType === "revenu"
              ? "+"
              : "";

          return (
        <Card key={transaction.id} sx={{ mb: 1 }}>
          <CardContent>
            <Typography fontWeight={700}>
              {transaction.description || "Sans description"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getSafeCategoryLabel(transaction?.categoryName || transaction?.categorie)} — {transaction.date}
            </Typography>
            {(transaction.subcategoryName || transaction.activityName || transaction.thirdPartyName || transaction.projectName) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                {[transaction.subcategoryName, transaction.activityName, transaction.thirdPartyName, transaction.projectName].filter(Boolean).join(" • ")}
              </Typography>
            )}
            <Typography
              color={amountColor}
              fontWeight={700}
              sx={{ mt: 0.5 }}
            >
              {amountPrefix}
              {transaction.montant} €
            </Typography>
          </CardContent>
        </Card>
          );
        })()
      ))}
    </Box>
  );
}
