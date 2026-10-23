/**
 * Les fiches du BANC DE BOUT EN BOUT du tableau animé (17/10/2026, vidéo v-6616b3800357 toujours sans vidéo après deux
 * correctifs qui n'avaient testé que deux fiches) :
 *  - la fiche de la vidéo v-6616b3800357 (Formation → ardoise, démonstration en 3 gestes), découpée à la main au format
 *    réel depuis son texte exact (`temoins/fiche-temoin-v-6616b3800357-reference-3.json`) ;
 *  - les témoins de `tests/tableau/temoins/` (18, et v-fc3ac0c1d171 depuis le 17/10 ; les fiches enveloppées d'un
 *    constat sont dépliées ; celles d'un ancien style passent en « reference/3 » par `versReference3`, une conversion
 *    mécanique : mêmes textes dits, blocs posés) ;
 *  - les fiches de `tests/tableau/trois-styles/fiches.ts`.
 * Chaque fiche porte son contexte (matières des preuves, sources des chiffres, mots de la douleur).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { ElementLigne, ElementPreuve, FicheTableau, SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { chiffresRetires, estDemande } from "../../../src/moteurs/montage-tableau/fidelite-texte";
import { numerosDits, partDite } from "../../../src/moteurs/montage-tableau/gabarit";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { MOTS_DOULEUR_FORMATION, MOTS_DOULEUR_GABARIT_CADRE, MOTS_DOULEUR_TEMOIN, MOTS_DOULEUR_VISUELS, SOURCE_CHIFFRE_VISUELS } from "../reference-3/fiches";
import { MOTS_DOULEUR_DEMO, MOTS_DOULEUR_V667, ficheDemonstration3Gestes, ficheMaquettes, ficheTemoinV667, ficheTemoinV667Corrige } from "../trois-styles/fiches";

const DOSSIER = join(__dirname, "..", "temoins");

export interface FicheBanc {
  nom: string;
  fiche: FicheTableau;
  motsDouleur: string[];
  /** Sources de chiffres en plus de celles des éléments « chiffre » (un compteur de bloc orange). */
  sources?: string[];
}

/** Mots de la douleur de la vidéo v-6616b3800357 (tels que l'accroche les écrit). */
export const MOTS_DOULEUR_V6616 = ["trois jours", "compte rendu"];

/** La fiche de la vidéo v-6616b3800357, remise en forme comme en production. */
export function ficheV6616(): FicheTableau {
  const brute = JSON.parse(readFileSync(join(DOSSIER, "fiche-temoin-v-6616b3800357-reference-3.json"), "utf8")) as FicheTableau;
  return remettreEnForme(brute, { motsDouleur: MOTS_DOULEUR_V6616 });
}

/** Contexte d'une fiche du banc : ses preuves sont des matières validées, ses chiffres ont leur source. */
export function contexteBanc(f: FicheTableau, motsDouleur: readonly string[], sourcesEnPlus: readonly string[] = []): ContexteTableau {
  const elements = f.scenes.flatMap((s) => s.elements);
  const preuves = [...new Set(elements.flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  const sources = [...new Set([...elements.flatMap((e) => (e.type === "chiffre" ? [e.sourceId] : [])), ...sourcesEnPlus])];
  return {
    aujourdhui: "2026-10-17",
    sourcesChiffres: sources,
    preuves: preuves.map((id) => ({ id, statut: "validee" as const, perimeLe: "2027-01-15" })),
    matieres: preuves.map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-15" })),
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
    ...(motsDouleur.length ? { motsDouleur: [...motsDouleur] } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Conversion d'un ancien style en « reference/3 »                       */
/* ------------------------------------------------------------------ */

type Partie = "accroche" | "douleur" | "solution" | "exemple" | "retenir" | "appel";

/** La partie d'une scène, d'après son rôle (la première scène est l'accroche, la scène « fin » l'appel). */
function partieDe(s: SceneTableau, i: number): Partie {
  if (i === 0) return "accroche";
  if (s.role === "fin") return "appel";
  if (s.role === "accroche" || s.role === "douleur" || s.role === "idee-recue") return "douleur";
  if (s.role === "exemple" || s.role === "preuve") return "exemple";
  if (s.role === "resultat") return "retenir";
  return "solution";
}

const lignes = (s: SceneTableau) => s.elements.filter((e): e is ElementLigne => e.type === "ligne");
const nbMots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
/** Les phrases d'un texte dit, avec l'index (en mots) de leur premier mot. */
function phrases(dit: string): { texte: string; ancre: number }[] {
  const res: { texte: string; ancre: number }[] = [];
  let ancre = 0;
  for (const p of dit.match(/[^.!?]+[.!?]*/gu) ?? []) {
    const t = p.trim();
    if (!t) continue;
    res.push({ texte: t, ancre });
    ancre += nbMots(t);
  }
  return res;
}
/** Une phrase dite, courte et sans nombre, à écrire quand une page n'écrit plus rien (jamais un texte inventé). */
function phraseDite(dit: string, max = 12): { texte: string; ancre: number } | undefined {
  return phrases(dit).find((p) => nbMots(p.texte) <= max && nbMots(p.texte) >= 2 && !/\d/.test(p.texte) && numerosDits(p.texte).length === 0);
}

/**
 * Une scène qui dit deux numéros d'étape (« Un. … Deux. … ») est coupée à la phrase du second, comme le découpage le
 * fait (une page par étape) : ses éléments suivent leur ancre.
 */
function couperAuxNumeros(s: SceneTableau): SceneTableau[] {
  const coupe = numerosDits(s.texteDit).find((n) => n.ancre > 1);
  if (!coupe) return [s];
  const morceaux = s.texteDit.split(" ");
  let mot = 0;
  let pos = morceaux.length;
  for (let m = 0; m < morceaux.length; m++) {
    if (!/[\p{L}\p{N}]/u.test(morceaux[m])) continue;
    if (mot === coupe.ancre) {
      pos = m;
      break;
    }
    mot++;
  }
  const premiers = s.elements.filter((e) => !("ancre" in e) || e.ancre < coupe.ancre);
  const ids = new Set(premiers.map((e) => e.id));
  const premiere: SceneTableau = { ...s, texteDit: morceaux.slice(0, pos).join(" "), elements: premiers.filter((e) => e.type !== "geste" || ids.has(e.cibleId)) };
  const reste = s.elements.filter((e) => !premiers.includes(e) && (e.type !== "geste" || !ids.has(e.cibleId))).map((e) => ("ancre" in e ? { ...e, ancre: e.ancre - coupe.ancre } : e)) as SceneTableau["elements"];
  const seconde: SceneTableau = { ...s, id: `${s.id}b`, texteDit: morceaux.slice(pos).join(" "), elements: reste };
  return [premiere, ...couperAuxNumeros(seconde)];
}
/** « avant » ou « après » trop long : coupé à sa première virgule (consigne : « …six fois par jour. »). */
function court(t: string, max: number): string | null {
  if (nbMots(t) <= max) return t;
  const c = t.split(",")[0].trim();
  return c && nbMots(c) <= max ? `${c.replace(/[.;:]$/, "")}.` : null;
}

/**
 * Une fiche d'un ancien style (« blocs/2 », « reference/1 », « reference/2 ») passée en « reference/3 », comme un
 * découpage (consigne v15) l'aurait rendue, sans rien inventer : mêmes textes dits ; chaque scène dans sa partie
 * (l'accroche seule en page 1, l'appel seul en dernière page), 3 blocs au plus par page (sinon une page de plus) ; un
 * titre de 3 mots au plus, une phrase clé, puis des détails ; les lignes qui ne reprennent pas le texte dit, ou qui en
 * retirent un chiffre, sont laissées ; une page vide écrit une phrase courte de son texte dit ; les numéros dits posés ;
 * l'accroche entourée au mot 0 avec les mots de la douleur. Les règles de la fiche jugent ensuite le résultat.
 */
export function versReference3(f: FicheTableau, motsDouleur: readonly string[]): FicheTableau {
  if (f.habillage === "reference/3") return f;
  let page = 0;
  let etat: { partie: Partie; ancienne: number; titre: boolean; phrase: boolean; groupes: Set<string>; dessin: boolean; comparaison: boolean } | null = null;
  const parPage = new Map<number, SceneTableau[]>();
  const scenes = f.scenes.flatMap(couperAuxNumeros).map((s0, i): SceneTableau => {
    const s = structuredClone(s0) as SceneTableau & { ecrans?: unknown };
    delete s.ecrans;
    const partie = partieDe(s, i);
    if (i > 0 && s.role === "accroche") s.role = "douleur";
    const dit = s.texteDit;
    // Les lignes candidates, nettoyées (marques du style d'avant retirées, barres comprises).
    const candidates = lignes(s).flatMap((l0): ElementLigne[] => {
      const l: ElementLigne = { ...l0 };
      delete l.marque;
      delete l.importants;
      delete (l as { code?: unknown }).code;
      if (/^à retenir$/i.test(l.texte.trim()) || /probl[eè]me/i.test(l.texte)) return [];
      if (partDite(l.texte, dit) < 0.5) return [];
      if (partie !== "exemple" && chiffresRetires(l.texte, dit).length) return [];
      return [l];
    });
    // Une étape numérotée a pour titre son verbe (le premier mot de sa phrase), s'il n'en a pas.
    const numero = partie === "solution" ? numerosDits(dit)[0] : undefined;
    if (numero && candidates.length && !candidates.some((l) => l.niveau === "titre" && nbMots(l.texte) <= 3)) {
      const verbe = candidates[0].texte.split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, "");
      if (verbe) candidates.unshift({ ...candidates[0], id: `${candidates[0].id}t`, texte: verbe, niveau: "titre" });
    }
    /** Bloc de chaque ligne sur une page dans l'état `e` (null : la page déborde). */
    const poser = (e: NonNullable<typeof etat>, debut: boolean): ElementLigne[] | null => {
      const res: ElementLigne[] = [];
      const ajouter = (l: ElementLigne, bloc: NonNullable<ElementLigne["bloc"]>, groupe: string): boolean => {
        if (!e.groupes.has(groupe) && e.groupes.size >= 3) return false;
        e.groupes.add(groupe);
        res.push({ ...l, bloc });
        return true;
      };
      for (const l of candidates) {
        let ok = true;
        if (partie === "accroche") {
          if (!e.phrase) ok = ajouter(l, "phrase-cle", l.id), (e.phrase = true);
          else if (e.groupes.size < 2) ok = ajouter(l, "detail", l.id);
          continue;
        }
        if (partie === "appel") {
          if (l === (candidates.find((x) => estDemande(x.texte)) ?? candidates.at(-1))) ok = ajouter(l, "appel", "appel");
          else if (!e.phrase && nbMots(l.texte) <= 12) ok = ajouter(l, "detail", l.id), (e.phrase = true);
          continue;
        }
        if (partie === "exemple" && (l.bloc === "avant" || l.bloc === "apres")) {
          const t = court(l.texte, 10);
          if (t) ok = ajouter({ ...l, texte: t }, l.bloc, "comparaison");
          e.comparaison = true;
        } else if (l.niveau === "titre" && !e.titre && nbMots(l.texte) <= 3 && partie !== "retenir") {
          ok = ajouter(l, "titre", "titre");
          e.titre = true;
        } else if ((l.bloc === "liste" || l.bloc === "coche") && partie !== "retenir" && nbMots(l.texte) <= 7) {
          ok = ajouter(l, "coche", "coche");
        } else if (!e.phrase && nbMots(l.texte) <= 12) {
          ok = ajouter(l, "phrase-cle", l.id);
          e.phrase = true;
        } else if (nbMots(l.texte) <= 12) {
          ok = ajouter(l, "detail", l.id);
        }
        if (!ok) {
          if (!debut) return null;
          break;
        }
      }
      return res;
    };
    const neuf = () => ({ partie, ancienne: s.page, titre: false, phrase: false, groupes: new Set<string>(), dessin: false, comparaison: false });
    // Nouvelle page : à chaque partie, quand l'ancienne fiche tournait la page, ou quand la page déborderait.
    let poses: ElementLigne[] | null = null;
    // Une étape numérotée a sa page.
    const memePage = etat && etat.partie === partie && etat.ancienne === s.page && partie !== "appel" && partie !== "accroche" && !numero;
    if (memePage) {
      const essai = { ...etat!, groupes: new Set(etat!.groupes) };
      poses = poser(essai, false);
      if (poses) etat = essai;
    }
    if (!poses) {
      page++;
      etat = neuf();
      poses = poser(etat, true) ?? [];
    }
    const gardees = new Set(poses.map((l) => l.id));
    const elements = s.elements.flatMap((e): SceneTableau["elements"] => {
      if (e.type === "ligne") return [...poses!.filter((l) => l.id === `${e.id}t`), ...(gardees.has(e.id) ? [poses!.find((l) => l.id === e.id)!] : [])];
      if (e.type === "geste") return e.geste === "barrer" || !(gardees.has(e.cibleId) || s.elements.some((x) => x.id === e.cibleId && x.type !== "ligne" && x.type !== "dessin")) ? [] : [e];
      if (e.type === "dessin") {
        if (etat!.dessin || partie === "appel") return [];
        etat!.dessin = true;
      }
      return [e];
    });
    const sc: SceneTableau = { ...s, page, gabarit: { role: partie, ...(numero ? { numero } : {}) }, elements };
    parPage.set(page, [...(parPage.get(page) ?? []), sc]);
    return sc;
  });
  // L'accroche : la première phrase dite (14 mots au plus) au mot 0, entourée, avec les mots de la douleur.
  const s1 = scenes[0];
  const premiere = phrases(s1.texteDit)[0];
  const p = s1.elements.find((e): e is ElementLigne => e.type === "ligne" && e.bloc === "phrase-cle");
  if (p && premiere && nbMots(premiere.texte) <= 14) p.texte = premiere.texte;
  if (p) {
    p.ancre = 0;
    p.marque = "entoure";
    const importants = motsDouleur.filter((m) => p.texte.toLowerCase().includes(m.toLowerCase()));
    if (importants.length) p.importants = importants;
  }
  return finitions(remettreEnForme({ ...f, habillage: "reference/3", scenes } as FicheTableau, { motsDouleur: [...motsDouleur] }));
}

/** Après les remises en forme (une page trop chargée a pu passer à une page de plus) : chaque page reste juste. */
function finitions(f: FicheTableau): FicheTableau {
  const parPage = new Map<number, SceneTableau[]>();
  for (const sc of f.scenes) parPage.set(sc.page, [...(parPage.get(sc.page) ?? []), sc]);
  // L'exemple écrit un « avant » ET un « après » (un de chaque, sur la page), ou aucun : le reste devient un détail.
  for (const [, ss] of parPage) {
    const ls = ss.flatMap((x) => x.elements.filter((e): e is ElementLigne => e.type === "ligne"));
    const av = ls.filter((l) => l.bloc === "avant");
    const ap = ls.filter((l) => l.bloc === "apres");
    const preuves = ss.flatMap((x) => x.elements.filter((e): e is ElementPreuve => e.type === "preuve"));
    const etiquetees = (re: RegExp) => preuves.flatMap((e) => e.lignes.filter((l) => re.test(l)));
    const nAv = av.length + etiquetees(/^\s*avant\s*:/iu).length;
    const nAp = ap.length + etiquetees(/^\s*apr[eè]s\s*:/iu).length;
    if (nAv === 1 && nAp === 1) continue;
    // Sinon : aucun côté (une ligne de preuve sans étiquette est un détail).
    for (const l of [...av, ...ap]) l.bloc = ls.some((x) => x.bloc === "phrase-cle") ? "detail" : "phrase-cle";
    for (const e of preuves) e.lignes = e.lignes.map((l) => l.replace(/^\s*(avant|apr[eè]s)\s*:\s*/iu, "").replace(/^\p{Ll}/u, (c) => c.toUpperCase()));
  }
  // Une page qui n'écrit plus rien écrit une phrase courte de son texte dit (l'appel : sa demande).
  for (const [, ss] of parPage) {
    if (ss.some((s) => s.elements.some((e) => e.type === "ligne"))) continue;
    const s = ss[0];
    const appel = s.gabarit?.role === "appel";
    const p = appel ? phrases(s.texteDit).at(-1) : phraseDite(s.texteDit);
    if (!p) continue;
    s.elements.unshift({ id: `${s.id}-l`, type: "ligne", texte: p.texte, niveau: appel ? "titre" : "texte", role: "regle", bloc: appel ? "appel" : "phrase-cle", ancre: p.ancre });
  }
  return f;
}

/* ------------------------------------------------------------------ */
/* Les fiches                                                            */
/* ------------------------------------------------------------------ */

/** Mots de la douleur d'une fiche de témoin : ceux qu'il donne, sinon les mots de sa douleur que l'accroche écrit. */
function motsDouleurDe(f: FicheTableau): string[] {
  // L'accroche dit sa première phrase dès le premier mot : les mots de la douleur sont pris dans ses 8 premiers mots.
  const debut = (phrases(f.scenes[0].texteDit)[0]?.texte ?? "").split(/\s+/).slice(0, 8).map((m) => m.replace(/[^\p{L}\p{N}'’-]/gu, ""));
  const douleur = (f.douleur ?? "").toLowerCase();
  const pleins = debut.filter((m) => m.length >= 5 && douleur.includes(m.toLowerCase()));
  const choix = pleins.length ? pleins : [...debut].filter((m) => m.length >= 5).sort((a, b) => b.length - a.length);
  return [...new Set(choix)].slice(0, 2);
}

/** Les témoins « reference/3 » ont leurs mots de la douleur (et sources) dans leurs tests. */
const CONNUS: Readonly<Record<string, { motsDouleur: string[]; sources?: string[] }>> = {
  "fiche-temoin-v-f1739d6a4f51-reference-3": { motsDouleur: MOTS_DOULEUR_TEMOIN },
  "fiche-formation-v3-reference-3": { motsDouleur: MOTS_DOULEUR_FORMATION },
  "fiche-gabarit-cadre-reference-3": { motsDouleur: MOTS_DOULEUR_GABARIT_CADRE },
  "fiche-gabarit-cadre-visuels-reference-3": { motsDouleur: MOTS_DOULEUR_VISUELS, sources: [SOURCE_CHIFFRE_VISUELS] },
  "fiche-temoin-v-667edcd8e3a8-reference-3": { motsDouleur: MOTS_DOULEUR_V667 },
  "fabrication-arretee-ecriture-a-l-heure-2026-10-15": { motsDouleur: [] },
  // Vidéo v-fc3ac0c1d171 (17/10) : le texte de v-6616b3800357, page 2 découpée autrement (titre « Qui fait quoi »).
  "fiche-temoin-v-fc3ac0c1d171-reference-3": { motsDouleur: MOTS_DOULEUR_V6616 },
};

/** Les témoins de `tests/tableau/temoins/` (hors la fiche v-6616b3800357), dépliés et passés en « reference/3 ». */
export function fichesTemoins(): FicheBanc[] {
  return readdirSync(DOSSIER)
    .filter((n) => n.endsWith(".json") && !n.includes("6616b3800357"))
    .sort()
    .map((n) => {
      const j = JSON.parse(readFileSync(join(DOSSIER, n), "utf8")) as { fiche?: FicheTableau; motsDouleur?: string[] } & FicheTableau;
      const brute = (j.scenes ? j : j.fiche!) as FicheTableau;
      const complete = Object.assign({ version: "fiche-scenes/1", formatId: "tableau-anime", versionId: "r1", structure: "demonstration" }, brute) as FicheTableau;
      const nom = n.replace(/\.json$/, "");
      const connu = CONNUS[nom];
      const motsDouleur = connu?.motsDouleur ?? motsDouleurDe(complete);
      const fiche = complete.habillage === "reference/3" ? remettreEnForme(complete, { motsDouleur }) : versReference3(complete, motsDouleur);
      return { nom, fiche, motsDouleur, ...(connu?.sources ? { sources: connu.sources } : {}) };
    });
}

/** Les fiches de `tests/tableau/trois-styles/fiches.ts`. */
export function fichesTroisStyles(): FicheBanc[] {
  return [
    { nom: "trois-styles · témoin v-667edcd8e3a8", fiche: ficheTemoinV667(), motsDouleur: MOTS_DOULEUR_V667 },
    { nom: "trois-styles · témoin v-667edcd8e3a8 corrigé", fiche: ficheTemoinV667Corrige(), motsDouleur: MOTS_DOULEUR_V667 },
    { nom: "trois-styles · maquettes", fiche: ficheMaquettes(), motsDouleur: ["mails", "temps"] },
    { nom: "trois-styles · démonstration en 3 gestes", fiche: ficheDemonstration3Gestes(), motsDouleur: MOTS_DOULEUR_DEMO },
  ];
}

/** Toutes les fiches du banc, la vidéo v-6616b3800357 en tête. */
export function fichesBanc(): FicheBanc[] {
  return [{ nom: "v-6616b3800357", fiche: ficheV6616(), motsDouleur: MOTS_DOULEUR_V6616 }, ...fichesTemoins(), ...fichesTroisStyles()];
}
