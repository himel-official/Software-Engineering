import { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const MetaContext = createContext(null);

// Loads crime types, colours and fading rules once from the backend
export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    api("/meta").then(setMeta).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
