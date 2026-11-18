"use client";

/**
 * CAL-23 · « Retirer » une publication DÉJÀ programmée (entrée de créneau) : bouton, confirmation, résultat.
 * Le retrait chez le diffuseur est fait et relu par l'action serveur ; ici on ne dit « retirée » que si l'action le confirme.
 * Un seul bouton orange par écran : ces boutons sont neutres. Lisible à 375 px (boutons empilés, pleine largeur).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";

/** Le routeur de l'application ; hors application (rendu de test), `null` : on recharge la page. */
function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export const PHRASE_CONFIRMATION_RETRAIT_PROGRAMME =
  "Retirer cette publication ? Elle ne partira pas à l'heure prévue. Son texte et son fichier sont gardés : vous la retrouvez dans « À placer ».";

/** Un titre court par cas, avant la phrase de l'action : jamais un faux succès. */
const TITRES_RETRAIT: Readonly<Record<string, string>> = {
  RETRAIT_A_VERIFIER: "À vérifier.",
  RETRAIT_A_LA_MAIN: "À retirer à la main.",
  RETRAIT_RESTE_PROGRAMME: "Pas retirée.",
  RETRAIT_REFUSE: "Pas retirée.",
};
const SANS_REPONSE = "Le retrait n'a pas pu être confirmé. La publication reste programmée : rechargez la page, puis vérifiez-la avant de réessayer.";

export function RetirerProgrammation({ cle }: { cle: string }) {
  const routeur = useRouteurOuNul();
  const [etape, setEtape] = useState<"repos" | "confirmation" | "fait">("repos");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aVoir, setAVoir] = useState<string | null>(null);

  async function confirmer() {
    if (enCours) return;
    setEnCours(true);
    setAVoir(null);
    try {
      // Importée au clic : l'action lit la clé de fiche dans FicheEntree, qui montre ce composant (pas de cycle d'imports).
      const { retirerProgrammationAction } = await import("@/app/(studio)/calendrier/actions/retirer");
      const r = await retirerProgrammationAction(cle, "retirer");
      if (r.ok) {
        setMessage(r.donnees.message);
        setEtape("fait");
        // Le retrait est fait : un rafraîchissement raté ne doit jamais le faire passer pour un échec.
        try {
          if (routeur) routeur.refresh();
          else window.location.reload();
        } catch {
          /* l'écran se mettra à jour au prochain chargement */
        }
      } else {
        const titre = r.code ? TITRES_RETRAIT[r.code] : undefined;
        setAVoir(titre ? `${titre} ${r.message}` : r.message);
        setEtape("repos");
      }
    } catch {
      setAVoir(SANS_REPONSE);
      setEtape("repos");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-trait pt-3" data-geste="retirer-programme">
      {etape === "repos" && (
        <Bouton type="button" variante="danger" pleineLargeur onClick={() => setEtape("confirmation")}>
          Retirer
        </Bouton>
      )}
      {etape === "confirmation" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texte">{PHRASE_CONFIRMATION_RETRAIT_PROGRAMME}</p>
          <Bouton type="button" variante="danger" pleineLargeur chargement={enCours} disabled={enCours} onClick={() => void confirmer()}>
            Oui, retirer
          </Bouton>
          <Bouton type="button" variante="secondaire" pleineLargeur disabled={enCours} onClick={() => { setEtape("repos"); setAVoir(null); }}>
            Non, garder
          </Bouton>
        </div>
      )}
      {etape === "fait" && message && <p role="status" className="text-sm font-bold text-texte">{message}</p>}
      {aVoir && <p role="alert" className="rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{aVoir}</p>}
    </div>
  );
}
