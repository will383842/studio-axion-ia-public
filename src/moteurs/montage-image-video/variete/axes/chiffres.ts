/**
 * Axe « chiffres » de la variété (lot CHI) : la façon de MONTRER les chiffres du bandeau (doc 72, axe 3).
 *
 * - CHI-A (référence) : le compteur du bandeau, inchangé.
 * - CHI-B anneau (un pourcentage), CHI-C duel de tailles, CHI-D chiffre géant (toujours), CHI-E en objets (un nombre
 *   qui se compte : ≤ 20 objets, ou un pourcentage par dizaines).
 * - Le duel BARRE l'ancienne valeur : il n'existe que pour un avant / après du MÊME indicateur (groupes « avant » et
 *   « après » de la carte, ou une ligne d'écran partagé avant / après). Deux parts complémentaires (80 % / 20 %) ou
 *   deux indicateurs différents ne font jamais un duel : rien n'y est faux, rien ne se barre.
 *
 * Le moment `bandeau` d'un bloc devient un écran de variété (`sorte: "variete"`, `axe: "chiffres"`) s'il est seul dans
 * son bloc, sinon une donnée `variete.donnees.chiffres.ecran` que le calque dessine par-dessus pendant le moment. Un
 * seul chiffre du bandeau (le « focal ») est montré par la variante, pendant sa fenêtre (de son mot au mot suivant) ;
 * les autres claquent ensuite en rangées, sur leur mot, comme le compteur. Aucun événement ne change : ce qui est
 * montré et quand reste celui du bandeau (les contrôles et `invariantsVarieteIV` le vérifient).
 *
 * Correctif (doc 72 § 7 point 4) : un chiffre qui claque sur une étape DÉJÀ posée de la toile (`proprietes.accents`)
 * n'était pas dessiné. Avec une recette, chaque toile qui en a reçoit `variete.donnees.chiffres.accents`, dessinés par
 * `chiffres/calque.tsx` à la position du nœud (sans toucher `Toile.tsx`).
 *
 * PUR : aucune date, aucun hasard. Les formes des données sont recopiées dans `studio-rendu/…/variete/chiffres/donnees.ts`
 * (un test vérifie qu'elles s'y assignent).
 */
import { planEnsemble } from "@/briques/schema-motion/plan-objets";
import { TEMPS_IV } from "@/briques/schema-motion/temps";
import type { CodesParAxe, FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage, ChiffreCarte } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import type { BlocRenduIV, MomentPlanIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

/** Codes que l'axe sait dessiner (CHI-A = la référence, rien à faire). */
export type CodeChiffresVarieIV = Exclude<CodesParAxe["chiffres"], "CHI-A">;

/** Un chiffre du bandeau (instants en secondes depuis le début du BLOC). */
export interface ChiffreEcranIV {
  texte: string;
  legende?: string;
  t: number;
}

/** Ce que l'écran « chiffres » dessine (instants depuis le début du bloc). */
export interface DonneesEcranChiffresIV {
  code: CodeChiffresVarieIV;
  fond: "sombre" | "ivoire";
  /** Fenêtre du moment dans le bloc. */
  debut: number;
  fin: number;
  etiquette?: string;
  chiffres: ChiffreEcranIV[];
  /** Rang du chiffre montré par la variante ; sa fenêtre va de son mot à `finVariante` (mot suivant ou fin). */
  focal: number;
  finVariante: number;
  /** CHI-B : valeur du pourcentage ; `reste` = le complément (déjà dit), en encre. */
  anneau?: { valeur: number; reste?: { texte: string; legende?: string } };
  /**
   * CHI-C : l'ANCIENNE valeur du même indicateur (avant), barrée quand la nouvelle (le focal) est dite. `t` : son mot
   * dans le bloc (absent : déjà dite avant l'écran, montrée dès le début).
   */
  duel?: { ancien: { texte: string; legende?: string; t?: number } };
  /** CHI-D : le chiffre en grand (une ou deux lignes) et ce qui l'accompagne en petit. */
  geant?: { lignes: string[]; legende?: string };
  /** CHI-E : `part` objets cochés sur `total` ; `reste` = le complément déjà dit. */
  objets?: { total: number; part: number; reste?: { texte: string } };
  /** Icônes des objets d'appoint (déclencheur et résultat de la carte). */
  icones: { entree: string; sortie: string };
}

/** Accent sur une étape déjà posée de la toile (instant depuis le début du bloc). */
export interface AccentToileIV {
  noeud: string;
  t: number;
  texte: string;
  /**
   * Vues d'ensemble pendant l'accent (de leur fondu à leur fin) : la boîte du nœud dans la vue et celles des autres
   * nœuds (`obstacles`), en pixels 1080 × 1920, pour que le calque pose l'accent sans couvrir un libellé.
   */
  vues?: { debut: number; fin: number; x: number; y: number; largeur: number; hauteur: number; obstacles: Rect[] }[];
}

type Rect = { x: number; y: number; largeur: number; hauteur: number };

/** Durée pendant laquelle l'accent reste à l'écran (le calque la lit aussi). */
export const TENUE_ACCENT_SEC = 1.9;

/** Données de l'axe portées par un bloc (`variete.donnees.chiffres`). */
export interface DonneesChiffresIV {
  code: CodesParAxe["chiffres"];
  /** Bloc `moments` dont le bandeau n'est pas seul : l'écran que le calque dessine pendant le moment. */
  ecran?: DonneesEcranChiffresIV;
  /** Toile : les chiffres qui claquent sur un nœud déjà posé. */
  accents?: AccentToileIV[];
}

/** Durée minimale de la fenêtre d'un chiffre pour qu'il soit montré par la variante (sinon : un éclair). */
export const FENETRE_MIN_CHIFFRE_SEC = 1.2;

const FAMILLES: Record<string, string> = { sec: "duree", min: "duree", h: "duree", jour: "duree", "%": "part", "€": "euro", nombre: "nombre" };
/** Valeur ramenée à une même échelle dans une famille (durées en secondes). */
const ECHELLE: Record<string, number> = { sec: 1, min: 60, h: 3600, jour: 86400 };

const chiffresDuBandeau = (carte: CarteImage): ChiffreCarte[] => carte.bandeauChiffres.map((id) => carte.chiffres.find((c) => c.id === id)).filter((c): c is ChiffreCarte => !!c);

/** Deux chiffres comparables : même famille, valeurs connues et différentes. */
function comparables(a: ChiffreCarte, b: ChiffreCarte): boolean {
  const f = FAMILLES[a.unite];
  if (!f || f !== FAMILLES[b.unite] || a.valeur === null || b.valeur === null) return false;
  return a.valeur * (ECHELLE[a.unite] ?? 1) !== b.valeur * (ECHELLE[b.unite] ?? 1);
}

const memeValeur = (a: ChiffreCarte, b: ChiffreCarte) => a.valeur === b.valeur && a.unite === b.unite;

/**
 * L'avant / après d'un MÊME indicateur, lu dans les groupes « avant » et « après » de la carte : l'ancienne valeur
 * (côté avant) et la nouvelle (côté après), comparables (même famille, ex. « 23 min » → « 3 secondes »). Le résultat
 * de chaque côté d'abord (« 19 min/commande » → « 45 sec » plutôt que « 8 min » → « 45 sec »), puis l'ordre de la carte.
 * `null` : pas d'avant / après (embranchement, entonnoir… : deux parts complémentaires ne sont pas un avant / après).
 */
export function paireAvantApres(carte: CarteImage): { ancien: ChiffreCarte; nouveau: ChiffreCarte } | null {
  const noeudsDe = (sorte: "avant" | "apres") => new Set(carte.groupes.filter((g) => g.sorte === sorte).flatMap((g) => g.noeuds));
  const avant = noeudsDe("avant");
  const apres = noeudsDe("apres");
  if (!avant.size || !apres.size) return null;
  const noeud = (c: ChiffreCarte) => carte.noeuds.find((n) => n.id === c.dansNoeud);
  const rang = (c: ChiffreCarte) => (noeud(c)?.role === "resultat" ? 0 : 1) * 1000 + (noeud(c)?.ordre ?? 999);
  const cote = (ids: Set<string>) => carte.chiffres.filter((c) => c.aDire && !!c.dansNoeud && ids.has(c.dansNoeud)).sort((x, y) => rang(x) - rang(y));
  for (const ancien of cote(avant)) {
    const nouveau = cote(apres).find((n) => comparables(ancien, n));
    if (nouveau) return { ancien, nouveau };
  }
  return null;
}

const pourcent = (c: ChiffreCarte) => c.unite === "%" && c.valeur !== null && c.valeur > 0 && c.valeur <= 100;
/** Objets à compter : un pourcentage par dizaines (sur 10), ou un nombre de 1 à 20. */
function compte(c: ChiffreCarte): { total: number; part: number } | null {
  if (c.valeur === null) return null;
  if (c.unite === "%" && c.valeur > 0 && c.valeur < 100 && c.valeur % 10 === 0) return { total: 10, part: c.valeur / 10 };
  if (c.unite === "nombre" && Number.isInteger(c.valeur) && c.valeur >= 1 && c.valeur <= 20) return { total: c.valeur, part: c.valeur };
  return null;
}

/** Le chiffre peut-il être montré par cette variante (hors condition de temps) ? */
function convient(code: CodeChiffresVarieIV, c: ChiffreCarte, carte: CarteImage): boolean {
  switch (code) {
    case "CHI-B":
      return pourcent(c);
    case "CHI-C": {
      // Seule la NOUVELLE valeur d'un avant / après se montre en duel (l'ancienne est barrée à côté).
      const paire = paireAvantApres(carte);
      return !!paire && memeValeur(c, paire.nouveau);
    }
    case "CHI-D":
      return true;
    case "CHI-E":
      return compte(c) !== null;
  }
}

export const AXE_CHIFFRES: AxeVarieteIV = {
  axe: "chiffres",
  possibles(carte: CarteImage, format: FormatIV) {
    void format;
    const bandeau = chiffresDuBandeau(carte);
    // CHI-C : un avant / après du même indicateur (montré sur le bandeau ou sur l'écran partagé avant / après).
    return (["CHI-B", "CHI-C", "CHI-D", "CHI-E"] as const).filter((code) => (code === "CHI-C" && !!paireAvantApres(carte)) || bandeau.some((c) => convient(code, c, carte)));
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const code = etape.recette.chiffres;
    let montre = false;
    const blocs: BlocRenduIV[] = [];
    for (const b of etape.blocs) {
      if (b.sorte === "toile" && b.proprietes.accents?.length) {
        blocs.push(avecDonnees(b, { code, accents: accentsDeToile(b) }));
        continue;
      }
      if (b.sorte === "objets" && code === "CHI-C") {
        const ecran = duelDeLEcranPartage(b, etape);
        if (ecran) {
          montre = true;
          blocs.push({ id: b.id, debut: b.debut, fin: b.fin, ...(b.variete ? { variete: b.variete } : {}), sorte: "variete", axe: "chiffres", code, donnees: ecran });
        } else blocs.push(b);
        continue;
      }
      if (b.sorte !== "moments" || code === "CHI-A") {
        blocs.push(b);
        continue;
      }
      const ecrans = b.moments.flatMap((m) => (m.sorte === "bandeau" ? [ecranDuBandeau(code, m, b, etape)] : [])).filter((e): e is DonneesEcranChiffresIV => !!e);
      if (!ecrans.length) {
        blocs.push(b);
        continue;
      }
      montre = true;
      if (b.moments.length === 1) {
        // Le bandeau seul dans son bloc : un écran de variété, rendu dans le cadre du format.
        blocs.push({ id: b.id, debut: b.debut, fin: b.fin, ...(b.variete ? { variete: b.variete } : {}), sorte: "variete", axe: "chiffres", code, donnees: ecrans[0] });
      } else {
        blocs.push(avecDonnees(b, { code, ecran: ecrans[0] }));
      }
    }
    const replis = [...etape.replis];
    if (code !== "CHI-A" && !montre) replis.push({ axe: "chiffres", code, raison: `aucun chiffre du bandeau ne se montre en ${code} : compteur de référence (CHI-A)` });
    return { ...etape, blocs, replis };
  },
};

/** Accents d'une toile, avec la place de leur nœud dans chaque vue d'ensemble ouverte pendant l'accent. */
function accentsDeToile(b: Extract<BlocRenduIV, { sorte: "toile" }>): AccentToileIV[] {
  const p = b.proprietes;
  return (p.accents ?? []).map((a) => {
    const vues = (p.ensembles ?? [])
      .filter((e) => e.debut - TEMPS_IV.fondu < a.t + TENUE_ACCENT_SEC && e.fin > a.t)
      .flatMap((e) => {
        const plan = planEnsemble(p.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles });
        const boite = plan.blocs.find((x) => x.id === a.noeud);
        const rect = (x: Rect): Rect => ({ x: x.x, y: x.y, largeur: x.largeur, hauteur: x.hauteur });
        // Obstacles : les autres nœuds et les chiffres posés sur la vue (« 80 % », « 20 % »).
        return boite ? [{ debut: e.debut - TEMPS_IV.fondu, fin: e.fin, ...rect(boite), obstacles: [...plan.blocs.filter((x) => x.id !== a.noeud), ...plan.chiffres].map(rect) }] : [];
      });
    return { ...a, ...(vues.length ? { vues } : {}) };
  });
}

function avecDonnees<B extends BlocRenduIV>(b: B, d: DonneesChiffresIV): B {
  if (!b.variete) return b;
  return { ...b, variete: { ...b.variete, donnees: { ...b.variete.donnees, chiffres: d } } };
}

/** Écran d'un moment `bandeau` dans la variante, ou `null` si aucun de ses chiffres ne s'y prête (assez longtemps). */
function ecranDuBandeau(code: CodeChiffresVarieIV, m: Extract<MomentPlanIV, { sorte: "bandeau" }>, b: BlocRenduIV, etape: EtapeVarieteIV): DonneesEcranChiffresIV | null {
  const { carte } = etape;
  const bandeau = chiffresDuBandeau(carte);
  const chiffres: ChiffreEcranIV[] = m.chiffres.map((c) => ({ texte: c.texte, ...(c.legende ? { legende: c.legende } : {}), t: c.t }));
  const carteDe = (texte: string) => bandeau.find((c) => c.brut === texte) ?? carte.chiffres.find((c) => c.brut === texte);
  // Déjà dit (dans la vidéo) avant l'instant absolu `t` : clé « valeur|unité » des chiffres dits.
  const ditAvant = (c: ChiffreCarte, t: number) => etape.chiffresDits.some((d) => d.cle === `${c.valeur}|${c.unite}` && d.t <= t + 1e-6);
  const legendeDe = (c: ChiffreCarte) => {
    const lien = c.dansLien ? carte.liens.find((l) => l.id === c.dansLien) : undefined;
    const apres = lien?.etiquette?.split(/\s[—–-]\s/).slice(1).join(" ").trim();
    return apres || undefined;
  };
  const fenetres = chiffres.map((c, i) => ({ i, debut: Math.max(m.debut, c.t), fin: i + 1 < chiffres.length ? chiffres[i + 1].t : m.fin }));
  const candidats = fenetres
    .filter((f) => f.fin - f.debut >= FENETRE_MIN_CHIFFRE_SEC)
    .map((f) => ({ ...f, carte: carteDe(chiffres[f.i].texte) }))
    .filter((f): f is typeof f & { carte: ChiffreCarte } => !!f.carte && convient(code, f.carte, carte))
    // Duel : le focal est la nouvelle valeur d'un avant / après ; l'ancienne (barrée) doit avoir déjà été dite.
    .map((f) => ({ ...f, ancien: code === "CHI-C" ? paireAvantApres(carte)?.ancien : undefined }))
    .filter((f) => code !== "CHI-C" || (!!f.ancien && ditAvant(f.ancien, b.debut + f.debut)))
    // La plus longue fenêtre d'abord (à égalité, la première).
    .sort((x, y) => y.fin - y.debut - (x.fin - x.debut) || x.i - y.i);
  const f = candidats[0];
  if (!f) return null;
  const c = f.carte;
  // Complément d'un pourcentage (80 % → 20 %), seulement s'il a déjà été dit.
  const complement = pourcent(c) ? carte.chiffres.find((o) => o.unite === "%" && o.valeur === 100 - c.valeur! && o.aDire && ditAvant(o, b.debut + f.debut)) : undefined;
  const reste = complement ? { texte: complement.brut, ...(legendeDe(complement) ? { legende: legendeDe(complement) } : {}) } : undefined;
  const donnees: DonneesEcranChiffresIV = {
    code,
    fond: code === "CHI-D" ? "sombre" : "ivoire",
    debut: m.debut,
    fin: m.fin,
    ...(m.etiquette ? { etiquette: m.etiquette } : {}),
    chiffres,
    focal: f.i,
    finVariante: f.fin,
    icones: iconesDe(carte),
  };
  if (code === "CHI-B") donnees.anneau = { valeur: c.valeur!, ...(reste ? { reste } : {}) };
  if (code === "CHI-C") donnees.duel = { ancien: { texte: f.ancien!.brut, ...(legendeDe(f.ancien!) ? { legende: legendeDe(f.ancien!) } : {}) } };
  if (code === "CHI-D") donnees.geant = geant(chiffres[f.i]);
  if (code === "CHI-E") donnees.objets = { ...compte(c)!, ...(reste ? { reste: { texte: reste.texte } } : {}) };
  return donnees;
}

/** Icônes des objets d'appoint : le déclencheur et le résultat de la carte. */
function iconesDe(carte: CarteImage): DonneesEcranChiffresIV["icones"] {
  const noeuds = [...carte.noeuds].sort((x, y) => x.ordre - y.ordre);
  const icone = (n?: (typeof noeuds)[number]) => (n?.icone && iconeDe(n.icone)) || "document";
  return { entree: icone(noeuds.find((n) => n.role === "declencheur") ?? noeuds[0]), sortie: icone([...noeuds].reverse().find((n) => n.role === "resultat") ?? noeuds[noeuds.length - 1]) };
}

/**
 * Duel d'un écran partagé avant / après (bloc `objets` qui n'a que lui) : une ligne dont la valeur « avant » et la
 * valeur « après » sont des chiffres comparables de la carte (même indicateur, ex. « 23 min » → « 3 secondes »).
 * L'ancienne paraît sur son mot, la nouvelle grandit sur le sien et l'ancienne se barre. `null` : pas d'avant / après.
 */
function duelDeLEcranPartage(b: Extract<BlocRenduIV, { sorte: "objets" }>, etape: EtapeVarieteIV): DonneesEcranChiffresIV | null {
  const { carte } = etape;
  const o = b.objets.length === 1 ? b.objets[0] : undefined;
  if (o?.sorte !== "ecran-partage" || !paireAvantApres(carte)) return null;
  const chiffreDe = (valeur?: string) => (valeur ? carte.chiffres.find((c) => c.brut === valeur.trim()) : undefined);
  const { avant, apres } = o.proprietes;
  for (let i = 0; i < Math.min(avant.lignes.length, apres.lignes.length); i++) {
    const la = avant.lignes[i];
    const ln = apres.lignes[i];
    const ancien = chiffreDe(la.valeur);
    const nouveau = chiffreDe(ln.valeur);
    if (!ancien || !nouveau || !comparables(ancien, nouveau)) continue;
    // Le duel va du mot de l'ancienne à la fin de l'écran : assez long pour être lu.
    if (o.fin - la.t < FENETRE_MIN_CHIFFRE_SEC || ln.t < la.t) continue;
    // « Recherche : 23 min » → légende « Recherche » ; « Trouvé » reste la légende de la nouvelle.
    const legende = (texte: string | undefined, valeur: string) => texte?.replace(valeur, "").replace(/[\s:—–-]+$/u, "").trim() || undefined;
    const lAncien = legende(la.texte, la.valeur!);
    const lNouveau = legende(ln.texte, ln.valeur!);
    const etiquette = b.entetes.find((e) => e.debut <= o.debut + 1e-6)?.etiquette;
    return {
      code: "CHI-C",
      // Le duel est un écran ivoire (comme celui du bandeau) : l'ancienne valeur en encre, la nouvelle en orange.
      fond: "ivoire",
      debut: o.debut,
      fin: o.fin,
      ...(etiquette ? { etiquette } : {}),
      chiffres: [{ texte: ln.valeur!, ...(lNouveau ? { legende: lNouveau } : {}), t: ln.t }],
      focal: 0,
      finVariante: o.fin,
      duel: { ancien: { texte: la.valeur!, ...(lAncien ? { legende: lAncien } : {}), t: la.t } },
      icones: iconesDe(carte),
    };
  }
  return null;
}

/**
 * Le chiffre géant : « 24h/24 » → « 24h » / « /24 » ; « 0 demande » → « 0 », le mot passe en petit avec la légende ;
 * « 80 % » reste sur une ligne. Le texte reste celui de la carte, mot pour mot (seul le découpage change).
 */
export function geant(c: ChiffreEcranIV): { lignes: string[]; legende?: string } {
  const texte = c.texte.trim();
  const barre = texte.indexOf("/");
  if (barre > 0) return { lignes: [texte.slice(0, barre), texte.slice(barre)], ...(c.legende ? { legende: c.legende } : {}) };
  const [tete, ...suite] = texte.split(/\s+/);
  // Unité courte (%, h, s, min, €) : sur la ligne du nombre ; un mot (« demande ») : en petit, devant la légende.
  if (!suite.length || suite.join(" ").length <= 3) return { lignes: [texte], ...(c.legende ? { legende: c.legende } : {}) };
  const legende = [suite.join(" "), c.legende].filter(Boolean).join(" ");
  return { lignes: [tete], legende };
}
