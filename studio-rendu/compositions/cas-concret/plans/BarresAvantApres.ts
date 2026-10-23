/**
 * Plan de l'objet `barres-avant-apres` (R2) : UNE barre, « avant » (longue, encre) ou « maintenant » (plus courte,
 * orange, avec rebond), qui se remplit de gauche à droite et porte son texte en affiche (vidéo de référence, plan
 * `s17`). Le type `resultat` en pose deux. Repère local : origine au coin haut-gauche de la boîte. PUR.
 */
import { enCapitales, largeurTexte, type BoitePx, type Fond } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, couleursDuFond, doux, famille, graisse, instant, progres, rebond, type ProprietesObjet } from "./commun";
import { couleursBarreForte, couleursFortes } from "./fond-fort";

export type VarianteBarre = "avant" | "maintenant";

export type ProprietesBarresAvantApres = ProprietesObjet & {
  variante?: VarianteBarre;
  /** Heure (s depuis le début de l'écran) où la barre commence à se remplir. */
  debut?: number;
  /** L3c · longueur finale en part de la boîte (barres proportionnelles) ; absente : la v4 (« avant » pleine, 520 / 900). */
  part?: number;
  /** L3c · couleurs du 3ᵉ fond terracotta ; absent : celles du fond. */
  fort?: boolean;
};

/* ------------------------------------------------------------------ */
/* L3c · barres proportionnelles aux nombres ÉCRITS dans la fiche         */
/* ------------------------------------------------------------------ */

/** Un nombre lu dans un texte de barre : sa valeur (durées en minutes) et sa sorte. */
export type NombreBarre = { valeur: number; sorte: "duree" | "pourcent" | "simple" };

/** Unités de durée reconnues juste après un nombre, en minutes (l'ordre compte : la plus longue d'abord). */
const UNITES_DUREE: readonly (readonly [RegExp, number])[] = [
  [/^\s*(?:semaines?|sem)(?![\p{L}])/iu, 7 * 24 * 60],
  [/^\s*(?:jours?|j)(?![\p{L}])/iu, 24 * 60],
  [/^\s*(?:heures?|h)(?![\p{L}])/iu, 60],
  [/^\s*(?:minutes?|mins?)(?![\p{L}])/iu, 1],
  [/^\s*(?:secondes?|sec|s)(?![\p{L}])/iu, 1 / 60],
];
/** Nombre écrit à la française : « 2 000 » (espaces, insécables comprises), « 1,5 ». */
const NOMBRE = /\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

/**
 * Le SEUL nombre d'un texte de barre (« 1 article, à la main » → 1 ; « jusqu'à 2 000 par jour » → 2000 ; « 1,5 » → 1,5 ;
 * « +1 H » → 60 min ; « 10 min » → 10 min ; « 1 h 30 » → 90 min ; « 100 % »). `null` s'il n'y en a aucun, s'il y en a
 * plusieurs, ou si l'écriture est ambiguë (« 1.5 », « 24/7 »). PUR. Le nombre est celui que la fiche écrit (R12 : il
 * vient des faits du cas) : rien n'est inventé, seule la LONGUEUR de la barre en dépend.
 */
export function lireNombreBarre(texte: string): NombreBarre | null {
  if (/\d\s*[./]\s*\d/.test(texte)) return null;
  const lus: { valeur: number; minutes: number | null; pourcent: boolean; debut: number; fin: number }[] = [];
  for (const m of texte.matchAll(NOMBRE)) {
    const debut = m.index ?? 0;
    const fin = debut + m[0].length;
    const valeur = Number(m[0].replace(/[   ]/g, "").replace(",", "."));
    const reste = texte.slice(fin);
    const unite = UNITES_DUREE.find(([re]) => re.test(reste));
    lus.push({ valeur, minutes: unite ? unite[1] : null, pourcent: /^\s*%/.test(reste), debut, fin });
  }
  // « 1 h 30 » / « 1h30 » : les minutes qui suivent directement des heures forment une seule durée.
  if (lus.length === 2 && lus[0]!.minutes === 60 && (lus[1]!.minutes === null || lus[1]!.minutes === 1) && !lus[1]!.pourcent) {
    const entre = texte.slice(lus[0]!.fin, lus[1]!.debut);
    if (/^\s*(?:h|heures?)\s*$/i.test(entre) && lus[1]!.valeur < 60) return { valeur: lus[0]!.valeur * 60 + lus[1]!.valeur, sorte: "duree" };
  }
  if (lus.length !== 1) return null;
  const n = lus[0]!;
  if (!Number.isFinite(n.valeur)) return null;
  if (n.minutes !== null) return { valeur: n.valeur * n.minutes, sorte: "duree" };
  return { valeur: n.valeur, sorte: n.pourcent ? "pourcent" : "simple" };
}

/** Plancher visible d'une barre proportionnelle (part de la pleine largeur), comme `barresProportionnelles` de la maquette. */
export const PLANCHER_BARRE = 0.03;

/**
 * Parts des deux barres (« avant », « maintenant ») proportionnelles aux nombres écrits : la plus grande = pleine
 * largeur, plancher 3 %. `null` (retour EXACT à la v4 520 / 900) s'il manque un nombre, s'il y en a plusieurs, si les
 * sortes diffèrent (une durée et un nombre simple, un pourcentage et une durée…) ou si les deux valent 0.
 */
export function partsBarres(avant: string, maintenant: string): { avant: number; maintenant: number } | null {
  const a = lireNombreBarre(avant);
  const m = lireNombreBarre(maintenant);
  if (!a || !m || a.sorte !== m.sorte) return null;
  const max = Math.max(Math.abs(a.valeur), Math.abs(m.valeur));
  if (!(max > 0)) return null;
  return { avant: Math.max(PLANCHER_BARRE, Math.abs(a.valeur) / max), maintenant: Math.max(PLANCHER_BARRE, Math.abs(m.valeur) / max) };
}

/** Longueur de la barre « maintenant » rapportée à « avant » (520 / 900 dans la référence). */
export const PART_MAINTENANT = 520 / 900;
const DUREE_AVANT_S = 0.5;
const DUREE_MAINTENANT_S = 0.4;
/** Texte de la référence : 130 px dans une barre de 190 px ; retrait 40 px. */
const TEXTE_REL = 130 / 190;
const RETRAIT_REL = 40 / 190;

export const debutBarreParDefaut = (v: VarianteBarre) => (v === "avant" ? 0.1 : 0.9);

/** Couleurs de la barre : « avant » encre sur ivoire (ivoire sur fond sombre), « maintenant » orange vif. */
export function couleursBarre(variante: VarianteBarre, fond: Fond) {
  if (variante === "maintenant") return { fond: COULEURS_DUO.orangeVif, texte: COULEURS_DUO.encre };
  return fond === "sombre" ? { fond: COULEURS_DUO.ivoire, texte: COULEURS_DUO.encre } : { fond: COULEURS_DUO.encre, texte: COULEURS_DUO.blanc };
}

export function planBarresAvantApres(p: ProprietesBarresAvantApres, image: number, fps = 25) {
  const t = instant(image, fps);
  const variante = p.variante ?? "avant";
  const debut = p.debut ?? debutBarreParDefaut(variante);
  const { largeur: w, hauteur: h } = p.boite;
  const proportionnelle = typeof p.part === "number" && Number.isFinite(p.part);
  const finale = proportionnelle ? w * c01(p.part!) : variante === "avant" ? w : w * PART_MAINTENANT;
  const x = variante === "avant" ? doux(progres(t, debut, DUREE_AVANT_S)) : rebond(progres(t, debut, DUREE_MAINTENANT_S));
  const texte = enCapitales((p.textes ?? [""])[0] ?? "");
  const retrait = h * RETRAIT_REL;
  const dispo = Math.max(1, finale - 2 * retrait);
  const taille = Math.min(h * TEXTE_REL, (h * TEXTE_REL * dispo) / Math.max(1, largeurTexte(texte, "anton", h * TEXTE_REL)));
  const c = p.fort ? couleursBarreForte(variante) : couleursBarre(variante, p.fond);
  const ombre = p.fort ? couleursFortes().ombre : couleursDuFond(p.fond).ombre;
  if (proportionnelle) {
    // L3c · la barre ne dépasse jamais sa boîte (le rebond s'arrête au bord) ; une barre trop courte pour son texte le
    // porte JUSTE APRÈS elle, dans la couleur du texte de l'écran (dessiné par le type, hors de la barre).
    const largeur = Math.min(w, Math.max(0, finale * x));
    const xDehors = finale + retrait * 0.6;
    const dispoDehors = Math.max(1, w - xDehors - retrait * 0.3);
    const tailleDehors = Math.min(h * TEXTE_REL, (h * TEXTE_REL * dispoDehors) / Math.max(1, largeurTexte(texte, "anton", h * TEXTE_REL)));
    const dehors = taille < 0.7 * h * TEXTE_REL && tailleDehors > taille;
    const couleurDehors = p.fort ? couleursFortes().texte : couleursDuFond(p.fond).texte;
    const tx = dehors
      ? { texte, taille: tailleDehors, boite: { x: xDehors, y: 0, largeur: dispoDehors, hauteur: h } as BoitePx, couleur: couleurDehors, famille: famille("anton"), graisse: graisse("anton"), tient: largeurTexte(texte, "anton", tailleDehors) <= dispoDehors + 0.01, dehors: true as const, opacite: c01((x - 0.4) * 2.5) }
      : { texte, taille, boite: { x: retrait, y: 0, largeur: dispo, hauteur: h } as BoitePx, couleur: c.texte, famille: famille("anton"), graisse: graisse("anton"), tient: largeurTexte(texte, "anton", taille) <= dispo + 0.01 };
    return { t, variante, barre: { boite: { x: 0, y: 0, largeur, hauteur: h } as BoitePx, rayon: Math.min((30 / 190) * h, finale / 2), couleur: c.fond }, debut, largeurFinale: finale, texte: tx, ombre };
  }
  return {
    t,
    variante,
    barre: { boite: { x: 0, y: 0, largeur: Math.max(0, finale * x), hauteur: h } as BoitePx, rayon: (30 / 190) * h, couleur: c.fond },
    debut,
    largeurFinale: finale,
    texte: { texte, taille, boite: { x: retrait, y: 0, largeur: dispo, hauteur: h } as BoitePx, couleur: c.texte, famille: famille("anton"), graisse: graisse("anton"), tient: largeurTexte(texte, "anton", taille) <= dispo + 0.01 },
    ombre,
  };
}
