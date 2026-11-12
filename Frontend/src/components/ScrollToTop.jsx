import { useEffect } from "react";
import { useLocation } from "react-router-dom";


export default function ScrollToTopPremium() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {

    if (!hash && !search) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }, [pathname, search, hash]);

  return null;
}
