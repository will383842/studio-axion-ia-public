"use client";

import { useEffect } from "react";
import { stockageSession } from "@/hooks/useSaisieGardee";
import { estErreurActionIntrouvable, rechargementPermis } from "@/lib/mise-a-jour-studio";

/**
 * Erreur de la racine : remplace le layout racine, donc sans globals.css (doc Next 16).
 * Styles en ligne sur les jetons recopiés : seule exception autorisée aux classes Tailwind.
 */
export default function ErreurGlobale({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Page ouverte avant une mise en ligne : la page se recharge (une fois par minute au plus), sans erreur brute.
  const miseAJour = estErreurActionIntrouvable(error);
  useEffect(() => {
    const s = stockageSession();
    if (miseAJour && s && rechargementPermis(s, Date.now())) window.location.reload();
  }, [miseAJour]);
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#16120f", color: "#f3ede4", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 16 }}>
        <div>
          <p style={{ fontSize: 64, fontWeight: 900, color: "#e07040", margin: 0 }}>Oups</p>
          <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>{miseAJour ? "Le studio vient d'être mis à jour" : "Le studio a rencontré un souci"}</h1>
          <p style={{ color: "#b8ada0", margin: "0 0 24px" }}>{miseAJour ? "Rechargez la page pour continuer." : "Rien n'est perdu. Réessayez."}</p>
          <button onClick={() => (miseAJour ? window.location.reload() : retry())} style={{ minHeight: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#c65a2e", color: "#fff6ec", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            {miseAJour ? "Recharger" : "Réessayer"}
          </button>
        </div>
      </body>
    </html>
  );
}
