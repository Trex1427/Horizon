import { useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, useMediaQuery } from "@mui/material";
import { useObjectives } from "../hooks/useObjectives";
import { ObjectiveCard } from "../components/ObjectiveCard";
import { ObjectiveForm } from "../components/ObjectiveForm";
import ObjectivesProgressRings from "../components/charts/ObjectivesProgressRings";
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

function getObjectiveProgress(objective = {}) {
  const currentAmount = Number(objective.currentAmount || 0);
  const targetAmount = Number(objective.targetAmount || 0);
  return targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
}

export default function Objectifs() {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const { objectives, loading, error, addObjective, updateObjective, deleteObjective } =
    useObjectives();
  const [formOpen, setFormOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [searchText, setSearchText] = useState("");

  const objectiveRows = useMemo(() => (
    (objectives || []).map((objective) => ({
      objective,
      progress: getObjectiveProgress(objective),
      targetAmount: Number(objective.targetAmount || 0),
      currentAmount: Number(objective.currentAmount || 0),
    }))
  ), [objectives]);

  const filteredObjectiveRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return objectiveRows;
    }

    return objectiveRows.filter(({ objective }) => (
      String(objective?.name || "").toLowerCase().includes(query)
      || String(objective?.status || "").toLowerCase().includes(query)
    ));
  }, [objectiveRows, searchText]);

  const summary = useMemo(() => {
    const activeRows = objectiveRows.filter(({ objective }) => objective?.status !== "completed" && objective?.status !== "archive");
    const targetAmount = objectiveRows.reduce((sum, row) => sum + row.targetAmount, 0);
    const averageProgress = objectiveRows.length > 0
      ? objectiveRows.reduce((sum, row) => sum + row.progress, 0) / objectiveRows.length
      : 0;

    return {
      activeCount: activeRows.length,
      targetAmount,
      averageProgress,
    };
  }, [objectiveRows]);

  const handleAddObjective = async (payload) => addObjective(payload);

  const handleUpdateObjective = async (id, payload) => updateObjective(id, payload);

  const handleEditObjective = (objective) => {
    setEditingObjective(objective);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    if (editingObjective) {
      const result = await handleUpdateObjective(editingObjective.id, payload);
      if (result.success) {
        setEditingObjective(null);
      }
      return result;
    }

    return handleAddObjective(payload);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingObjective(null);
  };

  const handleDeleteObjective = async (id) => deleteObjective(id);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PilotagePageShell>
      <PilotageHeader
        title="Objectifs"
        countLabel={`${objectives.length} objectif(s)`}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Rechercher un objectif"
        onAdd={() => {
          setEditingObjective(null);
          setFormOpen(true);
        }}
      />

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <PilotageSummary
        items={[
          { label: "Objectifs actifs", value: summary.activeCount, color: PILOTAGE_COLORS.blue },
          { label: "Montant cible", value: formatCurrency(summary.targetAmount), color: PILOTAGE_COLORS.green },
          { label: "Progression moyenne", value: `${Math.round(summary.averageProgress)}%`, color: summary.averageProgress >= 100 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.orange },
        ]}
      />

      {!error && objectives.length > 0 && (
        <PilotageSection title="KPIs" subtitle="Progression synthetique des objectifs principaux.">
          <ObjectivesProgressRings objectives={objectives} />
        </PilotageSection>
      )}

      <PilotageSection title="Liste principale" subtitle={`${filteredObjectiveRows.length} objectif(s) affiché(s)`}>
        {objectives.length === 0 ? (
          <PilotageEmptyState>Aucun objectif pour le moment. Commencez par en creer un.</PilotageEmptyState>
        ) : filteredObjectiveRows.length === 0 ? (
          <PilotageEmptyState>Aucun objectif ne correspond à la recherche.</PilotageEmptyState>
        ) : (
          <Stack spacing={1.25}>
            {filteredObjectiveRows.map(({ objective }) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                onEdit={handleEditObjective}
                onDelete={handleDeleteObjective}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </PilotageSection>

      <ObjectiveForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        isLoading={false}
        initialObjective={editingObjective}
      />
    </PilotagePageShell>
  );
}
