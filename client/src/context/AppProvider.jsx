import { useMemo, useState } from "react";
import AppContext from "./AppContext";

const AppProvider = ({ children }) => {
  const [noteResult, setNoteResult] = useState("");
  const [riskResult, setRiskResult] = useState(null);

  const value = useMemo(
    () => ({
      noteResult,
      setNoteResult,
      riskResult,
      setRiskResult,
    }),
    [noteResult, riskResult]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppProvider;
