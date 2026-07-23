import { Alert, Box, CircularProgress } from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import { useForecast } from "../hooks/useForecast";
import ForecastSummaryCard from "../components/ForecastSummaryCard";
import {
  PILOTAGE_COLORS,
  PilotageEmptyState,
  PilotageHeader,
  PilotagePageShell,
  PilotageSection,
  PilotageSummary,
} from "../components/PilotagePageLayout";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export default function Previsions() {
  const { loading, error, forecast } = useForecast();

  const isEmptyForecast =
    Number(forecast?.currentBalance || 0) === 0 &&
    Number(forecast?.expectedRecurringIncome || 0) === 0 &&
    Number(forecast?.expectedFixedExpenses || 0) === 0 &&
    Number(forecast?.remainingBudgets || 0) === 0 &&
    Number(forecast?.forecastEndOfMonth || 0) === 0;

  const monthLabel = `${formatTargetDate(forecast?.monthStart)} au ${formatTargetDate(forecast?.monthEnd)}`;
  const cumulativeForecast = Number(forecast?.forecastEndOfMonth || 0);
  const expectedDelta = Number(forecast?.expectedRecurringIncome || 0)
    - Number(forecast?.expectedFixedExpenses || 0)
    - Number(forecast?.remainingBudgets || 0);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PilotagePageShell>
      <PilotageHeader
        title="Prévisions"
        countLabel="1 mois"
      />

      <PilotageSummary
        items={[
          { label: "Nombre de mois", value: 1, caption: monthLabel, color: PILOTAGE_COLORS.blue },
          { label: "Prévision cumulée", value: formatCurrency(cumulativeForecast), color: cumulativeForecast >= 0 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.red },
          { label: "Écart estimé", value: formatCurrency(expectedDelta), color: expectedDelta >= 0 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.orange },
        ]}
      />

      {error ? (
        <Alert severity="error">
          {error}
        </Alert>
      ) : isEmptyForecast ? (
        <PilotageEmptyState>
          Aucune donnée suffisante pour générer une prévision ce mois-ci.
        </PilotageEmptyState>
      ) : (
        <>
          <PilotageSection title="Liste principale" subtitle={`Période : ${monthLabel}`}>
            <ForecastSummaryCard forecast={forecast} />
          </PilotageSection>
          <PilotageSection title="Détails éventuels" subtitle="Flux déjà calculés pour la prévision mensuelle.">
            <ForecastSummaryCard forecast={forecast} compact />
          </PilotageSection>
        </>
      )}
    </PilotagePageShell>
  );
}
