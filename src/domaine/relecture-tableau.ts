/**
 * RELIRE LE SCRIPT · TABLEAU ANIMÉ (brique 7 sur 8) : l'adaptateur PUR du tableau vers l'écran commun « Relire le
 * script » (`relecture-script.ts`, `RelireScript`). Sans réseau, importable côté client et côté serveur.
 *
 * Deux moments, le même écran :
 *  1. AVANT « Découper en scènes » : le texte dit en lignes. Venu du générateur (gabarit cadré), une ligne par phrase
 *     dite, groupée par passage, ses mots à l'écran modifiables ; écrit à la main, une ligne par phrase. Les contrôles
 *     du tableau (`scripts-tableau-controles.ts` : gabarit, 2 à 3 étapes, bornes de mots, mots interdits) tournent sur
 *     le texte relu. Bloquent seulement ce que la suite refuserait de toute façon : un mot interdit (sur sa phrase) et
 *     le plafond de durée du tableau ; le reste est signalé (« alerte » ou « info »), comme pour un texte de Will.
 *  2. AVANT « Fabriquer » : la fiche de scènes en lignes (« la voix dit » et ses lignes écrites, par page). Le REPÈRE
 *     « script relu » est l'empreinte de ces lignes : le serveur l'exige au lancement, il tombe si le texte change.
 */
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { differences, empreinte, type LigneScript, type PastilleControle } from "./relecture-script";
import { CARACTERES_DITS_MAX_TABLEAU, CARACTERES_PAR_SECONDE_TABLEAU, DEBUT_DOULEUR_SEC, DUREE_MAX_TABLEAU_SEC, caracteresDits, caracteresEn, caracteresEnTrop } from "./duree-tableau";
import { MARGE_DEBUT_DOULEUR, nettoyerMotsDouleur } from "./douleur-tableau";
import { mots as motsDuTexte, motsPleins, racine } from "./controles-script/texte";
import { LIBELLES_PARTIES, normaliserScript, type DemandeScriptTableau, type EcritureScript, type PhraseScript, type ResultatScriptTableau, type ScriptTableau } from "./scripts-tableau";
import {
  controlerEcriture,
  controlerEntrepriseTexte,
  controlerFormules,
  controlerRepetitionMots,
  ecritureLue,
  motsInterditsDans,
  phrasesDe,
  texteDitDe,
  type DefautScript,
} from "./scripts-tableau-controles";

const resserrer = (t: string) => t.replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------ */
/* 1. Le texte dit                                                      */
/* ------------------------------------------------------------------ */

/**
 * Chaque phrase du script, dans l'ordre DIT (celui de `phrasesDites`), passée à `f` avec son passage ; rend le script
 * avec les phrases que `f` renvoie. Un ancien résultat d'étape vide n'est pas dit : il est laissé tel quel.
 */
function parcourir(brut: ScriptTableau, f: (p: PhraseScript, i: number, groupe: string) => PhraseScript): ScriptTableau {
  const s = normaliserScript(brut);
  let i = 0;
  const m = (groupe: string) => (p: PhraseScript) => f(p, i++, groupe);
  const accroche = s.accroche.map(m(LIBELLES_PARTIES.accroche));
  const douleur = s.douleur.map(m(LIBELLES_PARTIES.douleur));
  const promesse = s.promesse.map(m(LIBELLES_PARTIES.solution));
  const etapes = s.etapes.map((e, n) => {
    const g = m(`${LIBELLES_PARTIES.etape} ${n + 1}`);
    const action = g(e.action);
    const comment = e.comment.map(g);
    return { ...e, action, comment, ...(e.resultat?.dit.trim() ? { resultat: g(e.resultat) } : {}) };
  });
  const exemple = { ...s.exemple, phrases: s.exemple.phrases.map(m(LIBELLES_PARTIES.exemple)) };
  const aRetenir = s.aRetenir.map(m(LIBELLES_PARTIES["a-retenir"]));
  const appel = s.appel.map(m(LIBELLES_PARTIES.appel));
  return { ...s, accroche, douleur, promesse, etapes, exemple, aRetenir, appel };
}

/** Le script du générateur en lignes : une par phrase dite (`p0`, `p1`…), groupée par passage, ses mots à l'écran. */
export function lignesDuScriptTableau(script: ScriptTableau): LigneScript[] {
  const lignes: LigneScript[] = [];
  parcourir(script, (p, i, groupe) => {
    if (p.dit.trim()) lignes.push({ id: `p${i}`, dit: p.dit.trim(), groupe, ecrits: p.ecran.trim() ? [{ texte: p.ecran.trim(), modifiable: true }] : [] });
    return p;
  });
  return lignes;
}

/** Le script du générateur avec les phrases relues (phrase dite et mots à l'écran, par identifiant de ligne). */
export function scriptAvecLignes(script: ScriptTableau, lignes: readonly LigneScript[]): ScriptTableau {
  const parId = new Map(lignes.map((l) => [l.id, l] as const));
  return parcourir(script, (p, i) => {
    const l = parId.get(`p${i}`);
    return l ? { dit: l.dit, ecran: l.ecrits?.[0]?.texte ?? p.ecran } : p;
  });
}

/** Un texte écrit à la main en lignes : une par phrase (`t0`, `t1`…). */
export function lignesDuTexteTableau(texte: string): LigneScript[] {
  return phrasesDe(texte).map((dit, i) => ({ id: `t${i}`, dit }));
}

/** Le texte dit des lignes relues, phrases jointes par une espace (une ligne vidée n'est plus dite). */
export function texteDesLignes(lignes: readonly LigneScript[]): string {
  return lignes
    .map((l) => resserrer(l.dit))
    .filter(Boolean)
    .join(" ");
}

/**
 * Le repère « texte relu » exigé par « Découper en scènes » : l'empreinte du texte dit des lignes relues (espaces
 * resserrées). Le serveur le recalcule sur le texte reçu : une lettre changée sans relecture, un autre repère.
 */
export function repereTexte(texte: string): string {
  return empreinte([{ id: "texte", dit: resserrer(texte) }]);
}

/**
 * « Découper à nouveau » (une fiche existe, le texte dit est dans le grand champ) : le texte déjà relu et découpé
 * repart avec son repère ; modifié, il se RELIT d'abord (rien ne part, aucun prix demandé).
 */
export function decouperANouveau(texteSaisi: string, texteRelu: string): { relu: string } | { relire: true } {
  return resserrer(texteSaisi) === resserrer(texteRelu) ? { relu: repereTexte(texteRelu) } : { relire: true };
}

/**
 * Origine du texte quand Will clique « J'ai déjà mon texte ». Dès qu'un texte de Claude a été repris dans ce brouillon
 * (`texteClaude`), le champ ne vaut « will » que s'il est VIDE : un texte de Claude, même retouché, reste à Claude
 * (« generateur », tous ses contrôles). Aucun texte de Claude dans ce brouillon : « will ».
 */
export function origineApresChoixWill(texteClaude: string | null, texteAffiche: string): "will" | "generateur" {
  return texteClaude !== null && resserrer(texteAffiche) !== "" ? "generateur" : "will";
}

/**
 * Origine du texte après une action de Will sur l'écran : `champ` (il tape ou colle dans le grand champ : seul un champ
 * vidé le redonne à Will), `import` (il importe un fichier ou un texte : c'est le sien), `bouton` (retour par « J'ai déjà
 * mon texte » : « will » le reste ; sinon voir `origineApresChoixWill`).
 */
export function origineApresSaisie(origine: "will" | "generateur", source: "champ" | "import" | "bouton", texte: string, texteClaude: string | null): "will" | "generateur" {
  if (source === "import") return "will";
  if (source === "champ") return resserrer(texte) === "" ? "will" : origine;
  return origine === "will" ? "will" : origineApresChoixWill(texteClaude, texte);
}

/** Ce que ces deux fonctions lisent d'un brouillon (forme de `BrouillonTableau`, et de sa vue pour l'écran). */
interface BrouillonOrigine {
  generation?: { demande: DemandeScriptTableau; issue: IssueGenerateur } | null;
  donnees: { texte: string; origine?: "will" };
}

/**
 * Le texte de Claude que ce brouillon porte (l'état de l'écran, perdu au rechargement, se retrouve ici) : le texte rangé
 * s'il n'est pas déclaré de Will, sinon le texte dit de l'écriture de Claude ; `null` : aucune écriture, ou texte déjà
 * déclaré de Will.
 */
export function texteClaudeDuBrouillon(b: BrouillonOrigine | null | undefined): string | null {
  if (!b?.generation || b.donnees.origine === "will") return null;
  if (b.donnees.texte.trim()) return b.donnees.texte;
  const c = contexteDuGenerateur(b.generation);
  return c ? texteDitDe(c.ecriture.script) : null;
}

/** Texte comparable : minuscules, ni ponctuation ni guillemets, espaces resserrés. */
const comparable = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Le texte reprend-il, mot pour mot (comparable), au moins la moitié des phrases de `modele` ? */
function reprendLaMoitie(texte: string, modele: string): boolean {
  const t = ` ${comparable(texte)} `;
  const phrases = phrasesDe(modele).map(comparable).filter((p) => p.split(" ").length >= 3);
  if (!phrases.length) return comparable(texte) === comparable(modele);
  return phrases.filter((p) => t.includes(` ${p} `)).length * 2 >= phrases.length;
}

/**
 * Garde-fou SERVEUR : l'origine « will » (déclarée par l'écran) est ignorée quand le brouillon a une écriture de Claude
 * et que le texte reçu est ce texte de Claude : son texte dit, ou le texte rangé d'un brouillon qui n'est pas déclaré de
 * Will. Comparaison sur textes comparables (casse, ponctuation) ; un texte qui reprend au moins la moitié des phrases de
 * Claude mot pour mot est encore le sien.
 */
export function texteDeWillAccepte(texte: string, b: BrouillonOrigine | null | undefined): boolean {
  if (!b?.generation) return true;
  const c = contexteDuGenerateur(b.generation);
  if (c && reprendLaMoitie(texte, texteDitDe(c.ecriture.script))) return false;
  return !(b.donnees.origine !== "will" && b.donnees.texte.trim() && reprendLaMoitie(texte, b.donnees.texte));
}

/**
 * AVIS seulement, non bloquant (plus appelé avant le prix : le texte de Will est pris à l'identique, la règle 10 ne contrôle
 * plus sa voix) : la douleur dite dans les premières secondes du texte de Will. Les mots cherchés sont ceux de la douleur donnés, sinon les mots pleins de la
 * douleur. `null` : rien à dire ; sinon la phrase qui dit ce qui manque (rien n'a été payé).
 */
export function defautDouleurDuTexteDeWill(texte: string, douleur: string, motsDouleur: readonly string[] | undefined): string | null {
  const donnes = nettoyerMotsDouleur(motsDouleur ?? []).filter((m) => motsPleins(m).length);
  const cherches = donnes.length ? donnes : [...new Set(motsDuTexte(douleur).filter((m) => motsPleins(m).length))];
  const cles = new Set(cherches.flatMap((m) => motsPleins(m)).map(racine));
  if (!cles.size) return null;
  const limite = caracteresEn(DEBUT_DOULEUR_SEC * MARGE_DEBUT_DOULEUR, CARACTERES_PAR_SECONDE_TABLEAU);
  const debut = resserrer(texte).slice(0, limite);
  if (motsPleins(debut).some((m) => cles.has(racine(m)))) return null;
  const liste = cherches.slice(0, 6).map((m) => `« ${m} »`).join(", ");
  return `Aucun mot de la douleur n'est dit dans les ${DEBUT_DOULEUR_SEC} premières secondes de votre texte : faites-en dire un dès le début (${liste}), ou changez les mots de la douleur pour ceux que votre début dit. Rien n'a été payé.`;
}

/** Phrase du bouton inactif quand la case « déjà vu » n'est pas cochée (le serveur et l'écran disent la même). */
export const RAISON_CASE_DEJA_VU = "Cochez d'abord « Ce conseil n'est pas en première page d'une recherche ».";

/** Les lignes du texte à relire : celles du script généré s'il redonne ce texte mot pour mot, sinon phrase par phrase. */
export function lignesDeDepart(texte: string, script: ScriptTableau | undefined | null): LigneScript[] {
  return script && resserrer(texteDitDe(script)) === resserrer(texte) ? lignesDuScriptTableau(script) : lignesDuTexteTableau(texte);
}

/** Ce que les contrôles du gabarit reçoivent en plus du texte : l'écriture du générateur et sa demande. */
export interface ContexteRelectureTableau {
  ecriture: EcritureScript;
  demande: DemandeScriptTableau;
  /** Texte du générateur retouché au point de ne plus suivre ses lignes (`t…`) : il garde les contrôles d'un texte libre. */
  retouche?: true;
}

/** L'issue d'une écriture du générateur (forme de `GenerationBrouillon.issue`). */
export type IssueGenerateur = { ok: true; resultat: ResultatScriptTableau } | { ok: false; meilleure?: { ecriture: EcritureScript } };

/** L'écriture du générateur (livrée, sinon sa meilleure version gardée) et sa demande ; `null` : rien d'écrit. */
export function contexteDuGenerateur(g: { demande: DemandeScriptTableau; issue: IssueGenerateur } | null | undefined): ContexteRelectureTableau | null {
  if (!g) return null;
  if (!g.issue.ok) return g.issue.meilleure ? { ecriture: g.issue.meilleure.ecriture, demande: g.demande } : null;
  const r = g.issue.resultat;
  const ecriture: EcritureScript = {
    idee: r.idee ?? "",
    gain: r.gain ?? { formule: "", unite: "" },
    metierExemple: r.metierExemple ?? "",
    script: r.script,
    motsDouleur: r.motsDouleur ?? [],
    sources: r.sources ?? [],
    affirmations: r.affirmations ?? [],
    variantes: [],
    aPreparer: r.aPreparer ?? [],
  };
  return { ecriture, demande: g.demande };
}

/**
 * Les lignes du script généré, si ce sont bien elles que la relecture renvoie (mêmes identifiants) ; si le texte du
 * générateur a été retouché et ne suit plus ses lignes : le même contexte marqué `retouche` (c'est toujours un texte de
 * Claude, il garde ses contrôles) ; `null` : aucun script généré, ou texte déclaré de Will (`deWill`, origine « will »
 * posée par l'écran au choix « J'ai déjà mon texte », même sur un brouillon qui a déjà une génération).
 */
export function contexteDesLignes(contexte: ContexteRelectureTableau | null, lignes: readonly LigneScript[]): ContexteRelectureTableau | null {
  if (!contexte || !lignes.length || lignes.some((l) => l.deWill)) return null;
  const ids = new Set(lignesDuScriptTableau(contexte.ecriture.script).map((l) => l.id));
  return lignes.length === ids.size && lignes.every((l) => ids.has(l.id)) ? contexte : { ...contexte, retouche: true };
}

/**
 * Lecture TOLÉRANTE du script relu reçu par une action serveur (donnée non sûre) : ses lignes, bornées ; le reste
 * (différences, barème, empreinte) est recalculé côté serveur, jamais cru.
 */
export function lireLignesRelues(brut: unknown): LigneScript[] {
  const liste = brut && typeof brut === "object" ? (brut as { lignes?: unknown }).lignes : null;
  if (!Array.isArray(liste)) return [];
  // Origine du texte, déclarée par l'écran au choix de Will : « will » (J'ai déjà mon texte) ou « generateur ».
  const deWill = (brut as { origine?: unknown }).origine === "will";
  return liste.slice(0, 200).flatMap((x): LigneScript[] => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.dit !== "string") return [];
    const ecrits = (Array.isArray(o.ecrits) ? o.ecrits : []).flatMap((e) => {
      const t = e && typeof e === "object" ? (e as { texte?: unknown }).texte : undefined;
      return typeof t === "string" ? [{ texte: t.slice(0, 300), modifiable: true }] : [];
    });
    return [{ id: o.id.slice(0, 60), dit: o.dit.slice(0, 2000), ...(ecrits.length ? { ecrits } : {}), ...(deWill ? { deWill: true as const } : {}) }];
  });
}

/**
 * Les contrôles du tableau sur le texte relu. Avec `contexte` (lignes du générateur) : TOUS les contrôles de l'écriture
 * (`controlerEcriture` : gabarit, étapes, bornes de mots…) ; texte du générateur retouché (`contexte.retouche`) : ceux
 * d'un texte libre (formules, répétitions, entreprise). Un mot interdit bloque, sur sa phrase, dans les deux cas ; le
 * plafond de durée du tableau bloque ; un défaut éliminatoire est une alerte, une remarque une information.
 * SANS `contexte` (texte que Will écrit, colle ou importe lui-même, « J'ai déjà mon texte » ; décision du 18/10) : pris à
 * l'identique, ni mot interdit ni avis de style ; seule la limite technique, le plafond de durée, bloque.
 */
export function pastillesTexteTableau(lignes: readonly LigneScript[], contexte?: ContexteRelectureTableau | null): PastilleControle[] {
  const texte = texteDesLignes(lignes);
  const pastilles: PastilleControle[] = [];
  if (contexte) for (const l of lignes) for (const libelle of motsInterditsDans(l.dit)) pastilles.push({ niveau: "bloquant", code: "mot-interdit", ligneId: l.id, texte: `Contient ${libelle}.` });
  if (caracteresDits(texte) > CARACTERES_DITS_MAX_TABLEAU) {
    pastilles.push({ niveau: "bloquant", code: "duree-plafond", texte: `${DUREE_MAX_TABLEAU_SEC} s au plus : raccourcissez le texte d'environ ${caracteresEnTrop(texte, DUREE_MAX_TABLEAU_SEC)} caractères.` });
  }
  if (!contexte) return pastilles;
  const defauts: DefautScript[] = contexte.retouche
    ? [...controlerFormules(texte), ...controlerRepetitionMots(texte), ...controlerEntrepriseTexte(texte, "Le texte dit")]
    : controlerEcriture(ecritureLue({ ...contexte.ecriture, script: scriptAvecLignes(contexte.ecriture.script, lignes), variantes: [] }), contexte.demande);
  const vus = new Set<string>();
  for (const d of defauts) {
    if (d.code === "mot-interdit" || vus.has(d.message)) continue;
    vus.add(d.message);
    pastilles.push({ niveau: d.eliminatoire ? "alerte" : "info", code: d.code, texte: d.message });
  }
  return pastilles;
}

/* ------------------------------------------------------------------ */
/* 2. La fiche de scènes                                                */
/* ------------------------------------------------------------------ */

type FicheLue = Pick<FicheTableau, "scenes">;

const lignesEcrites = (s: FicheTableau["scenes"][number]) => s.elements.flatMap((e) => (e.type === "ligne" ? [e] : []));

/** La fiche en lignes : une par scène (`id` de la scène), ce que dit la voix, puis ses lignes écrites, par page. */
export function lignesDeLaFiche(fiche: FicheLue): LigneScript[] {
  return fiche.scenes.map((s) => ({ id: s.id, dit: s.texteDit, groupe: `Page ${s.page}`, ecrits: lignesEcrites(s).map((e) => ({ texte: e.texte, modifiable: true })) }));
}

/** Correction d'une scène (forme de `CorrectionScene` du service) : le texte dit, et les lignes par identifiant. */
export interface CorrectionRelue {
  sceneId: string;
  texteDit?: string;
  lignes?: Record<string, string>;
}

/** Les seules modifications de la relecture, en corrections de la fiche (ce que « Enregistrer » envoie). */
export function correctionsDeLaRelecture(fiche: FicheLue, relues: readonly LigneScript[]): CorrectionRelue[] {
  return differences(lignesDeLaFiche(fiche), relues).flatMap((d): CorrectionRelue[] => {
    const s = fiche.scenes.find((x) => x.id === d.id);
    if (!s) return [];
    const ecrites = lignesEcrites(s);
    const lignes = Object.fromEntries((d.ecrits ?? []).flatMap((t, k) => (t !== null && ecrites[k] ? [[ecrites[k].id, t]] : [])));
    return [{ sceneId: s.id, ...(d.dit !== undefined ? { texteDit: d.dit } : {}), ...(Object.keys(lignes).length ? { lignes } : {}) }];
  });
}

/** Le repère « script relu » d'une fiche : l'empreinte de ses lignes (même texte, même repère ; une lettre, un autre). */
export function repereFiche(fiche: FicheLue): string {
  return empreinte(lignesDeLaFiche(fiche));
}
