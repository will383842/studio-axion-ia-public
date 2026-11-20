/**
 * CHAÎNE DE LA VIDÉO LONGUE (fiche VL-04) — étapes et pas, bâtis sur le gabarit. Les dépendances (voix par morceaux,
 * montage) sont des PORTS injectés : rien n'est relié ici, donc aucun appel payant. Le plan 16:9 par chapitre et le rendu
 * chapitre par chapitre sont la fiche VL-05 : ici, le montage passe par le port `monter`.
 */
import type { Ratio } from "@/domaine/types";
import type { MotHorodate } from "@/domaine/types";
import type { ChapitreWeb } from "@/domaine/site-videos/types";
import { verifierChapitres, type RemarqueChapitres } from "@/briques/geo";
import { lireVoixLongue, type FournisseurVoixLongue } from "@/briques/voix-longue";
import type { DefinitionEtapeMoteur } from "../types";
import { premiereEtapePrete, type ContexteAvance, type EtatGabarit } from "../gabarit";
import type { EntreesVideoLongue } from "./entrees";

export const COMPOSITION_VIDEO_LONGUE = "PlanDeScenes";

export const ETAPES_FABRICATION: DefinitionEtapeMoteur[] = [
  { cle: "reception", nom: "Votre script reçu", icone: "camera", dependDe: [], dureeEstimeeSec: 1 },
  { cle: "voix", nom: "Voix de votre double", icone: "son", dependDe: ["reception"], dureeEstimeeSec: 120 },
  { cle: "chapitres", nom: "Les chapitres", icone: "texte", dependDe: ["voix"], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "L'assemblage", icone: "ecran-partage", dependDe: ["chapitres"], dureeEstimeeSec: 3600 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

export const ETAPES_RETOUCHE: DefinitionEtapeMoteur[] = [
  { cle: "chapitres", nom: "Les chapitres touchés", icone: "texte", dependDe: [], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "L'assemblage", icone: "ecran-partage", dependDe: ["chapitres"], dureeEstimeeSec: 3600 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

/** Dépendances reliées (ou `null` : pause). Aucune n'est payante par elle-même ici ; l'accord relève de VL-07. */
export interface DependancesVideoLongue {
  voix: FournisseurVoixLongue;
  monter(ratio: Ratio, ctx: { chapitres: ChapitreWeb[]; mots: MotHorodate[]; dureeSec: number }): Promise<{ fichierCle: string }>;
}

export interface EtatVideoLongue extends EtatGabarit {
  voix?: { mots: MotHorodate[]; dureeSec: number; morceaux: number };
  chapitres?: ChapitreWeb[];
  remarques: RemarqueChapitres[];
  sorties: Partial<Record<Ratio, string>>;
}

export interface RepriseVideoLongue {
  voix: NonNullable<EtatVideoLongue["voix"]>;
  chapitres: ChapitreWeb[];
}

/** Début de chaque chapitre : le premier mot du chapitre dans la voix recollée (repli : au prorata des mots). */
export function chapitresDepuisVoix(entrees: EntreesVideoLongue, mots: MotHorodate[], dureeSec: number): ChapitreWeb[] {
  const comptes = entrees.chapitres.map((c) => c.texte.split(/\s+/).filter(Boolean).length);
  const total = comptes.reduce((a, b) => a + b, 0) || 1;
  let rang = 0;
  const debuts = comptes.map((n, i) => {
    const d = i === 0 ? 0 : mots.length >= total ? mots[Math.min(rang, mots.length - 1)].debutSec : (rang / total) * dureeSec;
    rang += n;
    return Math.round(d * 10) / 10;
  });
  return entrees.chapitres.map((c, i) => ({ debutSec: debuts[i], finSec: i + 1 < debuts.length ? debuts[i + 1] : Math.round(dureeSec * 10) / 10, libelle: c.titre, blocRecette: "chapitres" }));
}

/** Mots par seconde de lecture (même estimation que l'écran : `MOTS_PAR_SECONDE` de `PlanChapitres`, et la recette du format). */
export const MOTS_PAR_SECONDE_LECTURE = 2.6;

/** Mode sans voix (PUR) : chaque mot reste à l'écran le temps de le lire, chapitre après chapitre ; aucune voix, aucun coût. */
export function estimerMotsSansVoix(entrees: EntreesVideoLongue): { mots: MotHorodate[]; dureeSec: number } {
  const mots: MotHorodate[] = [];
  let t = 0;
  const pas = 1 / MOTS_PAR_SECONDE_LECTURE;
  for (const c of entrees.chapitres) {
    for (const mot of c.texte.split(/\s+/).filter(Boolean)) {
      mots.push({ mot, debutSec: Math.round(t * 1000) / 1000, finSec: Math.round((t + pas) * 1000) / 1000 });
      t += pas;
    }
  }
  return { mots, dureeSec: Math.round(t * 10) / 10 };
}

export async function avancerVideoLongue(etat: EtatVideoLongue, ctx: ContexteAvance<EntreesVideoLongue>, deps: DependancesVideoLongue): Promise<EtatVideoLongue> {
  const etape = premiereEtapePrete(ctx, etat)?.cle;
  if (!etape) return { ...etat, fini: true };
  const faite = (e: EtatVideoLongue): EtatVideoLongue => ({ ...e, faites: [...e.faites, etape] });
  switch (etape) {
    case "reception":
      if (ctx.entrees.chapitres.length === 0) return { ...etat, echec: { etape, message: "Aucun texte de chapitre n'a été reçu : validez d'abord votre script, chapitre par chapitre.", reessayable: false } };
      return faite(etat);
    case "voix": {
      // Sans voix : aucune lecture, aucun port de voix touché. Le temps de chaque mot suit la durée de lecture estimée.
      if (ctx.entrees.sansVoix) {
        const lue = estimerMotsSansVoix(ctx.entrees);
        return faite({ ...etat, voix: { mots: lue.mots, dureeSec: lue.dureeSec, morceaux: 0 } });
      }
      const lue = await lireVoixLongue(ctx.entrees.chapitres, deps.voix);
      return faite({ ...etat, voix: { mots: lue.mots, dureeSec: lue.dureeSec, morceaux: lue.morceaux.length } });
    }
    case "chapitres": {
      const voix = etat.voix ?? { mots: [], dureeSec: 0, morceaux: 0 };
      const chapitres = etat.chapitres ?? chapitresDepuisVoix(ctx.entrees, voix.mots, voix.dureeSec);
      // Remarques seulement (jamais un refus).
      return faite({ ...etat, chapitres, remarques: verifierChapitres(chapitres) });
    }
    case "montage": {
      if (ctx.commande.simulerEchecEtape === "montage" && ctx.tentative === 1) return { ...etat, echec: { etape, message: "L'assemblage a eu un souci, vous pouvez réessayer.", reessayable: true } };
      const sorties: EtatVideoLongue["sorties"] = {};
      for (const ratio of ctx.commande.ratios) sorties[ratio] = (await deps.monter(ratio, { chapitres: etat.chapitres ?? [], mots: etat.voix?.mots ?? [], dureeSec: etat.voix?.dureeSec ?? 0 })).fichierCle;
      return faite({ ...etat, sorties });
    }
    default:
      return { ...faite(etat), fini: true };
  }
}
