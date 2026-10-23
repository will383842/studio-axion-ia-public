/**
 * GABARIT DE PAGE CLAIR DU STYLE « reference/2 » (maquette `maquettes/tableau-gabarit-clair/`, regard de Will du
 * 14/10/2026 : « pas de titres, pas de hiérarchie, et les étapes dites ne sont pas écrites à l'écran »). PUR.
 *
 * Une page = une idée, toujours dans le même ordre : repère (progression des étapes, ou bandeau « Exemple »), TITRE
 * court souligné (pastille numérotée pour une étape, écrite au mot où la voix dit le numéro), PHRASE CLÉ, 1 à 3
 * DÉTAILS, un dessin. La page « exemple » écrit AVANT / APRÈS ; la dernière page, « À retenir », l'idée en une phrase
 * (15/10 ; une fiche ancienne garde sa liste des étapes) puis l'appel en grand.
 *
 * Ce fichier porte les constantes du gabarit et sa règle (`regleGabarit`, règle 18 du format). Il n'importe de
 * `fiche.ts` que des types (pas de dépendance circulaire à l'exécution).
 */
import { BORNES_FICHE, type BornesFiche } from "@/briques/fiche-scenes";
import { debutsDePhrase, mots, motsPleins, racine } from "@/domaine/controles-script/texte";
import type { ElementLigne, FicheTableau, SceneTableau } from "./fiche";
import { regleGabarit3 } from "./gabarit-3";
import { nombresDits } from "./fidelite-texte";

/** Style « reference/2 » (même valeur que `STYLE_REFERENCE_2` de `fiche.ts`). */
export const STYLE_GABARIT_CLAIR = "reference/2";
export const estGabaritClair = (fiche: Pick<FicheTableau, "habillage">) => fiche.habillage === STYLE_GABARIT_CLAIR;

/**
 * Style « reference/3 » (même valeur que `STYLE_REFERENCE_3` de `fiche.ts`, 14/10/2026, regard de Will : « pas assez
 * clair, on n'a pas dès le début le problème ») : le gabarit par PARTIES (accroche, douleur, solution, exemple, à
 * retenir, appel), règle dans `gabarit-3.ts`.
 */
export const STYLE_GABARIT_3 = "reference/3";
export const estGabarit3 = (fiche: Pick<FicheTableau, "habillage">) => fiche.habillage === STYLE_GABARIT_3;

/** Styles à gabarit de page (« reference/2 » et « reference/3 ») : chaque scène porte « gabarit », chaque ligne « bloc ». */
export const estGabarit = (fiche: Pick<FicheTableau, "habillage">) => estGabaritClair(fiche) || estGabarit3(fiche);

/** Styles de la page écrite au crayon (« reference/1 », « reference/2 » et « reference/3 »). */
export const estPageEcriteCrayon = (fiche: Pick<FicheTableau, "habillage">) => fiche.habillage === "reference/1" || estGabarit(fiche);

/**
 * Longueurs CONSEILLÉES au découpage (consigne, pas une règle : une ligne plus longue est réparée, pas refusée) : des lignes
 * courtes gardent la page à sa grande taille, dans toutes les sorties (14/10, vidéo
 * v-b19aefb21d57 : un détail de 13 mots et un avant de 10 mots ont fait refuser deux pages).
 */
export const CONSEIL_GABARIT = { detailMots: 10, comparaisonMots: 8 } as const;

/** Pages au plus d'une fiche « reference/2 » (la consigne en demande 8 au plus ; 2 restent pour la réparation). */
export const PAGE_MAX_GABARIT = 10;
/** Pages au plus d'une fiche « reference/3 » (la consigne en demande 12 au plus ; 2 restent pour la réparation). */
export const PAGE_MAX_GABARIT_3 = 14;

/**
 * Bornes communes d'une fiche du format : celles de la fiche commune ; pour la page écrite au crayon (« reference/1 »
 * et « reference/2 », 14/10) jusqu'à 8 pages et 14 scènes, pour que la réparation automatique puisse couper une scène
 * trop chargée ou passer à une page de plus au lieu de refuser (le gabarit clair compte déjà 7 pages : problème,
 * 4 étapes, exemple, « À retenir »). 6 éléments par scène au plus, toujours. Gabarit clair : jusqu'à 10 pages (14/10,
 * vidéo v-b19aefb21d57 : la fiche avait déjà ses 8 pages, la page trop chargée ne pouvait pas passer à une page de plus).
 */
export function bornesFicheTableau(fiche: Pick<FicheTableau, "habillage">): BornesFiche {
  // « reference/3 » : une partie par page, 3 blocs au plus par page (une page de plus plutôt qu'une page chargée).
  if (estGabarit3(fiche)) return { ...BORNES_FICHE, pageMax: PAGE_MAX_GABARIT_3, scenesMax: 18 };
  if (estGabaritClair(fiche)) return { ...BORNES_FICHE, pageMax: PAGE_MAX_GABARIT, scenesMax: 14 };
  return estPageEcriteCrayon(fiche) ? { ...BORNES_FICHE, pageMax: 8, scenesMax: 14 } : BORNES_FICHE;
}

/**
 * Rôle d'une PAGE. « reference/2 » : le problème, une étape (numérotée), l'exemple (avant / après), « À retenir ».
 * « reference/3 » : l'accroche, la douleur, la solution (ses étapes numérotées), l'exemple, « À retenir », l'appel.
 */
export const ROLES_PAGE = ["probleme", "etape", "exemple", "retenir", "accroche", "douleur", "solution", "appel"] as const;
export type RolePage = (typeof ROLES_PAGE)[number];

/** Place d'une ligne dans le gabarit de sa page (champ `bloc` de la ligne). */
export const BLOCS_GABARIT = ["titre", "phrase-cle", "detail", "avant", "apres", "liste", "appel", "idee-recue", "code", "coche", "transformation"] as const;
/** Blocs propres au style « reference/3 » (idée reçue barrée, liste à pastilles de couleur, liste cochée, « avant → après »). */
export const BLOCS_GABARIT_3_SEULS: readonly BlocGabarit[] = ["idee-recue", "code", "coche", "transformation"];
/** Rôles de page propres à chaque style. */
export const ROLES_PAGE_2: readonly RolePage[] = ["probleme", "etape", "exemple", "retenir"];
export const ROLES_PAGE_3: readonly RolePage[] = ["accroche", "douleur", "solution", "exemple", "retenir", "appel"];
/** Couleurs d'une liste à pastilles (« reference/3 ») : vert (on peut), orange (avec précaution), rouge (jamais). */
export const CODES_COULEUR = ["vert", "orange", "rouge"] as const;
export type CodeCouleur = (typeof CODES_COULEUR)[number];
export type BlocGabarit = (typeof BLOCS_GABARIT)[number];

/** Bornes du gabarit clair (maquette du 14/10, regard de Will). */
export const BORNES_GABARIT = {
  /** Titre : 1 à 3 mots. */
  titreMots: 3,
  /** Phrase clé : une phrase complète de 12 mots au plus. */
  phraseMots: 12,
  /** Détails : 1 à 3 phrases complètes par page, 16 mots au plus chacune. */
  detailsMax: 3,
  detailMots: 16,
  /** Avant, après, élément de « À retenir » : 14 mots au plus. */
  comparaisonMots: 14,
  /** « À retenir » : 6 éléments de liste au plus. */
  listeMax: 6,
  /** Numéros d'étape : 1 à 9. */
  numeroMax: 9,
  /** Phrase clé et détails reprennent les mots dits : au moins la moitié de leurs mots pleins sont dits sur la page. */
  partMotsDits: 0.5,
} as const;

/* ------------------------------------------------------------------ */
/* Numéros dits                                                          */
/* ------------------------------------------------------------------ */

const NOMBRES: Readonly<Record<string, number>> = {
  un: 1,
  une: 1,
  premier: 1,
  premiere: 1,
  premierement: 1,
  deux: 2,
  deuxieme: 2,
  deuxiemement: 2,
  second: 2,
  seconde: 2,
  secundo: 2,
  trois: 3,
  troisieme: 3,
  troisiemement: 3,
  quatre: 4,
  quatrieme: 4,
  quatriemement: 4,
  cinq: 5,
  cinquieme: 5,
  six: 6,
  sixieme: 6,
  sept: 7,
  septieme: 7,
  huit: 8,
  huitieme: 8,
  neuf: 9,
  neuvieme: 9,
};

const cle = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Numéros que la voix DIT en tête de phrase pour compter les étapes : « Un. », « Deux : », « Trois, », « 4. »,
 * « Premièrement, », « Étape 2. » — un mot de nombre en tête de phrase, SUIVI d'une ponctuation (« Un chantier
 * déborde. » n'est pas un numéro). Rend le numéro et l'index du mot (même découpe que l'ancre).
 */
export function numerosDits(texteDit: string): { n: number; ancre: number }[] {
  const debuts = new Set([0, ...debutsDePhrase(texteDit)]);
  const res: { n: number; ancre: number }[] = [];
  const morceaux = texteDit.split(/\s+/).filter(Boolean);
  let i = 0;
  for (let m = 0; m < morceaux.length; m++) {
    const brut = morceaux[m];
    if (!/[\p{L}\p{N}]/u.test(brut)) continue;
    const ponctue = /[.,:;!]["»”)]*$/u.test(brut) || /^[.,:;!]$/.test(morceaux[m + 1] ?? "");
    const c = cle(brut);
    const valeur = /^\d$/.test(c) ? Number(c) : NOMBRES[c];
    if (debuts.has(i) && ponctue && valeur && valeur <= BORNES_GABARIT.numeroMax) res.push({ n: valeur, ancre: i });
    // « Étape 2. » : le numéro est le mot qui suit « étape ».
    else if (debuts.has(i) && cle(brut) === "etape") {
      const suite = morceaux[m + 1] ?? "";
      const v = /^\d$/.test(cle(suite)) ? Number(cle(suite)) : NOMBRES[cle(suite)];
      if (v && /[.,:;!]["»”)]*$/u.test(suite)) res.push({ n: v, ancre: i + 1 });
    }
    i++;
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Pages                                                                 */
/* ------------------------------------------------------------------ */

/** Les lignes d'une scène (le gabarit ne lit qu'elles, avec les dessins). */
export const lignesDe = (s: SceneTableau): ElementLigne[] => s.elements.filter((e): e is ElementLigne => e.type === "ligne");

/** Une page de la fiche : son numéro, ses scènes dans l'ordre. */
export interface PageGabarit {
  page: number;
  scenes: SceneTableau[];
}

export function pagesDe(fiche: Pick<FicheTableau, "scenes">): PageGabarit[] {
  const res: PageGabarit[] = [];
  for (const s of fiche.scenes) {
    const p = res.at(-1);
    if (p && p.page === s.page) p.scenes.push(s);
    else res.push({ page: s.page, scenes: [s] });
  }
  return res;
}

/** Rôle d'une page : celui de sa première scène (toutes les scènes d'une page ont le même, vérifié par la règle). */
export const rolePage = (p: PageGabarit) => p.scenes[0]?.gabarit?.role;

/** Page de SUITE : sans titre, à la suite d'une page de même rôle (posée par la réparation d'une page trop chargée). */
export function estPageSuite(pages: readonly PageGabarit[], i: number): boolean {
  const p = pages[i];
  const prec = pages[i - 1];
  return !!prec && rolePage(prec) === rolePage(p) && !p.scenes.some((s) => lignesDe(s).some((l) => l.bloc === "titre"));
}

/** Numéro d'étape porté par une page (celui d'une de ses scènes), ou celui de la page d'étape qu'elle continue. */
export function numeroDePage(pages: readonly PageGabarit[], i: number): number | undefined {
  for (let j = i; j >= 0; j--) {
    const n = pages[j].scenes.find((s) => s.gabarit?.numero)?.gabarit?.numero?.n;
    if (n !== undefined) return n;
    if (!estPageSuite(pages, j)) return undefined;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Règle 18 : gabarit de page clair                                      */
/* ------------------------------------------------------------------ */

export const NOMS_BLOCS: Record<BlocGabarit, string> = {
  "idee-recue": "l'idée reçue",
  code: "un élément de la liste à pastilles",
  coche: "un élément de la liste cochée",
  transformation: "la transformation « avant → après »",
  titre: "le titre",
  "phrase-cle": "la phrase clé",
  detail: "un détail",
  avant: "la ligne « avant »",
  apres: "la ligne « après »",
  liste: "un élément de « À retenir »",
  appel: "l'appel",
};

export const NOMS_ROLES: Record<RolePage, string> = { probleme: "problème", etape: "étape", exemple: "exemple", retenir: "à retenir", accroche: "accroche", douleur: "douleur", solution: "solution", appel: "appel" };

/** Blocs permis par rôle de page. */
const BLOCS_PERMIS: Record<RolePage, readonly BlocGabarit[]> = {
  probleme: ["titre", "phrase-cle", "detail"],
  etape: ["titre", "phrase-cle", "detail"],
  exemple: ["titre", "phrase-cle", "detail", "avant", "apres"],
  retenir: ["titre", "phrase-cle", "liste", "appel", "detail"],
  // « reference/3 » : seulement dans son style (`gabarit-3.ts`).
  accroche: [],
  douleur: [],
  solution: [],
  appel: [],
};

interface Manquement {
  sceneId?: string;
  detail: string;
}

const nbMots = (t: string) => mots(t).length;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Part des mots pleins d'un texte écrit qui sont dits sur la page (racines). */
export function partDite(ecrit: string, dit: string): number {
  const cles = [...new Set(motsPleins(ecrit).map(racine))];
  if (!cles.length) return 1;
  const dites = new Set(motsPleins(dit).map(racine));
  return cles.filter((c) => dites.has(c)).length / cles.length;
}

/** Nombres écrits en chiffres dans un texte. */
const chiffres = (t: string) => t.match(/\d+/g) ?? [];

/**
 * Style « reference/2 » : chaque scène porte son gabarit ; chaque page a un rôle, UN titre court écrit en premier,
 * une phrase clé, 1 à 3 détails ; une étape porte le numéro que la voix dit, au mot où elle le dit ; l'exemple a son
 * « avant » et son « après » ; la dernière page est « À retenir » (liste, puis l'appel). Le texte écrit peut raccourcir
 * le texte dit, jamais le contredire : la phrase clé et les détails reprennent ses mots, un chiffre écrit est dit.
 * Les autres styles refusent les champs `gabarit` et `bloc`.
 */
export function regleGabarit(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  if (estGabarit3(fiche)) return regleGabarit3(fiche);
  if (!estGabaritClair(fiche)) {
    for (const s of fiche.scenes) {
      if (s.gabarit) res.push({ sceneId: s.id, detail: `le champ « gabarit » n'existe qu'au style « ${STYLE_GABARIT_CLAIR} » (cette fiche est au style « ${fiche.habillage} ») : retirez-le.` });
      if (lignesDe(s).some((l) => l.bloc)) res.push({ sceneId: s.id, detail: `le champ « bloc » d'une ligne n'existe qu'au style « ${STYLE_GABARIT_CLAIR} » : retirez-le.` });
    }
    return res;
  }
  const pages = pagesDe(fiche);
  const derniere = fiche.scenes[fiche.scenes.length - 1];
  let etapeAttendue = 1;
  pages.forEach((p, i) => {
    const premiere = p.scenes[0];
    const role = rolePage(p);
    for (const s of p.scenes) {
      if (!s.gabarit) {
        res.push({ sceneId: s.id, detail: `la scène n'a pas de « gabarit » : donnez-lui { "role": ${ROLES_PAGE.map((r) => `« ${r} »`).join(", ")} } (le rôle de sa page).` });
        continue;
      }
      if (s.ecrans?.length) res.push({ sceneId: s.id, detail: `pas d'« ecrans » au style « ${STYLE_GABARIT_CLAIR} » : retirez-les.` });
      if (!ROLES_PAGE_2.includes(s.gabarit.role)) res.push({ sceneId: s.id, detail: `le rôle de page « ${s.gabarit.role} » n'existe qu'au style « ${STYLE_GABARIT_3} » ; au style « ${STYLE_GABARIT_CLAIR} » : ${ROLES_PAGE_2.map((r) => `« ${r} »`).join(", ")}.` });
      if (role && s.gabarit.role !== role) res.push({ sceneId: s.id, detail: `toutes les scènes de la page ${p.page} ont le même rôle de page : « ${role} » (celui de sa première scène), pas « ${s.gabarit.role} ».` });
      if (s.gabarit.numero && s.gabarit.role !== "etape") res.push({ sceneId: s.id, detail: `seule une page « étape » porte un numéro : retirez « numero » ou donnez à la page le rôle « etape ».` });
      if (s.gabarit.visuel || s.gabarit.bloc) res.push({ sceneId: s.id, detail: `« visuel » et « bloc » (dessins de la banque, bloc orange) n'existent qu'au style « ${STYLE_GABARIT_3} » : retirez-les.` });
      for (const l of lignesDe(s)) {
        if (!l.bloc) res.push({ sceneId: s.id, detail: `la ligne « ${l.texte} » n'a pas de « bloc » : dites sa place dans la page (${BLOCS_GABARIT.map((b) => `« ${b} »`).join(", ")}).` });
        else if (role && !BLOCS_PERMIS[role].includes(l.bloc)) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[l.bloc]} (« ${l.texte} ») n'a pas sa place sur une page « ${NOMS_ROLES[role]} » (${BLOCS_PERMIS[role].map((b) => `« ${b} »`).join(", ")} seulement).` });
      }
      // La voix compte une étape (« Un. », « Deux : ») : le numéro est écrit, au mot où il est dit.
      const dits = numerosDits(s.texteDit);
      const num = s.gabarit.numero;
      for (const d of dits) {
        if (!num) res.push({ sceneId: s.id, detail: `la voix dit le numéro ${d.n} (mot ${d.ancre + 1}) : écrivez-le, avec « gabarit » { "role": "etape", "numero": { "n": ${d.n}, "ancre": ${d.ancre} } }.` });
        else if (num.n !== d.n || num.ancre !== d.ancre) res.push({ sceneId: s.id, detail: `la voix dit le numéro ${d.n} au mot ${d.ancre + 1} : le numéro écrit doit être { "n": ${d.n}, "ancre": ${d.ancre} }, pas { "n": ${num.n}, "ancre": ${num.ancre} }.` });
      }
      if (num && !dits.length && num.ancre >= mots(s.texteDit).length) res.push({ sceneId: s.id, detail: `le numéro part du mot ${num.ancre + 1}, mais le texte dit n'a que ${pluriel(mots(s.texteDit).length, "mot")}.` });
    }
    if (!role) return;
    const lignes = p.scenes.flatMap((s) => lignesDe(s).map((l) => ({ l, s })));
    const de = (b: BlocGabarit) => lignes.filter((x) => x.l.bloc === b);
    const suite = estPageSuite(pages, i);
    const dit = p.scenes.map((s) => s.texteDit).join(" ");
    // Titre : un seul, court, dans la première scène, écrit avant le reste de la scène.
    const titres = de("titre");
    if (!titres.length && !suite) res.push({ sceneId: premiere.id, detail: `la page ${p.page} n'a pas de titre : ajoutez une ligne « bloc » « titre » de 1 à ${BORNES_GABARIT.titreMots} mots (l'idée de la page), dans sa première scène.` });
    if (titres.length > 1) res.push({ sceneId: titres[1].s.id, detail: `la page ${p.page} a ${titres.length} titres ; un seul.` });
    for (const { l, s } of titres) {
      const n = nbMots(l.texte);
      if (n > BORNES_GABARIT.titreMots) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » fait ${n} mots ; ${BORNES_GABARIT.titreMots} au plus (le reste va dans la phrase clé).` });
      if (s !== premiere) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » s'écrit dans la première scène de la page ${p.page} (${premiere.id}).` });
      const avant = lignesDe(s).filter((x) => x !== l && x.ancre < l.ancre);
      if (avant.length) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » s'écrit en premier : son ancre (${l.ancre}) doit précéder celle de « ${avant[0].texte} » (${avant[0].ancre}).` });
    }
    // Phrase clé : une, phrase complète courte (obligatoire sauf « À retenir » et page de suite).
    const phrases = de("phrase-cle");
    if (!phrases.length && !suite && role !== "retenir") res.push({ sceneId: premiere.id, detail: `la page ${p.page} n'a pas de phrase clé : ajoutez une ligne « bloc » « phrase-cle » (une phrase complète de ${BORNES_GABARIT.phraseMots} mots au plus, reprise du texte dit).` });
    if (phrases.length > 1) res.push({ sceneId: phrases[1].s.id, detail: `la page ${p.page} a ${phrases.length} phrases clés ; une seule (les autres deviennent des détails).` });
    for (const { l, s } of phrases) {
      const n = nbMots(l.texte);
      if (n > BORNES_GABARIT.phraseMots) res.push({ sceneId: s.id, detail: `la phrase clé « ${l.texte} » fait ${n} mots ; ${BORNES_GABARIT.phraseMots} au plus.` });
    }
    const details = de("detail");
    if (details.length > BORNES_GABARIT.detailsMax) res.push({ sceneId: details[BORNES_GABARIT.detailsMax].s.id, detail: `la page ${p.page} a ${details.length} détails ; ${BORNES_GABARIT.detailsMax} au plus (mettez la suite sur une page de plus).` });
    for (const { l, s } of details) {
      const n = nbMots(l.texte);
      if (n > BORNES_GABARIT.detailMots) res.push({ sceneId: s.id, detail: `le détail « ${l.texte} » fait ${n} mots ; ${BORNES_GABARIT.detailMots} au plus.` });
    }
    for (const b of ["avant", "apres", "liste"] as const)
      for (const { l, s } of de(b)) {
        const n = nbMots(l.texte);
        if (n > BORNES_GABARIT.comparaisonMots) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[b]} « ${l.texte} » fait ${n} mots ; ${BORNES_GABARIT.comparaisonMots} au plus.` });
      }
    // Le texte écrit raccourcit le texte dit, jamais ne le contredit : mots repris, chiffres dits.
    for (const { l, s } of [...phrases, ...details]) {
      const part = partDite(l.texte, dit);
      if (part < BORNES_GABARIT.partMotsDits) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[l.bloc!]} « ${l.texte} » ne reprend pas le texte dit de sa page (${Math.round(part * 100)} % de ses mots sont dits) : écrivez les mots que la voix dit, à peine raccourcis.` });
    }
    const ditChiffres = new Set([...chiffres(dit), ...mots(dit).map(cle), ...nombresDits(dit)]);
    for (const { l, s } of lignes) {
      if (l.bloc === "liste" || l.bloc === "appel") continue;
      for (const c of chiffres(l.texte)) if (!ditChiffres.has(c) && !ditChiffres.has(cle(enLettres(Number(c))))) res.push({ sceneId: s.id, detail: `« ${l.texte} » écrit « ${c} », que la voix ne dit pas sur cette page : le texte écrit ne contredit jamais le texte dit.` });
    }
    // Rôles de page.
    if (role === "etape" && !suite) {
      const numeros = p.scenes.flatMap((s) => (s.gabarit?.numero ? [{ s, n: s.gabarit.numero.n }] : []));
      if (numeros.length > 1) res.push({ sceneId: numeros[1].s.id, detail: `la page ${p.page} porte ${numeros.length} numéros d'étape ; un seul par page.` });
      if (numeros[0] && numeros[0].n !== etapeAttendue) res.push({ sceneId: numeros[0].s.id, detail: `l'étape de la page ${p.page} porte le numéro ${numeros[0].n} ; ${etapeAttendue} est attendu (les étapes se suivent : 1, 2, 3…).` });
      etapeAttendue = (numeros[0]?.n ?? etapeAttendue) + 1;
    }
    // Une page et ses pages de suite (posées par la réparation d'une page trop chargée) forment un tout.
    const groupe = [p];
    for (let j = i + 1; j < pages.length && estPageSuite(pages, j); j++) groupe.push(pages[j]);
    const scenesGroupe = groupe.flatMap((x) => x.scenes);
    const deGroupe = (b: BlocGabarit) => scenesGroupe.flatMap((s) => lignesDe(s)).filter((l) => l.bloc === b);
    if (role === "exemple" && !suite) {
      const lignesPreuve = scenesGroupe.flatMap((s) => s.elements.flatMap((e) => (e.type === "preuve" ? e.lignes : [])));
      const nAvant = deGroupe("avant").length + lignesPreuve.filter((l) => /^\s*avant\s*:/iu.test(l)).length;
      const nApres = deGroupe("apres").length + lignesPreuve.filter((l) => /^\s*apr[eè]s\s*:/iu.test(l)).length;
      if (nAvant !== 1 || nApres !== 1) res.push({ sceneId: premiere.id, detail: `la page « exemple » ${p.page} écrit un « avant » et un « après » (un de chaque : lignes « bloc » « avant » / « apres », ou les lignes « Avant : … » / « Après : … » de sa preuve) : la situation sans la méthode, puis avec.` });
    }
    if (role === "retenir") {
      if (!p.scenes.includes(derniere)) res.push({ sceneId: premiere.id, detail: `la page « À retenir » est la dernière page de la vidéo.` });
      // 15/10 (gabarit cadré) : « À retenir » dit l'IDÉE en une phrase (phrase clé) ; une liste des étapes reste permise.
      if (!deGroupe("liste").length && !deGroupe("phrase-cle").length && !suite) res.push({ sceneId: premiere.id, detail: `la page « À retenir » écrit l'idée de la vidéo : une ligne « bloc » « phrase-cle » (l'idée en une phrase), ou une ligne « bloc » « liste » par étape.` });
      if (de("liste").length > BORNES_GABARIT.listeMax) res.push({ sceneId: premiere.id, detail: `la page « À retenir » a ${de("liste").length} éléments ; ${BORNES_GABARIT.listeMax} au plus.` });
    }
    const appels = de("appel");
    if (appels.length > 1) res.push({ sceneId: appels[1].s.id, detail: `un seul appel, dans la dernière scène.` });
    for (const { l, s } of appels) if (s !== derniere) res.push({ sceneId: s.id, detail: `l'appel « ${l.texte} » s'écrit dans la dernière scène de la vidéo.` });
  });
  return res;
}

/** « 3 » → « trois » (1 à 9 ; au-delà, le chiffre tel quel). */
function enLettres(n: number): string {
  return Object.entries(NOMBRES).find(([, v]) => v === n)?.[0] ?? String(n);
}
