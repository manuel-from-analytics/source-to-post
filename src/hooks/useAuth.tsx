import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        // Keep this callback synchronous. Calling another auth method here can
        // wait on the same internal lock as setSession and stall OAuth forever.
        setSession(session);
        setLoading(false);
      }
    );

    const initialize = async () => {
      const { data: { session: storedSession } } = await supabase.auth.getSession();
      if (!active) return;

      if (!storedSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Server validation is safe here because this runs outside the auth
      // state callback and therefore cannot deadlock session persistence.
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      setSession(!error && data.user ? storedSession : null);
      setLoading(false);
    };

    void initialize();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
