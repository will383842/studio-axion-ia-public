/**
 * PLAN V4 MINIMAL (Lot I, 17/10/2026) — le REPLI quand Claude Opus ne donne pas de plan (panne, plafond du mois, 3 essais refusés). PUR.
 *
 * Il remplace la « version simple » de l'ancien catalogue (`regles-fixes.ts`, qui reste dans le code mais n'est plus appelée par
 * `realiser`) : un plan `elementsV4` sobre, sans B-roll ni chiffre, qui passe les règles BLOQUANTES de `regles-v4.ts` (D0, V1 à V8, H1, H2).
 *  - une plaquette à la fois, collées bout à bout de 0 à l'écran de fin (prise seule : 0 s) ;
 *  - une ROTATION de plaquettes simples (décalée selon la prise : `graine`) qui alterne les emplacements (tête, carte, tête, bas…) : jamais deux fois de suite le même ;
 *  - un « coup de poing » `dalle-claquee` (plein cadre) toutes les ~17 s, jamais avant 8 s ni dans les 6 dernières secondes ;
 *  - les textes sont des mots DITS dans la plaquette (ou juste avant, fenêtre de D15), jamais un mot interdit à l'écran (V8) ;
 *    les lignes et les instants tombent sur le début d'un mot dit.
 * Pas de mise en scène « littérale » : c'est un filet de sécurité, la version complète reste celle de Claude.
 */
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { CATALOGUE_V4, plafondParVideoV4, type FicheCatalogueV4 } from "./catalogue-v4";

/** Fiche d'une plaquette ACTIVE (les plaquettes en coulisse ne sont jamais choisies). */
const ficheV4 = (id: string): Readonly<FicheCatalogueV4> | undefined => CATALOGUE_V4.find((f) => f.id === id && f.actif);
import { estMotOutil, motsInterditsDans, nettoyer, type MotTranscrit } from "./mots";

/** Emplacements en boucle : tête, carte, tête, puis bas ou fenêtre (5 plaquettes de suite couvrent toujours 3 emplacements, règle D2). */
const CYCLE_EMPLACEMENTS = Object.freeze(["tete", "carte", "tete", "bas", "tete", "carte", "tete", "fenetre"] as const);
/** Plaquettes simples de chaque emplacement, dans l'ordre de préférence (chacune 3 fois au plus par vidéo, règle D14). */
export const ROTATION_PLAN_MINIMAL_V4: Readonly<Record<"tete" | "carte" | "bas" | "fenetre" | "plein-cadre", readonly string[]>> = Object.freeze({
  tete: ["EtiquetteTete", "MotSaute", "element-barre", "BadgeProfil", "Interjection", "RangeePastilles"],
  carte: ["CarteCalendrier", "CarteChecklist", "CarteCommentaire", "GraphiqueBarres", "CarteStatuts", "CarteCommande"],
  bas: ["PileNotifications"],
  fenetre: ["FenetreTelephone", "CarrouselFeuillete", "FenetreDouble"],
  "plein-cadre": ["dalle-claquee", "rafale-trois-mots"],
});
/** Coup de poing : premier après 8 s, puis tous les ~17 s ; jamais dans les 6 dernières secondes. */
const COUP_PREMIER_SEC = 9;
const COUP_ECART_SEC = 17;
const COUP_AVANT_FIN_SEC = 6.5;
/** Aucune fenêtre (elle couvre le visage) avant 5 s. */
const FENETRE_APRES_SEC = 5.2;
/** Durée visée par plaquette (dans la fourchette de sa fiche). */
const DUREE_VISEE: Record<string, number> = {
  EtiquetteTete: 1.6, MotSaute: 1.6, Interjection: 1.1, "element-barre": 1.8, BadgeProfil: 1.8, RangeePastilles: 2.2,
  CarteCalendrier: 3.2, CarteChecklist: 3.4, CarteCommentaire: 3.2, GraphiqueBarres: 3.2, CarteStatuts: 3.4, CarteCommande: 3.6,
  PileNotifications: 2.6, FenetreTelephone: 2.8, CarrouselFeuillete: 2.8, FenetreDouble: 2.8, "dalle-claquee": 0.9, "rafale-trois-mots": 1.6,
};

/** La liste décalée de `graine` rangs (rotation) : la prise change la plaquette de départ de chaque emplacement ; graine 0 = l'ordre de la table. */
const decaler = (liste: readonly string[], graine: number) => liste.map((_, k) => liste[(k + graine) % liste.length]);

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Un mot affichable : pas un mot-outil, pas de chiffre, pas un mot interdit à l'écran. */
function affichable(m: MotTranscrit): boolean {
  const w = nettoyer(m.w);
  return w.length >= 2 && !estMotOutil(w) && !/\d/.test(w) && motsInterditsDans(w).length === 0;
}
const texte = (m: MotTranscrit) => nettoyer(m.w).toLocaleUpperCase("fr-FR");
/** Mots d'orthographe différente (premier de chaque), dans l'ordre où ils sont dits. */
const distincts = (l: readonly MotTranscrit[]) => l.filter((m, k) => l.findIndex((x) => texte(x) === texte(m)) === k);

interface Fenetre { debut: number; fin: number }

/** Contenu d'une plaquette de la rotation, à partir des mots DITS dans sa fenêtre (null : pas assez de mots pour elle). */
function contenu(id: string, f: Fenetre, mots: readonly MotTranscrit[]): Omit<ElementV4Plan, "id" | "debut" | "fin"> | null {
  const dedans = mots.filter((m) => m.a >= f.debut && m.a <= f.fin);
  const choix = dedans.filter(affichable);
  // Repli des textes : un mot dit juste avant (D15 regarde de début − 2 s à fin + 1 s).
  const proches = mots.filter((m) => m.a >= f.debut - 1.5 && m.a <= f.fin && affichable(m));
  const illustre = dedans.map((m) => m.w).join(" ").slice(0, 60).trim() || proches.map((m) => m.w).join(" ").slice(0, 60).trim();
  if (!illustre) return null;
  const plusLong = [...(choix.length ? choix : proches)].sort((x, y) => nettoyer(y.w).length - nettoyer(x.w).length)[0];
  if (!plusLong) return null;
  const instants = (n: number) => {
    if (dedans.length < n) return null;
    // n débuts de mots répartis dans la plaquette.
    return Array.from({ length: n }, (_, k) => r2(dedans[Math.floor((k * dedans.length) / n)].a)).filter((t, k, l) => l.indexOf(t) === k);
  };
  const lignes = (n: number) => (choix.length >= n ? choix.slice(0, n).map((m) => ({ texte: texte(m), a: r2(m.a) })) : null);
  switch (id) {
    case "EtiquetteTete":
    case "MotSaute":
    case "Interjection":
      return { mots: [texte(plusLong)], illustre };
    case "element-barre": {
      const i = instants(1);
      return i?.length === 1 ? { mots: [texte(plusLong)], instants: i, illustre } : null;
    }
    case "BadgeProfil": {
      const l = lignes(1);
      return l ? { mots: [texte(plusLong)], lignes: l, illustre } : null;
    }
    case "PileNotifications": {
      const l = lignes(Math.min(2, choix.length));
      return l?.length ? { lignes: l, illustre } : null;
    }
    case "CarteChecklist": {
      if (choix.length < 4) return null;
      return { mots: [texte(choix[0])], lignes: choix.slice(1, 4).map((m) => ({ texte: texte(m), a: r2(m.a) })), illustre };
    }
    case "CarteCalendrier":
    case "GraphiqueBarres": {
      const i = instants(2);
      return i?.length === 2 ? { mots: [texte(plusLong)], instants: i, illustre } : null;
    }
    case "CarteCommentaire": {
      const i = instants(3);
      return i?.length === 3 ? { mots: [texte(plusLong)], instants: i, illustre } : null;
    }
    case "RangeePastilles": {
      if (choix.length < 4) return null;
      return { mots: [texte(choix[0])], lignes: choix.slice(1, 4).map((m) => ({ texte: texte(m), a: r2(m.a) })), illustre };
    }
    case "CarteStatuts": {
      const d = distincts(choix);
      if (d.length < 4) return null;
      return { mots: d.slice(0, 4).map(texte), lignes: d.slice(0, 3).map((m) => ({ texte: texte(m), a: r2(m.a) })), illustre };
    }
    case "CarteCommande": {
      const d = distincts(choix);
      const i = instants(5);
      return d.length >= 3 && i?.length === 5 ? { mots: d.slice(0, 3).map(texte), instants: i, illustre } : null;
    }
    case "FenetreTelephone": {
      const d = distincts(choix);
      return d.length >= 3 ? { mots: d.slice(0, 3).map(texte), illustre } : null;
    }
    case "FenetreDouble": {
      const d = distincts(choix);
      return d.length >= 4 ? { mots: d.slice(0, 4).map(texte), illustre } : null;
    }
    case "CarrouselFeuillete": {
      const i = instants(1);
      return i?.length === 1 ? { mots: [texte(plusLong)], instants: i, illustre } : null;
    }
    case "dalle-claquee":
      return { mots: [texte(plusLong)], illustre };
    case "rafale-trois-mots": {
      const d = distincts(choix);
      const i = instants(2);
      return d.length >= 3 && i?.length === 2 ? { mots: d.slice(0, 3).map(texte), instants: i, illustre } : null;
    }
    default:
      return null;
  }
}

/**
 * Le plan v4 minimal : plaquettes de 0 à `horizon` (début de l'écran de fin), sans trou. Rend [] si la vidéo est trop courte ou muette :
 * `verifierPlan` le refuse alors (aucune plaquette) et la vidéo n'est pas rendue.
 */
export function planMinimalV4(entree: { mots: readonly MotTranscrit[]; horizon: number; graine?: number; eviterOuvertures?: readonly string[] }): ElementV4Plan[] {
  const mots = [...entree.mots].sort((x, y) => x.a - y.a);
  const horizon = entree.horizon;
  const elements: ElementV4Plan[] = [];
  const usages = new Map<string, number>();
  const graine = Math.abs(Math.trunc(entree.graine ?? 0));
  // Anti-répétition : la plaquette d'ouverture ne reprend pas celle des dernières vidéos (si une autre est possible).
  const eviter = new Set(entree.eviterOuvertures ?? []);
  let curseur = 0;
  let etape = 0;
  let prochainCoup = COUP_PREMIER_SEC;
  const dernier = () => elements[elements.length - 1];
  const autorise = (id: string) => {
    const p = dernier();
    return !p || (p.id !== id && ficheV4(p.id)?.slot !== ficheV4(id)?.slot);
  };

  for (let garde = 0; curseur < horizon - 0.01 && garde < 400; garde++) {
    const reste = horizon - curseur;
    // Emplacements essayés : le coup de poing s'il est dû, puis le cycle (une fenêtre seulement après 5 s), puis les autres en secours.
    const voulus: (keyof typeof ROTATION_PLAN_MINIMAL_V4)[] = [];
    if (curseur >= prochainCoup && curseur + 1 <= horizon - COUP_AVANT_FIN_SEC) voulus.push("plein-cadre");
    for (let k = 0; k < CYCLE_EMPLACEMENTS.length; k++) {
      const e = CYCLE_EMPLACEMENTS[(etape + k) % CYCLE_EMPLACEMENTS.length];
      // Le bas n'a qu'une plaquette : la fenêtre la remplace quand elle a servi 3 fois.
      for (const x of e === "bas" ? (["bas", "fenetre"] as const) : [e]) {
        if (x === "fenetre" && curseur < FENETRE_APRES_SEC) continue;
        if (!voulus.includes(x)) voulus.push(x);
      }
    }
    // Une plaquette déjà posée autant de fois que sa fiche le permet (D14) ne revient qu'en tout dernier recours.
    const usee = (id: string) => (usages.get(id) ?? 0) >= (ficheV4(id) ? plafondParVideoV4(ficheV4(id)!, horizon) : 3);
    // Dans chaque emplacement, la moins utilisée d'abord (variété, règle H10).
    const tous = voulus.flatMap((e) => decaler(ROTATION_PLAN_MINIMAL_V4[e], graine).sort((x, y) => (usages.get(x) ?? 0) - (usages.get(y) ?? 0)));
    const ordre = [...tous.filter((id) => !usee(id)), ...tous.filter(usee)];
    const candidats = !elements.length && eviter.size ? [...ordre.filter((id) => !eviter.has(id)), ...ordre.filter((id) => eviter.has(id))] : ordre;
    let pose = false;
    for (const id of candidats) {
      if (!autorise(id)) continue;
      const fiche = ficheV4(id);
      if (!fiche) continue;
      const [min, max] = fiche.dureeSec;
      let d = Math.min(Math.max(DUREE_VISEE[id] ?? min, min), max);
      // Fin de la vidéo : la dernière plaquette prend exactement ce qui reste (sinon on laisse au moins 1,5 s à la suivante).
      if (reste <= max + 1e-9) d = reste;
      else if (reste - d < 1.5) d = Math.min(max, reste - 1.5);
      if (d < min - 1e-9) continue;
      const fin = reste <= max + 1e-9 ? horizon : r2(curseur + d);
      const f = { debut: curseur, fin };
      const c = contenu(id, f, mots);
      if (!c) continue;
      elements.push({ id, debut: f.debut, fin: f.fin, ...c });
      usages.set(id, (usages.get(id) ?? 0) + 1);
      curseur = f.fin;
      if (fiche.slot === "plein-cadre") prochainCoup = curseur + COUP_ECART_SEC;
      else etape++;
      pose = true;
      break;
    }
    if (!pose) break;
  }
  return elements;
}
