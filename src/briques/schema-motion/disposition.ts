/**
 * MOTION DE SCHÉMA · disposition des nœuds sur la toile et disposition réduite « Ensemble » (plan § 5, K01, K21). PUR,
 * déterministe, sans dépendance externe : même schéma (quel que soit l'ordre de ses listes) = même disposition.
 *
 * - COUCHES par profondeur dans le graphe (plus long chemin depuis une entrée ; sans flèche : rang dans sa colonne) ;
 * - COLONNES par branche : groupes `branche` / `sorties` côte à côte, la branche majoritaire (sinon la plus grosse part)
 *   à GAUCHE et en orange, le tronc commun centré au-dessus ; sinon groupes `avant` | tronc | `apres` (et autres) ;
 * - aucune boîte ne chevauche une autre (vérifié couche par couche, puis entre couches par construction des ordonnées).
 * Elle garde la topologie et les couleurs de l'image, pas ses pixels.
 */
import { MOTS_MAX_ENSEMBLE, nombreDeMots, PLANCHER_IV, TAILLE_DETAIL_IV, TAILLE_LIBELLE_IV } from "./lisibilite";
import {
  ECRAN_IV,
  ZONE_CONTENU_IV,
  type BoiteNoeud,
  type BrancheDisposee,
  type ChiffreCleEnsemble,
  type CouleurSchema,
  type DispositionEnsemble,
  type DispositionToile,
  type NoeudEntree,
  type PastilleEnsemble,
  type SchemaEntree,
  type TexteBoite,
} from "./types";

const H = ECRAN_IV.hauteur;

export const MESURES_TOILE = Object.freeze({
  largeurMin: 240,
  largeurMax: 680,
  marge: 40,
  ecartTextes: 16,
  ecartX: 80,
  ecartY: 140,
  /** Écart entre un nœud du tronc et la tête d'une branche : la place des pastilles de part, à l'écart des branches. */
  ecartSeparation: 320,
  bord: 120,
  /** Largeur moyenne d'un signe, en fraction de la taille (Anton est étroite, Inter Bold plus large). */
  signeAnton: 0.48,
  signeInter: 0.56,
  interligne: 1.15,
});

/** Groupes qui s'ouvrent en colonnes parallèles sous un tronc commun. */
const SORTES_BRANCHES = new Set(["branche", "sorties"]);
/** Groupes posés en bandes côte à côte (avant | tronc | après). */
const SORTES_BANDES = new Set(["avant", "apres", "colonne", "sources"]);

const parOrdre = (a: NoeudEntree, b: NoeudEntree) => a.ordre - b.ordre || a.id.localeCompare(b.id);

/**
 * Réserve de chasse (25/10) : Anton rendue est plus large que l'estimation (`signeAnton`) ; sans marge, une boîte à
 * deux lignes passait à trois et le texte touchait ses bords. On coupe sur `intérieur / RESERVE_CHASSE` et la boîte
 * porte la largeur estimée × RESERVE_CHASSE (toujours dans `largeurMax`).
 */
export const RESERVE_CHASSE = 1.06;

/** Retour à la ligne glouton ; rend les lignes et la largeur de la plus longue (pixels). */
function couper(texte: string, taillePx: number, signe: number, largeurMax: number): { lignes: number; largeur: number } {
  const parSigne = taillePx * signe;
  const mots = texte.trim().split(/\s+/);
  let lignes = 1;
  let courante = 0;
  let plusLongue = 0;
  for (const m of mots) {
    const l = m.length * parSigne;
    const avecEspace = courante === 0 ? l : courante + parSigne + l;
    if (courante > 0 && avecEspace > largeurMax) {
      lignes++;
      plusLongue = Math.max(plusLongue, courante);
      courante = l;
    } else courante = avecEspace;
  }
  plusLongue = Math.max(plusLongue, courante);
  // Un mot plus long que la largeur permise tient seul sur sa ligne : la boîte prend sa largeur (jamais de texte qui déborde).
  const motLePlusLong = Math.max(...mots.map((m) => m.length * parSigne));
  return { lignes, largeur: Math.max(Math.min(largeurMax, plusLongue), motLePlusLong) };
}

/** Taille d'une boîte d'après ses textes (libellé Anton, détail Inter Bold), au plus `largeurMax` (sauf mot plus long). */
export function mesurerBoite(n: Pick<NoeudEntree, "libelle" | "detail">, largeurMax: number = MESURES_TOILE.largeurMax): { largeur: number; hauteur: number; textes: TexteBoite[] } {
  const M = MESURES_TOILE;
  const interieur = largeurMax - 2 * M.marge;
  const coupe = interieur / RESERVE_CHASSE;
  const lib = couper(n.libelle, TAILLE_LIBELLE_IV * H, M.signeAnton, coupe);
  const textes: TexteBoite[] = [{ texte: n.libelle, role: "libelle", taille: TAILLE_LIBELLE_IV, lignes: lib.lignes }];
  let largeur = lib.largeur;
  let hauteur = lib.lignes * TAILLE_LIBELLE_IV * H * M.interligne;
  if (n.detail) {
    const det = couper(n.detail, TAILLE_DETAIL_IV * H, M.signeInter, coupe);
    textes.push({ texte: n.detail, role: "detail", taille: TAILLE_DETAIL_IV, lignes: det.lignes });
    largeur = Math.max(largeur, det.largeur);
    hauteur += M.ecartTextes + det.lignes * TAILLE_DETAIL_IV * H * M.interligne;
  }
  return {
    // Réserve incluse, sans dépasser `largeurMax` (sauf un mot seul plus long, qui garde sa largeur brute comme avant).
    largeur: Math.round(Math.max(M.largeurMin, Math.min(largeur * RESERVE_CHASSE + 2 * M.marge, Math.max(largeurMax, largeur + 2 * M.marge)))),
    hauteur: Math.round(hauteur + 2 * M.marge),
    textes,
  };
}

/** Profondeur de chaque nœud : plus long chemin depuis une entrée, arêtes de retour (cycles) ignorées. */
function profondeurs(noeuds: NoeudEntree[], schema: SchemaEntree, colonneDe: Map<string, string | null>): Map<string, number> {
  const ids = new Set(noeuds.map((n) => n.id));
  const liens = [...schema.liens].filter((l) => ids.has(l.de) && ids.has(l.vers)).sort((a, b) => a.id.localeCompare(b.id));
  const res = new Map<string, number>();
  if (liens.length === 0) {
    // Sans flèche (bénéfices) : rang dans sa colonne, dans l'ordre de lecture.
    const rangs = new Map<string, number>();
    for (const n of noeuds) {
      const c = colonneDe.get(n.id) ?? "";
      const r = rangs.get(c) ?? 0;
      res.set(n.id, r);
      rangs.set(c, r + 1);
    }
    return res;
  }
  // Arêtes de retour repérées par un parcours en profondeur dans l'ordre de lecture.
  const suivants = new Map<string, string[]>(noeuds.map((n) => [n.id, []]));
  for (const l of liens) suivants.get(l.de)!.push(l.vers);
  const etat = new Map<string, 1 | 2>();
  const retours = new Set<string>();
  const visiter = (id: string) => {
    etat.set(id, 1);
    for (const s of suivants.get(id)!) {
      if (etat.get(s) === 1) retours.add(`${id}>${s}`);
      else if (!etat.has(s)) visiter(s);
    }
    etat.set(id, 2);
  };
  for (const n of noeuds) if (!etat.has(n.id)) visiter(n.id);
  const avant = new Map<string, string[]>(noeuds.map((n) => [n.id, []]));
  for (const l of liens) if (!retours.has(`${l.de}>${l.vers}`)) avant.get(l.vers)!.push(l.de);
  const calcul = (id: string): number => {
    if (res.has(id)) return res.get(id)!;
    const p = avant.get(id)!;
    const v = p.length === 0 ? 0 : 1 + Math.max(...p.map(calcul));
    res.set(id, v);
    return v;
  };
  for (const n of noeuds) calcul(n.id);
  return res;
}

/**
 * Variantes de disposition (essayées dans cet ordre par `disposerEtCadrer` tant qu'un bloc serait coupé par le bord) :
 * - `normale` ;
 * - `serree` : boîtes des branches et des rangées plus étroites (texte sur plus de lignes), colonnes de branche séparées
 *   d'au moins la marge du cadre, rangées trop larges pour un écran au zoom 0,8 coupées en plusieurs rangées : deux
 *   branches (ou une rangée) tiennent ensemble dans le cadre, ou une colonne en sort entière ;
 * - `branche-centree` : la branche majoritaire descend droit sous le tronc (colonne verticale centrée) ; les autres
 *   colonnes s'en écartent, à droite puis à gauche, assez loin pour rester hors cadre quand on suit l'une d'elles.
 */
export const VARIANTES_DISPOSITION = Object.freeze(["normale", "serree", "branche-centree"] as const);
export type VarianteDisposition = (typeof VARIANTES_DISPOSITION)[number];

/**
 * Réglages de chaque variante : largeur max d'une boîte de branche, écart entre deux colonnes de branche (pour
 * `branche-centree` : marge ajoutée à une demi-largeur d'écran entre le bord d'une colonne et le centre de sa voisine),
 * largeur max d'une boîte posée dans une rangée de plusieurs, largeur max d'une rangée (au-delà, elle est coupée).
 */
type ReglageVariante = { largeurMaxBranche: number; ecartBranches: number; largeurMaxRangee: number; rangeeMax: number };
const RANGEE_SERREE = { largeurMaxRangee: 520, rangeeMax: 1120 };
const REGLAGES_VARIANTE: Record<VarianteDisposition, ReglageVariante> = {
  normale: { largeurMaxBranche: MESURES_TOILE.largeurMax, ecartBranches: MESURES_TOILE.ecartX, largeurMaxRangee: MESURES_TOILE.largeurMax, rangeeMax: Infinity },
  serree: { largeurMaxBranche: 520, ecartBranches: 170, ...RANGEE_SERREE },
  "branche-centree": { largeurMaxBranche: MESURES_TOILE.largeurMax, ecartBranches: 120, ...RANGEE_SERREE },
};

/**
 * Disposition du schéma sur la toile. Verticalement, chaque colonne s'empile à son rythme (un nœud se pose sous le
 * précédent de sa colonne et sous ceux qui y mènent), le tronc commun sous tout ce qui le précède ; la tête d'une
 * branche est séparée du tronc par `ecartSeparation` (place des pastilles de part).
 */
export function disposerToile(schema: SchemaEntree, variante: VarianteDisposition = "normale"): DispositionToile {
  const M = MESURES_TOILE;
  const reglage = REGLAGES_VARIANTE[variante];
  const noeuds = [...schema.noeuds].sort(parOrdre);
  const ids = new Set(noeuds.map((n) => n.id));
  const groupes = [...schema.groupes].sort((a, b) => a.id.localeCompare(b.id));
  const partEntrante = (noeudsGroupe: string[]) =>
    Math.max(0, ...schema.liens.filter((l) => noeudsGroupe.includes(l.vers) && !noeudsGroupe.includes(l.de)).map((l) => l.part ?? 0));
  const premierOrdre = (noeudsGroupe: string[]) => Math.min(999, ...noeuds.filter((n) => noeudsGroupe.includes(n.id)).map((n) => n.ordre));

  const enBranches = groupes.filter((g) => SORTES_BRANCHES.has(g.sorte));
  const modeBranches = enBranches.length >= 2;
  let bandes: string[];
  let branches: BrancheDisposee[] = [];
  if (modeBranches) {
    const ordonnees = [...enBranches].sort(
      (a, b) => Number(!!b.majoritaire) - Number(!!a.majoritaire) || partEntrante(b.noeuds) - partEntrante(a.noeuds) || a.id.localeCompare(b.id),
    );
    bandes = ordonnees.map((g) => g.id);
    branches = ordonnees.map((g, rang) => {
      const entree = [...schema.liens].sort((a, b) => a.id.localeCompare(b.id)).find((l) => g.noeuds.includes(l.vers) && !g.noeuds.includes(l.de));
      const couleur: CouleurSchema = rang === 0 ? "orange" : (entree?.couleur ?? noeuds.find((n) => g.noeuds.includes(n.id))?.couleur ?? "noir");
      return { id: g.id, rang, couleur: couleur === "orange" && rang > 0 ? "noir" : couleur, majoritaire: rang === 0 };
    });
  } else {
    const enBandes = groupes
      .filter((g) => SORTES_BANDES.has(g.sorte) || SORTES_BRANCHES.has(g.sorte))
      .sort((a, b) => {
        const rangSorte = (s: string) => (s === "avant" ? 0 : s === "apres" ? 2 : 1);
        return rangSorte(a.sorte) - rangSorte(b.sorte) || premierOrdre(a.noeuds) - premierOrdre(b.noeuds) || a.id.localeCompare(b.id);
      })
      .map((g) => g.id);
    bandes = enBandes.length === 0 ? [""] : [enBandes[0], "", ...enBandes.slice(1)];
  }

  const colonneDe = new Map<string, string | null>();
  for (const n of noeuds) {
    const g = groupes.find((x) => bandes.includes(x.id) && x.noeuds.includes(n.id));
    colonneDe.set(n.id, g ? g.id : null);
  }
  const prof = profondeurs(noeuds, schema, colonneDe);
  const enBranche = (id: string) => modeBranches && colonneDe.get(id) !== null;
  const cle = (id: string) => (modeBranches && colonneDe.get(id) === null ? "\u0000tronc" : (colonneDe.get(id) ?? ""));
  const nbCouches = Math.max(0, ...noeuds.map((n) => prof.get(n.id)!)) + 1;
  const dansCleEtCouche = (k: string, c: number) => noeuds.filter((n) => cle(n.id) === k && prof.get(n.id) === c);
  const cles = [...new Set(noeuds.map((n) => cle(n.id)))].sort();
  // Boîte posée à plusieurs sur une couche d'une même colonne : largeur des rangées de la variante.
  const aPlusieurs = (id: string) => dansCleEtCouche(cle(id), prof.get(id)!).length > 1;
  const largeurMaxDe = (id: string) => (enBranche(id) ? reglage.largeurMaxBranche : aPlusieurs(id) ? reglage.largeurMaxRangee : M.largeurMax);
  const mesures = new Map(noeuds.map((n) => [n.id, mesurerBoite(n, largeurMaxDe(n.id))]));
  /** Largeur d'une rangée de boîtes posées côte à côte. */
  const largeurRangee = (liste: NoeudEntree[]) => liste.reduce((s, n) => s + mesures.get(n.id)!.largeur, 0) + Math.max(0, liste.length - 1) * M.ecartX;
  // Rangées : une couche d'une colonne trop large (`rangeeMax`) est coupée en plusieurs rangées superposées. Chaque nœud
  // reçoit un rang de rangée global (couche, puis morceau) : la pose suit les rangées, la couche reste celle du graphe.
  const morceau = new Map<string, number>();
  for (const k of cles) {
    for (let c = 0; c < nbCouches; c++) {
      let j = 0;
      let courant: NoeudEntree[] = [];
      for (const n of dansCleEtCouche(k, c)) {
        if (courant.length > 0 && largeurRangee([...courant, n]) > reglage.rangeeMax) {
          j++;
          courant = [];
        }
        courant.push(n);
        morceau.set(n.id, j);
      }
    }
  }
  const paires = [...new Set(noeuds.map((n) => `${prof.get(n.id)}:${morceau.get(n.id)}`))].map((x) => x.split(":").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rangDeRangee = new Map(paires.map(([c, j], i) => [`${c}:${j}`, i]));
  const rang = new Map(noeuds.map((n) => [n.id, rangDeRangee.get(`${prof.get(n.id)}:${morceau.get(n.id)}`)!]));
  const nbRangees = paires.length;
  const dansBandeEtRangee = (b: string, r: number) => noeuds.filter((n) => (colonneDe.get(n.id) ?? "") === b && rang.get(n.id) === r);

  // Largeur de chaque bande : sa plus large rangée sur une même couche (largeurs réelles des boîtes).
  const largeurBande = new Map<string, number>();
  for (const b of bandes) {
    let max: number = M.largeurMin;
    for (let r = 0; r < nbRangees; r++) max = Math.max(max, largeurRangee(dansBandeEtRangee(b, r)));
    largeurBande.set(b, max + (modeBranches ? reglage.ecartBranches : M.ecartX));
  }
  const debutBande = new Map<string, number>();
  let x0 = 0;
  for (const b of bandes) {
    debutBande.set(b, x0);
    x0 += largeurBande.get(b)!;
  }
  const largeurTotale = x0;
  // Centre de chaque bande et du tronc. `branche-centree` : la première colonne sous le tronc, les autres à distance
  // (demi-écran + demi-colonne + écart), alternativement à droite et à gauche.
  const centreBande = new Map(bandes.map((b) => [b, debutBande.get(b)! + largeurBande.get(b)! / 2]));
  let centreTronc = largeurTotale / 2;
  if (modeBranches && variante === "branche-centree") {
    const plusLarge = Math.max(...bandes.map((b) => largeurBande.get(b)! - reglage.ecartBranches));
    const pas = ECRAN_IV.largeur / 2 + plusLarge / 2 + reglage.ecartBranches;
    bandes.forEach((b, i) => centreBande.set(b, (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * pas));
    centreTronc = 0;
  }

  // Ordonnées : chaque colonne s'empile ; un nœud se pose sous ce qui y mène (flèches vers une couche plus basse).
  const menants = new Map<string, string[]>(noeuds.map((n) => [n.id, []]));
  for (const l of schema.liens) if (ids.has(l.de) && ids.has(l.vers) && prof.get(l.de)! < prof.get(l.vers)!) menants.get(l.vers)!.push(l.de);
  const basDe = new Map<string, number>();
  const curseur = new Map<string, number>();
  let sousTronc = M.bord;
  const yNoeud = new Map<string, number>();
  for (let r = 0; r < nbRangees; r++) {
    const groupes = new Map<string, NoeudEntree[]>();
    for (const n of noeuds.filter((x) => rang.get(x.id) === r)) groupes.set(cle(n.id), [...(groupes.get(cle(n.id)) ?? []), n]);
    // Les colonnes d'abord, le tronc ensuite (il passe sous tout ce qui est déjà posé).
    const ordreCles = [...groupes.keys()].sort((a, b) => Number(a === "\u0000tronc") - Number(b === "\u0000tronc") || a.localeCompare(b));
    for (const k of ordreCles) {
      const liste = groupes.get(k)!;
      const tronc = k === "\u0000tronc";
      let haut = Math.max(curseur.get(k) ?? M.bord, tronc ? Math.max(sousTronc, ...curseur.values()) : sousTronc);
      for (const n of liste) {
        for (const a of menants.get(n.id)!) {
          const ecart = modeBranches && colonneDe.get(a) === null && colonneDe.get(n.id) !== null ? M.ecartSeparation : M.ecartY;
          haut = Math.max(haut, basDe.get(a)! + ecart);
        }
      }
      const h = Math.max(...liste.map((n) => mesures.get(n.id)!.hauteur));
      for (const n of liste) {
        yNoeud.set(n.id, haut + (h - mesures.get(n.id)!.hauteur) / 2);
        basDe.set(n.id, yNoeud.get(n.id)! + mesures.get(n.id)!.hauteur);
      }
      curseur.set(k, haut + h + M.ecartY);
      if (tronc) sousTronc = haut + h + M.ecartY;
    }
  }
  const y = Math.max(...basDe.values()) + M.ecartY;

  const boites: BoiteNoeud[] = [];
  for (let rr = 0; rr < nbRangees; rr++) {
    const dansCouche = noeuds.filter((n) => rang.get(n.id) === rr);
    const centres = new Map<string, number>();
    const parBande = new Map<string, NoeudEntree[]>();
    for (const n of dansCouche) {
      const b = modeBranches && colonneDe.get(n.id) === null ? "\u0000tronc" : (colonneDe.get(n.id) ?? "");
      parBande.set(b, [...(parBande.get(b) ?? []), n]);
    }
    for (const [b, liste] of [...parBande.entries()].sort((a, b2) => a[0].localeCompare(b2[0]))) {
      let x = (b === "\u0000tronc" ? centreTronc : centreBande.get(b)!) - largeurRangee(liste) / 2;
      for (const n of liste) {
        const l = mesures.get(n.id)!.largeur;
        centres.set(n.id, x + l / 2);
        x += l + M.ecartX;
      }
    }
    // Aucun chevauchement dans la rangée : on pousse vers la droite dans l'ordre des centres.
    const rangees = dansCouche
      .map((n) => ({ n, cx: centres.get(n.id)!, l: mesures.get(n.id)!.largeur }))
      .sort((a, b) => a.cx - b.cx || a.n.id.localeCompare(b.n.id));
    let bordDroit = -Infinity;
    for (const r of rangees) {
      let gauche = r.cx - r.l / 2;
      if (gauche < bordDroit + M.ecartX) gauche = bordDroit + M.ecartX;
      bordDroit = gauche + r.l;
      const m = mesures.get(r.n.id)!;
      boites.push({
        id: r.n.id,
        x: Math.round(gauche),
        y: Math.round(yNoeud.get(r.n.id)!),
        largeur: m.largeur,
        hauteur: m.hauteur,
        couche: prof.get(r.n.id)!,
        colonne: colonneDe.get(r.n.id) ?? null,
        couleur: r.n.couleur,
        textes: m.textes,
      });
    }
  }

  const minX = Math.min(...boites.map((b) => b.x));
  for (const b of boites) b.x = b.x - minX + M.bord;
  boites.sort((a, b) => a.couche - b.couche || a.x - b.x || a.id.localeCompare(b.id));
  // La branche majoritaire est orange sur la toile aussi (boîtes et flèches qui y entrent), pas seulement dans
  // `branches` ; l'orange des autres branches passe au noir (un seul orange). Le vert (coche, résultat) est gardé.
  const rangDe = new Map(branches.map((br) => [br.id, br.rang]));
  const recolorer = (colonne: string | null | undefined, c: CouleurSchema): CouleurSchema => {
    const rang = colonne == null ? undefined : rangDe.get(colonne);
    if (rang === undefined || c === "vert") return c;
    return rang === 0 ? "orange" : c === "orange" ? "noir" : c;
  };
  for (const b of boites) b.couleur = recolorer(b.colonne, b.couleur);
  const fleches = [...schema.liens]
    .filter((l) => ids.has(l.de) && ids.has(l.vers))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => ({ id: l.id, de: l.de, vers: l.vers, couleur: recolorer(colonneDe.get(l.vers), l.couleur), ...(l.style ? { style: l.style } : {}) }));
  return {
    largeur: Math.max(...boites.map((b) => b.x + b.largeur)) + M.bord,
    hauteur: y - M.ecartY + M.bord,
    boites,
    fleches,
    branches,
  };
}

/** Deux rectangles se chevauchent-ils (bords qui se touchent exclus) ? */
export function chevauche(a: { x: number; y: number; largeur: number; hauteur: number }, b: { x: number; y: number; largeur: number; hauteur: number }): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

export type OptionsEnsemble = {
  /** Nœuds du bloc courant, allumés (les autres atténués). */
  allumes?: readonly string[];
  /** Chiffres-clés à écrire en grand (1 à 3) ; défaut : les 3 premiers chiffres à dire du schéma, de 3 mots au plus. */
  chiffresCles?: readonly string[];
  /** Bande verticale occupée (fractions de la hauteur) ; défaut : la bande de contenu. Sert à laisser place à un en-tête. */
  bande?: { haut: number; bas: number };
};

const MARGE_ENSEMBLE = 60;
const TAILLE_CHIFFRE_CLE_MAX = 0.05;

/**
 * Disposition réduite « Ensemble » : le schéma entier ramené à l'échelle d'UN écran, dans la bande de contenu, sans
 * texte à lire. Chaque boîte devient une pastille inscrite dans sa boîte réduite (donc aucun chevauchement) ; le numéro
 * de lecture n'est écrit que s'il tient au plancher ; 1 à 3 chiffres-clés (≤ 3 mots) sont écrits en grand sous le schéma.
 */
export function disposerEnsemble(toile: DispositionToile, schema: SchemaEntree, options: OptionsEnsemble = {}): DispositionEnsemble {
  const W = ECRAN_IV.largeur;
  const haut = (options.bande?.haut ?? ZONE_CONTENU_IV.haut) * H;
  const bas = (options.bande?.bas ?? ZONE_CONTENU_IV.bas) * H;
  const chiffres = options.chiffresCles ?? [...new Set((schema.chiffres ?? []).filter((c) => c.aDire).map((c) => c.brut))];
  // Un seul filtre (≤ 3 mots, 3 au plus), pour les chiffres reçus comme pour ceux tirés du schéma.
  const cles = chiffres.filter((t) => nombreDeMots(t) <= MOTS_MAX_ENSEMBLE).slice(0, 3);
  const bandeChiffres = cles.length > 0 ? 0.08 * H : 0;
  const zone = { x: MARGE_ENSEMBLE, y: haut, largeur: W - 2 * MARGE_ENSEMBLE, hauteur: bas - haut - bandeChiffres };

  const minX = Math.min(...toile.boites.map((b) => b.x));
  const minY = Math.min(...toile.boites.map((b) => b.y));
  const largeur = Math.max(...toile.boites.map((b) => b.x + b.largeur)) - minX;
  const hauteur = Math.max(...toile.boites.map((b) => b.y + b.hauteur)) - minY;
  const s = Math.min(1, zone.largeur / largeur, zone.hauteur / hauteur);
  const dx = zone.x + (zone.largeur - largeur * s) / 2;
  const dy = zone.y + (zone.hauteur - hauteur * s) / 2;
  const allumes = new Set(options.allumes ?? toile.boites.map((b) => b.id));
  const ordre = new Map([...schema.noeuds].sort(parOrdre).map((n, i) => [n.id, i + 1]));

  const pastilles: PastilleEnsemble[] = [...toile.boites]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((b) => {
      const rayon = Math.min(0.45 * Math.min(b.largeur, b.hauteur) * s, 0.045 * H);
      const taille = (rayon * 1.1) / H;
      const p: PastilleEnsemble = {
        id: b.id,
        cx: dx + (b.x - minX + b.largeur / 2) * s,
        cy: dy + (b.y - minY + b.hauteur / 2) * s,
        rayon,
        cadre: { x: dx + (b.x - minX) * s, y: dy + (b.y - minY) * s, largeur: b.largeur * s, hauteur: b.hauteur * s },
        couleur: b.couleur,
        allume: allumes.has(b.id),
      };
      if (taille >= PLANCHER_IV) p.numero = { texte: String(ordre.get(b.id) ?? ""), taille };
      return p;
    });

  const chiffresCles: ChiffreCleEnsemble[] = [];
  const largeurCase = zone.largeur / Math.max(1, cles.length);
  cles.forEach((texte, i) => {
    const tient = (largeurCase * 0.9) / (Math.max(1, texte.length) * MESURES_TOILE.signeAnton * H);
    const taille = Math.min(TAILLE_CHIFFRE_CLE_MAX, tient);
    if (taille < PLANCHER_IV) return; // jamais un texte sous le plancher : le chiffre est retiré
    chiffresCles.push({ texte, x: zone.x + i * largeurCase, y: bas - bandeChiffres, largeur: largeurCase, taille });
  });

  return { largeur: W, hauteur: H, pastilles, fleches: toile.fleches, chiffresCles };
}
