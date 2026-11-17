/**
 * PLANCHE « TENDANCES 2027 » (X1-17a) : une case par pièce X1 fusionnée (X1-01, 03, 04, 05, 06, 11, 12, 13, 15, 16).
 * Outil local : composant pur (aucun hook, aucune horloge, aucun hasard hors `graine`). Rien n'importe ce fichier depuis
 * `src/` ni `studio-rendu/`. Aucun réglage lu : les pièces sont appelées directement. Texte en Manrope.
 * X1-14 (pastille IA) et X1-02, 08, 09, 10 : X1-17b.
 */
import { createElement, type CSSProperties, type JSX, type ReactNode } from "react";
import { CHARTE_AXION, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { GRAISSE_MAX, GRAISSE_MIN, graisseAuTemps } from "../../src/briques/sous-titres/poids-variable";
import { FenetreInclineeVue } from "../../src/briques/motion/petits-objets/fenetre-inclinee";
import { CarteVerre } from "../../src/briques/motion/habillage-commun/verre";
import { ECHELLE_PLEIN_CADRE, zoomMot } from "../../src/briques/motion/habillage-commun/transition-zoom-mot";
import { choisirRaccordForme } from "../../src/briques/motion/habillage-commun/raccord-forme";
import { barreTemps } from "../../src/briques/motion/petits-objets/barre-temps";
import { deciderBoucle, type SceneBoucle } from "../../src/briques/fins/boucle";
import { apercuDeLaFin } from "../../src/briques/composition/ouverture-apercu";
import { motCleDeRecherche } from "../../src/briques/composition/mot-cle-recherche";
import { mesurerFlashs } from "../../src/briques/composition/garde-flash";

export const PIECES_X1_PLANCHE = ["X1-01", "X1-03", "X1-04", "X1-05", "X1-06", "X1-11", "X1-12", "X1-13", "X1-15", "X1-16"] as const;
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
const fonds: Record<FondAxion, { fond: string; encre: string }> = {
  ivoire: { fond: CHARTE_AXION.ivoire, encre: CHARTE_AXION.noir },
  noir: { fond: CHARTE_AXION.noir, encre: CHARTE_AXION.ivoire },
};
const texte = (px: number, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: FAMILLE_CSS_AXION, fontSize: px, color: CHARTE_AXION.noir, ...extra });

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

function Lignes({ lignes }: { lignes: string[] }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...texte(18) }}>
      {lignes.map((s) => (
        <div key={s}>{s}</div>
      ))}
    </div>
  );
}

function ContenuCase(c: CasePlanche, graine: number): ReactNode {
  switch (c.id) {
    case "x1-01-a":
    case "x1-01-b":
    case "x1-01-c": {
      const t = c.id.endsWith("a") ? 0 : c.id.endsWith("b") ? 0.5 : 1;
      const g = graisseAuTemps(t, 0, 1);
      return <div style={texte(64, { fontWeight: g, textAlign: "center" })}>relancer<div style={texte(16, { fontWeight: 400 })}>graisse {g} ({GRAISSE_MIN}→{GRAISSE_MAX})</div></div>;
    }
    case "x1-03":
      return createElement(FenetreInclineeVue, { image: 4, fps: FPS, dureeImages: 100, fond: "ivoire", graine, parametres: { largeur: 70, hauteur: 60, titre: "Mon espace" } });
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
      const e = zoomMot({ visageAvant: false, visageApres: false }, t);
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: CHARTE_AXION.ivoire }}>
          <div style={texte(40, { fontWeight: 800, transform: `scale(${e?.echelleMot ?? 1})`, opacity: e?.opaciteMot ?? 1 })}>devis</div>
          <div style={{ position: "absolute", left: 8, bottom: 6, ...texte(14) }}>échelle {e?.echelleMot} / {ECHELLE_PLEIN_CADRE}</div>
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
          <div style={{ position: "absolute", left: `${b.boite.x}%`, top: `${b.boite.y}%`, width: `${b.boite.largeur}%`, height: `${Math.max(b.boite.hauteur, 1.5)}%`, background: b.couleur }} />
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
            <div style={{ position: "relative", width: "100%", height: "100%" }}>{ContenuCase(c, graine)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
