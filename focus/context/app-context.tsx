import { createContext, useContext, useState, type PropsWithChildren } from "react";

type AppContextValue = {
  focusMinutes: number;
  setFocusMinutes: (value: number) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [focusMinutes, setFocusMinutes] = useState(25);

  return (
    <AppContext.Provider value={{ focusMinutes, setFocusMinutes }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return context;
}
