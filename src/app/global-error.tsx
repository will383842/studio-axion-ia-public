"use client";

import { useEffect } from "react";
import { stockageSession } from "@/hooks/useSaisieGardee";
import { estErreurActionIntrouvable, rechargementPermis } from "@/lib/mise-a-jour-studio";

/**
 * Valeurs RECOPIÉES des jetons de globals.css (clair) : cette page remplace le layout racine, donc ne charge pas
 * globals.css (doc Next 16) et doit tenir debout quand tout plante. Un test (tests/visuels/ref-r10-pages-annexes.test.ts)
 * vérifie qu'elles restent identiques aux jetons ; changer une valeur ici sans changer le jeton le fait échouer.
 */
const JETONS_ERREUR = {
  fond: "#f3f7fb",
  texte: "#14212e",
  texteDoux: "#44566a",
  accent: "#14507f",
  orange: "#b4512a",
  surOrange: "#ffffff",
} as const;

/**
 * Erreur de la racine : styles en ligne sur ces jetons recopiés : seule exception autorisée aux classes Tailwind.
 * M7 : « Oups » en accent (bleu), l'orange reste au bouton.
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
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: JETONS_ERREUR.fond, color: JETONS_ERREUR.texte, fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 16 }}>
        <div>
          <p style={{ fontSize: 64, fontWeight: 800, color: JETONS_ERREUR.accent, margin: 0 }}>Oups</p>
          <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>{miseAJour ? "Le studio vient d'être mis à jour" : "Le studio a rencontré un souci"}</h1>
          <p style={{ color: JETONS_ERREUR.texteDoux, margin: "0 0 24px" }}>{miseAJour ? "Rechargez la page pour continuer." : "Rien n'est perdu. Réessayez."}</p>
          <button onClick={() => (miseAJour ? window.location.reload() : retry())} style={{ minHeight: 48, padding: "0 24px", borderRadius: 999, border: 0, background: JETONS_ERREUR.orange, color: JETONS_ERREUR.surOrange, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            {miseAJour ? "Recharger" : "Réessayer"}
          </button>
        </div>
      </body>
    </html>
  );
}
