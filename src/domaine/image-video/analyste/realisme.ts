/**
 * IMAGE → VIDÉO · Analyste de réalisme (lot R3). PUR : aucun appel IA, aucun accès au serveur, aucune date, aucun hasard.
 *
 * `analyserRealisme(carte)` vérifie que le workflow dessiné est RÉALISABLE et propose, pour chaque problème, des
 * opérations FERMÉES (relier, reordonner, reformuler, retirer, corrigerTotal, rendreRealiste). `appliquerOperations`
 * les applique sans validation de Will, de façon pure et idempotente, et laisse une trace dans `lecture.alertes`.
 *
 * Règles de fer : aucun chiffre inventé (un total faux est recalculé comme la somme des termes présents, ou retiré) ;
 * le ton n'est jamais retouché (les phrases affirmatives sont gardées : phrase-choc et signature ne sont jamais lues
 * ni modifiées ; seule la structure et les nombres changent).
 */
import { chiffresDe } from "../chiffres";
import { completerCarte, type CarteImage, type NoeudCarte } from "../carte";

export type GraviteRealisme = "bloquant" | "avertissement";
export const CODES_REALISME = ["calcul-faux", "noeud-sans-lien", "boucle-sans-sortie", "chiffre-absurde", "parts-incorrectes", "entonnoir-croissant", "ordre-ambigu"] as const;
export type CodeRealisme = (typeof CODES_REALISME)[number];

export interface ProblemeRealisme {
  code: CodeRealisme;
  /** Ids des blocs (et flèches) concernés, triés. */
  blocs: string[];
  gravite: GraviteRealisme;
}

/** Où se trouve un texte à toucher (jamais la phrase-choc ni la signature). */
export type Emplacement =
  | { genre: "titre" }
  | { genre: "sousTitre" }
  | { genre: "noeud"; id: string; champ: "libelle" | "detail" }
  | { genre: "lien"; id: string }
  | { genre: "bandeau"; index: number };

export type OperationRealisme =
  | { op: "relier"; id: string; de: string; vers: string; trace: string }
  | { op: "reordonner"; ordres: { id: string; ordre: number }[]; trace: string }
  /** Change seulement des nombres dans un fragment (le reste du texte, donc le ton, doit rester identique). */
  | { op: "reformuler"; ou: Emplacement; avant: string; apres: string; trace: string }
  | { op: "retirer"; cible: "lien"; id: string; de: string; vers: string; trace: string }
  | { op: "retirer"; cible: "part"; id: string; trace: string }
  | { op: "retirer"; cible: "noeud"; id: string; trace: string }
  /** Un total faux devient la somme des termes présents (`nouveau`), ou disparaît (`nouveau: null`). */
  | { op: "corrigerTotal"; ou?: Emplacement; avant?: string; apres?: string; quantite?: { noeud: string; valeur: number | null }; ancien: number; nouveau: number | null; trace: string }
  /** Retire un chiffre absurde (`apres` est `avant` sans le chiffre). */
  | { op: "rendreRealiste"; ou: Emplacement; avant: string; apres: string; trace: string };

export interface RapportRealisme {
  problemes: ProblemeRealisme[];
  operationsProposees: OperationRealisme[];
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────────────────────────────────────────────

const nombreFr = (n: number): string => String(Math.round(n * 1e6) / 1e6).replace(".", ",");
const lireNombre = (s: string): number => Number.parseFloat(s.replace(",", "."));
const parOrdre = (a: NoeudCarte, b: NoeudCarte): number => a.ordre - b.ordre || a.id.localeCompare(b.id);

/** Types de schémas qui décrivent un flux : un bloc qui n'est relié à rien y est une impasse. */
const TYPES_FLUX = new Set(["chaine", "embranchement", "entonnoir", "avant-apres", "convergence", "chronologie"]);
const ROLES_FLUX = new Set(["declencheur", "etape", "decision", "sortie", "resultat", "moteur", "source"]);

function textesTouchables(carte: CarteImage): { ou: Emplacement; texte: string }[] {
  const res: { ou: Emplacement; texte: string }[] = [{ ou: { genre: "titre" }, texte: carte.titre }];
  if (carte.sousTitre) res.push({ ou: { genre: "sousTitre" }, texte: carte.sousTitre });
  for (const n of carte.noeuds) {
    res.push({ ou: { genre: "noeud", id: n.id, champ: "libelle" }, texte: n.libelle });
    if (n.detail) res.push({ ou: { genre: "noeud", id: n.id, champ: "detail" }, texte: n.detail });
  }
  for (const l of carte.liens) if (l.etiquette) res.push({ ou: { genre: "lien", id: l.id }, texte: l.etiquette });
  carte.bandeau.forEach((b, index) => res.push({ ou: { genre: "bandeau", index }, texte: b }));
  return res;
}

const blocDe = (ou: Emplacement): string | null => (ou.genre === "noeud" || ou.genre === "lien" ? ou.id : null);

function lireEmplacement(carte: CarteImage, ou: Emplacement): string | undefined {
  switch (ou.genre) {
    case "titre": return carte.titre;
    case "sousTitre": return carte.sousTitre;
    case "noeud": { const n = carte.noeuds.find((x) => x.id === ou.id); return n ? n[ou.champ] : undefined; }
    case "lien": return carte.liens.find((x) => x.id === ou.id)?.etiquette;
    case "bandeau": return carte.bandeau[ou.index];
  }
}

/** Écrit un texte ; vide = champ optionnel supprimé (libellé, titre : refusé). Renvoie faux si rien n'a été écrit. */
function ecrireEmplacement(carte: CarteImage, ou: Emplacement, texte: string): boolean {
  const t = texte.replace(/\s{2,}/g, " ").trim();
  switch (ou.genre) {
    case "titre": if (!t) return false; carte.titre = t; return true;
    case "sousTitre": if (!t) delete carte.sousTitre; else carte.sousTitre = t; return true;
    case "noeud": {
      const n = carte.noeuds.find((x) => x.id === ou.id);
      if (!n) return false;
      if (ou.champ === "libelle") { if (!t) return false; n.libelle = t; return true; }
      if (!t) delete n.detail; else n.detail = t;
      return true;
    }
    case "lien": { const l = carte.liens.find((x) => x.id === ou.id); if (!l) return false; if (!t) delete l.etiquette; else l.etiquette = t; return true; }
    case "bandeau": if (!t || ou.index >= carte.bandeau.length) return false; carte.bandeau[ou.index] = t; return true;
  }
}

// ─── Détections ──────────────────────────────────────────────────────────────────────────────────────────────────────

const NB = "\\d+(?:[.,]\\d+)?";
const UNITE = "(?:\\s?[a-zA-Z%€]{1,12})?";
const SOMME = new RegExp(`(${NB}${UNITE}(?:\\s*\\+\\s*${NB}${UNITE})+)\\s*=\\s*(${NB})(?:\\s?([a-zA-Z%€]{1,12}))?(?!\\s*[≠\\d.,])`, "g");
const PRODUIT = new RegExp(`(${NB})\\s*[×x*]\\s*(${NB})\\s*=\\s*(${NB})(?!\\s*[≠\\d.,]|\\s?[a-zA-Z%€])`, "g");

const SYNONYMES_UNITE: Record<string, string> = { minute: "min", mn: "min", min: "min", heure: "h", h: "h", seconde: "sec", sec: "sec", s: "sec", jour: "jour", j: "jour" };
/** Unité ramenée à une forme unique (« minutes » = « min »), ou chaîne vide s'il n'y en a pas. */
function uniteCanonique(u: string | undefined): string {
  const x = (u ?? "").toLowerCase().replace(/s$/, "");
  return SYNONYMES_UNITE[x] ?? x;
}

export interface CalculFauxDeTexte {
  /** Fragment exact de l'égalité fausse (« 15 min + 4 min = 20 min »). */
  fragment: string;
  /** Même égalité, total remplacé par le calcul exact. */
  corrige: string;
  ancien: number;
  nouveau: number;
}

/**
 * Égalités fausses d'un texte (toutes, pas seulement la première). Somme : termes ET total dans la MÊME unité (« 8 min + 6 min = 20 min ») ;
 * « 1 h + 30 min = 90 min », « 1 + 1 = 3 » ou « 3 outils + 1 IA = 1 seul flux » ne sont jamais touchés. Produit : nombres seuls.
 * Fonction pure, réutilisée par la garde « additionneur ».
 */
export function calculsFauxDeTexte(texte: string): CalculFauxDeTexte[] {
  const res: CalculFauxDeTexte[] = [];
  for (const m of texte.matchAll(SOMME)) {
    const parties = m[1].split("+").map((t) => new RegExp(`^\\s*(${NB})(?:\\s?([a-zA-Z%€]+))?\\s*$`).exec(t));
    if (parties.some((x) => !x)) continue;
    const unites = parties.map((x) => uniteCanonique(x![2]));
    if (!unites[0] || unites.some((u) => u !== unites[0]) || uniteCanonique(m[3]) !== unites[0]) continue;
    const vrai = Math.round(parties.reduce((t, x) => t + lireNombre(x![1]), 0) * 1e6) / 1e6;
    const total = lireNombre(m[2]);
    if (vrai === total) continue;
    const fin = m[0].lastIndexOf(m[2]) + m[2].length;
    res.push({ fragment: m[0], corrige: m[0].slice(0, m[0].lastIndexOf(m[2])) + nombreFr(vrai) + m[0].slice(fin), ancien: total, nouveau: vrai });
  }
  for (const m of texte.matchAll(PRODUIT)) {
    const vrai = Math.round(lireNombre(m[1]) * lireNombre(m[2]) * 1e6) / 1e6;
    const total = lireNombre(m[3]);
    if (vrai !== total) res.push({ fragment: m[0], corrige: m[0].slice(0, m[0].lastIndexOf(m[3])) + nombreFr(vrai), ancien: total, nouveau: vrai });
  }
  return res;
}

const MINUTES: Record<string, number> = { sec: 1 / 60, min: 1, h: 60, jour: 1440 };
const UNE_ANNEE_MIN = 525_600;

/** Composantes fortement connexes (Tarjan), ordre déterministe. */
function composantes(ids: string[], liens: { de: string; vers: string }[]): string[][] {
  const suivants = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const l of liens) suivants.get(l.de)?.push(l.vers);
  for (const v of suivants.values()) v.sort();
  let compteur = 0;
  const index = new Map<string, number>();
  const bas = new Map<string, number>();
  const pile: string[] = [];
  const surPile = new Set<string>();
  const res: string[][] = [];
  const visiter = (v: string) => {
    index.set(v, compteur);
    bas.set(v, compteur);
    compteur++;
    pile.push(v);
    surPile.add(v);
    for (const w of suivants.get(v) ?? []) {
      if (!index.has(w)) {
        visiter(w);
        bas.set(v, Math.min(bas.get(v)!, bas.get(w)!));
      } else if (surPile.has(w)) bas.set(v, Math.min(bas.get(v)!, index.get(w)!));
    }
    if (bas.get(v) === index.get(v)) {
      const c: string[] = [];
      let w: string;
      do {
        w = pile.pop()!;
        surPile.delete(w);
        c.push(w);
      } while (w !== v);
      res.push(c.sort());
    }
  };
  for (const i of [...ids].sort()) if (!index.has(i)) visiter(i);
  return res.sort((a, b) => a[0].localeCompare(b[0]));
}

const PREPOSITIONS_FIN = /(?:\b(?:en|sous|de|du|des|à|a|au|aux|dans|pour|par|sur|et|ou|avec)|[:+−–—-])$/i;
const DELAI_AVANT = /(?:\b(?:en|sous|dans)|d[ée]lai(?:\s+de)?|r[ée]ponse(?:\s+en)?)\s*:?\s*$/i;
const PAS_UN_DELAI = /par an|gagn|[ée]conomis|perd|cumul/i;
const POURCENTAGE_TOLERE = /de plus|hausse|augment|croiss|multipli|\broi\b|retour sur investissement|rentab|marge|objectif|gain/i;

export function analyserRealisme(carte: CarteImage): RapportRealisme {
  const problemes: ProblemeRealisme[] = [];
  const ops: OperationRealisme[] = [];
  const poser = (code: CodeRealisme, blocs: string[], gravite: GraviteRealisme) => problemes.push({ code, blocs: [...new Set(blocs)].sort(), gravite });
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const idsPris = new Set<string>([...carte.noeuds.map((n) => n.id), ...carte.liens.map((l) => l.id)]);
  const idLien = (de: string, vers: string): string => {
    const base = `r3-${de.slice(0, 16)}-${vers.slice(0, 16)}`.replace(/-+$/, "");
    let id = base;
    for (let i = 2; idsPris.has(id); i++) id = `${base.slice(0, 36)}-${i}`;
    idsPris.add(id);
    return id;
  };
  const planifies = new Set<string>();
  const existe = (de: string, vers: string) => carte.liens.some((l) => l.de === de && l.vers === vers);
  /** Une flèche à poser, une seule fois par paire (le même trou peut être vu par deux contrôles). */
  const relier = (de: string, vers: string, trace: string) => {
    if (existe(de, vers) || planifies.has(`${de}>${vers}`)) return;
    planifies.add(`${de}>${vers}`);
    ops.push({ op: "relier", id: idLien(de, vers), de, vers, trace });
  };
  const ordonnes = [...carte.noeuds].sort(parOrdre);

  // Les corrections de texte sont enchaînées par emplacement : chaque opération part du texte laissé par la précédente,
  // si bien qu'une seconde application ne trouve plus rien à faire (idempotence).
  const textes = textesTouchables(carte);
  const courant = new Map<string, string>(textes.map((t) => [JSON.stringify(t.ou), t.texte]));
  const editer = (ou: Emplacement, transformer: (s: string) => string, faire: (avant: string, apres: string) => OperationRealisme | null) => {
    const k = JSON.stringify(ou);
    const avant = courant.get(k);
    if (avant === undefined) return;
    const apres = transformer(avant);
    if (apres === avant) return;
    const op = faire(avant, apres);
    if (!op) return;
    courant.set(k, apres);
    ops.push(op);
  };

  // 1 · Calculs faux écrits dans les textes (somme ou produit, toutes les égalités).
  for (const t of textes) {
    for (const f of calculsFauxDeTexte(t.texte)) {
      poser("calcul-faux", [blocDe(t.ou) ?? "texte"], "bloquant");
      editer(t.ou, (s) => s.replace(f.fragment, f.corrige), (avant, apres) => ({ op: "corrigerTotal", ou: t.ou, avant, apres, ancien: f.ancien, nouveau: f.nouveau, trace: `« ${f.fragment} » devient « ${f.corrige} » (somme exacte des termes écrits).` }));
    }
  }

  // 1b · Sorties d'un nœud qui ne refont pas sa quantité (« 15 + 4 ≠ 20 »). La quantité d'entrée est celle du nœud lui-même ;
  // celle d'un prédécesseur ne compte que s'il est seul et que le nœud n'en a pas.
  const sources = [...new Set(carte.liens.map((l) => l.de))].sort();
  for (const de of sources) {
    const entree = parId.get(de);
    const predecesseurs = [...new Set(carte.liens.filter((l) => l.vers === de).map((l) => l.de))];
    const unique = predecesseurs.length === 1 ? parId.get(predecesseurs[0]) : undefined;
    const porteur = entree?.quantite !== undefined ? entree : unique?.quantite !== undefined ? unique : undefined;
    const qEntree = porteur?.quantite;
    const sorties = carte.liens.filter((l) => l.de === de).map((l) => parId.get(l.vers)).filter((n): n is NoeudCarte => n?.quantite !== undefined);
    if (!porteur || qEntree === undefined || qEntree < 2 || sorties.length < 2) continue;
    const somme = sorties.reduce((s, n) => s + (n.quantite ?? 0), 0);
    if (somme === qEntree) continue;
    poser("calcul-faux", [porteur.id, ...sorties.map((n) => n.id)], "bloquant");
    // Une quantité est un entier de 1 à 99 : au-delà, ou non entière, le total est retiré plutôt que recalculé.
    const valide = Number.isInteger(somme) && somme >= 1 && somme <= 99;
    const trace = `${sorties.map((n) => n.quantite).join(" + ")} ne font pas ${qEntree} : ${valide ? `le total devient ${somme}` : "le total est retiré"}.`;
    const quantite = { noeud: porteur.id, valeur: valide ? somme : null };
    const motif = new RegExp(`(?<![\\d.,])${qEntree}(?![\\d.,])`);
    const champ = valide ? (["libelle", "detail"] as const).find((c) => porteur[c] && motif.test(porteur[c]!)) : undefined;
    if (champ) {
      editer({ genre: "noeud", id: porteur.id, champ }, (s) => s.replace(motif, String(somme)), (avant, apres) => ({ op: "corrigerTotal", quantite, ou: { genre: "noeud", id: porteur.id, champ }, avant, apres, ancien: qEntree, nouveau: somme, trace }));
    } else {
      ops.push({ op: "corrigerTotal", quantite, ancien: qEntree, nouveau: valide ? somme : null, trace });
    }
  }

  // 1c · Somme d'un groupe (étapes chiffrées dans une même unité et leur résultat).
  for (const g of [...carte.groupes].sort((a, b) => a.id.localeCompare(b.id))) {
    const noeuds = g.noeuds.map((i) => parId.get(i)).filter((n): n is NoeudCarte => !!n);
    const chiffresDuNoeud = (n: NoeudCarte) => [n.libelle, n.detail ?? ""].flatMap((t) => chiffresDe(t)).filter((c) => c.valeur !== null);
    const etapes = noeuds.filter((n) => n.role === "etape").map((n) => chiffresDuNoeud(n)[0]).filter((c) => c !== undefined);
    const noeudResultat = noeuds.find((n) => n.role === "resultat" && chiffresDuNoeud(n)[0] !== undefined);
    const resultat = noeudResultat ? chiffresDuNoeud(noeudResultat)[0] : undefined;
    if (!noeudResultat || !resultat || etapes.length < 2 || etapes.some((c) => c.unite !== resultat.unite)) continue;
    const somme = Math.round(etapes.reduce((s, c) => s + (c.valeur ?? 0), 0) * 1e6) / 1e6;
    if (somme === resultat.valeur) continue;
    poser("calcul-faux", noeuds.map((n) => n.id), "bloquant");
    const nouveauBrut = resultat.brut.replace(/\d+(?:[.,]\d+)?/, nombreFr(somme));
    // Le total affiché au même endroit (bandeau, titre) est mis d'accord, sinon l'image se contredirait.
    for (const t of textes) {
      if (t.ou.genre === "lien" || (t.ou.genre === "noeud" && t.ou.id !== noeudResultat.id)) continue;
      editer(t.ou, (s) => (s.includes(resultat.brut) ? s.replace(resultat.brut, nouveauBrut) : s), (avant, apres) => ({
        op: "corrigerTotal",
        ou: t.ou,
        avant,
        apres,
        ancien: resultat.valeur!,
        nouveau: somme,
        trace: `${etapes.map((c) => nombreFr(c.valeur!)).join(" + ")} font ${nombreFr(somme)}, pas ${nombreFr(resultat.valeur!)} : « ${resultat.brut} » devient « ${nouveauBrut} ».`,
      }));
    }
  }

  // 2 · Flux sans entrée ni sortie : bloc relié à rien dans un schéma de flux.
  const relies = new Set(carte.liens.flatMap((l) => [l.de, l.vers]));
  const estFlux = carte.types.some((t) => TYPES_FLUX.has(t));
  if (estFlux) {
    for (const n of ordonnes) {
      if (relies.has(n.id) || n.photoPersonnes || !ROLES_FLUX.has(n.role)) continue;
      const i = ordonnes.findIndex((x) => x.id === n.id);
      const avant = ordonnes[i - 1];
      const apres = ordonnes[i + 1];
      poser("noeud-sans-lien", [n.id], "bloquant");
      if (avant) relier(avant.id, n.id, `Le bloc « ${n.libelle} » n'avait ni entrée ni sortie : relié après « ${avant.libelle} ».`);
      else if (apres) relier(n.id, apres.id, `Le bloc « ${n.libelle} » n'avait ni entrée ni sortie : relié avant « ${apres.libelle} ».`);
    }
  }

  // 3 · Boucle sans condition de sortie : seulement dans un schéma de flux qui a un bloc de sortie hors de la boucle
  // (un cycle PDCA ou un cercle vertueux, qui n'a pas de sortie par nature, reste intact).
  if (estFlux) {
    for (const c of composantes(carte.noeuds.map((n) => n.id), carte.liens)) {
      const dedans = new Set(c);
      if (!carte.liens.some((l) => dedans.has(l.de) && dedans.has(l.vers))) continue;
      if (carte.liens.some((l) => dedans.has(l.de) && !dedans.has(l.vers))) continue;
      const dehors = ordonnes.filter((n) => !dedans.has(n.id) && (n.role === "sortie" || n.role === "resultat"));
      const cible = dehors.find((n) => !carte.liens.some((l) => l.vers === n.id)) ?? dehors[0];
      if (!cible) continue;
      poser("boucle-sans-sortie", c, "bloquant");
      const dernier = c.map((i) => parId.get(i)!).sort(parOrdre).pop()!;
      relier(dernier.id, cible.id, `La boucle autour de « ${dernier.libelle} » n'avait aucune sortie : reliée à « ${cible.libelle} ».`);
    }
  }

  // 4 · Étapes irréalistes : délai absurde, pourcentage absurde, parts qui ne somment pas 100.
  for (const t of textes) {
    const absurdes = chiffresDe(t.texte).filter((c) => {
      if (c.valeur === null) return false;
      const i = t.texte.indexOf(c.brut);
      if (c.unite === "%") {
        const avant = t.texte.slice(0, i).trimEnd();
        return c.valeur > 100 && !avant.endsWith("+") && !POURCENTAGE_TOLERE.test(t.texte);
      }
      if (!(c.unite in MINUTES) || PAS_UN_DELAI.test(t.texte)) return false;
      return c.valeur * MINUTES[c.unite] > UNE_ANNEE_MIN && DELAI_AVANT.test(t.texte.slice(0, i));
    });
    if (!absurdes.length) continue;
    poser("chiffre-absurde", [blocDe(t.ou) ?? "texte"], "avertissement");
    editer(
      t.ou,
      (s) => {
        const reste = absurdes.reduce((x, c) => x.replace(c.brut, ""), s).replace(/\s{2,}/g, " ").trim();
        // Un texte qui finirait sur une préposition ou qui n'aurait plus qu'un mot n'est pas retouché : simple avertissement.
        return reste.split(/\s+/).length < 2 || PREPOSITIONS_FIN.test(reste) ? s : reste;
      },
      (avant, apres) => ({ op: "rendreRealiste", ou: t.ou, avant, apres, trace: `Chiffre irréaliste « ${absurdes.map((c) => c.brut).join(" », « ")} » retiré (rien n'est inventé à sa place).` }),
    );
  }
  for (const de of sources) {
    const parts = carte.liens.filter((l) => l.de === de && l.part !== undefined).sort((a, b) => a.id.localeCompare(b.id));
    if (parts.length < 2) continue;
    const somme = Math.round(parts.reduce((s, l) => s + (l.part ?? 0), 0) * 1e6) / 1e6;
    if (somme === 100) continue;
    const tous = carte.liens.filter((l) => l.de === de).length === parts.length;
    poser("parts-incorrectes", parts.map((l) => l.id), "avertissement");
    if (somme < 100 && !tous) continue;
    for (const l of parts) {
      ops.push({ op: "retirer", cible: "part", id: l.id, trace: `Les parts de ${de} font ${nombreFr(somme)} % au lieu de 100 % : la part de ${l.id} est retirée.` });
      const pct = l.etiquette ? chiffresDe(l.etiquette).find((c) => c.unite === "%" && c.valeur === l.part) : undefined;
      if (pct && l.etiquette) {
        editer(
          { genre: "lien", id: l.id },
          (s) => s.replace(pct.brut, "").replace(/^[\s—–\-:]+/, "").replace(/\s{2,}/g, " ").trim(),
          (avant, apres) => (apres ? { op: "rendreRealiste", ou: { genre: "lien", id: l.id }, avant, apres, trace: `Part « ${pct.brut} » retirée de l'étiquette de ${l.id}.` } : null),
        );
      }
    }
  }

  // 5 · Entonnoir dont les étapes augmentent : SIGNALÉ seulement (la garde aval l'écarte), jamais réparé.
  if (carte.types.includes("entonnoir")) {
    const croissants = carte.liens.filter((l) => (parId.get(l.vers)?.quantite ?? 0) > (parId.get(l.de)?.quantite ?? Infinity));
    if (croissants.length) poser("entonnoir-croissant", croissants.flatMap((l) => [l.de, l.vers]), "bloquant");
  }

  // 6 · Ordre de lecture ambigu (deux blocs au même rang) : rangs resserrés, ordre relatif gardé.
  const rangs = carte.noeuds.map((n) => ({ id: n.id, ordre: n.ordre }));
  if (new Set(rangs.map((r) => r.ordre)).size !== rangs.length) {
    poser("ordre-ambigu", rangs.filter((r) => rangs.filter((x) => x.ordre === r.ordre).length > 1).map((r) => r.id), "avertissement");
    const neufs = new Map(rangs.sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id)).map((r, i) => [r.id, i]));
    const diff = carte.noeuds.filter((n) => neufs.get(n.id) !== n.ordre).map((n) => ({ id: n.id, ordre: neufs.get(n.id)! })).sort((a, b) => a.id.localeCompare(b.id));
    if (diff.length) ops.push({ op: "reordonner", ordres: diff, trace: "Ordre de lecture remis en cohérence." });
  }

  problemes.sort((a, b) => a.code.localeCompare(b.code) || a.blocs.join().localeCompare(b.blocs.join()));
  return { problemes, operationsProposees: ops };
}

// ─── Application (pure, idempotente) ─────────────────────────────────────────────────────────────────────────────────

/** Mêmes caractères hors chiffres : seul un nombre a changé, jamais un mot (le ton reste intact). */
const memeTexteSansChiffres = (a: string, b: string): boolean => a.replace(/[\d.,]/g, "") === b.replace(/[\d.,]/g, "");
/** `apres` est `avant` auquel on a seulement ôté des caractères. */
function estUneSuppression(avant: string, apres: string): boolean {
  let j = 0;
  for (const ch of avant) if (j < apres.length && apres[j] === ch) j++;
  return j === apres.length && apres.length < avant.length;
}

function appliquer(carte: CarteImage, operations: readonly OperationRealisme[]): CarteImage {
  const c: CarteImage = structuredClone(carte);
  const traces: string[] = [];
  const remplacer = (ou: Emplacement, avant: string, apres: string, garde: (a: string, b: string) => boolean): boolean => {
    if (!garde(avant, apres)) return false;
    const actuel = lireEmplacement(c, ou);
    return actuel !== undefined && actuel === avant && ecrireEmplacement(c, ou, apres);
  };

  for (const o of operations) {
    switch (o.op) {
      case "relier": {
        if (!c.noeuds.some((n) => n.id === o.de) || !c.noeuds.some((n) => n.id === o.vers) || o.de === o.vers) break;
        if (c.liens.some((l) => l.id === o.id || (l.de === o.de && l.vers === o.vers))) break;
        c.liens.push({ id: o.id, de: o.de, vers: o.vers, couleur: "neutre", style: "plein" });
        traces.push(o.trace);
        break;
      }
      case "reordonner": {
        let change = false;
        for (const r of o.ordres) {
          const n = c.noeuds.find((x) => x.id === r.id);
          if (n && n.ordre !== r.ordre) {
            n.ordre = r.ordre;
            change = true;
          }
        }
        if (change) traces.push(o.trace);
        break;
      }
      case "reformuler":
        if (remplacer(o.ou, o.avant, o.apres, memeTexteSansChiffres)) traces.push(o.trace);
        break;
      case "rendreRealiste":
        if (remplacer(o.ou, o.avant, o.apres, estUneSuppression)) traces.push(o.trace);
        break;
      case "corrigerTotal": {
        let change = false;
        if (o.ou && o.avant !== undefined && o.apres !== undefined) change = remplacer(o.ou, o.avant, o.apres, memeTexteSansChiffres) || change;
        if (o.quantite) {
          const n = c.noeuds.find((x) => x.id === o.quantite!.noeud);
          if (n && n.quantite !== (o.quantite.valeur ?? undefined)) {
            if (o.quantite.valeur === null) delete n.quantite;
            else n.quantite = o.quantite.valeur;
            change = true;
          }
        }
        if (change) traces.push(o.trace);
        break;
      }
      case "retirer": {
        if (o.cible === "lien") {
          const i = c.liens.findIndex((l) => l.id === o.id && l.de === o.de && l.vers === o.vers);
          if (i >= 0) {
            c.liens.splice(i, 1);
            traces.push(o.trace);
          }
        } else if (o.cible === "part") {
          const l = c.liens.find((x) => x.id === o.id);
          if (l && l.part !== undefined) {
            delete l.part;
            traces.push(o.trace);
          }
        } else {
          const i = c.noeuds.findIndex((n) => n.id === o.id);
          if (i >= 0 && c.noeuds.length > 1) {
            c.noeuds.splice(i, 1);
            c.liens = c.liens.filter((l) => l.de !== o.id && l.vers !== o.id);
            c.groupes = c.groupes.map((g) => ({ ...g, noeuds: g.noeuds.filter((x) => x !== o.id) })).filter((g) => g.noeuds.length > 0);
            traces.push(o.trace);
          }
        }
        break;
      }
    }
  }

  const alertes = [...c.lecture.alertes];
  for (const t of traces) {
    const a = `Corrigé par le code : ${t}`.slice(0, 300);
    if (!alertes.includes(a)) alertes.push(a);
  }
  c.lecture = { ...c.lecture, alertes: alertes.slice(0, 60) };
  // Le code recalcule ensuite tout ce qui se calcule (chiffres, cohérence, types) : l'image reste cohérente avec elle-même.
  return completerCarte(c);
}

/**
 * Applique les opérations sans jamais lever : si le résultat n'est plus une carte valide (ou si une opération est mal
 * formée), la carte d'origine est rendue, avec une alerte qui le dit. Rien n'est appliqué à moitié.
 */
export function appliquerOperations(carte: CarteImage, operations: readonly OperationRealisme[]): CarteImage {
  try {
    return appliquer(carte, operations);
  } catch {
    const intacte: CarteImage = structuredClone(carte);
    const alerte = "Corrections du réalisme non appliquées : le résultat n'était pas une carte valide.";
    if (!intacte.lecture.alertes.includes(alerte)) intacte.lecture = { ...intacte.lecture, alertes: [...intacte.lecture.alertes, alerte].slice(0, 60) };
    return intacte;
  }
}
