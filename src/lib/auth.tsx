import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firestore-errors";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  companyId: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch or create user record and company
        const userRef = doc(db, "users", user.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, "users/" + user.uid);
        }

        if (userSnap && userSnap.exists()) {
          setCompanyId(userSnap.data().companyId);
        } else {
          // Create new user and company based on domain
          const domain = user.email?.split("@")[1];
          if (domain) {
            const companyId = domain.replace(/\./g, "-");
            const companyRef = doc(db, "companies", companyId);
            
            try {
              const companySnap = await getDoc(companyRef);

              if (!companySnap.exists()) {
                try {
                  await setDoc(companyRef, {
                    domain,
                    name: domain.split("-")[0],
                    createdAt: new Date().toISOString(),
                  });
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, "auth_setup_company");
                }
              }

              try {
                await setDoc(userRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName || null,
                  companyId,
                  role: "user",
                  createdAt: new Date().toISOString(),
                });
                setCompanyId(companyId);
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, "auth_setup_user");
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.GET, "auth_setup_get_company");
            }
          }
        }
      } else {
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, companyId, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
