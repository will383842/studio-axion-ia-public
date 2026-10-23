/**
 * IMAGE → VIDÉO · SOUS-TITRES VARIÉS (décision de Will du 15/10 : du peps au lieu du style fixe). PUR, déterministe.
 *
 * Le MÉLANGE est celui de la brique commune (`briques/sous-titres/melange.ts`, catalogue du 01/10), appelé tel quel,
 * à l'intensité par défaut du studio (« Équilibré ») : base = la charte duo (gabarit Minimal, ivoire sur sombre,
 * encre #15100c sur ivoire, mot fort orange), accents Impact et Bandeau, que la brique pose de préférence sur les
 * chiffres, les mots forts, l'accroche, et jamais deux de suite. Ce fichier n'ajoute AUCUNE règle de mélange ; il dit
 * seulement au mélange ce que le format sait (coupes de plan, mots de l'accroche et de la phrase-choc), puis ADAPTE le
 * résultat à la bande unique du format :
 *  - chaque accent reste au centre de la bande (`milieu`) : jamais déplacé en haut ou en bas de l'image ;
 *  - chaque accent est MESURÉ avec le moteur de rendu unique (`elementDe` : taille, inclinaison, rebond, glissement
 *    d'entrée, bandeau) ; s'il sort de la bande `BANDE_SOUS_TITRES_IV`, il est redressé, puis réduit (Impact ×1,3),
 *    puis rendu à la base : une variation ne sort JAMAIS de la bande ni ne touche la zone utile du contenu ;
 *  - aucun accent pendant la question à commenter (elle reste dans le style de base, le plus lisible) ;
 *  - aucun bandeau sur un écran ivoire (bandeau ivoire sur ivoire : il ne se verrait pas).
 * Q22 (`controlerVariationsIV`) refait la même mesure groupe par groupe, à chaque instant d'entrée.
 */
import { donneesCalque, elementDe, largeurElement, melanger, type DonneesCalque, type ElementDessine } from "@/briques/sous-titres";
import { BANDE_SOUS_TITRES_IV, formatDeHauteurIV, MISE_EN_PAGE_IV, ZONE_UTILE_IV } from "@/briques/schema-motion/types";
import type { IntensiteSousTitres, SegmentSousTitres } from "@/domaine/types";
import { ENCRE_SOUS_TITRES_IVOIRE, LARGEUR_SOUS_TITRES_PCT, STYLE_SOUS_TITRES_DUO } from "./emprunts";
import { chiffresDitsDe, type LigneDeTempsIV } from "./mise-en-scene";

/** Intensité du mélange : celle par défaut du studio et des autres formats (SOU-B, la référence). */
export const INTENSITE_SOUS_TITRES_IV: IntensiteSousTitres = "equilibre";

/**
 * Intensité d'une version : SOU-C (sous-titres appuyés, variété) → « Très dynamique » de la brique ; SOU-B, SOU-A
 * (retirée, jamais tirée) ou sans recette → l'intensité par défaut, inchangée.
 */
export function intensiteSousTitresIV(ligne: Pick<LigneDeTempsIV, "variete">): IntensiteSousTitres {
  return ligne.variete?.recette.sousTitres === "SOU-C" ? "tres-dynamique" : INTENSITE_SOUS_TITRES_IV;
}

/** Centre de la bande, en % de la hauteur (seule source : `BANDE_SOUS_TITRES_IV`). */
const CENTRE_PCT = +(((BANDE_SOUS_TITRES_IV.haut + BANDE_SOUS_TITRES_IV.bas) / 2) * 100).toFixed(2);

/** Style de la charte duo posé dans la bande : celui que reçoit la composition (`commandeDuMontageIV`). */
export const STYLE_SOUS_TITRES_IV = Object.freeze({ ...STYLE_SOUS_TITRES_DUO, positionPct: CENTRE_PCT, largeurMaxPct: LARGEUR_SOUS_TITRES_PCT });

type LigneSousTitres = Pick<LigneDeTempsIV, "sousTitres" | "plans" | "dureeSec" | "hauteur" | "chiffresDits" | "variete"> & Partial<Pick<LigneDeTempsIV, "blocs">>;

const estAccent = (s: SegmentSousTitres) => s.style === "impact" || s.style === "bandeau";
const pendant = (s: Pick<SegmentSousTitres, "debutSec" | "finSec">, p: { debut: number; fin: number }) => s.debutSec < p.fin - 1e-6 && s.finSec > p.debut + 1e-6;

/** Sous-titres de la ligne de temps → segments (mot fort = mot « en valeur », orange), sans style. */
export function segmentsDeBaseIV(ligne: Pick<LigneDeTempsIV, "sousTitres">): SegmentSousTitres[] {
  return ligne.sousTitres.groupes.map((g) => ({ id: g.id, debutSec: g.debutSec, finSec: g.finSec, mots: g.mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec, ...(m.orange ? { enValeur: true } : {}) })) }));
}

type BlocLu = NonNullable<LigneDeTempsIV["blocs"]>[number];

/** Fond de la PREMIÈRE image d'une ouverture, tel que la composition la dessine (OUV-A en 4:5 : ivoire). */
const FOND_OUVERTURE: Record<string, "ivoire" | "sombre"> = { "OUV-A": "sombre", "OUV-B": "sombre", "OUV-C": "sombre", "OUV-D": "ivoire", "OUV-E": "ivoire" };

/**
 * Fond que DESSINE un bloc de variété (intégration, défaut vu à l'œil : sous-titres pâles sur ivoire, encre sur nuit) :
 * l'écran de variété remplace celui du plan et peut changer de fond (OUV-A nuit sur un plan ivoire, FIN-C ou CHI-C ivoire
 * sur un plan sombre). `null` : le fond du plan (bloc qui n'est pas un écran de variété).
 */
export function fondDessineIV(b: BlocLu, hauteur = 1920): "ivoire" | "sombre" | null {
  if (b.sorte !== "variete") return null;
  const d = (b.donnees ?? {}) as { fond?: string; boucle?: { code?: string } };
  const ouverture = (code: string) => (code === "OUV-A" && formatDeHauteurIV(hauteur) === "4:5" ? "ivoire" : (FOND_OUVERTURE[code] ?? null));
  switch (b.axe) {
    case "ouverture":
      return ouverture(b.code);
    case "fin":
      return b.code === "FIN-C" ? ouverture(d.boucle?.code ?? "") : "sombre";
    case "camera":
      return "ivoire";
    case "chiffres":
    case "texte":
      return d.fond === "ivoire" || d.fond === "sombre" ? d.fond : null;
  }
  return null;
}

/**
 * Passages sur fond ivoire : sous-titres à l'encre sombre de la v4 (comme le cas concret). Le fond est celui du plan,
 * sauf pendant un écran de variété, où c'est celui qu'il dessine (`fondDessineIV`) ; l'ouverture avant / après (OUV-B)
 * pose une bande NUIT sous les sous-titres : ils y gardent leur style clair.
 */
export function passagesIvoireIV(ligne: Pick<LigneDeTempsIV, "plans"> & Partial<Pick<LigneDeTempsIV, "blocs" | "hauteur">>): { debutSec: number; finSec: number; texte: string }[] {
  const varies = (ligne.blocs ?? []).flatMap((b) => {
    const fond = fondDessineIV(b, ligne.hauteur);
    return fond ? [{ debut: b.debut, fin: b.fin, fond }] : [];
  });
  let morceaux = ligne.plans.filter((p) => p.fond === "ivoire" && p.fin > p.debut).map((p) => ({ debut: p.debut, fin: p.fin }));
  for (const n of varies) morceaux = morceaux.flatMap((m) => [{ debut: m.debut, fin: Math.min(m.fin, n.debut) }, { debut: Math.max(m.debut, n.fin), fin: m.fin }]).filter((m) => m.fin > m.debut + 1e-6);
  morceaux.push(...varies.filter((v) => v.fond === "ivoire").map((v) => ({ debut: v.debut, fin: v.fin })));
  morceaux.sort((a, b) => a.debut - b.debut);
  return morceaux.map((m) => ({ debutSec: m.debut, finSec: m.fin, texte: ENCRE_SOUS_TITRES_IVOIRE }));
}

/** Calque de mesure : celui que la composition dessine (charte duo, bande du format, 9:16, écrans ivoire). */
function calqueIV(segments: SegmentSousTitres[], ligne: Pick<LigneDeTempsIV, "plans" | "hauteur"> & Partial<Pick<LigneDeTempsIV, "blocs">>): DonneesCalque {
  // 4:5 (lot F45) : le calque du ratio 4:5, centré dans la bande du 4:5 ; le 9:16 est inchangé.
  const format = formatDeHauteurIV(ligne.hauteur);
  const b = MISE_EN_PAGE_IV[format].bandeSousTitres;
  const style = format === "4:5" ? { ...STYLE_SOUS_TITRES_IV, positionPct: +(((b.haut + b.bas) / 2) * 100).toFixed(2) } : STYLE_SOUS_TITRES_IV;
  const d = donneesCalque({ segments, base: "minimal", ratio: format, style });
  const clairs = passagesIvoireIV(ligne);
  return clairs.length ? { ...d, passagesClairs: clairs } : d;
}

/** Emprise verticale d'un élément dessiné (px) : ligne (ou bandeau), contour, rebond, inclinaison, glissement. */
export function empriseVerticale(el: ElementDessine): { hautPx: number; basPx: number; largeurPx: number } {
  const contour = el.clair ? 0 : el.gabarit.contourPx;
  const l = (largeurElement(el) + contour) * el.echelle;
  const h = ((el.fond ? el.taillePx + 2 * el.fond.margeYPx : el.taillePx * 1.1) + contour) * el.echelle;
  const a = (Math.abs(el.rotationDeg) * Math.PI) / 180;
  const demi = (l * Math.sin(a) + h * Math.cos(a)) / 2;
  const centre = el.yPx + el.decalageYPx;
  return { hautPx: centre - demi, basPx: centre + demi, largeurPx: l };
}

/** Instants où l'accent bouge le plus : entrée (glissement), sommet du rebond, fin de l'entrée, fin du groupe. */
const instantsDe = (s: SegmentSousTitres) => [s.debutSec, s.debutSec + 0.06, s.debutSec + 0.12, s.debutSec + 0.24, s.finSec - 1e-3].filter((t) => t >= s.debutSec && t < s.finSec);

/** Défauts d'un groupe dans la bande (vide = il y tient à chaque instant). */
function defautsGroupe(d: DonneesCalque, s: SegmentSousTitres, hauteur: number): string[] {
  const m = MISE_EN_PAGE_IV[formatDeHauteurIV(hauteur)];
  const haut = (m.format === "9:16" ? BANDE_SOUS_TITRES_IV : m.bandeSousTitres).haut * hauteur;
  const bas = (m.format === "9:16" ? BANDE_SOUS_TITRES_IV : m.bandeSousTitres).bas * hauteur;
  const utile = (m.format === "9:16" ? ZONE_UTILE_IV : m.zoneUtile).bas * hauteur;
  const defauts = new Set<string>();
  for (const t of instantsDe(s)) {
    const e = empriseVerticale(elementDe(d, s, t));
    if (e.hautPx < utile - 0.5) defauts.add("touche la zone utile du contenu");
    else if (e.hautPx < haut - 0.5) defauts.add("monte au-dessus de la bande");
    if (e.basPx > bas + 0.5) defauts.add("descend sous la bande");
    if (e.largeurPx > d.largeurMaxPx + 1) defauts.add("dépasse la largeur permise");
  }
  return [...defauts];
}

/** Essais d'un accent, du plus vif au plus sage : tel quel, redressé, puis Impact réduit (×1,3) et redressé. */
function essais(s: SegmentSousTitres): SegmentSousTitres[] {
  const droit = { ...s, inclinaison: 0 };
  return s.style === "impact" ? [s, droit, { ...droit, importance: 2 }] : [s, droit];
}

/**
 * Sous-titres variés d'une version (PUR) : le mélange de la brique, adapté à la bande du format (voir l'en-tête). Le
 * même résultat est envoyé à la composition et contrôlé par Q22.
 */
export function sousTitresVariesIV(ligne: LigneSousTitres): SegmentSousTitres[] {
  const base = segmentsDeBaseIV(ligne);
  const mots = base.flatMap((s) => s.mots);
  // Chiffres de la carte DITS en lettres (« quatre-vingts pour cent », « trois heures ») : la brique ne reconnaît que les
  // chiffres écrits ; le format lui signale leurs mots comme mots en valeur, le temps du mélange (lecture :
  // `chiffresDitsDe`, clés de `chiffresDits` — jamais un « un » de « un client »).
  const cles = new Set(ligne.chiffresDits.map((c) => c.cle));
  const chiffres = new Set(
    chiffresDitsDe(mots.map((m) => m.mot))
      .filter((c) => cles.has(c.cle))
      .flatMap((c) => Array.from({ length: c.dernier - c.rang + 1 }, (_, k) => c.rang + k)),
  );
  // Moments forts du format : les mots de l'accroche et de la phrase-choc portent le sens (mots « ancres » du mélange).
  const forts = ligne.plans.filter((p) => p.scene === "accroche" || p.scene === "phrase-choc");
  const ancres = mots.flatMap((m, k) => (forts.some((p) => m.debutSec >= p.debut - 1e-6 && m.debutSec < p.fin) ? [k] : []));
  let rang = 0;
  const signales = base.map((s) => ({ ...s, mots: s.mots.map((m) => (chiffres.has(rang++) ? { ...m, enValeur: true } : m)) }));
  const coupesSec = [...new Set(ligne.plans.map((p) => p.debut).filter((t) => t > 0))];
  const ctx = { intensite: intensiteSousTitresIV(ligne), coupesSec, ancres, dureeSec: ligne.dureeSec };

  // Contraintes du format = groupes VERROUILLÉS en base (la brique ne les réécrit jamais et place ses accents ailleurs) :
  // la question à commenter d'abord, puis chaque accent qui ne tient pas dans la bande ; le mélange est alors refait.
  // Ouverture de variété en 9:16 (intégration, défaut vu à l'œil : SOU-C « VINGT E-MAILS » en contour, illisible sur
  // l'appoint de l'ouverture) : ses objets d'appoint sont juste sous la bande ; un accent (contour, bandeau) s'y mêle.
  const ouvertures = formatDeHauteurIV(ligne.hauteur) === "9:16" ? (ligne.blocs ?? []).filter((b) => b.sorte === "variete" && b.axe === "ouverture").map((b) => ({ debut: b.debut, fin: b.fin })) : [];
  const verrous = new Set(base.flatMap((s, i) => (ligne.plans.some((p) => p.scene === "question" && pendant(s, p)) || ouvertures.some((o) => pendant(s, o)) ? [i] : [])));
  const ivoires = passagesIvoireIV(ligne).map((p) => ({ debut: p.debutSec, fin: p.finSec }));
  const enBase = (s: SegmentSousTitres, i: number): SegmentSousTitres => ({ ...s, mots: base[i].mots, style: "base", position: "auto", inclinaison: 0, importance: Math.min(2, s.importance ?? 0), souligne: s.style === "base" ? s.souligne : null, verrouille: false });
  for (let tour = 0; tour <= base.length; tour++) {
    const entree = signales.map((s, i) => (verrous.has(i) ? { ...s, style: "base" as const, position: "auto" as const, inclinaison: 0, souligne: null, verrouille: true } : s));
    const sortie = melanger(entree, ctx).map((s, i) => (estAccent(s) ? { ...s, position: "milieu" as const } : enBase(s, i)));
    let rate = -1;
    for (let i = 0; i < sortie.length && rate < 0; i++) {
      if (!estAccent(sortie[i])) continue;
      // Bandeau ivoire sur un écran ivoire : il ne se verrait pas.
      const essai = sortie[i].style === "bandeau" && ivoires.some((p) => pendant(sortie[i], p)) ? undefined : essais(sortie[i]).find((x) => defautsGroupe(calqueIV(sortie.map((y, k) => (k === i ? x : y)), ligne), x, ligne.hauteur).length === 0);
      if (essai) sortie[i] = { ...essai, verrouille: false };
      else rate = i;
    }
    if (rate < 0) return sortie;
    verrous.add(rate);
  }
  return base;
}

/** Nom lisible d'un style (phrases de Q22). */
const NOMS = { impact: "Impact", bandeau: "Bandeau", base: "base" } as const;

/**
 * Q22 · chaque groupe de sous-titres (accent ou base) MESURÉ dans la bande à chaque instant d'entrée ; jamais deux
 * accents collés ; aucun accent pendant la question à commenter. Une phrase par défaut, sans identifiant (vide =
 * conforme).
 */
export function controlerVariationsIV(segments: readonly SegmentSousTitres[], ligne: Pick<LigneDeTempsIV, "plans" | "hauteur"> & Partial<Pick<LigneDeTempsIV, "blocs">>): string[] {
  const d = calqueIV([...segments], ligne);
  const defauts: string[] = [];
  const texte = (s: SegmentSousTitres) => `« ${s.mots.map((m) => m.mot).join(" ")} »`;
  segments.forEach((s, i) => {
    const style = NOMS[s.style ?? "base"];
    for (const x of defautsGroupe(d, s, ligne.hauteur)) defauts.push(`le sous-titre ${texte(s)} (${style}) ${x}.`);
    if (estAccent(s) && segments[i + 1] && estAccent(segments[i + 1])) defauts.push(`deux variations collées : ${texte(s)} puis ${texte(segments[i + 1])}.`);
    if (estAccent(s) && ligne.plans.some((p) => p.scene === "question" && pendant(s, p))) defauts.push(`une variation (${style}) tombe sur la question à commenter : ${texte(s)}.`);
  });
  return defauts;
}
