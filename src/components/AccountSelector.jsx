import { MenuItem, TextField } from "@mui/material";

export default function AccountSelector({
  value,
  onChange,
  accounts = [],
  disabled = false,
  name = "accountId",
  label = "Compte",
  size = "medium",
  sx,
  createOptionValue = "",
  createOptionLabel = "",
}) {
  return (
    <TextField
      label={label}
      name={name}
      select
      value={value || ""}
      onChange={onChange}
      fullWidth
      size={size}
      sx={{ mb: 2, ...sx }}
      disabled={disabled}
      required
    >
      {accounts.map((account) => (
        <MenuItem key={account.id} value={account.id}>
          {account.icon || "💳"} {account.name}
        </MenuItem>
      ))}
      {createOptionValue ? <MenuItem disabled divider /> : null}
      {createOptionValue ? (
        <MenuItem value={createOptionValue} sx={{ color: "primary.main", fontWeight: 600 }}>
          {createOptionLabel}
        </MenuItem>
      ) : null}
    </TextField>
  );
}
