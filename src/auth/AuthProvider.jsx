import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import {
  getAuthorizationState,
  isPopupRedirectError,
  mapAuthError,
  parseAllowedFirebaseUids,
} from "./authConfig";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const allowedUids = useMemo(
    () => parseAllowedFirebaseUids(import.meta.env.VITE_ALLOWED_FIREBASE_UIDS),
    [],
  );
  const isDevelopment = Boolean(import.meta.env.DEV);
  const authorization = useMemo(
    () => getAuthorizationState({ uid: user?.uid || "", allowedUids, isDevelopment }),
    [allowedUids, isDevelopment, user?.uid],
  );

  useEffect(() => {
    let active = true;

    getRedirectResult(auth).catch((error) => {
      if (active) {
        setAuthError(mapAuthError(error));
      }
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (!active) {
          return;
        }

        setUser(nextUser);
        setLoading(false);
        setSigningIn(false);
      },
      (error) => {
        if (!active) {
          return;
        }

        setAuthError(mapAuthError(error));
        setLoading(false);
        setSigningIn(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    setAuthError("");
    await signOut(auth);
    setUser(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError("");
  }, []);

  useEffect(() => {
    if (!loading && user && !authorization.isAuthorized) {
      setAuthError("Ce compte n'est pas autorisé à accéder à Horizon.");
    }
  }, [authorization.isAuthorized, loading, user]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError("");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (isPopupRedirectError(error)) {
        setAuthError(mapAuthError(error));
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      setAuthError(mapAuthError(error));
      setSigningIn(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    setSigningIn(true);
    setAuthError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(mapAuthError(error));
      setSigningIn(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    uid: user?.uid || "",
    loading,
    signingIn,
    isAuthenticated: Boolean(user),
    isAuthorized: authorization.isAuthorized,
    authorizationReason: authorization.reason,
    showLocalDiagnostic: authorization.shouldShowLocalDiagnostic,
    signInWithGoogle,
    signInWithEmail,
    clearAuthError,
    logout,
    authError,
  }), [
    authError,
    authorization.isAuthorized,
    authorization.reason,
    authorization.shouldShowLocalDiagnostic,
    clearAuthError,
    loading,
    logout,
    signInWithGoogle,
    signInWithEmail,
    signingIn,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
