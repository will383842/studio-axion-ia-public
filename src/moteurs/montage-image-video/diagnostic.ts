/**
 * IMAGE → VIDÉO · Diagnostic d'un refus de la mise en scène (IV_MISE_EN_SCENE), en LECTURE SEULE. PUR, déterministe.
 *
 * Sépare les deux causes possibles d'un refus sur un état réel (document de travail) :
 * - la VOIX : les mots horodatés de la piste ne se rattachent pas aux écrans (calage faible, écrans dans le désordre,
 *   mots du corps et de la fin mal partagés) ;
 * - la FICHE : un bloc cité dans les `refs` d'un écran dont la scène ne le dessine pas (« titre », « chiffre »,
 *   « accroche », « phrase-choc », « micro-objet » sans bénéfice, deuxième bloc d'une « alerte »…), un écran trop long
 *   pour ses textes.
 * Preuve : la même version est remise en scène sur des heures SIMULÉES (3,4 mots/s, calage parfait). Un refus qui y
 * reste vient de la fiche ; un refus qui y disparaît vient de la voix. Le contrôle Q12 (« le bloc n'apparaît jamais »)
 * ne dépend d'aucune heure : seuls la scène et les `refs` des écrans décident qu'un bloc est posé.
 *
 * Aucun appel, aucune écriture : lit un `EtatFabricationIV` et rend des lignes de texte.
 */
import { motsDits } from "@/domaine/image-video/fiche";
import { calerFiche, motsDeLaFin, pisteSimulee } from "./calage";
import { entreesMiseEnSceneIV, type EtatFabricationIV } from "./fabrication";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "./mise-en-scene";

export type CauseMiseEnSceneIV = "aucune" | "fiche" | "voix" | "fiche-et-voix" | "inconnue";

export interface EcranDiagnosticIV {
  id: string;
  partie: string;
  scene: string;
  refs: string[];
  debutSec: number;
  finSec: number;
  /** Mots écrits / mots calés (retrouvés tels quels dans la voix). */
  mots: number;
  cales: number;
  /** Blocs de la carte cités par l'écran et posés par lui. */
  dessines: string[];
  /** Blocs de la carte cités par l'écran et posés par AUCUN écran (Q12). */
  jamaisDessines: string[];
  /** Écran de bénéfice (« micro-objet », « carte-benefice ») qui ne cite aucun bénéfice : mis en scène sur la toile depuis le 17/10. */
  beneficeSansBenefice: boolean;
}

export interface VersionDiagnosticIV {
  version: string;
  reseaux: string[];
  courte: boolean;
  /** Refus avec la voix réelle (ce que la fabrication a dit). */
  phrasesVoixReelle: string[];
  /** Refus de la même fiche sur des heures simulées (calage parfait). */
  phrasesVoixSimulee: string[];
  calage: { partCalee: number; motsVoix: number; motsCorpsVoix: number; motsEcritsCorps: number; motsEcritsFin: number; erreur?: string };
  /** Écrans dont le premier mot est dit avant celui de l'écran précédent (voix dans le désordre). */
  ecransDesordre: string[];
  ecrans: EcranDiagnosticIV[];
  cause: CauseMiseEnSceneIV;
}

export interface DiagnosticMiseEnSceneIV {
  etape: string;
  refus?: { code: string; message: string };
  versions: VersionDiagnosticIV[];
  cause: CauseMiseEnSceneIV;
  lignes: string[];
}

/** Scènes qui ne dessinent qu'un bloc « bénéfice » (avant le correctif du 17/10, rien d'autre). */
const BENEFICES = new Set(["micro-objet", "carte-benefice"]);
const arrondi = (x: number) => Math.round(x * 100) / 100;
const pourcent = (x: number) => `${Math.round(x * 100)} %`;
/** Famille d'un refus (« Il manque quelque chose à l'écran : … » → « Il manque quelque chose à l'écran »). */
const famille = (p: string) => p.split(" : ")[0];

function phrasesDe(entree: EntreeMiseEnSceneIV): { phrases: string[]; ligne: ReturnType<typeof mettreEnSceneIV>["ligne"] | null; erreur?: string } {
  try {
    const r = mettreEnSceneIV(entree);
    return { phrases: r.phrases, ligne: r.ligne };
  } catch (err) {
    return { phrases: [`Erreur : ${(err as Error).message}`], ligne: null, erreur: (err as Error).message };
  }
}

function causeDe(reelle: readonly string[], simulee: readonly string[]): CauseMiseEnSceneIV {
  if (!reelle.length) return "aucune";
  const restent = new Set(simulee.map(famille));
  const parFiche = reelle.filter((p) => restent.has(famille(p)));
  if (parFiche.length === reelle.length) return "fiche";
  if (!parFiche.length) return "voix";
  return "fiche-et-voix";
}

/** Diagnostic d'une version : voix réelle contre voix simulée, calage, écran par écran. */
export function diagnostiquerVersionIV(v: { version: string; reseaux: readonly string[]; courte: boolean; entree: EntreeMiseEnSceneIV }): VersionDiagnosticIV {
  const { entree } = v;
  const fin = entree.fin && !entree.fin.muet ? entree.fin : null;
  const reelle = phrasesDe(entree);
  const simulee = phrasesDe({ ...entree, voix: pisteSimulee(entree.fiche, fin) });
  const motsEcritsCorps = entree.fiche.ecrans.reduce((s, e) => s + motsDits(e.texteDit).length, 0);
  const calage: VersionDiagnosticIV["calage"] = { partCalee: 0, motsVoix: entree.voix.mots.length, motsCorpsVoix: entree.voix.motsCorps, motsEcritsCorps, motsEcritsFin: motsDeLaFin(fin).length };
  let parEcran = new Map<string, { mots: number; cales: number; debut: number }>();
  try {
    const c = calerFiche(entree.fiche, entree.voix, fin);
    calage.partCalee = c.partCalee;
    parEcran = new Map(c.ecrans.map((x) => [x.id, { mots: x.mots.length, cales: x.mots.filter((m) => m.cale).length, debut: x.mots[0]?.debutSec ?? 0 }]));
  } catch (err) {
    calage.erreur = (err as Error).message;
  }
  const ecransDesordre: string[] = [];
  let avant = -Infinity;
  for (const e of entree.fiche.ecrans) {
    const d = parEcran.get(e.id)?.debut;
    if (d === undefined) continue;
    if (d + 1e-6 < avant) ecransDesordre.push(e.id);
    avant = Math.max(avant, d);
  }
  const evs = reelle.ligne?.evenements ?? simulee.ligne?.evenements ?? [];
  const plans = reelle.ligne?.plans ?? [];
  const blocs = new Set(entree.carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => n.id));
  const poses = new Set(evs.filter((x) => x.ref).map((x) => x.ref!));
  const ecrans: EcranDiagnosticIV[] = entree.fiche.ecrans.map((e) => {
    const siens = plans.filter((p) => p.ecran === e.id);
    const dessines = [...new Set(evs.filter((x) => x.ecran === e.id && x.ref && blocs.has(x.ref)).map((x) => x.ref!))];
    const cal = parEcran.get(e.id);
    const noeudsCites = entree.carte.noeuds.filter((n) => e.refs.includes(n.id) && !n.photoPersonnes);
    return {
      id: e.id,
      partie: e.partie,
      scene: e.scene,
      refs: [...e.refs],
      debutSec: arrondi(siens[0]?.debut ?? cal?.debut ?? 0),
      finSec: arrondi(siens.at(-1)?.fin ?? 0),
      mots: cal?.mots ?? motsDits(e.texteDit).length,
      cales: cal?.cales ?? 0,
      dessines,
      jamaisDessines: e.refs.filter((r) => blocs.has(r) && !poses.has(r)),
      beneficeSansBenefice: BENEFICES.has(e.scene) && noeudsCites.length > 0 && !noeudsCites.some((n) => n.role === "benefice"),
    };
  });
  return { version: v.version, reseaux: [...v.reseaux], courte: v.courte, phrasesVoixReelle: reelle.phrases, phrasesVoixSimulee: simulee.phrases, calage, ecransDesordre, ecrans, cause: causeDe(reelle.phrases, simulee.phrases) };
}

const PHRASE_CAUSE: Record<CauseMiseEnSceneIV, string> = {
  aucune: "Aucun refus : la mise en scène passe avec cette voix.",
  fiche: "CAUSE : la FICHE (script). Les mêmes refus restent avec une voix simulée parfaitement calée : la voix n'y est pour rien.",
  voix: "CAUSE : la VOIX. Les refus disparaissent avec une voix simulée parfaitement calée : les mots horodatés ne suivent pas les écrans.",
  "fiche-et-voix": "CAUSE : la FICHE et la VOIX. Une partie des refus reste avec une voix simulée (fiche), l'autre disparaît (voix).",
  inconnue: "Cause inconnue : aucune version à mettre en scène dans cet état (voix ou pistes absentes).",
};

/** Diagnostic d'un état de fabrication : une version par piste (et version courte), puis des lignes à imprimer. */
export function diagnostiquerMiseEnSceneIV(e: EtatFabricationIV): DiagnosticMiseEnSceneIV {
  const versions = entreesMiseEnSceneIV(e).map(diagnostiquerVersionIV);
  const causes = new Set(versions.map((v) => v.cause).filter((c) => c !== "aucune"));
  const cause: CauseMiseEnSceneIV = !versions.length ? "inconnue" : !causes.size ? "aucune" : causes.size === 1 ? [...causes][0] : causes.has("voix") && (causes.has("fiche") || causes.has("fiche-et-voix")) ? "fiche-et-voix" : [...causes][0];
  const lignes: string[] = [`Étape : ${e.etape}${e.refus ? ` · refus ${e.refus.code} : ${e.refus.message}` : ""}`, PHRASE_CAUSE[cause], ""];
  const titre = (id: string) => e.carte?.carte.noeuds.find((n) => n.id === id)?.libelle ?? id;
  for (const v of versions) {
    lignes.push(`── ${v.reseaux.join(", ")}${v.courte ? " (version courte)" : ""} · version ${v.version} · ${PHRASE_CAUSE[v.cause]}`);
    const c = v.calage;
    lignes.push(`Calage : ${pourcent(c.partCalee)} des mots écrits retrouvés · voix ${c.motsVoix} mots dont ${c.motsCorpsVoix} au corps · script ${c.motsEcritsCorps} mots au corps + ${c.motsEcritsFin} à la fin${c.erreur ? ` · ERREUR : ${c.erreur}` : ""}`);
    const sansBenefice = v.ecrans.filter((x) => x.beneficeSansBenefice);
    if (sansBenefice.length) lignes.push(`Écrans de bénéfice sans bénéfice (aucun bloc posé avant le correctif du 17/10, toile depuis) : ${sansBenefice.map((x) => `${x.id} « ${x.scene} » [${x.refs.join(", ")}]`).join(", ")}`);
    if (v.ecransDesordre.length) lignes.push(`Écrans dits dans le désordre : ${v.ecransDesordre.join(", ")}`);
    lignes.push("Refus avec la voix réelle :", ...(v.phrasesVoixReelle.length ? v.phrasesVoixReelle.map((p) => `  · ${p}`) : ["  (aucun)"]));
    lignes.push("Refus avec une voix simulée (même fiche) :", ...(v.phrasesVoixSimulee.length ? v.phrasesVoixSimulee.map((p) => `  · ${p}`) : ["  (aucun)"]));
    lignes.push("Écrans (id · partie · scène · début-fin · mots calés · refs → blocs posés) :");
    for (const x of v.ecrans) {
      const manque = x.jamaisDessines.length ? ` · JAMAIS POSÉS : ${x.jamaisDessines.map((r) => `${r} « ${titre(r)} »`).join(", ")} (la scène « ${x.scene} » ne les dessine pas)` : "";
      lignes.push(`  ${x.id} · ${x.partie} · ${x.scene} · ${x.debutSec}-${x.finSec} s · ${x.cales}/${x.mots} · [${x.refs.join(", ")}] → [${x.dessines.join(", ")}]${manque}`);
    }
    lignes.push("");
  }
  return { etape: e.etape, ...(e.refus ? { refus: { code: e.refus.code, message: e.refus.message } } : {}), versions, cause, lignes };
}
