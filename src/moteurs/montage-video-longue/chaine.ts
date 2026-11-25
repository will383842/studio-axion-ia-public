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
  { cle: "voix", nom: "Voix ou temps de lecture", icone: "son", dependDe: ["reception"], dureeEstimeeSec: 120 },
  { cle: "chapitres", nom: "Les chapitres", icone: "texte", dependDe: ["voix"], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "L'assemblage", icone: "ecran-partage", dependDe: ["chapitres"], dureeEstimeeSec: 3600 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

export const ETAPES_RETOUCHE: DefinitionEtapeMoteur[] = [
  { cle: "chapitres", nom: "Les chapitres touchés", icone: "texte", dependDe: [], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "L'assemblage", icone: "ecran-partage", dependDe: ["chapitres"], dureeEstimeeSec: 3600 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

/**
 * Suivi du montage pas à pas d'un format (JSON seulement, gardé dans l'état du gabarit : un redémarrage reprend là).
 * `plages` : morceaux terminés (idRendu -> clé du morceau). `enCours` / `collage` : la demande soumise dont on attend la fin
 * (`depuisMs` : heure de soumission, pour le délai ; `erreurs` : lectures d'état réessayables de suite).
 */
export interface SuiviMontageVideoLongue {
  plages: Record<string, string>;
  enCours?: { idRendu: string; depuisMs: number; erreurs: number };
  collage?: { idRendu: string; depuisMs: number; erreurs: number };
}

/** Résultat d'un pas de montage : fini, ou encore en cours (à rappeler avec le nouveau suivi). */
export type PasMontageVideoLongue = { fini: { fichierCle: string; /** Taille mesurée du fichier collé (octets), si le collage l'a renvoyée. */ taille?: number } } | { enCours: { suivi: SuiviMontageVideoLongue; fait: number; total: number } };

type ContexteMontage = { chapitres: ChapitreWeb[]; mots: MotHorodate[]; dureeSec: number };

/** Dépendances reliées (ou `null` : pause). Aucune n'est payante par elle-même ici ; l'accord relève de VL-07. */
export interface DependancesVideoLongue {
  voix: FournisseurVoixLongue;
  /** Montage « tout d'un coup » (garde-fou et tests) : à éviter pour une vraie vidéo, la boucle n'accorde que 30 s à un pas. */
  monter(ratio: Ratio, ctx: ContexteMontage): Promise<{ fichierCle: string }>;
  /** Montage PAS À PAS : une seule action de rendu par appel (soumettre ou relire), puis retour. Préféré à `monter` quand présent. */
  monterPas?(ratio: Ratio, ctx: ContexteMontage, suivi?: SuiviMontageVideoLongue): Promise<PasMontageVideoLongue>;
}

export interface EtatVideoLongue extends EtatGabarit {
  voix?: { mots: MotHorodate[]; dureeSec: number; morceaux: number };
  chapitres?: ChapitreWeb[];
  remarques: RemarqueChapitres[];
  sorties: Partial<Record<Ratio, string>>;
  /** Taille mesurée (octets) du fichier de chaque format, quand le collage l'a renvoyée. Absente = inconnue. */
  tailles?: Partial<Record<Ratio, number>>;
  /** Montage pas à pas : suivi par format tant que le collage n'est pas terminé. */
  montageSuivi?: Partial<Record<Ratio, SuiviMontageVideoLongue>>;
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

/** Message lisible et caractère réessayable d'une erreur de pas (erreurs du montage ou refus connus ; sinon phrase habituelle). */
function echecDuPas(err: unknown): { message: string; reessayable: boolean } {
  const nom = err instanceof Error ? err.name : "";
  if (err instanceof Error && nom === "ErreurMontageVideoLongue") return { message: err.message, reessayable: (err as Error & { reessayable?: boolean }).reessayable === true };
  if (err instanceof Error && nom === "ErreurVideoLongue") return { message: err.message, reessayable: (err as Error & { motif?: string }).motif === "eteint" }; // éteint : on rallume puis « Réessayer » ; durée ou plan : même refus à chaque essai
  return { message: "L'assemblage a eu un souci, vous pouvez réessayer.", reessayable: true };
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
      const ctxMontage = { chapitres: etat.chapitres ?? [], mots: etat.voix?.mots ?? [], dureeSec: etat.voix?.dureeSec ?? 0 };
      const sorties: EtatVideoLongue["sorties"] = { ...etat.sorties };
      // Sans montage pas à pas : tout d'un coup (comme avant).
      if (!deps.monterPas) {
        for (const ratio of ctx.commande.ratios) sorties[ratio] = (await deps.monter(ratio, ctxMontage)).fichierCle;
        return faite({ ...etat, sorties });
      }
      // Pas à pas : un seul format, une seule action de rendu, puis retour. L'étape n'est faite qu'une fois tout collé.
      const suivis = { ...etat.montageSuivi };
      const tailles = { ...etat.tailles };
      const ratio = ctx.commande.ratios.find((r) => !sorties[r]);
      if (ratio) {
        let pas: PasMontageVideoLongue;
        try {
          pas = await deps.monterPas(ratio, ctxMontage, suivis[ratio]);
        } catch (err) {
          // Échec lisible. On garde les plages finies et on retire la demande en cours / le collage (et leur horloge) :
          // « Réessayer » repart d'un suivi neuf, sans resoumettre une plage finie (même idRendu = ignoré par le serveur).
          const { message, reessayable } = echecDuPas(err);
          return { ...etat, sorties, montageSuivi: { ...suivis, [ratio]: { plages: suivis[ratio]?.plages ?? {} } }, echec: { etape, message, reessayable } };
        }
        if ("enCours" in pas) return { ...etat, sorties, montageSuivi: { ...suivis, [ratio]: pas.enCours.suivi } };
        sorties[ratio] = pas.fini.fichierCle;
        if (typeof pas.fini.taille === "number" && pas.fini.taille > 0) tailles[ratio] = pas.fini.taille;
        delete suivis[ratio];
        if (ctx.commande.ratios.some((r) => !sorties[r])) return { ...etat, sorties, tailles, montageSuivi: suivis };
      }
      return faite({ ...etat, sorties, tailles, montageSuivi: undefined });
    }
    default:
      return { ...faite(etat), fini: true };
  }
}
