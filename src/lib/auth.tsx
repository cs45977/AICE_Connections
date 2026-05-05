import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signOut, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firestore-errors";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: "user" | "admin" | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"user" | "admin" | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch user record
        const userRef = doc(db, "users", user.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, "users/" + user.uid);
        }

        if (userSnap && userSnap.exists()) {
          const data = userSnap.data();
          setRole(data.role);
          
          // Bootstrap admin if needed
          if (user.email === "cs45977@gmail.com" && data.role !== "admin") {
            await setDoc(userRef, { ...data, role: "admin" }, { merge: true });
            setRole("admin");
          }
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    
    // Check user count for "no verification" logic
    const usersQuery = query(collection(db, "users"), limit(4));
    const usersSnap = await getDocs(usersQuery);
    const isEarlyUser = usersSnap.size < 3;

    try {
      const initialRole = email === "cs45977@gmail.com" ? "admin" : "user";
      
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        displayName: name,
        role: initialRole,
        createdAt: new Date().toISOString(),
        emailVerificationExempt: isEarlyUser
      });
      
      setRole(initialRole);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "auth_setup_user");
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signIn, register, resetPassword, logout }}>
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
