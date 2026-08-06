import { useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography, useMediaQuery } from "../components/ui/foundations/MuiPrimitives";
import { Add, Clear, Search } from "../components/ui/icons/MuiIcons";
import { useCategories } from "../hooks/useCategories";
import { CategoryCard } from "../components/CategoryCard";
import { CategoryForm } from "../components/CategoryForm";

const HORIZON_COLORS = {
  ink: "#172a2f",
  light: "#f6f8f4",
  line: "rgba(23, 42, 47, 0.12)",
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function Categories() {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const { categories, loading, error, addCategory, updateCategory, deleteCategory } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [search, setSearch] = useState("");

  const visibleCategories = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return categories;
    return categories.filter((category) => normalizeText([category.name, category.type].filter(Boolean).join(" ")).includes(query));
  }, [categories, search]);

  const handleSubmit = async (payload) => {
    if (editingCategory) {
      return updateCategory(editingCategory.id, payload);
    }

    return addCategory(payload);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingCategory(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 1.25, flexDirection: { xs: "column", sm: "row" } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: HORIZON_COLORS.ink, lineHeight: 1.15 }}>
            Catégories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {categories.length} élément(s) · {categories.length} active(s)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingCategory(null);
            setFormOpen(true);
          }}
        >
          Ajouter
        </Button>
      </Box>

      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher une catégorie"
        size="small"
        type="search"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Effacer la recherche" onClick={() => setSearch("")}>
                <Clear fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
        {visibleCategories.length} sur {categories.length} catégorie(s) affichée(s)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}

      {categories.length === 0 ? (
        <Box sx={{ border: "1px dashed", borderColor: HORIZON_COLORS.line, borderRadius: 2, p: 2, bgcolor: HORIZON_COLORS.light }}>
          <Typography sx={{ fontWeight: 800, color: HORIZON_COLORS.ink }}>Aucune catégorie active pour le moment.</Typography>
          <Button size="small" variant="contained" sx={{ mt: 1 }} onClick={() => setFormOpen(true)}>
            Ajouter une catégorie
          </Button>
        </Box>
      ) : visibleCategories.length === 0 ? (
        <Box sx={{ border: "1px dashed", borderColor: HORIZON_COLORS.line, borderRadius: 2, p: 2, bgcolor: HORIZON_COLORS.light }}>
          <Typography sx={{ fontWeight: 800, color: HORIZON_COLORS.ink }}>Aucune catégorie ne correspond à votre recherche.</Typography>
          <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => setSearch("")}>
            Effacer la recherche
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {visibleCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEdit}
              onDelete={deleteCategory}
              enableDoubleClickEdit={enableDesktopDoubleClickEdit}
            />
          ))}
        </Stack>
      )}

      <CategoryForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialCategory={editingCategory}
        isLoading={false}
      />
    </Box>
  );
}
