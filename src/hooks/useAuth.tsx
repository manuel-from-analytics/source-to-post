import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getExistingAuthAttemptId, recordAuthCheckpoint } from "@/lib/auth-diagnostics";

export type AuthStatus = "initializing" | "anonymous" | "authenticating" | "authenticated" | "error";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  status: AuthStatus;
  error: string | null;
  beginAuthentication: () => void;
  confirmSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  status: "initializing",
  error: null,
  beginAuthentication: () => {},
  confirmSession: async () => false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const revisionRef = useRef(0);

  const applyAuthenticatedSession = useCallback((nextSession: Session) => {
    revisionRef.current += 1;
    setSession(nextSession);
    setStatus("authenticated");
    setError(null);
    recordAuthCheckpoint("session_authenticated");
  }, []);

  const beginAuthentication = useCallback(() => {
    setStatus("authenticating");
    setError(null);
  }, []);

  const confirmSession = useCallback(async (): Promise<boolean> => {
    const confirmationRevision = revisionRef.current;
    setStatus("authenticating");
    recordAuthCheckpoint("session_validating");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      if (revisionRef.current === confirmationRevision) {
        setSession(null);
        setStatus("error");
        setError("session_missing");
      }
      recordAuthCheckpoint("session_invalid", "session_missing");
      return false;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      if (revisionRef.current === confirmationRevision) {
        setSession(null);
        setStatus("error");
        setError("session_invalid");
      }
      recordAuthCheckpoint("session_invalid", "user_validation_failed");
      return false;
    }

    applyAuthenticatedSession(sessionData.session);
    return true;
  }, [applyAuthenticatedSession]);

  useEffect(() => {
    let active = true;
    const initializationRevision = revisionRef.current;
    recordAuthCheckpoint("session_initializing");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;
        // Initialization below owns INITIAL_SESSION. Treating an empty initial
        // event as final can beat URL/session hydration after a full redirect.
        if (event === "INITIAL_SESSION") {
          recordAuthCheckpoint("session_event", event);
          return;
        }
        revisionRef.current += 1;
        recordAuthCheckpoint("session_event", event);
        setSession(nextSession);
        setStatus(nextSession ? "authenticated" : "anonymous");
        setError(null);
      }
    );

    const initialize = async () => {
      const recoveringOAuth = Boolean(getExistingAuthAttemptId());
      const attempts = recoveringOAuth ? 40 : 1;
      if (recoveringOAuth) setStatus("authenticating");

      let storedSession: Session | null = null;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const { data, error: storedSessionError } = await supabase.auth.getSession();
        if (!active || revisionRef.current !== initializationRevision) return;
        if (!storedSessionError && data.session) {
          storedSession = data.session;
          break;
        }
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      if (!active || revisionRef.current !== initializationRevision) return;
      if (!storedSession) {
        setSession(null);
        setStatus(recoveringOAuth ? "error" : "anonymous");
        setError(recoveringOAuth ? "session_timeout" : null);
        recordAuthCheckpoint(recoveringOAuth ? "session_invalid" : "session_missing", recoveringOAuth ? "session_timeout" : undefined);
        return;
      }

      // Server validation is safe here because this runs outside the auth
      // state callback and therefore cannot deadlock session persistence.
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (revisionRef.current !== initializationRevision) return;
      if (!error && data.user) {
        applyAuthenticatedSession(storedSession);
      } else {
        setSession(null);
        setStatus("anonymous");
        setError(null);
        recordAuthCheckpoint("session_invalid", "initial_user_validation_failed");
      }
    };

    void initialize();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applyAuthenticatedSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading: status === "initializing" || status === "authenticating",
      status,
      error,
      beginAuthentication,
      confirmSession,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
