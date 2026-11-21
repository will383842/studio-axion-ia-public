/**
 * PLANCHE « TENDANCES 2027 » (X1-17a) : une case par pièce X1 fusionnée (X1-01, 02, 03, 04, 05, 06, 11, 12, 13, 15, 16).
 * Outil local : composant pur (aucun hook, aucune horloge, aucun hasard hors `graine`). Rien n'importe ce fichier depuis
 * `src/` ni `studio-rendu/`. Aucun réglage lu : les pièces sont appelées directement. Texte en Manrope.
 * X1-08 (croquis), X1-09 (trait au feutre), X1-10 (papier découpé) : X1-17b-b, depuis les fichiers PURS de `src/` seulement
 * (jamais roughjs, perfect-freehand ni `studio-rendu/**`). X1-14 (pastille IA) : exclue.
 */
import { createElement, type CSSProperties, type JSX, type ReactNode } from "react";
import { CHARTE_AXION, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { GRAISSE_MAX, GRAISSE_MIN, graisseAuTemps } from "../../src/briques/sous-titres/poids-variable";
import { couleursMinimalDynamique, decouperMinimalDynamique, tailleTexteMinimale } from "../../src/briques/sous-titres/minimal-dynamique";
import { cheminBoiteArrondie } from "../../src/briques/sous-titres/boite-arrondie";
import type { SegmentRendu } from "../../src/briques/sous-titres/types-rendu";
import { DELAI_INCLINAISON, FenetreInclineeVue } from "../../src/briques/motion/petits-objets/fenetre-inclinee";
import { CarteVerre } from "../../src/briques/motion/habillage-commun/verre";
import { ECHELLE_PLEIN_CADRE, echelleMotDansCadre, zoomMotDansCadre } from "../../src/briques/motion/habillage-commun/transition-zoom-mot";
import { choisirRaccordForme } from "../../src/briques/motion/habillage-commun/raccord-forme";
import { barreTemps } from "../../src/briques/motion/petits-objets/barre-temps";
import { deciderBoucle, type SceneBoucle } from "../../src/briques/fins/boucle";
import { apercuDeLaFin } from "../../src/briques/composition/ouverture-apercu";
import { motCleDeRecherche } from "../../src/briques/composition/mot-cle-recherche";
import { mesurerFlashs } from "../../src/briques/composition/garde-flash";
import { FORMES_CROQUIS, planCroquis, TOILE_CROQUIS, type FormeCroquis } from "../../src/briques/motion/petits-objets/croquis";
import { traitFeutre, type GenreTraitFeutre } from "../../src/briques/motion/petits-objets/trait-feutre";
import { bordDechire, papierDecoupe, rubanAdhesif } from "../../src/briques/motion/petits-objets/papier-decoupe";
import { aleaGraine } from "../../src/briques/motion/petits-objets/graine";

export const PIECES_X1_PLANCHE = ["X1-01", "X1-02", "X1-03", "X1-04", "X1-05", "X1-06", "X1-08", "X1-09", "X1-10", "X1-11", "X1-12", "X1-13", "X1-15", "X1-16"] as const;
export type PieceX1 = (typeof PIECES_X1_PLANCHE)[number];

export const FORMATS_PLANCHE = {
  "9x16": { largeur: 1080, hauteur: 1920, colonnes: 3 },
  "4x5": { largeur: 1080, hauteur: 1350, colonnes: 4 },
  "1x1": { largeur: 1080, hauteur: 1080, colonnes: 4 },
  "16x9": { largeur: 1920, hauteur: 1080, colonnes: 6 },
} as const;
export type FormatPlanche = keyof typeof FORMATS_PLANCHE;

export interface CasePlanche {
  id: string;
  piece: PieceX1;
  titre: string;
  /** Boîte en % de la planche. */
  x: number;
  y: number;
  l: number;
  h: number;
}

const CASES_DEF: ReadonlyArray<Pick<CasePlanche, "id" | "piece" | "titre">> = [
  { id: "x1-01-a", piece: "X1-01", titre: "X1-01 · mot qui grossit (début)" },
  { id: "x1-01-b", piece: "X1-01", titre: "X1-01 · mot qui grossit (milieu)" },
  { id: "x1-01-c", piece: "X1-01", titre: "X1-01 · mot qui grossit (fin)" },
  { id: "x1-02-groupes", piece: "X1-02", titre: "X1-02 · minimal dynamique" },
  { id: "x1-02-boite", piece: "X1-02", titre: "X1-02 · boîte arrondie" },
  { id: "x1-03", piece: "X1-03", titre: "X1-03 · fenêtre inclinée" },
  { id: "x1-04-ivoire", piece: "X1-04", titre: "X1-04 · verre sur ivoire" },
  { id: "x1-04-noir", piece: "X1-04", titre: "X1-04 · verre sur noir" },
  { id: "x1-05-a", piece: "X1-05", titre: "X1-05 · zoom sur le mot (0 %)" },
  { id: "x1-05-b", piece: "X1-05", titre: "X1-05 · zoom sur le mot (50 %)" },
  { id: "x1-05-c", piece: "X1-05", titre: "X1-05 · zoom sur le mot (100 %)" },
  { id: "x1-06-a", piece: "X1-06", titre: "X1-06 · raccord de forme (départ)" },
  { id: "x1-06-b", piece: "X1-06", titre: "X1-06 · raccord de forme (milieu)" },
  { id: "x1-06-c", piece: "X1-06", titre: "X1-06 · raccord de forme (arrivée)" },
  { id: "x1-16", piece: "X1-16", titre: "X1-16 · barre de temps" },
  { id: "x1-11", piece: "X1-11", titre: "X1-11 · règle : fin en boucle" },
  { id: "x1-12", piece: "X1-12", titre: "X1-12 · règle : aperçu de la fin" },
  { id: "x1-13", piece: "X1-13", titre: "X1-13 · règle : mot-clé de recherche" },
  { id: "x1-15", piece: "X1-15", titre: "X1-15 · règle : garde flash" },
  { id: "x1-08", piece: "X1-08", titre: "X1-08 · croquis (formes de base)" },
  { id: "x1-09-entourage", piece: "X1-09", titre: "X1-09 · feutre : entourage" },
  { id: "x1-09-soulignement", piece: "X1-09", titre: "X1-09 · feutre : soulignement" },
  { id: "x1-10", piece: "X1-10", titre: "X1-10 · papier découpé et ruban" },
];

const GOUTTIERE = 1.2;

/** Cases en grille régulière, séparées par une gouttière ; aucun chevauchement possible. */
export function casesDeLaPlanche(format: FormatPlanche = "9x16"): CasePlanche[] {
  const { colonnes } = FORMATS_PLANCHE[format];
  const lignes = Math.ceil(CASES_DEF.length / colonnes);
  const l = (100 - GOUTTIERE * (colonnes + 1)) / colonnes;
  const h = (100 - GOUTTIERE * (lignes + 1)) / lignes;
  return CASES_DEF.map((c, i) => ({
    ...c,
    x: GOUTTIERE + (i % colonnes) * (l + GOUTTIERE),
    y: GOUTTIERE + Math.floor(i / colonnes) * (h + GOUTTIERE),
    l,
    h,
  }));
}

const FPS = 25;
/** X1-03 : image montrée = juste après l'arrivée du contenu, fenêtre encore inclinée (DELAI_INCLINAISON) ET remplie. */
const IMAGE_X103 = Math.round((DELAI_INCLINAISON + 0.1) * FPS);
const fonds: Record<FondAxion, { fond: string; encre: string }> = {
  ivoire: { fond: CHARTE_AXION.ivoire, encre: CHARTE_AXION.noir },
  noir: { fond: CHARTE_AXION.noir, encre: CHARTE_AXION.ivoire },
};
const texte = (px: number, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: FAMILLE_CSS_AXION, fontSize: px, color: CHARTE_AXION.noir, ...extra });

/** X1-05 : mot de démonstration, taille et largeur estimée (0,62 em par lettre en Manrope gras) ; marge de chaque côté du cadre de la case. */
const MOT_X105 = "devis";
const TAILLE_MOT_X105 = 40;
const MARGE_X105 = 8;
const REMPLISSAGE_CASE = 16;
/** Largeurs en px du mot (échelle 1) et du cadre (la case moins son remplissage) : le mot grossi doit tenir dans `largeurCadre - 2 * marge`. */
export function geometrieMotX105(format: FormatPlanche = "9x16"): { largeurMot: number; largeurCadre: number; marge: number } {
  const c = casesDeLaPlanche(format)[0];
  return { largeurMot: MOT_X105.length * TAILLE_MOT_X105 * 0.62, largeurCadre: (FORMATS_PLANCHE[format].largeur * c.l) / 100 - REMPLISSAGE_CASE, marge: MARGE_X105 };
}

const PLAN_FLASH = {
  dureeMs: 6000,
  scenes: [0, 400, 800, 1200, 1600].map((d) => ({ debutMs: d + 1000, finMs: d + 1400, transition: { entree: "flash-ivoire", sortie: "coupe", dureeMs: 100 } })),
} as unknown as Parameters<typeof mesurerFlashs>[0];
const PLAN_APERCU = {
  facecam: false,
  scenes: [
    { id: "s1", piece: "titre", debutMs: 0, finMs: 3000, position: "centre" },
    { id: "s2", piece: "tableau-de-bord", debutMs: 5000, finMs: 9000, position: "centre" },
  ],
} as unknown as Parameters<typeof apercuDeLaFin>[0];
const SCENES_BOUCLE: SceneBoucle[] = [
  { type: "motion", debutMs: 0, finMs: 4000, fond: "ivoire", etatEntree: "titre" },
  { type: "tableau", debutMs: 4000, finMs: 9000, fond: "ivoire", etatEntree: "tableau" },
];
const MOTS_DEMO = [
  { texte: "Voici", debutMs: 0, finMs: 300 },
  { texte: "comment", debutMs: 300, finMs: 700 },
  { texte: "relancer", debutMs: 700, finMs: 1200 },
  { texte: "devis", debutMs: 1200, finMs: 1700 },
];

/** Phrase de démonstration figée : mots minutés 0,4 s chacun, « relancer » seul en valeur. */
const SEGMENT_MINIMAL: SegmentRendu = {
  id: "demo-minimal",
  debutSec: 0,
  finSec: 2.8,
  mots: ["Vous", "pouvez", "relancer", "ce", "devis", "dès", "demain"].map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4, ...(mot === "relancer" ? { enValeur: true } : {}) })),
};

function Lignes({ lignes }: { lignes: string[] }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...texte(18) }}>
      {lignes.map((s) => (
        <div key={s}>{s}</div>
      ))}
    </div>
  );
}

const pts = (points: ReadonlyArray<readonly [number, number]>): string => points.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(" ");
const ZONE_BASSE = { x: 10, y: 72, largeur: 80, hauteur: 20 };

/** Forme géométrique de base du croquis (le tracé à la main est fait au rendu) : points légèrement déplacés, uniquement par la graine. */
function pointsCroquis(forme: FormeCroquis, graine: number): string[] {
  const plan = planCroquis(forme, { x: 10, y: 10, largeur: 80, hauteur: 80 }, "neutre", "ivoire", graine);
  if (!plan) return [];
  return plan.traits.map((t, i) => {
    const [a, b, c, d] = t.nombres;
    const bouge = (v: number, k: number): number => v + (aleaGraine(t.seed, k) - 0.5) * 16;
    let base: [number, number][];
    if (t.genre === "rectangle") base = [[a, b], [a + c, b], [a + c, b + d], [a, b + d], [a, b]];
    else if (t.genre === "ellipse") base = Array.from({ length: 33 }, (_, k) => [a + (Math.cos((k / 32) * 2 * Math.PI) * c) / 2, b + (Math.sin((k / 32) * 2 * Math.PI) * d) / 2] as [number, number]);
    else base = [[a, b], [c, d]];
    return pts(base.map(([x, y], k) => [bouge(x, i * 100 + k * 2), bouge(y, i * 100 + k * 2 + 1)] as [number, number]));
  });
}

function ContenuCase(c: CasePlanche, graine: number, format: FormatPlanche = "9x16"): ReactNode {
  switch (c.id) {
    case "x1-01-a":
    case "x1-01-b":
    case "x1-01-c": {
      const t = c.id.endsWith("a") ? 0 : c.id.endsWith("b") ? 0.5 : 1;
      const g = graisseAuTemps(t, 0, 1);
      return <div style={texte(64, { fontWeight: g, textAlign: "center" })}>relancer<div style={texte(16, { fontWeight: 400 })}>graisse {g} ({GRAISSE_MIN}→{GRAISSE_MAX})</div></div>;
    }
    case "x1-02-groupes": {
      const groupes = decouperMinimalDynamique([SEGMENT_MINIMAL]);
      const { fond, texte: encreMarque } = couleursMinimalDynamique();
      const taille = Math.max(tailleTexteMinimale((FORMATS_PLANCHE[format].hauteur * c.h) / 100), 22);
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {groupes.map((g) => (
            <div key={g.id} data-groupe={g.mots.map((m) => m.mot).join(" ")} style={texte(taille, { fontWeight: 700, display: "flex", gap: "0.3em" })}>
              {g.mots.map((m, i) => (i === g.marque ? <span key={m.debutSec} style={{ background: fond, color: encreMarque, padding: "0 0.2em", borderRadius: 6 }}>{m.mot}</span> : <span key={m.debutSec}>{m.mot}</span>))}
            </div>
          ))}
        </div>
      );
    }
    case "x1-02-boite": {
      const mots = decouperMinimalDynamique([SEGMENT_MINIMAL])[0].mots.map((m) => m.mot);
      const largeurs = [300, 500, 200];
      const lignes = largeurs.map((largeur, i) => ({ x: (500 - largeur) / 2, y: i * 60, largeur, hauteur: 44 }));
      return (
        <svg viewBox="-30 -30 560 240" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d={cheminBoiteArrondie(lignes, { rayon: 18, marge: 10 })} fill={CHARTE_AXION.noir} />
          {mots.slice(0, 3).map((mot, i) => (
            <text key={mot} x={250} y={i * 60 + 32} textAnchor="middle" fontSize={30} fontWeight={700} fontFamily={FAMILLE_CSS_AXION} fill={CHARTE_AXION.ivoire}>{mot}</text>
          ))}
        </svg>
      );
    }
    case "x1-03":
      return createElement(FenetreInclineeVue, { image: IMAGE_X103, fps: FPS, dureeImages: 100, fond: "ivoire", graine, parametres: { largeur: 70, hauteur: 60, titre: "Mon espace" } });
    case "x1-04-ivoire":
    case "x1-04-noir": {
      const fond: FondAxion = c.id.endsWith("noir") ? "noir" : "ivoire";
      return (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${CHARTE_AXION.terracotta} 50%, ${CHARTE_AXION.gris} 50%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CarteVerre fond={fond} style={{ padding: 24, ...texte(24, { color: fonds[fond].encre }) }}>Carte en verre</CarteVerre>
        </div>
      );
    }
    case "x1-05-a":
    case "x1-05-b":
    case "x1-05-c": {
      const t = c.id.endsWith("a") ? 0 : c.id.endsWith("b") ? 0.5 : 1;
      const g = geometrieMotX105(format);
      const brut = zoomMotDansCadre({ visageAvant: false, visageApres: false }, t, g);
      // La planche n'ouvre pas la scène suivante (qui recouvre le mot en fin de zoom) : le mot reste donc entier dans sa case à tout instant.
      const e = brut && { ...brut, echelleMot: Math.min(brut.echelleMot, echelleMotDansCadre(g.largeurMot, g.largeurCadre, g.marge)) };
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: CHARTE_AXION.ivoire }}>
          <div data-echelle-mot={e?.echelleMot ?? 1} data-opacite-mot={e?.opaciteMot ?? 1} style={texte(TAILLE_MOT_X105, { fontWeight: 800, transform: `scale(${e?.echelleMot ?? 1})`, opacity: e?.opaciteMot ?? 1 })}>{MOT_X105}</div>
          <div style={{ position: "absolute", left: 8, bottom: 6, ...texte(14) }}>échelle {Math.round((e?.echelleMot ?? 1) * 100) / 100} / {ECHELLE_PLEIN_CADRE}</div>
        </div>
      );
    }
    case "x1-06-a":
    case "x1-06-b":
    case "x1-06-c": {
      const r = choisirRaccordForme({ de: "carre", vers: "carte", avecVisage: false, boite: { largeur: 100, hauteur: 100 } });
      const chemin = r ? (c.id.endsWith("a") ? r.cheminDe : c.id.endsWith("c") ? r.cheminVers : null) : null;
      return (
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {chemin ? <path d={chemin} fill={r?.couleur} /> : <g><path d={r?.cheminDe} fill={r?.couleur} opacity={0.5} /><path d={r?.cheminVers} fill={r?.couleur} opacity={0.5} /></g>}
        </svg>
      );
    }
    case "x1-16": {
      const b = barreTemps({ image: 60, dureeImages: 100, zone: { haut: 8, droite: 10, bas: 15, gauche: 5 }, fond: "ivoire" });
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <div data-rail={`${b.rail.boite.x} ${b.rail.boite.y} ${b.rail.boite.largeur} ${b.rail.boite.hauteur}`} style={{ position: "absolute", left: `${b.rail.boite.x}%`, top: `${b.rail.boite.y}%`, width: `${b.rail.boite.largeur}%`, height: `${Math.max(b.rail.boite.hauteur, 1.5)}%`, background: b.rail.couleur }} />
          <div data-barre={`${b.boite.x} ${b.boite.y} ${b.boite.largeur} ${b.boite.hauteur}`} style={{ position: "absolute", left: `${b.boite.x}%`, top: `${b.boite.y}%`, width: `${b.boite.largeur}%`, height: `${Math.max(b.boite.hauteur, 1.5)}%`, background: b.couleur }} />
          <div style={{ position: "absolute", left: 8, top: 6, ...texte(14) }}>progression {Math.round(b.progression * 100)} %</div>
        </div>
      );
    }
    case "x1-11": {
      const d = deciderBoucle(SCENES_BOUCLE);
      return <Lignes lignes={["Entrée : 2 scènes sans visage, même fond.", d.boucle ? `Décision : boucle, état final « ${d.raccord.etatFinal} »` : `Décision : pas de boucle (${d.raison})`]} />;
    }
    case "x1-12": {
      const a = apercuDeLaFin(PLAN_APERCU, "tutoriel-outil");
      return <Lignes lignes={["Entrée : tutoriel, résultat à 5 s.", a.type === "apercu" ? `Décision : aperçu de ${a.sceneId}, ${a.debutMs}–${a.finMs} ms` : "Décision : aucun aperçu"]} />;
    }
    case "x1-13": {
      const m = motCleDeRecherche(MOTS_DEMO, "relancer un devis");
      return <Lignes lignes={["Entrée : « Voici comment relancer devis », sujet « relancer un devis ».", m.type === "mot" ? `Décision : mot-clé « ${m.texte} » à ${m.debutMs} ms` : "Décision : aucun mot-clé"]} />;
    }
    case "x1-08":
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <svg viewBox={`0 0 ${TOILE_CROQUIS * 2} ${TOILE_CROQUIS * 2}`} style={{ position: "absolute", inset: 0, width: "100%", height: "90%" }}>
            {FORMES_CROQUIS.map((forme, i) => (
              <g key={forme} transform={`translate(${(i % 2) * TOILE_CROQUIS} ${Math.floor(i / 2) * TOILE_CROQUIS})`}>
                {pointsCroquis(forme, graine + i).map((p, k) => (
                  <polyline key={k} points={p} fill="none" stroke={CHARTE_AXION.noir} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </g>
            ))}
          </svg>
          <div style={{ position: "absolute", left: 8, bottom: 4, ...texte(14) }}>tracé à la main au rendu</div>
        </div>
      );
    case "x1-09-entourage":
    case "x1-09-soulignement": {
      const genre: GenreTraitFeutre = c.id.endsWith("entourage") ? "entourage" : "soulignement";
      const t = traitFeutre({ genre, graine, zone: ZONE_BASSE });
      const z = ZONE_BASSE;
      return (
        <svg viewBox={`${z.x - 3} ${z.y - 3} ${z.largeur + 6} ${z.hauteur + 6}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {t ? <polyline points={pts(t.points)} fill="none" stroke={CHARTE_AXION.terracotta} strokeWidth={t.epaisseur / 10} strokeLinecap="round" strokeLinejoin="round" /> : null}
          <text x={z.x + z.largeur / 2} y={z.y + z.hauteur / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FAMILLE_CSS_AXION} fill={CHARTE_AXION.noir}>relancer</text>
        </svg>
      );
    }
    case "x1-10": {
      const z = ZONE_BASSE;
      const p = papierDecoupe({ graine, zone: z, points: 24 });
      const ruban = rubanAdhesif(z);
      const bord = bordDechire(graine, 24);
      const haut = bord.map((d, i) => [z.x + (i / (bord.length - 1)) * z.largeur, z.y + (d * z.largeur) / 100] as [number, number]);
      const bas = [...bord].reverse().map((d, i) => [z.x + (1 - i / (bord.length - 1)) * z.largeur, z.y + z.hauteur + (d * z.largeur) / 100] as [number, number]);
      return (
        <svg viewBox={`${z.x - 4} ${z.y - 6} ${z.largeur + 8} ${z.hauteur + 12}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {p ? <polygon points={pts([...haut, ...bas])} fill={p.couleur} stroke={CHARTE_AXION.noir} strokeWidth={0.4} /> : null}
          <rect x={ruban.boite.x} y={ruban.boite.y} width={ruban.boite.largeur} height={ruban.boite.hauteur} fill={CHARTE_AXION.terracotta} opacity={ruban.opacite} />
          <text x={z.x + z.largeur / 2} y={z.y + z.hauteur / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FAMILLE_CSS_AXION} fill={CHARTE_AXION.noir}>devis</text>
        </svg>
      );
    }
    default: {
      const f = mesurerFlashs(PLAN_FLASH);
      return <Lignes lignes={["Entrée : 5 flashs rapprochés.", `Décision : ${f.flashs} flashs, ${f.maxParSeconde} par seconde`, ...f.reserves]} />;
    }
  }
}

export function PlancheTendances2027({ format = "9x16", graine = 1 }: { format?: FormatPlanche; graine?: number }): JSX.Element {
  const { largeur, hauteur } = FORMATS_PLANCHE[format];
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, background: CHARTE_AXION.gris, overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      {casesDeLaPlanche(format).map((c) => (
        <div key={c.id} data-case={c.id} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.l}%`, height: `${c.h}%`, background: CHARTE_AXION.ivoire, overflow: "hidden", boxSizing: "border-box" }}>
          <div style={{ position: "absolute", left: 8, top: 4, ...texte(14, { fontWeight: 700, zIndex: 1 }) }}>{c.titre}</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 28, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
            <div style={{ position: "relative", width: "100%", height: "100%" }}>{ContenuCase(c, graine, format)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
