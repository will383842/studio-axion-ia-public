/**
 * C4-U4.4a : approvisionnement d'une fenêtre `axion:` par l'archive des vidéos de Will, injectable.
 * Pur côté moteur : tout passe par des ports. Rien ne l'importe ; le chef le passera en `dep.approvisionner`
 * (C4-U4.4b, avec C4-U4.5b). 0 € : aucune banque payante, aucun Claude, aucun contrôle visuel.
 */
import type { FenetrePlan } from "@/domaine/facecam-animee/plan";
import type { ResultatImages } from "../images/index";
import { lireRechercheAxion } from "./recherche";

export interface ExtraitAxionV4 { cle: string; debutSec: number; longueurSec: number }

export interface PortsAxionV4 {
  trouver(recherche: string, dureeFenetreSec: number): Promise<ExtraitAxionV4 | null>;
  /** Écrit le clip muet sous `cleCible` (le `media` de la fenêtre) ; `true` si c'est fait. */
  preparer(extrait: ExtraitAxionV4, cleCible: string): Promise<boolean>;
}

type Plan = { fenetres: FenetrePlan[] };

/** Recherche sans préfixe `axion:`, coupée à 60 caractères (schéma du plan) ; garde l'original si aucun mot utile. */
function rechercheOrdinaire(recherche: string): string {
  const lue = lireRechercheAxion(recherche);
  const texte = lue ? lue.motsCles.join(" ") : recherche.replace(/^\s*axion:/i, "").trim();
  return (texte || "video").slice(0, 60);
}

export function avecExtraitsMaisonV4<O>(
  defaut: (plan: Plan, o: O) => Promise<ResultatImages<Plan>>,
  ports: PortsAxionV4,
): typeof defaut {
  return async (plan, o) => {
    const rang = plan.fenetres.findIndex((f) => lireRechercheAxion(f.recherche) !== null);
    if (rang < 0) return defaut(plan, o);
    const f = plan.fenetres[rang];
    const lue = lireRechercheAxion(f.recherche);
    let extrait: ExtraitAxionV4 | null = null;
    try {
      if (lue) {
        extrait = await ports.trouver(lue.motsCles.join(" "), Math.max(0, f.fin - f.debut));
        if (extrait && !(await ports.preparer(extrait, f.media))) extrait = null;
      }
    } catch {
      extrait = null;
    }
    if (extrait) {
      return {
        plan: { ...plan, fenetres: plan.fenetres.map((x, i) => (i === rang ? { ...f, media: f.media, video: true, depuisSec: 0 } : x)) },
        choix: [{ fenetre: rang, mediaInitial: f.media, source: "mes-images", id: extrait.cle, genre: "video", cle: f.media, scene: f.recherche, empreinte: extrait.cle, raison: "extrait des vidéos de Will (archive)" }],
        manques: [],
        supprimees: [],
        empreintes: [extrait.cle],
      };
    }
    const fenetres = plan.fenetres.map((x, i) => (i === rang ? { ...f, recherche: rechercheOrdinaire(f.recherche) } : x));
    return defaut({ ...plan, fenetres }, o);
  };
}
