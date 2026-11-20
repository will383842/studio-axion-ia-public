/**
 * CHAÎNE DU MONTAGE « DONNÉES » (G4-09a) — donnée → garde des chiffres → narration sans IA → voix → calage → plan → propriétés.
 * PURE et NON INSCRITE : aucun `index.ts`, rien ne l'appelle hors tests (G4-09b l'inscrira). Zéro euro : la narration est
 * celle du modèle (G4-05), jamais Claude. La voix et le calage sont des PORTS injectés (doubles en test) ; le rendu est
 * l'affaire de G4-09b. Sans port voix : variante muette, plan sous-titré seul.
 * Jamais un chiffre qui ne vient pas de la donnée : tout refus d'une garde arrête la chaîne avec un message clair.
 * Le plan est rangé sous `projetMontage.reprise.plan`.
 */
import { garderChiffres } from "../../briques/donnees-video/garde-chiffres";
import { garderPlanScenes } from "../../briques/donnees-video/garde-plan-scenes";
import { narrationModele } from "../../briques/donnees-video/narration-modele";
import { planDepuisDonnees } from "../../briques/donnees-video/plan-depuis-donnees";
import { fnv1a64, jsonCanonique } from "../../briques/plan-scenes/empreinte";
import type { PlanValide } from "../../briques/plan-scenes/schema";
import { baseRetenue, donneesCalque, fabriquerSousTitres } from "../../briques/sous-titres";
import type { MotHorodate } from "../../domaine/types";
import { lireEntreesDonnees } from "./entrees";
import { formatDuRatioDonnees, proprietesMontageDonnees, type ProprietesMontageDonnees } from "./proprietes";

/** Ce que rend la voix : adresse du son, durée, mots minutés. */
export interface VoixLue {
  audio: string;
  dureeSec: number;
  mots: MotHorodate[];
}
export interface PortVoix {
  lire(texte: string): Promise<VoixLue>;
}
/** Calage : recale les mots lus sur le texte validé. Absent : les mots de la voix sont pris tels quels. */
export interface PortCalage {
  caler(entree: { texte: string; mots: MotHorodate[]; dureeSec: number }): Promise<MotHorodate[]> | MotHorodate[];
}

export type EtapeChaineDonnees = "entree" | "garde-chiffres" | "narration" | "voix" | "calage" | "plan" | "garde-plan";

export interface ReprisePlanDonnees {
  plan: PlanValide;
  empreinte: string;
  remarques: string[];
}

export type ResultatChaineDonnees =
  | {
      ok: true;
      muette: boolean;
      proprietes: ProprietesMontageDonnees;
      texteDit: string;
      remarques: string[];
      projetMontage: { reprise: { plan: ReprisePlanDonnees } };
    }
  | { ok: false; etape: EtapeChaineDonnees; erreurs: string[] };

const refus = (etape: EtapeChaineDonnees, erreurs: string[]): ResultatChaineDonnees => ({ ok: false, etape, erreurs });

export async function chaineMontageDonnees(entrees: Record<string, unknown> | undefined, ports: { voix?: PortVoix; calage?: PortCalage; narration?: (donnee: Parameters<typeof narrationModele>[0]) => Promise<ReturnType<typeof narrationModele> | null> } = {}): Promise<ResultatChaineDonnees> {
  const lecture = lireEntreesDonnees(entrees);
  if (!lecture.ok) return refus("entree", lecture.erreurs);
  const { donnee, ratio } = lecture.entrees;
  const muette = lecture.entrees.muette || !ports.voix;

  // Garde sur la donnée seule (calculs déclarés justes), avant toute narration ou voix.
  const g0 = garderChiffres(donnee, { textesEcran: [] });
  if (!g0.ok) return refus("garde-chiffres", g0.erreurs.length ? g0.erreurs : ["Chiffres refusés."]);

  // Narration du modèle, sans IA.
  const modele = narrationModele(donnee);
  // Port facultatif (G4-06-b) : le texte de l'IA s'il est rendu, sinon le modèle gratuit + une remarque. Sans port : identique.
  const ia = ports.narration ? await Promise.resolve().then(() => ports.narration!(donnee)).catch(() => null) : null;
  const narration = ia ?? (ports.narration ? { ...modele, remarques: [...modele.remarques, "Narration par l'IA indisponible : texte modèle."] } : modele);
  if (!narration.texte.trim()) return refus("narration", ["Donnée trop courte : aucune narration possible.", ...narration.remarques]);
  const g1 = garderChiffres(donnee, muette ? { textesEcran: [narration.texte] } : { textesEcran: [], texteDit: narration.texte });
  if (!g1.ok) return refus("garde-chiffres", [...g1.erreurs, ...g1.horsDonnee.map((h) => `Le nombre « ${h.brut} » n'est pas dans la donnée.`)]);

  // Voix (port) puis calage ; muette : aucun appel.
  let audio: string | undefined;
  let dureeSec = narration.dureeEstimeeSec;
  let mots: MotHorodate[] | undefined;
  if (!muette) {
    let voix: VoixLue;
    try {
      voix = await ports.voix!.lire(narration.texte);
    } catch (e) {
      return refus("voix", [`La voix a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}.`]);
    }
    audio = voix.audio;
    dureeSec = voix.dureeSec;
    mots = voix.mots;
    if (ports.calage) {
      try {
        mots = await ports.calage.caler({ texte: narration.texte, mots, dureeSec });
      } catch (e) {
        return refus("calage", [`Le calage a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}.`]);
      }
    }
  }

  // Sous-titres, puis plan depuis la donnée.
  const segments = fabriquerSousTitres({ texte: narration.texte, dureeSec, ...(mots ? { mots } : {}), ratio });
  const sousTitres = segments.length ? donneesCalque({ segments, base: baseRetenue(undefined, null), ratio }) : undefined;
  const format = formatDuRatioDonnees(ratio);
  const dureeMs = Math.round(dureeSec * 1000);
  const { resultat, remarques } = planDepuisDonnees(donnee, {
    format,
    dureeMs,
    ...(mots ? { mots: mots.map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) })) } : {}),
  });
  if (resultat.plan.scenes.length === 0) return refus("plan", ["Plan vide : aucune scène n'a pu être posée.", ...remarques]);
  const gp = garderPlanScenes(resultat.plan, donnee);
  if (!gp.ok) return refus("garde-plan", gp.fautes.map((f) => `Scène ${f.sceneId} (${f.piece}) : la valeur « ${f.valeur} » n'est pas dans la donnée.`));

  const plan = resultat.plan;
  const toutes = [...narration.remarques, ...remarques];
  return {
    ok: true,
    muette,
    proprietes: proprietesMontageDonnees({ plan, ...(audio ? { audio } : {}), ...(sousTitres ? { sousTitres } : {}) }),
    texteDit: narration.texte,
    remarques: toutes,
    projetMontage: { reprise: { plan: { plan, empreinte: fnv1a64(jsonCanonique(plan)), remarques: toutes } } },
  };
}
