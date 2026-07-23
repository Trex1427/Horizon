import { Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import Google from "@mui/icons-material/Google";
import Logout from "@mui/icons-material/Logout";
import { useAuth } from "./useAuth";

function AuthShell({ children }) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
        background: "linear-gradient(180deg, #f8faf6 0%, #e8f1ec 100%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid rgba(20, 41, 43, 0.14)",
          borderRadius: 3,
          p: { xs: 2.5, sm: 4 },
          boxShadow: "0 22px 44px rgba(20, 41, 43, 0.12)",
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}

export function AuthGate({ children }) {
  const {
    authError,
    isAuthenticated,
    isAuthorized,
    loading,
    logout,
    showLocalDiagnostic,
    signInWithGoogle,
    signingIn,
    uid,
    user,
  } = useAuth();

  if (loading) {
    return (
      <AuthShell>
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          <CircularProgress size={32} />
          <Typography variant="h6">Horizon</Typography>
          <Typography color="text.secondary">Chargement de la session...</Typography>
        </Stack>
      </AuthShell>
    );
  }

  if (isAuthenticated && !isAuthorized) {
    return (
      <AuthShell>
        <Stack spacing={2.5}>
          <Typography variant="h4" sx={{ fontFamily: '"Fraunces", "Times New Roman", serif', fontWeight: 700 }}>
            Horizon
          </Typography>
          <Typography color="text.secondary">
            Ce compte n'est pas autorisé à accéder à Horizon.
          </Typography>
          {showLocalDiagnostic && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(15, 82, 87, 0.08)" }}>
              <Typography variant="body2">Diagnostic local</Typography>
              <Typography variant="caption" sx={{ display: "block" }}>UID: {uid}</Typography>
              <Typography variant="caption" sx={{ display: "block" }}>Email: {user?.email || "non renseigné"}</Typography>
              <Typography variant="caption" sx={{ display: "block" }}>Nom: {user?.displayName || "non renseigné"}</Typography>
            </Box>
          )}
          <Button variant="outlined" startIcon={<Logout />} onClick={logout}>
            Se déconnecter
          </Button>
        </Stack>
      </AuthShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthShell>
        <Stack spacing={2.5}>
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontFamily: '"Fraunces", "Times New Roman", serif',
                fontWeight: 700,
                color: "#0f5257",
              }}
            >
              Horizon
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Connectez-vous pour accéder à vos finances.
            </Typography>
          </Box>

          {authError && (
            <Typography color="error" role="alert">
              {authError}
            </Typography>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={<Google />}
            onClick={signInWithGoogle}
            disabled={signingIn}
            sx={{
              minHeight: 48,
              bgcolor: "#0f5257",
              "&:hover": { bgcolor: "#0b4348" },
            }}
          >
            {signingIn ? "Connexion en cours..." : "Continuer avec Google"}
          </Button>
        </Stack>
      </AuthShell>
    );
  }

  return children;
}
