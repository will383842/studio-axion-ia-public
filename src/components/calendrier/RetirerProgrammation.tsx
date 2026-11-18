"use client";

/**
 * CAL-23 · « Retirer » une publication DÉJÀ programmée (entrée de créneau) : bouton, confirmation, résultat.
 * Le retrait chez le diffuseur est fait et relu par l'action serveur ; ici on ne dit « retirée » que si l'action le confirme.
 * Un seul bouton orange par écran : ces boutons sont neutres. Lisible à 375 px (boutons empilés, pleine largeur).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
const SANS_REPONSE = "À vérifier. Le Studio ne sait pas si le retrait a eu lieu : rechargez la page, puis vérifiez la publication avant de réessayer.";
const CODE_INCONNU = "À vérifier. Le Studio ne sait pas si le retrait a eu lieu : relisez la publication chez le diffuseur avant de réessayer.";

/** Un retrait partiel (CAL-22) dit déjà ce qui est retiré et ce qui reste : aucun titre ne doit le contredire. */
const estPartiel = (m: string): boolean => m.startsWith("Retrait partiel");

export function RetirerProgrammation({ cle }: { cle: string }) {
  const routeur = useRouteurOuNul();
  const [etape, setEtape] = useState<"repos" | "confirmation" | "fait">("repos");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aVoir, setAVoir] = useState<string | null>(null);
  // « Annuler » pendant les 10 secondes que l'action accorde (annulableJusquA) : la publication revient à la même date.
  const [annulable, setAnnulable] = useState<{ creneauId: string; jusqua: number } | null>(null);

  useEffect(() => {
    if (!annulable) return;
    // Le rafraîchissement attend la fin du délai : le créneau retiré quitte le calendrier, l'aperçu se fermerait avec son message et son « Annuler ».
    let fait = false;
    const t = setTimeout(() => {
      fait = true;
      setAnnulable(null);
      rafraichir();
    }, Math.max(0, annulable.jusqua - Date.now()));
    return () => {
      clearTimeout(t);
      // Fermé avant la fin du délai (sans « Annuler ») : le calendrier se met à jour quand même.
      if (!fait) rafraichir();
    };
  }, [annulable]);

  function rafraichir() {
    try {
      if (routeur) routeur.refresh();
      else window.location.reload();
    } catch {
      /* l'écran se mettra à jour au prochain chargement */
    }
  }

  async function annuler() {
    if (!annulable || enCours) return;
    setEnCours(true);
    try {
      const { annulerRetraitAction } = await import("@/app/(studio)/calendrier/actions/retirer");
      const r = await annulerRetraitAction(annulable.creneauId);
      setAnnulable(null);
      if (r.ok) {
        setMessage(r.donnees.message);
        rafraichir();
      } else setAVoir(r.message);
    } catch {
      setAnnulable(null);
      setAVoir("Le Studio ne sait pas si l'annulation a eu lieu. Rechargez la page pour voir où est la publication.");
    } finally {
      setEnCours(false);
    }
  }

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
        const jusqua = Date.parse(r.donnees.annulableJusquA);
        setEtape("fait");
        // Pas de rafraîchissement tant que « Annuler » est proposé ; sans délai lisible, on rafraîchit tout de suite.
        if (Number.isFinite(jusqua)) setAnnulable({ creneauId: r.donnees.creneauId, jusqua });
        else rafraichir();
      } else {
        const titre = r.code ? TITRES_RETRAIT[r.code] : undefined;
        // Code absent ou inconnu : on ne sait pas ce qui a eu lieu, donc jamais une phrase qui laisse croire à un simple refus.
        setAVoir(!titre ? CODE_INCONNU : estPartiel(r.message) ? r.message : `${titre} ${r.message}`);
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
      {etape === "fait" && annulable && (
        <Bouton type="button" variante="secondaire" pleineLargeur disabled={enCours} onClick={() => void annuler()}>
          Annuler
        </Bouton>
      )}
      {aVoir && <p role="alert" className="rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{aVoir}</p>}
    </div>
  );
}
