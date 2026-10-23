/**
 * FIN PROPRE À CHAQUE SORTIE (décision du propriétaire, 12/10/2026) : aucune vidéo ne part sur TikTok ni sur YouTube
 * Shorts avec la fin « Écrivez MOT en commentaire. Je vous l'envoie. ». Le vertical de TikTok et Shorts
 * (`vertical-liens`) dit donc une AUTRE fin que les autres sorties : la fin validée sans promesse d'envoi du réseau, ou
 * AUCUN appel tant qu'aucune n'est validée (la phrase d'appel n'est ni dite ni écrite ; l'écran de fin montre
 * `axion-ia.com`). Depuis le 14/10 (Will) : UNE demande de la banque commune, choisie selon le type de la fiche
 * (`finDesLiens`, règle pure `choisirFinLiens` de `src/briques/fins/fin-liens.ts`) ; « aucun appel » ne reste qu'en repli.
 *
 * Ce fichier est PUR (aucun appel) :
 *  - `appelDitDeLaSortie` : ce que dit la fin d'une sortie (l'appel de la fiche, aucun appel, ou une autre phrase) ;
 *  - `trouverAppel` : où est la phrase d'appel dans la fiche (dernière scène, style « blocs/2 ») ;
 *  - `ficheDeVariante` : la fiche d'une sortie dont la fin diffère (appel retiré, ancres décalées, éléments de l'écran
 *    d'appel retirés : l'écran de fin ne montre plus que le site, ou la phrase de la fin et le site). Une dernière scène
 *    qui ne disait que l'appel est supprimée : la scène d'avant porte l'écran du site (incident du 12/10) ;
 *  - `texteCorps` : le texte du corps de la voix (tout sauf l'appel), le même qu'avant pour une voix déjà au journal ;
 *  - `planVoixSorties` : combien de voix lire, et comment. Une seule voix quand toutes les sorties disent la même fin
 *    (comportement d'avant, inchangé). Sinon le CORPS (tout sauf l'appel final) est lu UNE fois et chaque phrase de fin
 *    à part, puis raccordée au corps (`planRaccordVoix`, `recette-voix.ts`). Repli quand l'appel n'est pas à la fin de
 *    la dernière scène : une voix complète par variante, avec le surcoût annoncé ;
 *  - `estimerVoixSorties` : le prix de ces lectures, surcoût compris.
 */
import { choisirFinLiens, estObjectifFinLiens, type IndicesFiche } from "@/briques/fins/fin-liens";
import { EMPLACEMENT_MOT } from "@/briques/fins/types";
import { substituerPrononciations } from "@/domaine/prononciations";
import { mots } from "@/domaine/controles-script/texte";
import { ECRANS_PAR_SCENE_MAX as ECRANS_MAX } from "@/briques/fiche-scenes";
import { remettreEnForme } from "./decoupage";
import { cleMot, estStyleBlocs2, type EcranTableau, type ElementTableau, type FicheTableau, type MomentEcran, type SceneTableau } from "./fiche";
import { sansAppelAuMot, type IdSortie } from "./formats-sortie";
import { cleSimple, PHRASES_APPEL } from "./regles";

/** Adresse montrée en grand sur l'écran de fin sans appel. */
export const SITE_FIN = "axion-ia.com";

/** Alerte : le vertical de TikTok et Shorts se termine sans appel tant qu'aucune fin n'y est validée. */
export const FIN_SANS_APPEL_LIENS = "Fin sans appel pour TikTok et Shorts : phrase à valider (« Le lien est dans mon profil. »). Leur vidéo se termine sur axion-ia.com, sans appel ni promesse d'envoi.";

/** Fin retenue pour une sortie (même forme que `FinRetenue` de `fabriquer.ts`). */
export type FinDeSortie = { id: string; ecran: string; type?: string; mot?: string; dit?: string; objectif?: string } | { absente: string };

/** Ce que dit la fin d'une sortie : l'appel écrit dans la fiche, aucun appel, ou une autre phrase (sa fin validée). */
export type AppelDit = { sorte: "fiche" } | { sorte: "aucun" } | { sorte: "phrase"; dit: string; ecran: string };

/** Vrai pour une fin qui demande un mot en commentaire contre un envoi. */
export function finAuMot(fin: FinDeSortie | undefined): boolean {
  if (!fin || !("ecran" in fin)) return false;
  return fin.type === "commentaire" || !!fin.mot?.trim() || fin.ecran.includes(EMPLACEMENT_MOT) || !!fin.dit?.includes(EMPLACEMENT_MOT) || /\bje vous (l['’]\s?|les )?envoie\b/i.test(fin.dit ?? "");
}

/**
 * Ce que dit la fin d'une sortie. Le vertical de TikTok et Shorts, et le carré de LinkedIn (`sansAppelAuMot`) : jamais
 * l'appel de la fiche (fin au mot refusée) ;
 * sa fin validée sans promesse d'envoi si elle existe (phrase dite connue), sinon aucun appel. Les autres sorties :
 * l'appel de la fiche (comportement d'avant).
 */
export function appelDitDeLaSortie(id: IdSortie, fin: FinDeSortie | undefined): AppelDit {
  if (!sansAppelAuMot(id)) return { sorte: "fiche" };
  if (!fin || !("ecran" in fin) || finAuMot(fin) || !fin.dit?.trim()) return { sorte: "aucun" };
  return { sorte: "phrase", dit: fin.dit.trim(), ecran: fin.ecran };
}

/**
 * Type de la fiche, pour la fin de TikTok et Shorts (14/10, `choisirFinLiens`) : étapes numérotées (« Un. », « Deux. »),
 * mot à commenter proposé, question ou problème au départ.
 */
export function indicesDeLaFiche(fiche: Pick<FicheTableau, "scenes" | "structure">): IndicesFiche {
  const texte = fiche.scenes.map((s) => String(s.texteDit ?? "")).join(" ");
  const numero = (n: string) => new RegExp(`(^|[.!?…]\\s+)${n}\\s*[.:]`, "i").test(texte);
  return {
    etapes: numero("Un") && numero("Deux"),
    mot: fiche.scenes.some((s) => s.ecrans?.some((e) => e.motCommentaire)) || / (ecrivez|tapez|mettez) \S+ en commentaire | commentez /.test(` ${sansAccents(String(fiche.scenes.at(-1)?.texteDit ?? ""))} `),
    question: fiche.structure === "question-abonne" || /\?\s*$/.test(String(fiche.scenes[0]?.texteDit ?? "")),
    probleme: fiche.structure === "erreur-corrigee",
  };
}

/** La fin de TikTok et Shorts d'une fiche : UNE demande de la banque commune (`objectif` : réglage qui force le choix). */
export function finDesLiens(fiche: Pick<FicheTableau, "scenes" | "structure">, objectif?: string): FinDeSortie | undefined {
  const f = choisirFinLiens(indicesDeLaFiche(fiche), estObjectifFinLiens(objectif) ? { force: objectif } : {});
  return f ? { id: f.code, ecran: f.ecran, dit: f.dit, type: f.type, objectif: f.objectif } : undefined;
}

/** Une découpe du texte dit en jetons (séparés par des blancs), chacun avec son rang de mot lu (null : sans lettre). */
function jetons(texte: string): { t: string; mot: number | null }[] {
  let n = 0;
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ t, mot: /[\p{L}\p{N}]/u.test(t) ? n++ : null }));
}

const finDePhrase = (t: string) => /[.?!…]["»”)]*$/.test(t);
const sansAccents = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/** « Je vous l’envoie » et « Je vous les envoie » (essai du 12/10 : « les » n’était pas reconnu). */
const PROMESSE_ENVOI = /\bje vous (l |les )?envoie\b/;

/** Vrai pour une phrase d'appel (règle 12) ou une promesse d'envoi (« Je vous l'envoie »). */
function phraseDAppel(phrase: string): boolean {
  const p = ` ${sansAccents(phrase)} `;
  return PROMESSE_ENVOI.test(p) || PHRASES_APPEL.some((a) => p.includes(` ${sansAccents(a)} `));
}

/** Où est l'appel dans la fiche : scène (la dernière), mots [debut, fin[ du texte dit, et s'il la termine. */
export interface AppelTrouve {
  scene: number;
  debut: number;
  fin: number;
  /** L'appel termine la dernière scène (aucun mot après lui). */
  enFin: boolean;
  /** Le texte de l'appel, tel qu'il est écrit dans la fiche. */
  texte: string;
  /**
   * Appel commencé dans la scène d'avant (« … Écrivez CONSIGNE » puis « en commentaire. Je vous l'envoie. ») : la
   * scène et le mot où il commence ; il court jusqu'à la fin de cette scène (`debut` vaut alors 0).
   */
  avant?: { scene: number; debut: number };
}

/** Amorce d'appel (« Écrivez CONSIGNE », « Tapez … ») : comptée avec l'appel seulement quand elle le touche. */
const AMORCE_APPEL = /^(ecrivez|tapez|commentez|mettez|ecris|tape)\b/;

/** Phrases d'un texte dit, en rangs de mots [debut, fin[ (une fin sans ponctuation fait une phrase). */
function phrasesDe(texte: string): { debut: number; fin: number; texte: string }[] {
  const js = jetons(texte);
  const n = js.filter((j) => j.mot !== null).length;
  const phrases: { debut: number; fin: number; texte: string }[] = [];
  let debut = 0;
  let morceaux: string[] = [];
  for (const j of js) {
    morceaux.push(j.t);
    if (j.mot !== null && finDePhrase(j.t)) {
      phrases.push({ debut, fin: j.mot + 1, texte: morceaux.join(" ") });
      debut = j.mot + 1;
      morceaux = [];
    }
  }
  if (debut < n) phrases.push({ debut, fin: n, texte: morceaux.join(" ") });
  return phrases;
}

/** Texte des mots [debut, fin[ d'un texte dit, tel qu'il est écrit (les jetons sans lettre suivent le mot d'avant). */
function texteDe(texte: string, debut: number, fin: number): string {
  const js = jetons(texte);
  return js
    .filter((j, i) => {
      const rang = j.mot ?? js[i - 1]?.mot ?? -1;
      return rang >= debut && rang < fin;
    })
    .map((j) => j.t)
    .join(" ");
}

/**
 * Cherche l'appel à la fin de la fiche : dans la DERNIÈRE scène (la règle 12 l'interdit ailleurs), et dans la fin de la
 * scène d'avant quand il y commence (amorce « Écrivez MOT » ou phrase d'appel collée au début de la dernière scène).
 * `dit` (phrase dite de la fin retenue, mot rempli) : cherchée mot pour mot d'abord. Sinon : de la première phrase
 * d'appel (règle 12, ou « Je vous l'envoie ») à la dernière qui la suit sans interruption, amorces qui la précèdent
 * comprises. `null` : aucun appel dans la fiche.
 */
export function trouverAppel(fiche: Pick<FicheTableau, "scenes">, dit?: string): AppelTrouve | null {
  const k = fiche.scenes.length - 1;
  const s = fiche.scenes[k];
  if (!s) return null;
  const prec = k > 0 ? fiche.scenes[k - 1] : undefined;
  const motsScene = mots(s.texteDit).map(cleMot);
  const motsPrec = prec ? mots(prec.texteDit).map(cleMot) : [];
  const resultat = (debut: number, fin: number, avant?: number): AppelTrouve => {
    const ici = texteDe(s.texteDit, debut, fin);
    const la = avant !== undefined && prec ? texteDe(prec.texteDit, avant, motsPrec.length) : "";
    return { scene: k, debut, fin, enFin: fin === motsScene.length, texte: [la, ici].filter(Boolean).join(" "), ...(avant !== undefined ? { avant: { scene: k - 1, debut: avant } } : {}) };
  };
  const cherche = dit ? mots(dit).map(cleMot).filter(Boolean) : [];
  if (cherche.length) {
    for (let i = motsScene.length - cherche.length; i >= 0; i--) if (cherche.every((m, j) => motsScene[i + j] === m)) return resultat(i, i + cherche.length);
    // À cheval sur les deux dernières scènes : commence dans la scène d'avant, la finit, continue au début de la dernière.
    const tous = [...motsPrec, ...motsScene];
    for (let i = motsPrec.length - 1; i >= Math.max(0, motsPrec.length - cherche.length + 1); i--) {
      if (cherche.every((m, j) => tous[i + j] === m)) return resultat(0, i + cherche.length - motsPrec.length, i);
    }
  }
  const phrases = phrasesDe(s.texteDit);
  const premiere = phrases.findIndex((p) => phraseDAppel(p.texte));
  if (premiere < 0) return null;
  let derniere = premiere;
  while (derniere + 1 < phrases.length && phraseDAppel(phrases[derniere + 1].texte)) derniere++;
  let depart = premiere;
  while (depart > 0 && AMORCE_APPEL.test(sansAccents(phrases[depart - 1].texte))) depart--;
  if (depart > 0 || !prec) return resultat(phrases[depart].debut, phrases[derniere].fin);
  // L'appel ouvre la dernière scène : la fin de la scène d'avant en fait partie quand elle l'amorce.
  const avant = phrasesDe(prec.texteDit);
  let a = avant.length;
  while (a > 0 && (phraseDAppel(avant[a - 1].texte) || AMORCE_APPEL.test(sansAccents(avant[a - 1].texte)))) a--;
  return resultat(phrases[depart].debut, phrases[derniere].fin, a < avant.length ? avant[a].debut : undefined);
}

/** Le texte dit d'une scène, mots [debut, fin[ retirés (les jetons sans lettre suivent le mot d'avant), `ajout` à la place. */
function texteSans(texte: string, debut: number, fin: number, ajout?: string): string {
  const js = jetons(texte);
  const gardes: string[] = [];
  let pose = false;
  js.forEach((j, i) => {
    const rang = j.mot ?? js[i - 1]?.mot ?? -1;
    const retire = rang >= debut && rang < fin;
    if (retire && ajout && !pose) {
      gardes.push(ajout);
      pose = true;
    }
    if (!retire) {
      if (ajout && !pose && rang >= fin) {
        gardes.push(ajout);
        pose = true;
      }
      gardes.push(j.t);
    }
  });
  if (ajout && !pose) gardes.push(ajout);
  return gardes.join(" ");
}

/** Mots retirés de chaque scène par l'appel : [debut, fin[ (la scène d'avant : de son début d'appel à sa fin). */
function retraitsDe(fiche: Pick<FicheTableau, "scenes">, appel: AppelTrouve | null): Map<number, { debut: number; fin: number }> {
  const k = fiche.scenes.length - 1;
  const n = mots(fiche.scenes[k].texteDit).length;
  const r = new Map<number, { debut: number; fin: number }>([[k, { debut: appel?.debut ?? n, fin: appel?.fin ?? n }]]);
  if (appel?.avant) r.set(appel.avant.scene, { debut: appel.avant.debut, fin: mots(fiche.scenes[appel.avant.scene].texteDit).length });
  return r;
}

/**
 * Texte du CORPS de la voix (tout sauf l'appel), scène par scène bout à bout. Une scène vidée par l'appel compte pour
 * un texte vide, comme avant : le corps déjà lu et gardé au journal d'une vidéo garde la même empreinte (aucune
 * relecture payée à la reprise).
 */
export function texteCorps(fiche: Pick<FicheTableau, "scenes">, appel: AppelTrouve | null): string {
  const retraits = retraitsDe(fiche, appel);
  return fiche.scenes.map((s, i) => (retraits.has(i) ? texteSans(s.texteDit, retraits.get(i)!.debut, retraits.get(i)!.fin) : s.texteDit)).join(" ");
}

/**
 * Texte écrit qui parle encore de l'appel au mot : « commentaire », « Commentez », « Je vous l'envoie », ou l'amorce
 * « Écrivez MOT » du mot à commenter. Plus étroit que la règle 12 : « le lien » d'une fin validée reste permis.
 */
export function parleDuCommentaire(texte: string, mot?: string): boolean {
  const p = ` ${sansAccents(texte)} `;
  if (/ comment(aire|aires|ez|er) /.test(p) || PROMESSE_ENVOI.test(p)) return true;
  const m = mot ? sansAccents(mot) : "";
  return !!m && new RegExp(` (ecrivez|tapez|mettez) ${m.replace(/[^a-z0-9 -]/g, "")} `).test(p);
}

/**
 * AVIS seulement, non bloquant (plus appelé avant le prix : un texte collé par Will est pris à l'identique, jamais refusé) :
 * TikTok/Shorts et LinkedIn (`sansAppelAuMot`) ne parlent pas de commentaire en cours de vidéo. N'est pas visé
 * ce que `trouverAppel` retire de la fiche : le bloc d'appel de fin (phrases d'appel qui se suivent et leurs amorces). Rend la phrase à dire à Will, ou null.
 */
export function defautCommentaireEnCoursDeVideo(texteDit: string, sorties: readonly IdSortie[]): string | null {
  if (!sorties.some(sansAppelAuMot)) return null;
  // Le corps de la voix, tout sauf le bloc d'appel que la fin propre à la sortie remplace (ce que `trouverAppel` retire).
  const fiche = { scenes: [{ texteDit }] } as unknown as Pick<FicheTableau, "scenes">;
  const corps = texteCorps(fiche, trouverAppel(fiche));
  if (!phrasesDe(corps).some((p) => parleDuCommentaire(p.texte))) return null;
  return "Votre texte parle de commentaire en cours de vidéo : TikTok, Shorts et LinkedIn ne le permettent pas. Retirez cette phrase ou décochez ces réseaux. Rien n'a été payé.";
}

/** Élément qui écrit un texte, ou montre un dessin (ni geste, ni mention). */
const montre = (e: ElementTableau) => e.type !== "geste" && e.type !== "mention";
const ancreDe = (e: ElementTableau) => ("ancre" in e ? e.ancre : 0);
const textesDe = (e: ElementTableau): string[] => (e.type === "ligne" || e.type === "mention" ? [e.texte] : e.type === "preuve" ? [...e.lignes] : e.type === "chiffre" ? [e.unite ? `${e.valeur} ${e.unite}` : e.valeur] : []);

/** Éléments gardés : les gestes dont la cible reste (et qui ne tombent pas dans un retrait), ancres renumérotées. */
function garderElements(gardes: ElementTableau[], retire: (a: number) => boolean, nouvelle: (a: number) => number): ElementTableau[] {
  const ids = new Set(gardes.filter(montre).map((e) => e.id));
  return gardes.filter((e) => e.type !== "geste" || (ids.has(e.cibleId) && !retire(ancreDe(e)))).map((e) => ("ancre" in e ? ({ ...e, ancre: nouvelle(e.ancre) } as ElementTableau) : e));
}

/** Mots forts gardés : ceux encore écrits dans une ligne de la scène (règle « références internes »). */
function motsFortsValides(s: SceneTableau): SceneTableau {
  if (!s.ecrans?.some((e) => e.motsForts)) return s;
  const lignes = new Set(s.elements.flatMap((e) => (e.type === "ligne" ? e.texte.split(/\s+/).map(cleSimple) : [])));
  const ecrans = s.ecrans.map((e) => {
    if (!e.motsForts) return e;
    const motsForts = e.motsForts.filter((m) => lignes.has(cleSimple(m)));
    const copie = { ...e, motsForts };
    if (!motsForts.length) delete (copie as Partial<typeof copie>).motsForts;
    return copie;
  });
  return { ...s, ecrans };
}

/** Moment de l'écran par défaut d'une scène sans écran décrit (recopié de la mise en page, qui ne l'exporte pas). */
const MOMENT_DU_ROLE: Readonly<Record<SceneTableau["role"], MomentEcran>> = {
  accroche: "accroche",
  douleur: "douleur",
  "idee-recue": "retournement",
  etape: "etape",
  exemple: "exemple",
  preuve: "exemple",
  resultat: "recapitulatif",
  fin: "recapitulatif",
};

/** Ligne de secours d'une scène finale sans aucun élément : l'adresse du site, que son écran montre (jamais vide). */
const ligneSite = (sceneId: string): ElementTableau => ({ id: `${sceneId}-site`, type: "ligne", role: "titre", niveau: "titre", texte: SITE_FIN, ancre: 0 }) as ElementTableau;

/**
 * La fiche d'une variante : l'appel (mots [debut, fin[ de la dernière scène, et la fin de la scène d'avant quand il y
 * commence) est retiré, ou remplacé par `phrase` dans la dernière scène. Les ancres qui suivent sont décalées ; les
 * éléments de l'écran d'appel (style « blocs/2 » : ancrés à partir de lui) et ceux de l'appel sont retirés, avec les
 * gestes qui les visent. L'écran d'appel garde son moment (les fonds des écrans d'avant ne changent pas) ; son mot à
 * commenter et son gabarit sont retirés (la mise en page pose l'écran du site). Sans appel trouvé : la phrase est
 * ajoutée à la fin de la dernière scène. Aucun texte écrit ne parle plus de commentaire.
 *
 * Dernière scène qui ne disait QUE l'appel (incident réel du 12/10, vidéo `v-9d15cce3c6e3` : « Écrivez CONSIGNE en
 * commentaire. Je vous l'envoie. ») : une fois l'appel retiré, elle n'a plus aucun mot ; elle est SUPPRIMÉE et la
 * scène d'avant porte la fin : l'écran du site (`axion-ia.com` en grand) y part sur son dernier mot, puis tient 2,5 s
 * après lui avant le fondu, comme la fin « adresse seule » déjà validée. Les scènes d'avant restent telles quelles
 * (reprises du premier vertical).
 */
export function ficheDeVariante(fiche: FicheTableau, appel: AppelTrouve | null, phrase?: string): FicheTableau {
  const k = fiche.scenes.length - 1;
  const retraits = retraitsDe(fiche, appel);
  const blocs2 = estStyleBlocs2(fiche);
  const s = fiche.scenes[k];
  const motAppel = (s.ecrans ?? []).map((e) => e.motCommentaire).find(Boolean);
  const scenes = fiche.scenes.map((x, i) => {
    const r = retraits.get(i);
    if (!r) return x;
    return i === k ? derniereSansAppel(x, r.debut, r.fin, blocs2, phrase) : sceneSansFin(x, r.debut);
  });
  // Scènes finales vidées par l'appel : supprimées ; la scène d'avant porte l'écran de fin.
  const ecranAppel = (s.ecrans ?? []).findLast((e) => e.moment === "appel");
  let videes = 0;
  while (scenes.length - videes > 1 && !mots(scenes[scenes.length - 1 - videes].texteDit).length) videes++;
  const gardees = videes ? scenes.slice(0, scenes.length - videes) : scenes;
  if (videes && ecranAppel) gardees[gardees.length - 1] = porterLaFin(gardees[gardees.length - 1], ecranAppel);
  // Plus aucun texte écrit sur le commentaire, ni mot à commenter (le vertical de TikTok et Shorts n'en demande pas).
  const nettes = gardees.map((x, i) => nettoyer(x, motAppel, i === gardees.length - 1));
  return pageAppelParties({ ...fiche, scenes: nettes.map((x, i) => (x === fiche.scenes[i] ? x : motsFortsValides(x))) }, fiche);
}

/**
 * Gabarit par parties (« reference/3 ») : la variante garde sa page d'APPEL, dernière et seule (bench du 17/10 : une fin
 * « Écrivez … en commentaire » retirée pour TikTok, Shorts ou LinkedIn laissait la ligne du site sans bloc, ou plus de
 * page d'appel du tout quand la scène ne disait que l'appel). La dernière scène est la page d'appel : le site écrit en
 * grand (« bloc » « appel ») quand aucune autre demande n'y reste, au plus une autre phrase en détail, ni visuel ni bloc
 * orange ; elle tourne la page si elle la partageait avec une autre partie. Les autres styles : rien ne change.
 */
function pageAppelParties(f: FicheTableau, avant: FicheTableau): FicheTableau {
  if (f.habillage !== "reference/3" || f === avant) return f;
  const scenes = [...f.scenes];
  const k = scenes.length - 1;
  const s = scenes[k];
  const etaitAppel = s.gabarit?.role === "appel";
  const partage = scenes.some((x, i) => i < k && x.page === s.page);
  const page = partage && !etaitAppel ? s.page + 1 : s.page;
  const lignes = s.elements.filter((e): e is Extract<ElementTableau, { type: "ligne" }> => e.type === "ligne");
  const appel = lignes.find((l) => l.bloc === "appel" && !/commentaire/iu.test(l.texte));
  const site = lignes.find((l) => l.id === `${s.id}-site`);
  const detail = lignes.find((l) => l !== appel && l !== site && l.bloc !== "appel");
  const gardees = new Set([appel, site, detail].filter(Boolean) as ElementTableau[]);
  const elements: ElementTableau[] = s.elements.flatMap((e): ElementTableau[] => {
    if (e.type !== "ligne") return e.type === "geste" && !s.elements.some((x) => x.id === e.cibleId && (x.type !== "ligne" || gardees.has(x))) ? [] : [e];
    if (!gardees.has(e)) return [];
    if (e === site) return [{ ...e, bloc: "appel" } as ElementTableau];
    if (e === detail) return [{ ...e, bloc: "detail" } as ElementTableau];
    return [e];
  });
  if (!appel && !site) elements.push({ ...(ligneSite(s.id) as Extract<ElementTableau, { type: "ligne" }>), bloc: "appel" } as ElementTableau);
  const gabarit = { role: "appel" as const };
  scenes[k] = { ...s, page, gabarit, elements };
  return { ...f, scenes };
}

/** Une scène dont la fin (mots `debut` et suivants) appartient à l'appel : ces mots, leurs éléments et écrans retirés. */
function sceneSansFin(s: SceneTableau, debut: number): SceneTableau {
  const n = mots(s.texteDit).length;
  if (debut >= n) return s;
  const retire = (a: number) => a >= debut;
  const elements = garderElements(
    s.elements.filter((e) => !montre(e) || !retire(ancreDe(e))),
    retire,
    (a) => a,
  );
  const ecrans = s.ecrans
    ?.filter((e, i) => i === 0 || !retire(e.ancre ?? 0))
    .map((e) => {
      const copie = { ...e, ...(e.liste ? { liste: e.liste.filter((it) => !retire(it.ancre)) } : {}) };
      if (copie.liste && !copie.liste.length) delete copie.liste;
      return copie;
    });
  return { ...s, texteDit: texteSans(s.texteDit, debut, n), elements: elements.some(montre) ? elements : s.elements, ...(ecrans ? { ecrans } : {}) };
}

/** La dernière scène sans l'appel (mots [debut, fin[), `phrase` à sa place. */
function derniereSansAppel(s: SceneTableau, debut: number, fin: number, blocs2: boolean, phrase?: string): SceneTableau {
  const n = mots(s.texteDit).length;
  const ajoutes = phrase ? mots(phrase).length : 0;
  const decalage = ajoutes - (fin - debut);
  const texteDit = texteSans(s.texteDit, debut, fin, phrase);
  const total = n + decalage;
  const nouvelle = (a: number) => (a >= fin ? a + decalage : a);
  let ecrans = s.ecrans?.map((e) => ({ ...e }));
  let iAppel = ecrans ? ecrans.findIndex((e, i) => e.moment === "appel" && i === ecrans!.length - 1) : -1;
  // Écran d'appel seul écran de la scène, après une phrase de contenu (blocage réel du 14/10, vidéo `v-9238deaab41e` :
  // « Les dix réponses types… sur une page. Écrivez REPONSES… ») : sans l'appel, l'écran du site couvrait toute la
  // phrase et cachait ce que Will avait écrit pour elle. Un écran de contenu porte la phrase, l'écran du site part sur
  // son dernier mot (comme `porterLaFin`), ou sur le premier mot de la phrase de fin validée. Rangs d'avant le retrait.
  const siteApres = phrase ? debut : fin < n ? n - 1 : debut - 1;
  if (blocs2 && iAppel === 0 && siteApres > 0) {
    const [appelSeul] = ecrans!;
    const contenu: EcranTableau = { moment: MOMENT_DU_ROLE[s.role], ...(appelSeul.liste?.some((it) => it.ancre < siteApres) ? { liste: appelSeul.liste.filter((it) => it.ancre < siteApres) } : {}) };
    const { liste: _liste, ...site } = appelSeul;
    void _liste;
    ecrans = [contenu, { ...site, ancre: siteApres }];
    iAppel = 1;
  }
  const departAppel = iAppel > 0 ? (ecrans![iAppel].ancre ?? 0) : iAppel === 0 ? 0 : Infinity;
  // Éléments gardés : ni dans l'appel, ni (blocs/2) sur l'écran d'appel, qui ne montre plus que la fin et le site.
  const dansAppel = (a: number) => a >= debut && a < fin;
  const retire = (a: number) => dansAppel(a) || (blocs2 && a >= departAppel);
  let gardes = s.elements.filter((e) => !montre(e) || !retire(ancreDe(e)));
  // Écran d'appel seul écran de la scène (essai réel du 12/10 : la scène finale « Messages prêts · Écrivez RELANCE… »
  // restait sans aucun élément, refusée au calage) : ses éléments hors de l'appel restent (ceux d'avant, puis ceux
  // d'une phrase de clôture), l'écran du site ne les montre pas ; une scène a toujours au moins un élément.
  if (blocs2 && !gardes.some(montre)) gardes = s.elements.filter((e) => !montre(e) || ancreDe(e) < debut);
  if (blocs2 && !gardes.some(montre)) gardes = s.elements.filter((e) => !montre(e) || !dansAppel(ancreDe(e)));
  let elements = garderElements(gardes, dansAppel, (a) => Math.min(nouvelle(a), Math.max(0, total - 1)));
  if (!elements.some(montre) && total > 0) elements = [ligneSite(s.id)];
  let ecransVariante = ecrans;
  if (ecrans) {
    ecransVariante = ecrans.flatMap((e, i) => {
      const copie = { ...e, ...(e.ancre !== undefined ? { ancre: Math.min(nouvelle(e.ancre), Math.max(0, total - 1)) } : {}), ...(e.liste ? { liste: e.liste.filter((it) => !dansAppel(it.ancre)).map((it) => ({ ...it, ancre: Math.min(nouvelle(it.ancre), Math.max(0, total - 1)) })) } : {}) };
      if (copie.liste && !copie.liste.length) delete copie.liste;
      if (i !== iAppel) return [copie];
      delete copie.motCommentaire;
      delete copie.gabarit;
      delete copie.motsForts;
      // Appel retiré avant le départ de l'écran : il part du premier mot de la phrase ajoutée, sinon du dernier mot.
      if (i > 0 && (e.ancre ?? 0) >= debut) copie.ancre = phrase ? debut : Math.max(0, total - 1);
      const avant = ecrans[i - 1]?.ancre ?? 0;
      if (i > 0 && (copie.ancre ?? 0) <= avant) return [];
      return [copie];
    });
  }
  return { ...s, texteDit, elements, ...(ecransVariante ? { ecrans: ecransVariante } : {}) };
}

/**
 * La scène qui porte la fin quand la dernière (qui ne disait que l'appel) est supprimée : l'écran d'appel, sans mot à
 * commenter (la mise en page y pose le site), part sur son DERNIER mot ; la tenue de fin suit ce mot. Ce qui partait
 * de ce mot ou après (éléments, éléments de liste) ne serait vu que sous l'écran du site : retiré. Une scène d'un seul
 * mot, ou déjà à deux écrans, garde son premier écran et cède le second (ou l'unique) à l'écran du site.
 */
function porterLaFin(s: SceneTableau, ecranAppel: NonNullable<SceneTableau["ecrans"]>[number]): SceneTableau {
  const n = mots(s.texteDit).length;
  const site = { ...ecranAppel };
  delete site.motCommentaire;
  delete site.gabarit;
  delete site.motsForts;
  delete site.liste;
  const ecrans = s.ecrans?.length ? s.ecrans.map((e) => ({ ...e })) : [];
  let depart = Math.max(0, n - 1);
  if (!ecrans.length) {
    // Sans écran décrit, la scène a son écran par défaut : il reste le premier, l'écran du site le suit.
    if (depart > 0) ecrans.push({ moment: MOMENT_DU_ROLE[s.role] });
  } else if (ecrans.length >= ECRANS_MAX || depart <= (ecrans.at(-1)!.ancre ?? 0)) {
    // Plus de place pour un écran de plus : le dernier cède sa place (et son départ) à l'écran du site.
    const cede = ecrans.pop()!;
    if (ecrans.length) depart = Math.max(cede.ancre ?? 0, (ecrans.at(-1)!.ancre ?? 0) + 1);
  }
  if (!ecrans.length) depart = 0;
  if (depart > 0) site.ancre = depart;
  else delete site.ancre;
  const retire = (a: number) => depart > 0 && a >= depart;
  const gardes = s.elements.filter((e) => !montre(e) || !retire(ancreDe(e)));
  const elements = gardes.some(montre) ? garderElements(gardes, retire, (a) => a) : s.elements;
  const avant = ecrans.map((e) => {
    const copie = { ...e, ...(e.liste ? { liste: e.liste.filter((it) => !retire(it.ancre)) } : {}) };
    if (copie.liste && !copie.liste.length) delete copie.liste;
    return copie;
  });
  return { ...s, elements, ecrans: [...avant, site] };
}

/** Retire les textes écrits qui parlent encore de commentaire (éléments, éléments de liste, mot à commenter). */
function nettoyer(s: SceneTableau, mot: string | undefined, derniere: boolean): SceneTableau {
  const parle = (e: ElementTableau) => textesDe(e).some((t) => parleDuCommentaire(t, mot));
  const touche = s.elements.some(parle) || (s.ecrans ?? []).some((e) => e.motCommentaire || (e.liste ?? []).some((it) => parleDuCommentaire(`${it.texte} ${it.detail ?? ""}`, mot)));
  if (!touche) return s;
  let elements = garderElements(
    s.elements.filter((e) => !parle(e)),
    () => false,
    (a) => a,
  );
  if (!elements.some(montre)) elements = derniere ? [ligneSite(s.id)] : s.elements;
  const ecrans = s.ecrans?.map((e) => {
    const copie = { ...e, ...(e.liste ? { liste: e.liste.filter((it) => !parleDuCommentaire(`${it.texte} ${it.detail ?? ""}`, mot)) } : {}) };
    delete copie.motCommentaire;
    if (copie.liste && !copie.liste.length) delete copie.liste;
    return copie;
  });
  return { ...s, elements, ...(ecrans ? { ecrans } : {}) };
}

/** Texte dit d'une fiche (les `texteDit` bout à bout). */
export const texteDitDe = (fiche: Pick<FicheTableau, "scenes">) => fiche.scenes.map((s) => s.texteDit).join(" ");

/** Une lecture payée de la voix : le corps, une phrase de fin, ou une voix complète (repli). */
export interface LectureVoix {
  /** Identifiant stable de la lecture (`corps`, `fin-1`, `complete-1`…). */
  id: string;
  role: "corps" | "fin" | "complete";
  /** Texte écrit (avant les prononciations). */
  texte: string;
}

/** Une variante de voix : la fiche qu'elle dit, et les lectures dont elle est faite (corps + fin, ou complète). */
export interface VarianteVoix {
  /** `principale` (celle des sorties qui disent l'appel de la fiche) ou l'identifiant de la sortie. */
  id: string;
  fiche: FicheTableau;
  /** Lecture du corps (raccord) ou voix complète (repli, ou voix unique). */
  base: string;
  /** Lecture de la phrase de fin, raccordée à la base ; absente : la base seule. */
  fin?: string;
  /** Sorties qui utilisent cette variante. */
  sorties: IdSortie[];
}

export type PlanVoixSorties =
  /** Une seule voix pour toutes les sorties : la chaîne d'avant, inchangée. */
  | { mode: "unique" }
  /** Le corps lu une fois, chaque phrase de fin à part, puis raccordée. */
  | { mode: "raccord"; appel: AppelTrouve | null; lectures: LectureVoix[]; variantes: VarianteVoix[] }
  /** L'appel n'est pas à la fin de la dernière scène : une voix complète par variante (surcoût annoncé). */
  | { mode: "repli"; raison: string; appel: AppelTrouve; lectures: LectureVoix[]; variantes: VarianteVoix[] };

/**
 * Plan des voix d'une fabrication. `fins` : la fin retenue pour chaque sortie (la phrase dite de la fin des sorties
 * principales aide à repérer l'appel dans la fiche).
 */
export function planVoixSorties(fiche: FicheTableau, sorties: readonly { id: IdSortie; fin?: FinDeSortie }[]): PlanVoixSorties {
  const dits = sorties.map((s) => ({ ...s, appel: appelDitDeLaSortie(s.id, s.fin) }));
  if (dits.every((d) => d.appel.sorte === "fiche")) return { mode: "unique" };
  const ditFiche = dits.map((d) => (d.appel.sorte === "fiche" && d.fin && "ecran" in d.fin ? d.fin.dit : undefined)).find(Boolean);
  const appel = trouverAppel(fiche, ditFiche);
  // Sans appel dans la fiche (ancien style : la règle 12 l'interdit), « aucun appel » dit la fiche telle quelle.
  if (!appel && dits.every((d) => d.appel.sorte !== "phrase")) return { mode: "unique" };
  // Variantes distinctes, dans l'ordre des sorties (la principale d'abord quand une sortie dit l'appel de la fiche).
  const cles = new Map<string, { appel: AppelDit; sorties: IdSortie[] }>();
  for (const d of dits) {
    const cle = d.appel.sorte === "phrase" ? `phrase:${d.appel.dit}` : d.appel.sorte;
    const v = cles.get(cle) ?? { appel: d.appel, sorties: [] };
    v.sorties.push(d.id);
    cles.set(cle, v);
  }
  const idDe = (a: AppelDit, sortiesV: IdSortie[]) => (a.sorte === "fiche" ? "principale" : sortiesV[0]);
  // La fiche d'une fin propre passe les mêmes remises en forme déterministes que toute fiche (`remettreEnForme`) ; elle
  // est relue avant la voix aux règles de FORME (`controlerFormeSortie`, `controles.ts`).
  const ficheDe = (a: AppelDit) => (a.sorte === "fiche" ? fiche : remettreEnForme(ficheDeVariante(fiche, appel, a.sorte === "phrase" ? a.dit : undefined)));

  if (appel && !appel.enFin) {
    const lectures: LectureVoix[] = [];
    const variantes = [...cles.values()].map((v, i) => {
      const f = ficheDe(v.appel);
      const lecture: LectureVoix = { id: `complete-${i + 1}`, role: "complete", texte: texteDitDe(f) };
      lectures.push(lecture);
      return { id: idDe(v.appel, v.sorties), fiche: f, base: lecture.id, sorties: v.sorties };
    });
    return { mode: "repli", raison: "La phrase d'appel n'est pas à la fin de la dernière scène : chaque fin est lue avec toute la voix (une voix complète par fin).", appel, lectures, variantes };
  }

  const corps: LectureVoix = { id: "corps", role: "corps", texte: appel ? texteCorps(fiche, appel) : texteDitDe(fiche) };
  const lectures: LectureVoix[] = [corps];
  const finDe = (texte: string): string => {
    const deja = lectures.find((l) => l.role === "fin" && l.texte === texte);
    if (deja) return deja.id;
    const l: LectureVoix = { id: `fin-${lectures.length}`, role: "fin", texte };
    lectures.push(l);
    return l.id;
  };
  const variantes = [...cles.values()].map((v): VarianteVoix => {
    const fin = v.appel.sorte === "fiche" ? (appel ? finDe(appel.texte) : undefined) : v.appel.sorte === "phrase" ? finDe(v.appel.dit) : undefined;
    return { id: idDe(v.appel, v.sorties), fiche: ficheDe(v.appel), base: corps.id, ...(fin ? { fin } : {}), sorties: v.sorties };
  });
  return { mode: "raccord", appel, lectures, variantes };
}

/** Estimation des lectures de la voix (centimes d'euro, au caractère), avec le surcoût par rapport à une voix unique. */
export interface EstimationVoixSorties {
  caracteres: number;
  centimes: number;
  /** Ce qu'aurait coûté une voix unique (le texte de la fiche). */
  centimesVoixUnique: number;
  /** Surcoût des fins propres (0 : aucun). */
  surcoutCentimes: number;
  /** Une ligne par lecture. */
  lectures: { id: string; role: LectureVoix["role"]; caracteres: number; centimes: number }[];
  /** Phrase lisible du surcoût (absente : aucun). */
  phraseSurcout?: string;
}

const centimesDe = (caracteres: number, tarif: number) => Math.ceil(caracteres * tarif - 1e-9);

/** Texte envoyé à la voix (prononciations substituées). */
export function texteLu(texte: string, prononciations: readonly { mot: string; prononciation: string }[] = []): string {
  return prononciations.length ? substituerPrononciations(texte, [...prononciations]) : texte;
}

/** Prix des lectures d'un plan (une voix unique : le texte de la fiche). */
export function estimerVoixSorties(fiche: FicheTableau, plan: PlanVoixSorties, tarif: number, prononciations: readonly { mot: string; prononciation: string }[] = []): EstimationVoixSorties {
  const unique = texteLu(texteDitDe(fiche), prononciations).length;
  const centimesVoixUnique = centimesDe(unique, tarif);
  if (plan.mode === "unique") return { caracteres: unique, centimes: centimesVoixUnique, centimesVoixUnique, surcoutCentimes: 0, lectures: [{ id: "voix", role: "complete", caracteres: unique, centimes: centimesVoixUnique }] };
  const lectures = plan.lectures.map((l) => {
    const caracteres = texteLu(l.texte, prononciations).length;
    return { id: l.id, role: l.role, caracteres, centimes: centimesDe(caracteres, tarif) };
  });
  const caracteres = lectures.reduce((s, l) => s + l.caracteres, 0);
  const centimes = lectures.reduce((s, l) => s + l.centimes, 0);
  const surcoutCentimes = Math.max(0, centimes - centimesVoixUnique);
  const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const phraseSurcout = surcoutCentimes
    ? plan.mode === "repli"
      ? `Fin propre à TikTok et Shorts : la phrase d'appel n'est pas à la fin de la dernière scène, la voix est lue une fois par fin (surcoût ${euros(surcoutCentimes)}).`
      : `Fin propre à TikTok et Shorts : phrases de fin lues à part (surcoût ${euros(surcoutCentimes)}).`
    : undefined;
  return { caracteres, centimes, centimesVoixUnique, surcoutCentimes, lectures, ...(phraseSurcout ? { phraseSurcout } : {}) };
}
