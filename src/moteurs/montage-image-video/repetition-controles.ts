/**
 * IMAGE → VIDÉO · RÉPÉTITION GÉNÉRALE DES CONTRÔLES DE FIN DE FABRICATION, HORS LIGNE.
 *
 * Rejoue la porte unique (`porteUniqueIV`) sur un état DÉJÀ ENREGISTRÉ, avec le code de cette branche : mise en scène
 * recalculée, contrôles de chaque version, plafonds des réseaux. Les transcriptions et relectures déjà payées sont
 * reprises de l'état (`controles`) ; ce qui manquerait serait payant, donc BLOQUÉ et compté (`appelsBloques`) : aucune
 * réservation, aucune transcription, aucune extraction d'images, aucun appel Claude. L'état reçu n'est jamais modifié.
 * Un écart avec le verdict enregistré est dit (`ecart`) : c'est ce que la mise en ligne de ce code changerait.
 */
import type { BruitageValideIV } from "./bruitages";
import type { OutilsEcouteIV } from "./ecoute";
import { entreePorteIV, type EtatFabricationIV } from "./fabrication";
import { porteUniqueIV, type OutilsPorteIV, type VerdictPorteIV, type VersionJugeeIV } from "./porte";

export interface OptionsRepetitionIV {
  /** Lit la piste voix seule rangée (Q17). Absent : la piste est « introuvable » et Q17 reste non vérifié. */
  lireSon?: OutilsEcouteIV["lireSon"];
  bruitages?: readonly BruitageValideIV[];
}

export type RepetitionControlesIV =
  | { applicable: false; raison: string }
  | {
      applicable: true;
      verdict: VerdictPorteIV;
      versions: VersionJugeeIV[];
      /** Appels payants que la porte a voulu faire faute de donnée enregistrée : tous refusés. */
      appelsBloques: number;
      /** Verdict enregistré dans l'état (absent si les contrôles n'avaient pas eu lieu). */
      enregistre?: { ok: boolean; phrases: string[] };
      /** Différences entre le verdict rejoué et celui de l'état, en phrases simples (vide : identique). */
      ecart: string[];
    };

const REFUS_PAYANT = "répétition générale hors ligne : aucun appel payant";

/** Ce qu'il faut à la porte ; la première pièce manquante est dite. */
function manque(e: EtatFabricationIV): string | null {
  if (!e.carte) return "pas de carte validée dans cet état.";
  if (!e.script) return "pas de script dans cet état.";
  if (!e.plan) return "pas de plan des fins dans cet état.";
  if (!e.pistes?.length) return "pas de voix découpée en pistes dans cet état.";
  if (!e.rendus || !Object.keys(e.rendus).length) return "aucun rendu enregistré dans cet état.";
  return null;
}

export async function repeterControlesIV(etat: EtatFabricationIV, options: OptionsRepetitionIV = {}): Promise<RepetitionControlesIV> {
  const absent = manque(etat);
  if (absent) return { applicable: false, raison: absent };
  const e = structuredClone(etat);
  let bloques = 0;
  const bloquer = async (): Promise<never> => {
    bloques++;
    throw new Error(REFUS_PAYANT);
  };
  const outils: OutilsPorteIV = {
    lireSon: options.lireSon ?? (async () => null),
    transcrire: bloquer,
    extraireImages: bloquer,
    lireImage: async () => null,
    appeler: bloquer,
    budget: {
      reserver: async () => {
        bloques++;
        return { ok: false, message: REFUS_PAYANT };
      },
    },
    idAppel: (prefixe) => `${prefixe}-repetition`,
  };
  let verdict: VerdictPorteIV;
  try {
    verdict = await porteUniqueIV(entreePorteIV(e, options.bruitages).entree, outils);
  } catch (err) {
    return { applicable: false, raison: `l'état ne se laisse pas rejouer (${(err as Error).message}).` };
  }
  const enregistre = etat.controles?.verdict ? { ok: etat.controles.verdict.ok, phrases: [...etat.controles.verdict.phrases] } : undefined;
  const ecart: string[] = [];
  if (!enregistre) ecart.push("aucun verdict enregistré à comparer.");
  else {
    if (enregistre.ok !== verdict.ok) ecart.push(`verdict : enregistré ${enregistre.ok ? "prête" : "refusée"}, rejoué ${verdict.ok ? "prête" : "refusée"}.`);
    for (const p of verdict.phrases) if (!enregistre.phrases.includes(p)) ecart.push(`défaut nouveau : ${p}`);
    for (const p of enregistre.phrases) if (!verdict.phrases.includes(p)) ecart.push(`défaut disparu : ${p}`);
  }
  return { applicable: true, verdict, versions: verdict.versions, appelsBloques: bloques, ...(enregistre ? { enregistre } : {}), ecart };
}
