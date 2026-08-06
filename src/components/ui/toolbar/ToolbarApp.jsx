import { IconButton, InputAdornment, Stack, TextField } from "../foundations/MuiPrimitives";
import { Search, Settings } from "../icons/MuiIcons";
import { AppSearchBar } from "./AppToolbar";
import { ActionBar } from "../navigation/Navigation";

export function AppSecondaryToolsButton({
  onClick,
  ariaLabel = "Ouvrir les outils secondaires",
  buttonSize = 44,
}) {
  return (
    <IconButton
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      sx={{
        width: buttonSize,
        height: buttonSize,
        borderRadius: 1.5,
        border: "1px solid rgba(20, 41, 43, 0.16)",
        bgcolor: "#fff",
      }}
    >
      <Settings fontSize="small" />
    </IconButton>
  );
}

export function AppToolbarSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  buttonSize = 44,
  utilityAction = null,
  onOpenSecondaryTools = null,
}) {
  const resolvedUtilityAction = utilityAction || (
    typeof onOpenSecondaryTools === "function"
      ? (
          <AppSecondaryToolsButton
            onClick={onOpenSecondaryTools}
            ariaLabel="Ouvrir les outils secondaires"
            buttonSize={buttonSize}
          />
        )
      : null
  );

  return (
    <AppSearchBar utilityAction={resolvedUtilityAction}>
      <TextField
        hiddenLabel
        name="searchText"
        size="small"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        fullWidth
        inputProps={{ "aria-label": ariaLabel }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
          sx: {
            minHeight: buttonSize,
            "& input": {
              py: 1,
              fontSize: "0.92rem",
            },
          },
        }}
      />
    </AppSearchBar>
  );
}

export function CompactToolbarLayout({
  children,
  className = "v2-card transactions-compact-toolbar transactions-toolbar-core",
  label = "Toolbar compacte",
  stackSx = {},
}) {
  return (
    <ActionBar className={className} unstyled label={label}>
      <Stack spacing={0.75} sx={{ width: "100%", ...stackSx }}>
        {children}
      </Stack>
    </ActionBar>
  );
}