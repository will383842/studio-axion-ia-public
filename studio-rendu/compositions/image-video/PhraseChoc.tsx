import React from "react";
/**
 * K19 · PhraseChoc : la phrase-choc mot à mot (chaque mot sur son heure), en grand sur fond sombre, l'accent `*mot*` en
 * orange ; le dernier mot s'allume (lueur), un éclair orange le salue, puis la marque apparaît dessous. Comme l'image 10
 * de la maquette validée. Pixels de l'écran de référence 1080 × 1920.
 */
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, teinte } from "../cas-concret/plans/commun";
import { INTERLIGNE_IV, planPhraseChoc } from "./plan-objets";

export function PhraseChoc({ phrase, debut, heures, t, marque = "axion-ia.com" }: { phrase: string; debut: number; heures?: number[]; t: number; marque?: "axion-ia.com" }) {
  const p = planPhraseChoc({ phrase, debut, heures }, t);
  const nombre = p.lignes.reduce((s, l) => s + l.length, 0);
  const hauteur = p.lignes.length * p.taille * INTERLIGNE_IV;
  const [avant, apres] = marque.split("ia");
  let k = 0;
  return (
    <>
      {p.eclair > 0 ? <div style={{ position: "absolute", inset: 0, background: COULEURS_DUO.orangeVif, opacity: p.eclair }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0.43 * 1920 - hauteur / 2, width: 1080, textAlign: "center", fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: p.taille, lineHeight: INTERLIGNE_IV, textTransform: "uppercase" }}>
        {p.lignes.map((l, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {l.map((m) => {
              const dernier = ++k === nombre;
              const lueur = dernier ? p.lueur : 0;
              return (
                <span
                  key={k}
                  style={{
                    display: "inline-block",
                    margin: "0 0.12em",
                    opacity: m.opacite,
                    transform: `translateY(${m.decalageY}px) scale(${m.echelle})`,
                    filter: m.flou > 0 ? `blur(${m.flou}px)` : undefined,
                    color: m.accent ? COULEURS_DUO.orangeVif : COULEURS_DUO.blanc,
                    textShadow: `0 0 ${24 + 50 * lueur}px ${teinte(COULEURS_DUO.orangeVif, 0.35 + 0.5 * lueur)}`,
                  }}
                >
                  {m.mot}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {p.marque > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0.43 * 1920 + hauteur / 2 + 70, width: 1080, textAlign: "center", fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.marque * 1920 * 1.5, letterSpacing: "0.08em", color: COULEURS_DUO.blanc, opacity: p.marque, transform: `translateY(${(1 - p.marque) * 20}px)` }}>
          {avant}
          <span style={{ color: COULEURS_DUO.orangeVif }}>ia</span>
          {apres}
        </div>
      ) : null}
    </>
  );
}
