import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Delete from "@mui/icons-material/Delete";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import Edit from "@mui/icons-material/Edit";
import { useAccounts } from "../hooks/useAccounts.js";
import { useCategories } from "../hooks/useCategories.js";
import { useVehicles } from "../hooks/useVehicles.js";
import { useTransactionsContext } from "../context/TransactionsContext.jsx";
import { calculateVehicleExpenses } from "../services/vehicleService.js";
import VehicleFormDialog from "../components/VehicleFormDialog.jsx";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const EMPTY_FORM = { id: "", name: "" };

function VehicleDetail({ vehicle, transactions, accounts, categories, onBack, onEdit }) {
  const accountMap = useMemo(() => new Map(accounts.map((entry) => [entry.id, entry])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((entry) => [entry.id, entry])), [categories]);
  const expenses = useMemo(() => calculateVehicleExpenses(vehicle.id, transactions), [vehicle.id, transactions]);
  return <Stack spacing={3}>
    <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ alignSelf: "flex-start" }}>Retour aux véhicules</Button>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
      <Box><Typography variant="overline" color="primary">Véhicule</Typography><Typography variant="h4" fontWeight={800}>{vehicle.name}</Typography></Box>
      <Button startIcon={<Edit />} variant="outlined" onClick={onEdit}>Modifier</Button>
    </Stack>
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 7 }}><Card variant="outlined"><CardContent><Typography variant="overline" color="text.secondary">Informations</Typography><Typography variant="h6">Nom</Typography><Typography>{vehicle.name}</Typography></CardContent></Card></Grid>
      <Grid size={{ xs: 12, md: 5 }}><Card variant="outlined" sx={{ bgcolor: "rgba(15,82,87,.05)" }}><CardContent><Typography variant="overline" color="text.secondary">KPI</Typography><Typography variant="body2">Total des dépenses</Typography><Typography variant="h4" fontWeight={900} color="primary.main">{currency.format(expenses.total)}</Typography></CardContent></Card></Grid>
    </Grid>
    <Box><Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>Dépenses</Typography>
      <TableContainer component={Paper} variant="outlined"><Table size="small" sx={{ minWidth: 700 }} aria-label={`Dépenses du véhicule ${vehicle.name}`}>
        <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Libellé</TableCell><TableCell>Catégorie</TableCell><TableCell align="right">Montant</TableCell><TableCell>Compte</TableCell></TableRow></TableHead>
        <TableBody>{expenses.transactions.map((transaction) => <TableRow key={transaction.id} hover>
          <TableCell>{transaction.date || "—"}</TableCell><TableCell>{transaction.description || "Sans libellé"}</TableCell>
          <TableCell>{transaction.categoryName || transaction.categorie || categoryMap.get(transaction.categoryId)?.name || "Sans catégorie"}</TableCell>
          <TableCell align="right"><Typography fontWeight={800}>{currency.format(Math.abs(Number(transaction.montant) || 0))}</Typography></TableCell>
          <TableCell>{accountMap.get(transaction.accountId)?.name || transaction.accountName || "Compte indisponible"}</TableCell>
        </TableRow>)}
        {!expenses.transactions.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucune dépense liée à ce véhicule.</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>
    </Box>
  </Stack>;
}

export default function Vehicles() {
  const api = useVehicles();
  const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactionsContext();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(null);
  const selected = api.vehicles.find((vehicle) => vehicle.id === selectedId);
  const save = (values) => values.id ? api.editVehicle(values.id, { name: values.name }) : api.addVehicle({ name: values.name });
  const remove = async (vehicle) => {
    if (!window.confirm("Supprimer le véhicule “" + vehicle.name + "” ?\\nIl ne sera plus proposé dans les nouvelles transactions. Les anciennes transactions qui lui sont associées seront conservées.")) return;
    const result = await api.removeVehicle(vehicle.id);
    if (result.success && selectedId === vehicle.id) setSelectedId("");
  };
  if (api.loading || transactionsLoading) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  if (api.error || transactionsError) return <Alert severity="error">{api.error || transactionsError}</Alert>;
  return <Box sx={{ maxWidth: 1050, mx: "auto", py: 1 }}>
    {selected ? <VehicleDetail vehicle={selected} transactions={transactions} accounts={accounts} categories={categories} onBack={() => setSelectedId("")} onEdit={() => setForm({ id: selected.id, name: selected.name })} /> : <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
        <Box><Typography variant="overline" color="primary">Référentiel</Typography><Typography variant="h4" fontWeight={800}>Véhicules</Typography><Typography color="text.secondary">Attribuez vos dépenses au bon véhicule.</Typography></Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ ...EMPTY_FORM })}>Ajouter un véhicule</Button>
      </Stack>
      <Grid container spacing={2}>{api.vehicles.map((vehicle) => <Grid key={vehicle.id} size={{ xs: 12, sm: 6, md: 4 }}>
        <Card variant="outlined" role="button" tabIndex={0} onClick={() => setSelectedId(vehicle.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(vehicle.id); } }} sx={{ cursor: "pointer", height: "100%", "&:hover": { borderColor: "primary.main" } }}>
          <CardContent><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Stack direction="row" spacing={1} alignItems="center"><DirectionsCar color="primary" /><Typography variant="h6" fontWeight={800}>{vehicle.name}</Typography></Stack><Chip size="small" label="Actif" color="success" /></Stack>
            <Stack direction="row" spacing={.5} sx={{ mt: 2 }}><IconButton aria-label={`Modifier ${vehicle.name}`} onClick={(event) => { event.stopPropagation(); setForm({ id: vehicle.id, name: vehicle.name }); }}><Edit /></IconButton><IconButton color="error" aria-label={`Supprimer ${vehicle.name}`} onClick={(event) => { event.stopPropagation(); remove(vehicle); }}><Delete /></IconButton></Stack>
          </CardContent>
        </Card>
      </Grid>)}</Grid>
      {!api.vehicles.length && <Paper variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>Aucun véhicule. Créez votre premier véhicule.</Paper>}
    </Stack>}
    {form && <VehicleFormDialog open title={form.id ? "Modifier le véhicule" : "Ajouter un véhicule"} initialName={form.name} onClose={() => setForm(null)} onSave={(name) => save({ ...form, name })} />}
  </Box>;
}
