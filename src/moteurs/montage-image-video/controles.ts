/**
 * IMAGE → VIDÉO · Contrôles finaux Q01-Q28 d'UNE version (lot L13, plan 50 § 7). PUR : tout ce qui se mesure ou se
 * paie (écoute, relecture, mise en page des instants clés) arrive déjà mesuré par `porte.ts`.
 *
 * Une LIGNE par contrôle et par version, avec une phrase simple pour Will. Règle d'or : aucun contrôle ne se saute en
 * silence. Une donnée absente rend la ligne « non faite », et une ligne bloquante non faite BLOQUE comme un échec.
 * Seuls Q02 (cohérence arithmétique, dite telle qu'écrite) et Q28 (débit, sert à recalibrer) sont indicatifs.
 *
 * Ce qui est relu ici, sans rien recalculer en confiance :
 *  - carte (Q01-Q03) et script (Q04-Q10, Q05 bis, Q08 bis, chapitres) par `verifierScript` (L6), sur la fiche de la
 *    version (fiche courte et nœuds retirés pour une version courte) ;
 *  - mise en scène (Q12-Q15, Q20-Q23, Q25, fonds, mot orange, segment de fin) : la ligne de temps est RECALCULÉE depuis
 *    ses entrées (`mettreEnSceneIV`, déterministe) et doit être celle qui a été rendue ;
 *  - écoute (Q17-Q19), chiffres de la carte DITS et MONTRÉS, interdits entendus, relecture (Q26), mesures (Q24),
 *    textes de publication (Q27), plafonds du réseau (Q11, verdict fourni par la porte).
 */
import { createHash } from "node:crypto";
import type { CarteImage } from "@/domaine/image-video/carte";
import { complexiteDe, DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { PARTIES, motsDits, texteDuCorps, type FicheImage } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import type { MesuresExport } from "@/briques/controle-image";
import { jetonsDits, occurrences } from "@/briques/coupes/texte";
import type { PisteVoixSeuleIV } from "./assemblage";
import { CRETE_IV_DBTP, LOUDNESS_IV_LUFS } from "./assemblage";
import { DEFAUTS_DE_DETAIL_IV } from "./adaptation-scene";
import { clesDeLaCarte, controlerToutMontre, type LigneControleSceneIV } from "./controles-scene";
import { miseEnPageAuxInstantsIV } from "./emprise-ligne";
import { formeDite, formesComparables, type ConstatControle, type EcouteVersionIV } from "./ecoute";
import { FIGE_IV } from "./commandes-ffmpeg";
import type { FinIV } from "./fins";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV, type LigneDeTempsIV, type ResultatMiseEnSceneIV } from "./mise-en-scene";
import { interditsDans, type PublicationIV } from "./publication";
import { instantsClesIV } from "./relecture-finale";
import { INTERDITS_PERMANENTS, empreinteDeCarte, phraseChocAttendue, verifierScript, type ContexteRegles, type Manquement } from "./regles";
import type { VerdictReseauIV } from "./reseaux";
import type { EtatVoixIV } from "./voix";

/** Tous les contrôles d'une version, dans l'ordre du rapport. Une version à laquelle il en manque un est refusée. */
export const CODES_CONTROLE_IV = [
  "Q01", "Q02", "Q03", "Q04", "Q05", "Q05bis", "Q06", "Q07", "Q08", "Q08bis", "Q09", "Q10", "Q11", "Q11bis",
  "Q12", "Q13", "CHIFFRES", "Q14", "Q15", "Q16", "Q17", "Q18", "Q19", "Q20", "Q21", "Q22", "Q23", "Q24", "Q25",
  "Q26", "Q27", "Q28", "FOND", "ORANGE", "FIN", "SCENE",
] as const;
export type CodeControleIV = (typeof CODES_CONTROLE_IV)[number];

/** Ordre de Will du 25/10/2026 (« vidéo prête du premier coup ») : ces lignes disent un défaut en REMARQUE, jamais en blocage. */
const LIGNES_ZERO_BLOCAGE_IV = ["Q12", "Q15", "Q19", "Q20", "Q21", "Q22", "Q23", "Q25", "Q27", "SCENE"] as const;

/**
 * Contrôles indicatifs (jamais bloquants : remarque orange à la porte). Q13 et Q14 (chiffre non montré, rythme) sont des défauts de DÉTAIL :
 * après le rendu payé, ils ne doivent jamais arrêter la vidéo (filet « zéro blocage », `adaptation-scene.ts`). Q12, Q15, Q19 à Q23, Q25, Q27 et SCENE le sont aussi (ordre du 25/10/2026). Restent bloquants : CHIFFRES (chiffre faux), la voix (Q16, Q17), le rendu impossible (mesure absente de Q24) et l'image noire ou illisible. Q26 ne bloque que pour un chiffre faux ou une image entière illisible (`jugerRelecture`) ; relecture impossible = remarque « images finales non relues ». Q11, Q18 et Q24 ne bloquent qu'au-delà de leurs planchers (vidéo inutilisable), en deçà ce sont des remarques ; le cadre et la cadence de Q24 sont des remarques.
 */
export const CONTROLES_INDICATIFS: ReadonlySet<CodeControleIV> = new Set<CodeControleIV>(["Q02", "Q28", ...DEFAUTS_DE_DETAIL_IV, ...LIGNES_ZERO_BLOCAGE_IV]);

/** Libellé de chaque contrôle, en tête de la phrase pour Will. */
export const LIBELLES_CONTROLE_IV: Readonly<Record<CodeControleIV, string>> = Object.freeze({
  Q01: "Lecture de l'image",
  Q02: "Calculs de l'image",
  Q03: "Carte validée",
  Q04: "Rien d'oublié",
  Q05: "Rien d'inventé",
  Q05bis: "Promesses",
  Q06: "Phrase-choc",
  Q07: "Ossature du script",
  Q08: "Mots interdits",
  Q08bis: "Question de commentaire",
  Q09: "Écriture",
  Q10: "Durée du script",
  Q11: "Durée de la vidéo",
  Q11bis: "Version courte",
  Q12: "Tout est montré",
  Q13: "Chiffre dit, chiffre montré",
  CHIFFRES: "Chiffres de l'image dits et montrés",
  Q14: "Rythme",
  Q15: "Caméra et lisibilité",
  Q16: "Voix",
  Q17: "Son de la voix",
  Q18: "Écoute",
  Q19: "Fin dite en entier",
  Q20: "Bruitages",
  Q21: "Mise en page",
  Q22: "Sous-titres",
  Q23: "Défauts visibles",
  Q24: "Mesures du fichier",
  Q25: "Marque",
  Q26: "Relecture des images finales",
  Q27: "Textes de publication",
  Q28: "Débit de la voix",
  FOND: "Fonds",
  ORANGE: "Mot orange",
  FIN: "Fin du réseau",
  SCENE: "Ligne de temps rendue",
});

export type EtatLigneIV = "reussi" | "echoue" | "non-fait";

export interface LigneControleIV {
  code: CodeControleIV;
  version: string;
  reseaux: ReseauIV[];
  etat: EtatLigneIV;
  bloquant: boolean;
  /** Une phrase simple pour Will. */
  phrase: string;
  details: string[];
}

/** Une ligne bloque si elle est bloquante et n'a pas réussi (échec OU non faite). */
export const bloque = (l: Pick<LigneControleIV, "etat" | "bloquant">): boolean => l.bloquant && l.etat !== "reussi";

/* ------------------------------------------------------------------ */
/* Entrées                                                               */
/* ------------------------------------------------------------------ */

/** Une version à contrôler : tout ce qui a servi à la fabriquer, et ce qui a été produit. */
export interface VersionAControlerIV {
  /** Identifiant de la piste (fin du plan ; suffixe « -courte »). */
  version: string;
  reseaux: ReseauIV[];
  courte: boolean;
  /** Fiche de la version (fiche courte pour une version courte). */
  fiche: FicheImage;
  /** Version courte : titres des chapitres retirés et leurs nœuds. */
  retires?: string[];
  noeudsRetires?: string[];
  /** Segment de fin du plan (`null` ou muet : LinkedIn). */
  fin: FinIV | null;
  piste: PisteVoixSeuleIV;
  /** Entrées de la mise en scène (recalculée) et ligne de temps RENDUE. */
  scene: EntreeMiseEnSceneIV;
  ligne: LigneDeTempsIV;
  /** Mixage : la voix mixée (par son empreinte). */
  mixage: { voix: { empreinte: string } };
  /** Fichier final : clé, empreinte de ses octets (relie une relecture reprise au fichier relu), mesures (Q24). */
  fichier: { cle: string; empreinte?: string; mesures?: MesuresExport };
}

/** Mesures attendues du fichier final (Q24). */
export const MESURES_IV = Object.freeze({ lufs: LOUDNESS_IV_LUFS, toleranceLufs: 1, creteMaxDbtp: CRETE_IV_DBTP, noirOuFigeMaxSec: 0.5, figeSousVoixMaxSec: FIGE_IV.sousVoixMaxSec, largeur: 1080, hauteur: 1920, fps: 25 });

export interface MesuresDeLaPorteIV {
  ecoute?: EcouteVersionIV;
  relecture?: { q26: ConstatControle; indications: string[]; remarques?: string[] };
  /** Verdict des plafonds pour les réseaux de cette version (Q11), calculé par la porte sur toutes les versions. */
  plafonds: VerdictReseauIV[];
}

export interface ContexteControlesIV {
  carte: CarteImage;
  /** Fiche LONGUE validée (Q11 bis : chapitres retirés) ; la fiche de la version est dans la version. */
  ficheValidee: FicheImage;
  regles?: Omit<ContexteRegles, "carte" | "noeudsRetires">;
  voix: Pick<EtatVoixIV, "issue">;
  publication: PublicationIV;
  liens: Readonly<Record<string, string>>;
}

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const sec = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;

function ligneIV(code: CodeControleIV, v: Pick<VersionAControlerIV, "version" | "reseaux">, details: readonly string[], o: { nonFait?: boolean; phraseOk?: string; indicatif?: boolean } = {}): LigneControleIV {
  const bloquant = !CONTROLES_INDICATIFS.has(code) && !o.indicatif;
  const etat: EtatLigneIV = o.nonFait ? "non-fait" : details.length ? "echoue" : "reussi";
  const libelle = LIBELLES_CONTROLE_IV[code];
  const suite = details.length > 1 ? ` (et ${details.length - 1} autre${details.length > 2 ? "s" : ""})` : "";
  const phrase =
    etat === "reussi" ? `${libelle} : ${o.phraseOk ?? "conforme"}.` : `${libelle}${etat === "non-fait" ? " (non vérifié)" : ""} : ${details[0] ?? "donnée absente"}${suite}`;
  return { code, version: v.version, reseaux: [...v.reseaux], etat, bloquant, phrase, details: [...details] };
}

/** Constat « souple » : remarques non bloquantes (écoute bonne dans l'ensemble) ; `souple` vrai quand elles sont seules. */
type ConstatSouple = ConstatControle & { souple?: boolean };
function avecRemarques(c: ConstatControle | undefined, remarques: readonly string[] | undefined): ConstatSouple | undefined {
  if (!c || !remarques?.length) return c;
  if (!c.ok) return { ...c, details: [...c.details, ...remarques] };
  return { ok: false, details: [...remarques], souple: true };
}

const deConstat = (code: CodeControleIV, v: VersionAControlerIV, c: ConstatSouple | undefined, absent: string, phraseOk?: string) =>
  c ? ligneIV(code, v, c.details.length || c.ok ? c.details : [absent], { ...(c.nonFait ? { nonFait: true } : {}), ...(phraseOk ? { phraseOk } : {}), ...(c.souple ? { indicatif: true } : {}) }) : ligneIV(code, v, [absent], { nonFait: true });

/** Empreinte stable d'une ligne de temps (sa forme JSON). */
export function empreinteLigne(l: LigneDeTempsIV): string {
  return createHash("sha256").update(JSON.stringify(l)).digest("hex").slice(0, 32);
}

/** Texte que dit la version : corps, puis question et fin (rien après la phrase-choc sur LinkedIn). */
export function scriptDeLaVersion(v: Pick<VersionAControlerIV, "fiche" | "fin">): string {
  const fin = v.fin && !v.fin.muet ? [v.fin.question?.dit ?? "", ...v.fin.appels.map((a) => a.dit)] : [];
  return [texteDuCorps(v.fiche), ...fin].map((t) => t.trim()).filter(Boolean).join(" ");
}

/** La phrase est-elle entendue en entier dans le texte entendu ? */
function entendue(phrase: string, entendu: string): boolean {
  const formes = formesComparables(phrase);
  if (!formes.length) return false;
  const dits = jetonsDits(entendu.split(/\s+/).filter(Boolean).map((mot) => ({ mot: formeDite(mot), debutSec: 0, finSec: 0 })), () => true).flatMap((j) => formesComparables(j.forme).map((forme) => ({ forme, mot: j.mot })));
  return occurrences(formes, dits).some((o) => o.complete);
}

/* ------------------------------------------------------------------ */
/* Les contrôles                                                         */
/* ------------------------------------------------------------------ */

/** Mise en scène recalculée depuis ses entrées (déterministe) ; ses lignes, et l'égalité avec la ligne rendue. */
export function relireMiseEnScene(v: Pick<VersionAControlerIV, "scene" | "ligne" | "piste">): { resultat: ResultatMiseEnSceneIV | null; ecarts: string[] } {
  let resultat: ResultatMiseEnSceneIV;
  try {
    resultat = mettreEnSceneIV(v.scene);
  } catch (err) {
    return { resultat: null, ecarts: [`la mise en scène ne se recalcule pas (${(err as Error).message}).`] };
  }
  const ecarts: string[] = [];
  if (empreinteLigne(resultat.ligne) !== empreinteLigne(v.ligne)) ecarts.push("la ligne de temps rendue n'est pas celle que donnent le script et la voix : elle n'a pas été contrôlée.");
  const mots = v.scene.voix.mots;
  if (mots.length !== v.piste.mots.length || mots.some((m, i) => m.mot !== v.piste.mots[i].mot || Math.abs(m.debutSec - v.piste.mots[i].debutSec) > 1e-6)) ecarts.push("la mise en scène n'a pas été calée sur la piste voix seule de cette version.");
  return { resultat, ecarts };
}

/** Carte d'une version courte : sans les blocs retirés, ni leurs flèches, branches et chiffres. */
export function carteSansRetires(carte: CarteImage, noeudsRetires: readonly string[]): CarteImage {
  const r = new Set(noeudsRetires);
  return {
    ...carte,
    noeuds: carte.noeuds.filter((n) => !r.has(n.id)),
    liens: carte.liens.filter((l) => !r.has(l.de) && !r.has(l.vers)),
    groupes: carte.groupes.map((g) => ({ ...g, noeuds: g.noeuds.filter((n) => !r.has(n)) })).filter((g) => g.noeuds.length > 0),
    chiffres: carte.chiffres.filter((c) => !(c.dansNoeud && r.has(c.dansNoeud)) && !(c.dansLien && carte.liens.some((l) => l.id === c.dansLien && (r.has(l.de) || r.has(l.vers))))),
  };
}

/** Manquements du script rangés par contrôle. */
function parRegle(manquements: readonly Manquement[]): Map<CodeControleIV, string[]> {
  const res = new Map<CodeControleIV, string[]>();
  const vers: Record<Manquement["regle"], CodeControleIV> = { FORME: "Q07", CHAPITRES: "Q11bis", Q04: "Q04", Q05: "Q05", Q05bis: "Q05bis", Q06: "Q06", Q07: "Q07", Q08: "Q08", Q08bis: "Q08bis", Q09: "Q09", Q10: "Q10" };
  for (const m of manquements) {
    const code = vers[m.regle];
    res.set(code, [...(res.get(code) ?? []), `${m.ecranId ? `écran ${m.ecranId} : ` : ""}${m.message}`]);
  }
  return res;
}

/**
 * Toutes les lignes d'une version (PUR). `m` : ce que la porte a mesuré ou fait payer ; une mesure absente rend sa
 * ligne « non faite », donc bloquante.
 */
export function controlerVersionIV(v: VersionAControlerIV, ctx: ContexteControlesIV, m: MesuresDeLaPorteIV): LigneControleIV[] {
  const { carte } = ctx;
  const lignes: LigneControleIV[] = [];
  const L = (code: CodeControleIV, details: readonly string[], o: { nonFait?: boolean; phraseOk?: string; indicatif?: boolean } = {}) => lignes.push(ligneIV(code, v, details, o));

  // Q01-Q03 · la carte.
  L("Q01", carte.validation || carte.lecture.ecarts.length === 0 ? [] : [`${carte.lecture.ecarts.length} écart(s) entre les deux lectures de l'image ne sont pas tranchés.`]);
  L("Q02", carte.coherence.filter((c) => !c.ok).map((c) => `« ${c.calcul} » ne tombe pas juste sur l'image : la vidéo le dit tel qu'écrit.`));
  const q03: string[] = [];
  if (!carte.validation) q03.push("la carte n'a pas été validée par Will.");
  else if (ctx.ficheValidee.empreinteCarte !== empreinteDeCarte(carte) || v.fiche.empreinteCarte !== empreinteDeCarte(carte)) q03.push("le script n'a pas été écrit d'après la carte validée (empreinte différente).");
  L("Q03", q03);

  // Q04-Q10 · le script de la version (fiche courte et nœuds retirés pour une version courte).
  const verdict = verifierScript(v.fiche, { ...(ctx.regles ?? {}), carte, ...(v.courte ? { noeudsRetires: v.noeudsRetires ?? [] } : {}) });
  const regles = parRegle(verdict.manquements);
  const ecoute = m.ecoute;
  const entendu = ecoute?.texteEntendu ?? "";
  const sansEcoute = !ecoute || !ecoute.q18.ok && !!ecoute.q18.nonFait;

  L("Q04", regles.get("Q04") ?? []);
  L("Q05", [...(regles.get("Q05") ?? []), ...(ecoute?.comparaison?.chiffresInventes ?? []).map((c) => `la voix dit « ${c} », absent du script et de l'image.`)]);
  L("Q05bis", regles.get("Q05bis") ?? []);

  // Q06 · phrase-choc mot pour mot, et entendue.
  const q06 = [...(regles.get("Q06") ?? [])];
  const choc = phraseChocAttendue(carte, ctx.regles?.choixFormules);
  if (ecoute && !sansEcoute && !entendue(choc, entendu)) q06.push(`la phrase-choc (« ${choc} ») n'est pas entendue en entier.`);
  if (sansEcoute && q06.length === 0) L("Q06", ["l'écoute n'a pas été faite : la phrase-choc n'est pas confirmée."], { nonFait: true });
  else L("Q06", q06);

  // Q07 · ossature, et accroche finie avant 3 s sur la voix.
  const q07 = [...(regles.get("Q07") ?? [])];
  const accroche = v.fiche.ecrans.filter((e) => e.partie === PARTIES[0]).reduce((n, e) => n + motsDits(e.texteDit).length, 0);
  const finAccroche = v.piste.mots[accroche - 1]?.finSec;
  if (!accroche || finAccroche === undefined) q07.push("l'accroche n'a pas de mots sur la voix.");
  else if (finAccroche > 3 + 1e-6) q07.push(`l'accroche finit à ${sec(finAccroche)} (avant 3 s).`);
  L("Q07", q07);

  // Q08 · interdits : script, question, écrans (L6), voix entendue, post et premier commentaire.
  const interdits = [...INTERDITS_PERMANENTS, ...(ctx.regles?.interdits ?? [])];
  const q08 = [
    ...(regles.get("Q08") ?? []),
    ...(entendu ? interditsDans(entendu, interdits).map((x) => `la voix dit « ${x} ».`) : []),
    ...ctx.publication.manquements.filter((x) => v.reseaux.includes(x.reseau) && /interdit/.test(x.detail)).map((x) => `${x.reseau} : ${x.detail}`),
  ];
  L("Q08", q08);

  // Q08 bis · question présente hors LinkedIn (et entendue), absente de LinkedIn ; aucune fin dite sur LinkedIn.
  const q08bis = [...(regles.get("Q08bis") ?? [])];
  const linkedin = v.reseaux.includes("linkedin");
  if (linkedin) {
    if (v.fin && !v.fin.muet) q08bis.push("la version LinkedIn porte un segment de fin : rien ne doit être dit ni affiché après la phrase-choc.");
    if (v.piste.mots.length !== v.piste.motsCorps || v.piste.raccordSec !== undefined) q08bis.push("la voix LinkedIn dit quelque chose après la phrase-choc.");
    if (v.reseaux.some((r) => r !== "linkedin")) q08bis.push(`la version muette de LinkedIn sert aussi ${v.reseaux.filter((r) => r !== "linkedin").join(", ")}.`);
  } else if (!v.fin || v.fin.muet) q08bis.push(`aucune fin pour ${v.reseaux.join(", ")} : la question de commentaire et la fin du réseau manquent.`);
  else if (!v.fin.question) q08bis.push(`la question de commentaire manque pour ${v.reseaux.join(", ")}.`);
  else if (ecoute && !sansEcoute && !entendue(v.fin.question.dit, entendu)) q08bis.push(`la question (« ${v.fin.question.dit} ») n'est pas entendue en entier.`);
  L("Q08bis", q08bis);

  L("Q09", regles.get("Q09") ?? []);
  // Q10 : la fourchette de durée du script vaut pour le script validé ; une version courte est jugée par Q11 et Q11 bis.
  L("Q10", v.courte ? [] : regles.get("Q10") ?? [], v.courte ? { phraseOk: "version courte, durée jugée au plafond du réseau" } : {});

  // Q11 · durée mesurée : corps dans la fourchette de la classe (version longue) ; plafond de chaque réseau.
  const q11: string[] = [];
  const q11Souple: string[] = [];
  if (!v.courte) {
    const [bas, haut] = complexiteDe(carte).fourchetteSec;
    const corps = v.piste.mots[v.piste.motsCorps - 1]?.finSec;
    if (corps === undefined) q11.push("la durée du corps n'a pas pu être mesurée.");
    else if (corps > haut * 1.1 + 1e-6) q11Souple.push(`la voix dépasse de ${sec(corps - haut)} : raccourcissez l'explication (corps de ${sec(corps)} pour ${haut} s au plus).`);
    else if (corps < bas * 0.9 - 1e-6) q11Souple.push(`le corps ne dure que ${sec(corps)} (${bas} s au moins).`);
  }
  for (const r of v.reseaux) {
    const p = m.plafonds.find((x) => x.reseau === r);
    if (!p) q11.push(`le plafond de ${r} n'a pas été jugé.`);
    else if (p.bloquant) q11.push(p.phrase ?? `${p.nom} non livré.`);
  }
  // Durée du corps hors fourchette : remarque (la vidéo reste utilisable) ; seuls le plafond du réseau et une durée non mesurée bloquent.
  L("Q11", [...q11, ...q11Souple], { indicatif: q11.length === 0 && q11Souple.length > 0 });

  // Q11 bis · version courte : chapitres retirés tous non essentiels, script détachable (chapitres de L6).
  const q11bis = [...(regles.get("Q11bis") ?? [])];
  if (v.courte) {
    const retires = v.retires ?? [];
    if (!retires.length) q11bis.push("la version courte ne dit pas quels chapitres sont retirés.");
    for (const t of retires) {
      const c = ctx.ficheValidee.chapitres.find((x) => x.titre === t);
      if (!c) q11bis.push(`le chapitre retiré « ${t} » n'existe pas dans le script validé.`);
      else if (c.essentiel) q11bis.push(`le chapitre « ${t} » est essentiel : il ne peut pas être retiré.`);
    }
  }
  L("Q11bis", q11bis);

  // Mise en scène relue : Q12-Q15, Q19 (ligne de temps), Q20-Q23, Q25, fonds, mot orange, fin du réseau.
  const scene = relireMiseEnScene(v);
  L("SCENE", scene.ecarts);
  const lignesScene = scene.resultat?.rapport.lignes ?? [];
  const sceneDe = (code: LigneControleSceneIV["code"]) => lignesScene.filter((l) => l.code === code && l.bloquant).flatMap((l) => l.details);
  const sceneCode = (code: CodeControleIV & LigneControleSceneIV["code"]) => (scene.resultat ? L(code, sceneDe(code)) : L(code, ["la mise en scène n'a pas pu être relue."], { nonFait: true }));
  // Q12 d'une version courte : la carte sans les blocs des chapitres retirés (la mise en scène de L11 ne connaît pas
  // les retraits et réclamerait des blocs volontairement ôtés).
  if (v.courte && scene.resultat) L("Q12", controlerToutMontre(v.ligne, carteSansRetires(carte, v.noeudsRetires ?? []), clesDeLaCarte(carte)).details);
  else sceneCode("Q12");
  sceneCode("Q13");

  // Chaque chiffre de la carte à dire (hors chapitres retirés) : DIT (entendu, valeur + unité) ET MONTRÉ.
  const cles = clesDeLaCarte(carte);
  const montres = new Set(v.ligne.evenements.filter((e) => e.visible).flatMap((e) => e.chiffres));
  const chiffres: string[] = [];
  for (const c of (v.courte ? carteSansRetires(carte, v.noeudsRetires ?? []) : carte).chiffres) {
    if (!c.aDire) continue;
    const cle = cles.get(c.id)!;
    if (!sansEcoute && !ecoute!.chiffresEntendus.includes(cle)) chiffres.push(`le chiffre « ${c.brut} » n'est pas entendu (valeur et unité).`);
    if (!montres.has(cle)) chiffres.push(`le chiffre « ${c.brut} » n'est jamais affiché.`);
  }
  if (sansEcoute) L("CHIFFRES", chiffres.length ? chiffres : ["l'écoute n'a pas été faite : les chiffres dits ne sont pas confirmés."], chiffres.length ? {} : { nonFait: true });
  else L("CHIFFRES", chiffres);

  sceneCode("Q14");
  sceneCode("Q15");

  // Q16 · voix acceptée (hésitations relues, ressemblance v4).
  const issue = ctx.voix.issue;
  L("Q16", issue?.statut === "faite" ? [] : [issue?.statut === "refus" ? issue.message : "la voix n'est pas finie."], issue ? {} : { nonFait: true });

  // Q17-Q19 · écoute (piste voix seule) ; Q19 reprend aussi la ligne de temps.
  lignes.push(deConstat("Q17", v, ecoute?.q17, "la piste voix seule n'a pas été lue."));
  lignes.push(deConstat("Q18", v, avecRemarques(ecoute?.q18, ecoute?.q18Remarques), "l'écoute n'a pas été faite.", ecoute?.comparaison ? `${Math.round(ecoute.comparaison.part * 1000) / 10} % des mots entendus dans l'ordre, chiffres tous entendus` : undefined));
  const q19 = ecoute?.q19;
  const q19Ligne = sceneDe("Q19");
  lignes.push(deConstat("Q19", v, q19 ? { ...q19, ok: q19.ok && q19Ligne.length === 0, details: [...q19.details, ...q19Ligne] } : undefined, "la fin n'a pas été mesurée sur la voix seule."));

  sceneCode("Q20");

  // Q21 · textes lisibles (L11) et mise en page À CHAQUE INSTANT CLÉ (remplissage, marges, plancher, icônes).
  const q21 = sceneDe("Q21");
  // Mesurée ici, avec les MÊMES plans que les composants (`@/briques/schema-motion/emprise`, lu aussi par `studio-rendu`).
  const instantsQ21 = instantsClesIV(v.ligne, ctx.carte).map((i) => i.instantSec);
  const mp = miseEnPageAuxInstantsIV(v.ligne, instantsQ21);
  L("Q21", [...q21, ...(instantsQ21.length ? [] : ["aucun instant clé à contrôler."]), ...mp.flatMap((r) => r.defauts.map((d) => `à ${sec(r.instantSec)} : ${d}`))]);
  sceneCode("Q22");
  sceneCode("Q23");

  // Q24 · mesures du fichier final ; une mesure absente = non fait.
  const me = v.fichier.mesures;
  const lire = (k: string) => (me && typeof me[k] === "number" && Number.isFinite(me[k]) ? (me[k] as number) : null);
  const q24: string[] = [];
  /** Mesures de DÉTAIL (volume, crête, image noire ou figée) : remarque orange. Le cadre et la cadence sont des remarques aussi ; une mesure absente reste bloquante. */
  const q24Souple: string[] = [];
  const absentes: string[] = [];
  const M = MESURES_IV;
  /** `detail` : remarque orange ; `plancher` (si donné) : au-delà, la vidéo est inutilisable et la mesure BLOQUE quand même. */
  const verifier = (k: string, nom: string, ok: (x: number) => boolean, ko: (x: number) => string, detail = false, plancher?: (x: number) => boolean) => {
    const x = lire(k);
    if (x === null) absentes.push(nom);
    else if (!ok(x)) (detail && !(plancher && plancher(x)) ? q24Souple : q24).push(ko(x));
  };
  // Planchers bloquants (vidéo inutilisable) : en deçà de ces valeurs, une mesure hors seuil reste une remarque.
  const NOIR_PLANCHER_SEC = 2; // image noire de plus de 2 s
  const FIGE_PLANCHER_SEC = 5; // image figée de plus de 5 s
  const LUFS_PLANCHER_ECART = 6; // volume à plus de 6 LUFS de la cible (−14)
  const horsPlancherLufs = (x: number) => Math.abs(x - M.lufs) > LUFS_PLANCHER_ECART;
  const noirTropLong = (x: number) => x > NOIR_PLANCHER_SEC;
  const figeTropLong = (x: number) => x > FIGE_PLANCHER_SEC;
  verifier("lufs", "le volume", (x) => Math.abs(x - M.lufs) <= M.toleranceLufs + 1e-9, (x) => `volume à ${x} LUFS (−14 à 1 près).`, true, horsPlancherLufs);
  verifier("creteVraieDbtp", "la crête", (x) => x <= M.creteMaxDbtp + 1e-9, (x) => `crête à ${x} dBTP (−1 au plus).`, true);
  verifier("noirMaxSec", "les images noires", (x) => x <= M.noirOuFigeMaxSec + 1e-9, (x) => `image noire de ${sec(x)} (0,5 s au plus).`, true, noirTropLong);
  // Image figée (décision de Will du 17/10) : jusqu'à 2,5 s tant que la voix parle (écran tenu le temps d'une phrase),
  // 0,5 s hors voix (silence, fin). Sans la mesure « hors voix », le fichier est jugé comme avant (0,5 s partout).
  const horsVoix = lire("figeHorsVoixMaxSec");
  if (horsVoix === null) verifier("figeMaxSec", "les images figées", (x) => x <= M.noirOuFigeMaxSec + 1e-9, (x) => `image figée de ${sec(x)} (0,5 s au plus).`, true, figeTropLong);
  else {
    verifier("figeMaxSec", "les images figées", (x) => x <= M.figeSousVoixMaxSec + 1e-9, (x) => `image figée de ${sec(x)} (2,5 s au plus, même pendant que la voix parle).`, true, figeTropLong);
    verifier("figeHorsVoixMaxSec", "les images figées hors voix", (x) => x <= M.noirOuFigeMaxSec + 1e-9, (x) => `image figée de ${sec(x)} sans voix (0,5 s au plus hors voix).`, true, figeTropLong);
  }
  // Cadre attendu : celui de la ligne de la version (1080 × 1920 en 9:16, 1080 × 1350 en 4:5).
  const largeur = v.ligne.largeur ?? M.largeur;
  const hauteur = v.ligne.hauteur ?? M.hauteur;
  verifier("largeur", "la largeur", (x) => x === largeur, (x) => `largeur de ${x} px (${largeur}).`, true);
  verifier("hauteur", "la hauteur", (x) => x === hauteur, (x) => `hauteur de ${x} px (${hauteur}).`, true);
  verifier("fps", "la cadence", (x) => Math.abs(x - M.fps) < 1e-6, (x) => `${x} images par seconde (25).`, true);
  if (absentes.length) L("Q24", [...q24, ...q24Souple, `non mesuré${absentes.length > 1 ? "s" : ""} sur le fichier final : ${absentes.join(", ")}.`], q24.length || q24Souple.length ? {} : { nonFait: true });
  else L("Q24", [...q24, ...q24Souple], { indicatif: q24.length === 0 && q24Souple.length > 0 });

  sceneCode("Q25");
  lignes.push(deConstat("Q26", v, avecRemarques(m.relecture?.q26, m.relecture?.remarques), "les images finales n'ont pas été relues."));

  // Q27 · textes de publication des réseaux de la version : présents, lien suivi là où la fin le promet, interdits.
  const q27: string[] = [];
  for (const r of v.reseaux) {
    const t = ctx.publication.textes.find((x) => x.reseau === r);
    if (!t) {
      q27.push(`pas de texte de publication pour ${r}.`);
      continue;
    }
    const lien = ctx.liens[r];
    if (!lien) q27.push(`pas de lien suivi pour ${r}.`);
    else if (t.ouPoserLeLien === "premier-commentaire" && !t.premierCommentaire?.includes(lien)) q27.push(`${r} : le lien suivi manque dans le premier commentaire.`);
    if (r === "youtube-shorts" && (!t.titre || t.titre.length > 60)) q27.push("YouTube Shorts : titre absent ou de plus de 60 caractères.");
  }
  q27.push(...ctx.publication.manquements.filter((x) => v.reseaux.includes(x.reseau)).map((x) => `${x.reseau} : ${x.detail}`));
  L("Q27", q27);

  // Q28 · débit mesuré (indicatif, sert à recalibrer).
  const corpsSec = v.piste.mots[v.piste.motsCorps - 1]?.finSec ?? 0;
  const debit = corpsSec > 0 ? v.piste.motsCorps / corpsSec : 0;
  const debitMin = DEBIT_MOTS_PAR_SEC * 0.85;
  const debitMax = DEBIT_MOTS_PAR_SEC * 1.15;
  L("Q28", debit >= debitMin && debit <= debitMax ? [] : [`${debit.toFixed(2).replace(".", ",")} mots par seconde (${debitMin.toFixed(2).replace(".", ",")} à ${debitMax.toFixed(2).replace(".", ",")} attendus).`], { phraseOk: `${debit.toFixed(2).replace(".", ",")} mots par seconde` });

  sceneCode("FOND");
  sceneCode("ORANGE");
  sceneCode("FIN");

  // Ordre du rapport.
  return CODES_CONTROLE_IV.flatMap((c) => lignes.filter((l) => l.code === c));
}
