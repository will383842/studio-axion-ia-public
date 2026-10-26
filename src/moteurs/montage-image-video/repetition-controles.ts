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
import { LIBELLES_CONTROLE_IV } from "./controles";
import { entreePorteIV, type EtatFabricationIV } from "./fabrication";
import { porteUniqueIV, type OutilsPorteIV, type VerdictPorteIV, type VersionJugeeIV } from "./porte";

export interface OptionsRepetitionIV {
  /** Lit la piste voix seule rangée (Q17). Absent : l'écoute n'est pas rejouée, Q17, Q18 et Q19 sont ignorés dans l'écart. */
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
      /** Faux si aucune lecture de la piste voix n'a été donnée : Q17, Q18 et Q19 sont alors ignorés dans l'écart. */
      ecouteRejouee: boolean;
      /** Contrôles laissés hors de l'écart faute d'écoute (Q17 à Q19 et ceux qui n'en sont pas séparables). */
      controlesIgnores: string[];
    };

/** Une ligne qui ne se juge qu'avec l'écoute : Q17 à Q19, ou toute ligne dont le défaut dit que l'écoute ou la piste voix manque. */
const DEPEND_DE_L_ECOUTE = /écoute|voix seule/i;
const CODES_ECOUTE = ["Q17", "Q18", "Q19"];

/** Phrases de défaut (« réseaux · Libellé [(non vérifié)] : … ») qui portent sur l'un de ces contrôles. */
function filtreEcoute(codes: Set<string>): (phrase: string) => boolean {
  const libelles = [...codes].map((c) => (LIBELLES_CONTROLE_IV as Record<string, string>)[c]).filter(Boolean).map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!libelles.length) return () => true;
  const re = new RegExp(` · (${libelles.join("|")})( \\(non vérifié\\))? :`);
  return (p) => !re.test(p);
}

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
  const ecouteRejouee = options.lireSon !== undefined;
  const controlesIgnores = ecouteRejouee
    ? []
    : [...new Set(verdict.versions.flatMap((v) => v.lignes.filter((l) => CODES_ECOUTE.includes(l.code) || (l.etat !== "reussi" && l.details.some((d) => DEPEND_DE_L_ECOUTE.test(d)))).map((l) => l.code as string)))];
  const garde = ecouteRejouee ? () => true : filtreEcoute(new Set([...CODES_ECOUTE, ...controlesIgnores]));
  const enregistre = etat.controles?.verdict ? { ok: etat.controles.verdict.ok, phrases: [...etat.controles.verdict.phrases] } : undefined;
  const ecart: string[] = [];
  if (!enregistre) ecart.push("aucun verdict enregistré à comparer.");
  else {
    const rejouees = verdict.phrases.filter(garde);
    const gardees = enregistre.phrases.filter(garde);
    // Écoute non rejouée : le verdict se compare sans les défauts d'écoute, de part et d'autre.
    const okRejoue = ecouteRejouee ? verdict.ok : rejouees.length === 0;
    const okEnregistre = ecouteRejouee ? enregistre.ok : gardees.length === 0;
    if (okEnregistre !== okRejoue) ecart.push(`verdict : enregistré ${okEnregistre ? "prête" : "refusée"}, rejoué ${okRejoue ? "prête" : "refusée"}.`);
    for (const p of rejouees) if (!enregistre.phrases.includes(p)) ecart.push(`défaut nouveau : ${p}`);
    for (const p of gardees) if (!verdict.phrases.includes(p)) ecart.push(`défaut disparu : ${p}`);
  }
  return { applicable: true, verdict, versions: verdict.versions, appelsBloques: bloques, ...(enregistre ? { enregistre } : {}), ecart, ecouteRejouee, controlesIgnores };
}
