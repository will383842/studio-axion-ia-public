import React from "react";
/**
 * FIN-D · Le chiffre qui reste (maquettes FIN-D-2 et R45-FIN-D-1) : le chiffre-clé reste AU-DESSUS de la phrase-choc
 * (jamais derrière), séparé par un filet ; la phrase arrive mot par mot à ses heures, mot pour mot, un seul mot orange ;
 * en appoint, les dix barres de la part (8 sur 10 pour 80 %). En 4:5, les barres passent à droite du chiffre.
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";
import { a, ANTON, C, DixBarres, Ecran, Lueur } from "../objets-ouverture";
import type { DonneesFin } from "./donnees";

type D = Extract<DonneesFin, { code: "FIN-D" }>;

const LARGEUR = 936;

/** Coupe une suite de mots en lignes de `largeur` px à la taille donnée. */
function couper(mots: readonly { texte: string; k: number }[], taille: number, largeur: number = LARGEUR): { texte: string; k: number }[][] {
  const lignes: { texte: string; k: number }[][] = [];
  let l = 0;
  for (const m of mots) {
    const w = largeurAnton(m.texte, taille);
    const courante = lignes[lignes.length - 1];
    if (!courante || l + 0.22 * taille + w > largeur) {
      lignes.push([m]);
      l = w;
    } else {
      courante.push(m);
      l += 0.22 * taille + w;
    }
  }
  return lignes;
}

/** La phrase en lignes : les phrases d'abord en 88 px, la dernière en 156 px ; tout réduit d'un même rapport si trop haut. */
export type LignePhrase = { mots: { texte: string; k: number }[]; taille: number; interligne: number; marge: number };
export function disposerPhrase(d: Pick<DonneesFin, "mots" | "lignes">, hauteurMax: number, largeur: number = LARGEUR): LignePhrase[] {
  return disposerPhraseDetail(d, hauteurMax, largeur).lignes;
}

/** Comme `disposerPhrase`, et dit si le REPLI a été utilisé (rien de plus grand que 58 px ne tenait dans la zone). */
export function disposerPhraseDetail(d: Pick<DonneesFin, "mots" | "lignes">, hauteurMax: number, largeur: number = LARGEUR): { lignes: LignePhrase[]; repli: boolean } {
  let k = 0;
  const phrases = d.lignes.map((n) => d.mots.slice(k, (k += n)).map((texte, i) => ({ texte, k: k - n + i })));
  // Rapport de 2,4 à 0,4 par pas de 0,04, en entiers (pas de dérive de flottant : le dernier pas est bien 0,40).
  for (let i = 60; i >= 10; i--) {
    const r = i / 25;
    const res = phrases.flatMap((p, i) => {
      const derniere = i === phrases.length - 1 && phrases.length > 1;
      const taille = Math.max(58, Math.min(derniere ? 230 : phrases.length > 1 ? 200 : 320, Math.round((derniere ? 156 : phrases.length > 1 ? 88 : 130) * r)));
      const interligne = derniere || phrases.length === 1 ? 1.12 : 1.2;
      return couper(p, taille, largeur).map((mots, j) => ({ mots, taille, interligne, marge: j === 0 && i > 0 ? (derniere ? 22 : 8) : 0 }));
    });
    // Aucune ligne plus large que la zone (mesure réelle d'Anton, `chasse-anton`, la même que celle des tests) : sinon on réduit.
    const largeurLigne = (l: { mots: { texte: string }[]; taille: number }) => l.mots.reduce((w, m) => w + largeurAnton(m.texte, l.taille), 0) + 0.22 * l.taille * (l.mots.length - 1);
    if (res.reduce((s, l) => s + l.taille * l.interligne + l.marge, 0) <= hauteurMax && res.every((l) => largeurLigne(l) <= largeur + 1e-6)) return { lignes: res, repli: false };
  }
  // Repli (très peu de hauteur) : 58 px, coupé à la largeur, jamais une ligne plus large que la zone.
  const lignes = phrases.flatMap((p, i) => {
    const derniere = i === phrases.length - 1 && phrases.length > 1;
    return couper(p, 58, largeur).map((mots, j) => ({ mots, taille: 58, interligne: derniere || phrases.length === 1 ? 1.12 : 1.2, marge: j === 0 && i > 0 ? (derniere ? 22 : 8) : 0 }));
  });
  return { lignes, repli: true };
}

export function FinD({ d, t, format }: { d: D; t: number; format: FormatIV }) {
  const q45 = format === "4:5";
  const y0 = q45 ? 168 : 266;
  const orange = d.phrase.split(/\s+/).findIndex((m) => /\*/.test(m));
  // Mot par mot à leurs heures : la phrase se recompose sur les mots déjà dits (jamais un mot avant son heure).
  const vus = Math.max(1, d.heures.filter((h) => t >= h - 0.02).length);
  const parPhrase = d.lignes.map((n, i) => Math.max(0, Math.min(n, vus - d.lignes.slice(0, i).reduce((s, x) => s + x, 0)))).filter((k) => k > 0);
  const hauteurMax = (q45 ? 1030 : 1140) - (y0 + 188);
  const lignes = disposerPhrase({ mots: d.mots.slice(0, vus), lignes: parPhrase }, hauteurMax);
  const part = d.chiffre.unite === "%" ? d.part : null;
  return (
    <Ecran fond="sombre" largeur={1080} hauteur={q45 ? 1350 : 1920}>
      <Lueur x={540} y={q45 ? 560 : 640} r={q45 ? 560 : 620} o={0.5} />
      <div style={{ position: "absolute", left: 72, top: y0, ...ANTON, fontSize: 150, lineHeight: 1, color: C.ivoire, whiteSpace: "nowrap" }}>{d.chiffre.texte}</div>
      {q45 && part !== null ? <DixBarres x={472} y={y0 + 12} l={536} h={124} pleines={Math.round(part / 10)} plein={C.ivoire} vide={C.grisClair} ecart={14} /> : null}
      <div style={{ position: "absolute", left: 72, top: y0 + 164, width: LARGEUR, height: 6, borderRadius: 3, background: a(C.grisClair, 0.7) }} />
      <div style={{ position: "absolute", left: 72, top: y0 + 188 + Math.max(0, (hauteurMax - lignes.reduce((h, l) => h + l.taille * l.interligne + l.marge, 0)) / 2), ...ANTON, color: C.ivoire, whiteSpace: "nowrap" }}>
        {lignes.map((l, i) => (
          <div key={i} style={{ fontSize: l.taille, lineHeight: l.interligne, marginTop: l.marge }}>
            {l.mots.map((m, j) => {
              return (
                <span key={m.k} style={{ color: m.k === orange ? C.orangeVif : undefined }}>
                  {j ? " " : ""}
                  {m.texte}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {!q45 && part !== null ? <DixBarres x={72} y={1320} l={LARGEUR} h={186} pleines={Math.round(part / 10)} plein={C.ivoire} vide={C.grisClair} /> : null}
    </Ecran>
  );
}
