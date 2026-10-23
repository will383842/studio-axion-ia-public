import React from "react";
/**
 * OUV-B · Avant / après d'un coup (maquettes OUV-B-1/2) : l'écran est coupé en deux dès la 1re image ; à gauche, sur
 * nuit, le problème (son chiffre, le message qui attend) ; à droite, sur ivoire, le résultat (son chiffre claque, la
 * coche valide). La moitié ivoire se dévoile de haut en bas. `boucle` : les deux moitiés posées (FIN-C).
 * Une bande nuit tient la place des sous-titres sur la couture : ils restent lisibles sur les deux fonds.
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { a, ANTON, avance, Bulle, C, claque, Coche, Ecran, Etiquette, Icone, INTER, largeurAnton, Lueur, Points, T, tailleQuiTient, Traits } from "../objets-ouverture";
import type { DonneesOuverture } from "./donnees";

type D = Extract<DonneesOuverture, { code: "OUV-B" }>;

function MoitieNuit({ d, appoint }: { d: D; appoint: boolean }) {
  const chiffre = d.avant.chiffre.texte;
  return (
    <>
      {d.situation ? <Etiquette texte="Situation type" y={270} fond="sombre" /> : null}
      <T x={72} y={440} taille={tailleQuiTient(chiffre, 180, 430, 96)} couleur={C.ivoire}>{chiffre}</T>
      <Bulle x={72} y={690} l={400} h={170}>
        <Points taille={34} />
      </Bulle>
      {d.avant.libelle ? <div style={{ position: "absolute", left: 72, top: 892, width: 430, ...INTER, fontSize: 60, color: C.grisClair, lineHeight: 1.1 }}>{d.avant.libelle}</div> : null}
      <Bulle x={72} y={d.avant.libelle && d.avant.libelle.length > 14 ? 1048 : 1000} l={400} h={100} fond={a(C.blanc, 0.9)}>
        <Points taille={26} />
      </Bulle>
      {appoint ? (
        <>
          <Bulle x={72} y={1318} l={400} h={100} fond={a(C.blanc, 0.9)}>
            <Points taille={24} />
          </Bulle>
          <Bulle x={72} y={1432} l={400} h={100} fond={a(C.blanc, 0.9)}>
            <Points taille={24} />
          </Bulle>
        </>
      ) : null}
    </>
  );
}

function MoitieIvoire({ d, pop, coche, appoint }: { d: D; pop: number; coche: number; appoint: boolean }) {
  const { nombre, unite } = d.apres.chiffre;
  const taille = Math.min(250, Math.floor(400 / (largeurAnton(nombre, 1) + (unite ? largeurAnton(unite, 0.4) + 0.05 : 0))));
  return (
    <>
      <div style={{ position: "absolute", left: 713 - 60, top: 410, width: 120, height: 120, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {d.apres.icone ? <Icone nom={d.apres.icone} taille={70} couleur={C.orangeVif} epaisseur={2.6} /> : null}
      </div>
      {d.apres.libelle ? (
        <T x={713 - 230} y={556} largeur={460} align="center" taille={tailleQuiTient(d.apres.libelle, 76, 440, 60)} couleur={C.encre} style={{ textTransform: "none" }}>
          {d.apres.libelle}
        </T>
      ) : null}
      <div style={{ position: "absolute", left: 560, top: 688, width: 440, transform: `scale(${Math.max(0.0001, pop)})`, transformOrigin: "50% 55%" }}>
        {/* Chiffre focal ≥ 230 px : le nombre en grand, l'unité à 0,4 (≥ 96 px), comme OUV-A. */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", whiteSpace: "nowrap", ...ANTON, textTransform: "none", color: C.orange }}>
          <span style={{ fontSize: taille }}>{d.apres.chiffre.nombre}</span>
          {d.apres.chiffre.unite ? <span style={{ fontSize: Math.max(96, Math.round(taille * 0.4)), marginLeft: 14 }}>{d.apres.chiffre.unite}</span> : null}
        </div>
      </div>
      <Coche x={713} y={1050} r={56} echelle={coche} />
      {appoint
        ? [1318, 1432].map((y) => (
            <Bulle key={y} x={588} y={y} l={400} h={100} queue="droite" contour={C.encre} epaisseur={5}>
              <Traits />
              <div style={{ position: "relative", width: 56, height: 56 }}>
                <Coche x={28} y={28} r={26} />
              </div>
            </Bulle>
          ))
        : null}
    </>
  );
}

export function OuvertureB({ d, t, format, boucle }: { d: D; t: number; format: FormatIV; boucle?: boolean }) {
  const tt = boucle ? 9 : t;
  const appoint = format === "9:16";
  const bas = 1920;
  const front = 190 + (bas - 190) * avance(tt, 0, Math.max(0.4, d.bascule));
  const pop = claque(tt, 0.15, 0.32);
  const coche = claque(tt, d.bascule, 0.3);
  return (
    <Ecran fond="sombre" largeur={1080} hauteur={format === "4:5" ? 1350 : 1920} cadre45={format === "4:5"} bandeNuit>
      <Lueur x={270} y={820} r={460} o={0.7} />
      <MoitieNuit d={d} appoint={appoint} />
      <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, clipPath: `inset(190px 0 ${Math.max(0, 1920 - front)}px 0)` }}>
        <div style={{ position: "absolute", left: -540, top: 0, width: 1080, height: 1920, background: `radial-gradient(700px 900px at 85% 40%, ${C.ivoireHaut}, ${C.ivoire})` }} />
        <div style={{ position: "absolute", left: -540, top: 0, width: 1080, height: 1920 }}>
          <MoitieIvoire d={d} pop={pop} coche={coche} appoint={appoint} />
        </div>
      </div>
      {front < 1900 ? (
        <>
          <div style={{ position: "absolute", left: 540, top: front - 70, width: 540, height: 70, background: `linear-gradient(180deg, ${a(C.orangeVif, 0)}, ${a(C.orangeVif, 0.28)})` }} />
          <div style={{ position: "absolute", left: 540, top: front - 5, width: 540, height: 10, background: C.orangeVif }} />
        </>
      ) : null}
      <div style={{ position: "absolute", left: 536, top: 186, width: 544, height: 8, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 536, top: 190, width: 8, height: Math.min(front, 1920) - 190, background: C.orangeVif }} />
      {/* La bande nuit sous les sous-titres est posée par `Ecran` (9:16 et 4:5) : lisibles de part et d'autre de la couture. */}
    </Ecran>
  );
}
