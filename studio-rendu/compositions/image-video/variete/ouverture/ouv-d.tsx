import React from "react";
/**
 * OUV-D · Question à l'écran (maquettes OUV-D-1/2) : les mots de l'accroche en très grand, mot par mot au rythme de la
 * voix, sur ivoire, un seul mot orange ; le curseur bat tant que la phrase n'est pas finie. En appoint : les messages
 * qui attendent et, la nuit, la lune qui se lève sur l'horizon (sinon l'objet du déclencheur posé sur l'horizon).
 * `boucle` (FIN-C) : la phrase entière. `affiche` (première image des réseaux) : la phrase entière, sans appoint ni curseur,
 * sur le fond `fond` (ivoire par défaut : les rendus actuels ne changent pas ; sombre : texte ivoire, accent orange vif).
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { accentDe, ANTON, avance, Bulle, C, CarteIcone, claque, Ecran, Etiquette, Horizon, largeurAnton, Points, texteDe } from "../objets-ouverture";
import type { DonneesOuverture } from "./donnees";
import { PhraseChoc, zonePhrase, type PhraseBoucle } from "./phrase-choc";

type D = Extract<DonneesOuverture, { code: "OUV-D" }>;

const HAUT = 330;
const BAS = 1120;
const LARGEUR = 936;

/**
 * Lignes et tailles : parmi les découpages des mots en 1 à 4 lignes (dans l'ordre), chaque ligne à la taille qui
 * remplit la largeur (548 px au plus), tout réduit d'un même rapport si trop haut ; on garde celui qui couvre le plus.
 */
export function disposerMots(mots: readonly string[], interligne = 1.18): { mots: number[]; taille: number }[] {
  const n = mots.length;
  if (!n) return [];
  const largeur = (ix: number[]) => ix.reduce((s, i) => s + largeurAnton(mots[i], 1), 0) + 0.22 * (ix.length - 1);
  let meilleur: { mots: number[]; taille: number }[] = [{ mots: mots.map((_, i) => i), taille: 96 }];
  let score = -1;
  for (let masque = 0; masque < 1 << (n - 1); masque++) {
    const coupes = [...Array(n - 1).keys()].filter((k) => masque & (1 << k));
    if (coupes.length > 3) continue;
    const bornes = [0, ...coupes.map((k) => k + 1), n];
    const lignes = bornes.slice(0, -1).map((b, k) => [...Array(bornes[k + 1] - b).keys()].map((x) => x + b));
    let tailles = lignes.map((ix) => Math.min(548, Math.floor(LARGEUR / largeur(ix))));
    const hauteur = tailles.reduce((s, x) => s + x * interligne, 0);
    if (hauteur > BAS - HAUT) tailles = tailles.map((x) => Math.floor((x * (BAS - HAUT)) / hauteur));
    if (Math.min(...tailles) < 96) continue;
    const couvert = lignes.reduce((s, ix, k) => s + tailles[k] * Math.min(LARGEUR, largeur(ix) * tailles[k]), 0);
    if (couvert > score) {
      score = couvert;
      meilleur = lignes.map((ix, k) => ({ mots: ix, taille: tailles[k] }));
    }
  }
  return meilleur;
}

export function OuvertureD({ d, t, format, boucle, phrase, fond = "ivoire", affiche }: { d: D; t: number; format: FormatIV; boucle?: boolean; phrase?: PhraseBoucle; fond?: "ivoire" | "sombre"; affiche?: boolean }) {
  const tt = boucle || affiche ? 99 : t;
  const encre = fond === "sombre" ? texteDe("sombre") : C.encre;
  const accent = fond === "sombre" ? accentDe("sombre") : C.orange;
  // Comme la maquette OUV-D-1 : les mots déjà dits occupent toute la place, la phrase se recompose à chaque mot.
  const visibles = Math.max(1, d.mots.filter((m) => tt >= m.t).length);
  // Affiche : interligne 1,30 (l'accent d'une capitale ne touche pas la ligne du dessus) ; OUV-D de la vidéo : 1,18, inchangé.
  const interligne = affiche ? 1.3 : 1.18;
  const lignes = disposerMots(d.mots.slice(0, visibles).map((m) => m.texte), interligne);
  const appoint = format === "9:16" && !affiche;
  // Le bloc de mots est centré entre le haut et la bande des sous-titres : aucun grand trou au-dessus ni au-dessous.
  const total = lignes.reduce((h, l) => h + l.taille * interligne, 0);
  const y0 = HAUT + Math.max(0, (BAS - HAUT - total) / 2);
  const tops = lignes.map((_, k) => y0 + lignes.slice(0, k).reduce((h, l) => h + l.taille * interligne, 0));
  const y = y0 + total;
  const dernier = d.mots[d.mots.length - 1];
  return (
    <Ecran fond={fond} largeur={1080} hauteur={format === "4:5" ? 1350 : 1920} cadre45={format === "4:5"}>
      {d.situation ? <Etiquette texte="Situation type" y={262} fond={fond} /> : null}
      {boucle && phrase ? <PhraseChoc p={phrase} t={t} zone={zonePhrase("OUV-D", format)} couleur={encre} orange={accent} /> : null}
      {(boucle && phrase ? [] : lignes).map((l, k) => {
        const top = tops[k];
        return (
          <div key={k} style={{ position: "absolute", left: 66, top, ...ANTON, fontSize: l.taille, color: encre, whiteSpace: "nowrap", display: "flex", gap: `${0.22 * l.taille}px` }}>
            {l.mots.map((i) => {
              const m = d.mots[i];
              const e = claque(tt, m.t, 0.26);
              return (
                <span key={i} style={{ color: m.orange ? accent : encre, transform: `scale(${Math.max(0.0001, e)})`, transformOrigin: "0% 100%", display: "inline-block" }}>
                  {m.texte}
                </span>
              );
            })}
          </div>
        );
      })}
      {!(boucle && phrase) && visibles < d.mots.length && Math.floor(tt * 2.5) % 2 === 0 ? <div style={{ position: "absolute", left: 72, top: Math.min(BAS, y + 10), width: 22, height: 120, background: C.orange }} /> : null}
      {appoint ? (
        <>
          {[1312, 1384, 1456].map((by, i) => (
            <div key={by} style={{ opacity: avance(tt, 0.1 + i * 0.12, 0.25) }}>
              <Bulle x={72} y={by} l={500} h={64} contour={C.encre} epaisseur={5}>
                <Points taille={18} />
              </Bulle>
            </div>
          ))}
          {d.nuit ? (
            <Horizon id="ouv-d" cx={810} monte={0.55 + 0.4 * avance(tt, 0, (dernier?.t ?? 1) + 0.6)} r={110} debut={620} />
          ) : (
            <>
              <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
                <line x1={620} y1={1508} x2={1008} y2={1508} stroke={C.encre} strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" />
              </svg>
              <CarteIcone cx={810} cy={1508 - 70 * avance(tt, 0.2, 0.5) - 20} l={320} h={120} icone={d.icone} ombre={0} />
            </>
          )}
        </>
      ) : null}
    </Ecran>
  );
}
