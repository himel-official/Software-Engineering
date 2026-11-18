import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { MetaProvider } from "./MetaContext.jsx";
import { UnreadProvider } from "./UnreadContext.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MetaProvider>
          <UnreadProvider>
            <App />
          </UnreadProvider>
        </MetaProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
