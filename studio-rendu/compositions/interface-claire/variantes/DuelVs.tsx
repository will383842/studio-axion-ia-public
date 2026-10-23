import React from "react";
/**
 * CARTE « DUEL » (nouvelle, reprise du brouillon du designer n° 2 ; designer n° 3, 15/10/2026 — standard premium).
 * Quand : une comparaison de deux options (à la main ou automatisé, recruter ou former). Carte sur la bande, la prise
 * descend dessous, visage entier.
 *
 * Composition : deux colonnes égales, chacune avec son titre sur un ONGLET et 3 lignes en corps à icône nue, dans un
 * panneau en creux ; la pastille « VS » encre (0,1 L) au centre est le SEUL héros. Au verdict : la colonne perdante
 * passe en sable (onglet sable, lignes barrées d'un filet) ; la gagnante reçoit un LISERÉ orange, un onglet orange et un
 * sceau « ✓ » de 0,07 L à cheval sur son coin bas-droit, dans la marge — qui ne cache aucune ligne (fin de la coche
 * géante du brouillon).
 * Mouvement :
 *  - N1 : la carte tombe ; les colonnes arrivent des bords et se PERCUTENT (claque) avec une secousse de 1 % de la carte ;
 *         le VS tourne de −20° à 0 ;
 *  - N2 : les lignes alternent gauche / droite, chacune sur son mot : entrée par translation (glisse 0,18 s), flash
 *         orange plein de SA colonne (0,12 s, ≈ 7 % de l'image) puis surlignage orange-voile tant qu'elle est la dernière dite ; au verdict,
 *         un balayage orange-voile parcourt la colonne gagnante en 0,2 s, les ratures tombent en cascade de 50 ms ;
 *  - N3 : le VS respire de 2 %.
 */
import { GEOMETRIE, POLICES } from "../charte";
import { Icone } from "../elements";
import { BAS_CARTE } from "./commun";
import type { Mot } from "./Scene";
import { claque, CoquePremium, DEGRADE, filet, fondu, glisse, microOmbre, N3, pointsDepuisNumero, Reflet, respire, secousse, styleCorps, styleHeros, styleTitre } from "./premium-3";

export type LigneDuel = { texte: string; icone: string; a: number };
export type ColonneDuel = { titre: string; lignes: LigneDuel[] };

export type DuelVsProps = {
  t: number;
  largeurImage: number;
  hauteurImage: number;
  /** Sujet, dans la barre de fenêtre. */
  titre: string;
  gauche: ColonneDuel;
  droite: ColonneDuel;
  /** Instant de la collision des colonnes (et de la frappe du VS). */
  chocA: number;
  /** Conclusion : côté gagnant et instant du verdict. */
  verdict?: { gagnant: "gauche" | "droite"; a: number };
  /** Entrée et sortie de la carte (s) ; défaut : 0,3 s avant le choc → jamais. */
  debut?: number;
  fin?: number;
  /** Progression « 2/5 » (points). */
  numero?: string;
};

/** Exemple : « Faire vos comptes-rendus à la main, ou les obtenir rédigés en sortant de la réunion. » */
export const EXEMPLE_DUEL_VS = {
  phrase: "Faire vos comptes-rendus à la main, ou les obtenir rédigés en sortant de la réunion.",
  duree: 4.6,
  mots: [
    { texte: "Faire", a: 0.0 },
    { texte: "vos", a: 0.15 },
    { texte: "comptes-rendus", a: 0.3, fort: true },
    { texte: "à", a: 0.75 },
    { texte: "la", a: 0.85 },
    { texte: "main,", a: 0.95, fort: true },
    { texte: "ou", a: 1.45 },
    { texte: "les", a: 1.6 },
    { texte: "obtenir", a: 1.75 },
    { texte: "rédigés", a: 2.1, fort: true },
    { texte: "en", a: 2.45 },
    { texte: "sortant", a: 2.55 },
    { texte: "de", a: 2.85 },
    { texte: "la", a: 2.95 },
    { texte: "réunion.", a: 3.05, fort: true },
  ] satisfies Mot[],
  titre: "Vos comptes-rendus",
  gauche: {
    titre: "À la main",
    lignes: [
      { texte: "Notes à la volée", icone: "crayon", a: 0.7 },
      { texte: "Tout retaper", icone: "document", a: 1.6 },
      { texte: "Envoi le soir", icone: "horloge", a: 2.5 },
    ],
  },
  droite: {
    titre: "Automatisé",
    lignes: [
      { texte: "Réunion enregistrée", icone: "video", a: 1.15 },
      { texte: "Texte rédigé seul", icone: "etincelles", a: 2.05 },
      { texte: "Envoyé en sortant", icone: "envoyer", a: 2.95 },
    ],
  },
  chocA: 0.3,
  verdict: { gagnant: "droite" as const, a: 3.35 },
};
/** Instant représentatif (verdict posé). */
export const INSTANT_DUEL_VS = 4.0;

/** Durée du flash orange plein d'une ligne (s). */
const FLASH = 0.12;

export function DuelVs(p: DuelVsProps) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const debut = p.debut ?? Math.max(0, p.chocA - 0.3);
  const fin = p.fin ?? 99;
  const hCarte = (BAS_CARTE - GEOMETRIE.carteY) * H;
  const dx = secousse(p.t, p.chocA, 0.22, hCarte * 0.01);
  return (
    <CoquePremium
      t={p.t}
      debut={debut}
      fin={fin}
      W={W}
      H={H}
      y0={GEOMETRIE.carteY}
      y1={BAS_CARTE}
      dx={dx}
      entete={{ mode: "fenetre", titre: p.titre, points: pointsDepuisNumero(p.numero) }}
      enfants={(l, h) => <Duel {...p} l={l} h={h} />}
    />
  );
}

function Duel(p: DuelVsProps & { l: number; h: number }) {
  const { t, l, h } = p;
  const W = p.largeurImage;
  const gap = Math.round(W * 0.06);
  const lc = (l - gap) / 2;
  const hT = Math.round(W * 0.058);
  const hPanneau = h - hT;
  const pad = Math.round(W * 0.012);
  const hLigne = (hPanneau - 2 * pad) / 3;
  const r = Math.round(W * 0.014);
  const verdict = p.verdict && t >= p.verdict.a ? p.verdict : undefined;

  // Dernière ligne dite (surlignée), toutes colonnes confondues.
  const toutes = [...p.gauche.lignes, ...p.droite.lignes].sort((a, b) => a.a - b.a);
  const derniere = toutes.filter((x) => t >= x.a).pop();

  // Collision : chaque colonne arrive de son bord (0,05 L) et dépasse vers le centre (claque) au choc.
  const eArr = claque(t, p.chocA - 0.12, 0.14);

  const colonne = (c: ColonneDuel, cote: -1 | 1) => {
    const nomCote = cote < 0 ? "gauche" : "droite";
    const perdante = !!verdict && verdict.gagnant !== nomCote;
    const gagnante = !!verdict && verdict.gagnant === nomCote;
    const x0 = cote < 0 ? 0 : lc + gap;
    const dxCol = cote * (1 - eArr) * W * 0.05;
    const balayage = gagnante ? glisse(t, verdict!.a, 0.2) : 0;
    const voile = gagnante ? Math.max(0, 1 - Math.max(0, t - verdict!.a - 0.25) / 0.35) : 0;
    const fondOnglet = perdante ? N3.sable : gagnante ? DEGRADE.orange : N3.encreDouce;
    const texteOnglet = perdante ? N3.encreDouce : N3.ivoire;
    // La colonne qui « parle » flashe en orange plein (0,12 s) : un changement franc sur ~7 % de l'image.
    const flashCol = !verdict && c.lignes.some((x) => t >= x.a && t < x.a + FLASH);
    return (
      <div key={nomCote} style={{ position: "absolute", left: x0, top: 0, width: lc, height: h, opacity: fondu(t, p.chocA - 0.12), transform: `translateX(${dxCol}px)` }}>
        {/* Onglet du titre. */}
        <div style={{ position: "absolute", left: 0, top: 0, height: hT, display: "flex", alignItems: "center", padding: `0 ${Math.round(W * 0.022)}px`, background: fondOnglet, borderRadius: `${r}px ${r}px 0 0`, overflow: "hidden" }}>
          {perdante ? null : <Reflet rayon={r} retrait={r * 0.6} />}
          <span style={{ ...styleTitre(Math.round(W * 0.036), texteOnglet), whiteSpace: "nowrap" }}>{c.titre}</span>
        </div>
        {/* Panneau en creux. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: hT,
            width: lc,
            height: hPanneau,
            borderRadius: `0 ${r}px ${r}px ${r}px`,
            background: flashCol ? DEGRADE.orange : perdante ? N3.sable : N3.ivoireCreux,
            boxShadow: gagnante ? `inset 0 0 0 ${Math.round(W * 0.006)}px ${N3.orange}` : `inset 0 0 0 ${Math.max(2, Math.round(W * 0.0018))}px ${N3.filet}`,
            overflow: "hidden",
          }}
        >
          {gagnante ? <div style={{ position: "absolute", left: 0, top: 0, width: lc, height: hPanneau * balayage, background: `rgba(222, 192, 168, ${voile})` }} /> : null}
          {c.lignes.map((ligne, i) => {
            if (t < ligne.a) return null;
            const e = glisse(t, ligne.a, 0.18);
            const flash = flashCol;
            const active = !verdict && ligne === derniere;
            const rature = perdante && t >= verdict!.a + 0.05 * (i + 1);
            const couleurTexte = flash ? N3.ivoire : perdante ? N3.encreDouce : N3.encre;
            const couleurIcone = flash ? N3.ivoire : perdante ? N3.encreDouce : active || gagnante ? N3.orange : N3.encreDouce;
            return (
              <div key={ligne.texte} style={{ position: "absolute", left: pad, right: pad, top: pad + i * hLigne, height: hLigne }}>
                {i > 0 ? <div style={{ position: "absolute", left: Math.round(W * 0.02), right: Math.round(W * 0.02), top: 0, borderTop: filet(W, perdante ? N3.sableProfond : N3.filet) }} /> : null}
                <div
                  style={{
                    position: "absolute",
                    inset: Math.round(W * 0.004),
                    borderRadius: Math.round(W * 0.01),
                    background: !flash && active ? N3.orangeVoile : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: Math.round(W * 0.016),
                    padding: `0 ${Math.round(W * 0.02)}px`,
                    opacity: fondu(t, ligne.a),
                    transform: `translateX(${cote * (1 - e) * W * 0.03}px)`,
                  }}
                >
                 <div style={{ flexShrink: 0, display: "flex" }}>
                    <Icone nom={ligne.icone} taille={W * 0.04} couleur={couleurIcone} epaisseur={2.4} />
                  </div>
                  <span style={{ ...styleCorps(Math.round(W * 0.03), couleurTexte), lineHeight: 1.18, textDecoration: rature ? "line-through" : undefined, textDecorationThickness: Math.max(2, Math.round(W * 0.0022)), textDecorationColor: N3.encreDouce }}>{ligne.texte}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Sceau du gagnant : à cheval sur le coin bas-droit du panneau, dans la marge — il ne cache aucune ligne. */}
        {gagnante ? <Sceau t={t} a={verdict!.a + 0.08} W={W} style={{ right: -Math.round(W * 0.018), top: h - Math.round(W * 0.052) }} /> : null}
      </div>
    );
  };

  // Pastille VS : seul héros.
  const dVs = Math.round(W * 0.1);
  const eVs = claque(t, p.chocA, 0.14);
  const anneau = Math.round(W * 0.006);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {colonne(p.gauche, -1)}
      {colonne(p.droite, 1)}
      {t >= p.chocA ? (
        <div
          style={{
            position: "absolute",
            left: l / 2 - dVs / 2,
            top: hT + hPanneau / 2 - dVs / 2,
            width: dVs,
            height: dVs,
            ...styleHeros(W, DEGRADE.encre, dVs / 2),
            boxShadow: `0 0 0 ${anneau}px ${N3.ivoire}, ${Math.round(W * 0.005)}px ${Math.round(W * 0.005)}px 0 ${anneau}px ${N3.encre}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: fondu(t, p.chocA),
            transform: `rotate(${-20 * (1 - eVs)}deg) scale(${(1 + 0.08 * (1 - eVs)) * (1 + 0.02 * respire(t, 1.2))})`,
            overflow: "hidden",
          }}
        >
          <Reflet rayon={dVs} retrait={dVs * 0.25} />
          <span style={{ fontFamily: POLICES.titre, fontSize: Math.round(W * 0.04), color: N3.ivoire, letterSpacing: "0.02em", lineHeight: 1 }}>VS</span>
        </div>
      ) : null}
    </div>
  );
}

function Sceau({ t, a, W, style }: { t: number; a: number; W: number; style: React.CSSProperties }) {
  if (t < a) return null;
  const d = Math.round(W * 0.07);
  const e = claque(t, a, 0.12);
  const trait = glisse(t, a + 0.06, 0.14);
  return (
    <div style={{ position: "absolute", ...style, width: d, height: d, borderRadius: "50%", background: DEGRADE.orange, boxShadow: `0 0 0 ${Math.round(W * 0.004)}px ${N3.ivoire}, ${microOmbre(W, 0.16)}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: fondu(t, a), transform: `rotate(${-12 * (1 - e)}deg) scale(${1 + 0.08 * (1 - e)})`, overflow: "hidden" }}>
      <Reflet rayon={d} retrait={d * 0.25} />
      <svg width={d * 0.56} height={d * 0.56} viewBox="0 0 24 24" fill="none" stroke={N3.ivoire} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trait} />
      </svg>
    </div>
  );
}
