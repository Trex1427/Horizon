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

function traceAuth(event, details = {}) {
  if (typeof window === "undefined") return;
  console.log("[NAV_TRACE]", new Date().toISOString(), `AuthProvider:${event}`, {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    ...details,
  });
}

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

    traceAuth("effect:start", { loading });

    getRedirectResult(auth).catch((error) => {
      if (active) {
        traceAuth("getRedirectResult:error", { message: mapAuthError(error) });
        setAuthError(mapAuthError(error));
      }
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (!active) {
          return;
        }

        traceAuth("onAuthStateChanged:next", {
          nextUid: nextUser?.uid || "",
          nextEmail: nextUser?.email || "",
        });

        setUser(nextUser);
        setLoading(false);
        setSigningIn(false);
      },
      (error) => {
        if (!active) {
          return;
        }

        traceAuth("onAuthStateChanged:error", { message: mapAuthError(error) });
        setAuthError(mapAuthError(error));
        setLoading(false);
        setSigningIn(false);
      },
    );

    return () => {
      traceAuth("effect:cleanup");
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    traceAuth("state", {
      loading,
      signingIn,
      isAuthenticated: Boolean(user),
      isAuthorized: authorization.isAuthorized,
      uid: user?.uid || "",
    });
  }, [authorization.isAuthorized, loading, signingIn, user]);

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
