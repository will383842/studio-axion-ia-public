import React from "react";
/**
 * OUV-E · Détail puis recul (maquettes OUV-E-1/2) : collé sur un nœud du schéma (l'alerte, sinon le moteur), la carte
 * déborde de l'écran ; puis la caméra recule et montre le schéma entier de l'image (icônes réelles des nœuds), le nœud
 * encadré. `boucle` (FIN-C) : le gros plan.
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { a, ANTON, avance, C, Carte, CarteIcone, couleursNoeud, Ecran, Etiquette, Icone, INTER, T, tailleQuiTient, Vibration } from "../objets-ouverture";
import { grosPlanOuvE, type DonneesOuverture, type NoeudSchemaOuverture } from "./donnees";
import { PhraseChoc, zonePhrase, type PhraseBoucle } from "./phrase-choc";

type D = Extract<DonneesOuverture, { code: "OUV-E" }>;

function Cloche({ cx, cy, r, angle, icone }: { cx: number; cy: number; r: number; angle: number; icone: string | null }) {
  return (
    <>
      <div style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50% 15%", display: "flex" }}>{icone ? <Icone nom={icone} taille={r * 1.15} couleur={C.orangeVif} epaisseur={2.4} /> : null}</div>
      </div>
      <Vibration x={cx - r - 6} y={cy} cote={-1} />
      <Vibration x={cx + r + 6} y={cy} cote={1} />
    </>
  );
}

/** 1re image : le nœud en gros plan, la carte déborde ; le fil mène à la carte suivante, qui entre dans le champ. */
function GrosPlan({ d, t, appoint, phrase, tPhrase = 0 }: { d: D; t: number; appoint: boolean; phrase?: PhraseBoucle; tPhrase?: number }) {
  const angle = Math.sin(t * 14) * 16;
  const g = grosPlanOuvE(d.detail.libelle, appoint ? "9:16" : "4:5");
  return (
    <>
      {d.situation ? <Etiquette texte="Situation type" y={262} fond="ivoire" /> : null}
      <div style={{ position: "absolute", left: g.carte.x, top: 344, width: g.carte.l, height: 780, boxSizing: "border-box", borderRadius: 80, background: C.blanc, border: `16px solid ${C.encre}`, boxShadow: `0 40px 100px ${a(C.encre, 0.12)}` }} />
      <Cloche cx={262} cy={548} r={124} angle={angle} icone={d.detail.icone} />
      {phrase ? (
        <PhraseChoc p={phrase} t={tPhrase} zone={zonePhrase("OUV-E", appoint ? "9:16" : "4:5")} couleur={C.encre} orange={C.orange} />
      ) : (
        <T x={g.texte.x} y={g.texte.lignes.length > 1 ? 700 : 744} taille={g.texte.taille} couleur={C.encre} style={{ lineHeight: 1.05 }}>
          {g.texte.lignes.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </T>
      )}
      {d.detail.detail && !phrase ? <div style={{ position: "absolute", left: 112, top: 906, width: 880, ...INTER, fontSize: 66, color: C.encre, lineHeight: 1.12 }}>{d.detail.detail}</div> : null}
      {appoint ? (
        <>
          <div style={{ position: "absolute", left: 147, top: 1124, width: 6, height: 216, background: C.encre }} />
          <div style={{ position: "absolute", left: 40 + 300 * (1 - avance(t, 0.2, 0.6)), top: 1330, width: 1200, height: 206, boxSizing: "border-box", borderRadius: 80, background: C.blanc, border: `16px solid ${C.encre}` }}>
            <div style={{ position: "absolute", left: 222 - 70 - 16, top: 17, width: 140, height: 140, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d.suivant ? <Icone nom={d.suivant} taille={76} couleur={C.blanc} epaisseur={2.6} /> : null}
            </div>
            <div style={{ position: "absolute", left: 328, top: 50, width: 420, height: 26, borderRadius: 13, background: C.encre }} />
            <div style={{ position: "absolute", left: 328, top: 98, width: 280, height: 26, borderRadius: 13, background: a(C.encre, 0.45) }} />
          </div>
        </>
      ) : null}
    </>
  );
}

/** Où pose-t-on chaque nœud du schéma (centres, en px) ; le dernier de chaque colonne descend dans l'appoint. */
function disposer(d: D, appoint: boolean) {
  const n = d.schema.colonnes.length;
  const xs = n >= 2 ? [180, 900] : [540];
  const haut = d.schema.haut.map((noeud, i) => ({ noeud, cx: 540, cy: 326 + i * 174, grand: false }));
  const debut = 326 + d.schema.haut.length * 174 + 162 - 174;
  const fins = appoint ? 1416 : 1022;
  const colonnes = d.schema.colonnes.slice(0, 2).map((col, c) => {
    const k = col.length;
    const ys = k === 1 ? [fins] : col.map((_, i) => (i === k - 1 ? fins : debut + ((Math.min(1022, fins - 180) - debut) * i) / Math.max(1, k - 2)));
    return col.map((noeud, i) => ({ noeud, cx: xs[c], cy: ys[i], grand: i === k - 1 && appoint }));
  });
  return { haut, colonnes };
}

/** 2e image : la caméra a reculé ; le schéma entier, le nœud du gros plan encadré. */
function Recul({ d, t, appoint }: { d: D; t: number; appoint: boolean }) {
  const { haut, colonnes } = disposer(d, appoint);
  const tous = [...haut, ...colonnes.flat()];
  const cible = tous.find((x) => x.noeud.detail) ?? tous[0];
  const e = avance(t, 0, 0.35);
  const zoom = 1 + 0.8 * (1 - e);
  const carte = (x: { noeud: NoeudSchemaOuverture; cx: number; cy: number; grand: boolean }, k: string) => {
    const c = couleursNoeud(x.noeud.couleur);
    if (x.noeud.detail) return null;
    return <CarteIcone key={k} cx={x.cx} cy={x.cy} l={x.grand ? 360 : 220} h={x.grand ? 180 : 104} icone={x.noeud.icone} contour={c.contour} couleurIcone={c.icone} epaisseur={x.grand ? 6 : 5} />;
  };
  const libelle = d.detail.libelle;
  const lc = 530;
  const xc = Math.max(60, Math.min(1020 - lc, cible.cx - lc / 2));
  return (
    <div style={{ position: "absolute", inset: 0, clipPath: "inset(190px 0 0 0)" }}>
    <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${cible.cx}px ${cible.cy}px` }}>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        {haut.slice(1).map((h, i) => (
          <line key={`h${i}`} x1={540} y1={haut[i].cy + 52} x2={540} y2={h.cy - 52} stroke={C.orangeVif} strokeWidth={7} />
        ))}
        {haut.length
          ? colonnes.map((col, c) => (col[0] ? <path key={`b${c}`} d={`M540 ${haut[haut.length - 1].cy + 52} C 540 ${haut[haut.length - 1].cy + 90}, ${col[0].cx} ${col[0].cy - 110}, ${col[0].cx} ${col[0].cy - 52}`} fill="none" stroke={c === 0 ? C.orangeVif : C.encre} strokeWidth={7} /> : null))
          : null}
        {colonnes.map((col, c) =>
          col.slice(1).map((x, i) => <line key={`c${c}-${i}`} x1={x.cx} y1={col[i].cy + 52} x2={x.cx} y2={x.cy - (x.grand ? 92 : 52)} stroke={c === 0 ? C.orangeVif : C.encre} strokeWidth={x.grand ? 5 : 7} strokeDasharray={x.grand ? "3 14" : undefined} strokeLinecap="round" />),
        )}
      </svg>
      {tous.map((x, k) => carte(x, `n${k}`))}
      <Carte x={xc} y={cible.cy - 70} l={lc} h={140} contour={C.encre} epaisseur={6} rayon={30} ombre={0}>
        <div style={{ position: "absolute", left: 50, top: 0, width: lc - 70, height: 140, display: "flex", alignItems: "center", justifyContent: "center", ...ANTON, textTransform: "none", fontSize: tailleQuiTient(libelle, 64, lc - 90, 58), color: C.encre, whiteSpace: "nowrap" }}>{libelle}</div>
      </Carte>
      <div style={{ position: "absolute", left: xc - 42, top: cible.cy - 40, width: 80, height: 80, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-12deg)" }}>
        {d.detail.icone ? <Icone nom={d.detail.icone} taille={46} couleur={C.orangeVif} epaisseur={2.6} /> : null}
      </div>
      <div style={{ position: "absolute", left: xc - 102, top: cible.cy - 130, width: lc + 140, height: 260, borderRadius: 40, border: `4px dashed ${a(C.encre, 0.25)}` }} />
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" stroke={C.orangeVif} strokeWidth={10} strokeLinecap="round">
        {[
          [xc - 70, cible.cy - 102, 1, 1],
          [xc + lc + 28, cible.cy - 102, -1, 1],
          [xc - 70, cible.cy + 102, 1, -1],
          [xc + lc + 28, cible.cy + 102, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y + sy * 46} L${x} ${y} L${x + sx * 46} ${y}`} />
        ))}
      </svg>
    </div>
    </div>
  );
}

export function OuvertureE({ d, t, format, boucle, phrase }: { d: D; t: number; format: FormatIV; boucle?: boolean; phrase?: PhraseBoucle }) {
  const appoint = format === "9:16";
  const deuxieme = !boucle && t >= d.bascule;
  return (
    <Ecran fond="ivoire" largeur={1080} hauteur={format === "4:5" ? 1350 : 1920} cadre45={format === "4:5"}>
      {deuxieme ? <Recul d={d} t={t - d.bascule} appoint={appoint} /> : <GrosPlan d={d} t={boucle ? 0.3 : t} appoint={appoint} phrase={boucle ? phrase : undefined} tPhrase={t} />}
    </Ecran>
  );
}
