import React from "react";
/**
 * OUV-A · Résultat d'abord (maquettes OUV-A-1/2 et R45-OUV-A-1) : le chiffre final claque en géant, puis la vidéo
 * « rembobine » vers le début du schéma (le chiffre qui est dit). `boucle` : l'état posé de la 1re image (FIN-C).
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { a, accentDe, ANTON, avance, Bulle, C, Carte, CarteIcone, claque, Coche, Ecran, Etiquette, largeurAnton, Lueur, T, tailleQuiTient, texteDe, type NomFond } from "../objets-ouverture";
import type { DonneesOuverture } from "./donnees";
import { PhraseChoc, zonePhrase, type PhraseBoucle } from "./phrase-choc";

type D = Extract<DonneesOuverture, { code: "OUV-A" }>;

/** Le chiffre en géant : nombre + unité (0,38 de la taille), dans `largeur`. */
function ChiffreGeant({ d, x, y, largeur, max, couleur, echelle }: { d: D; x: number; y: number; largeur: number; max: number; couleur: string; echelle: number }) {
  const { nombre, unite } = d.resultat.chiffre;
  const taille = Math.min(max, Math.floor(largeur / (largeurAnton(nombre, 1) + (unite ? largeurAnton(unite, 0.38) + 0.03 : 0))));
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${echelle})`, transformOrigin: "0% 100%", display: "flex", alignItems: "flex-start", whiteSpace: "nowrap" }}>
      <span style={{ ...ANTON, fontSize: taille, color: couleur, letterSpacing: "-0.01em" }}>{nombre}</span>
      {unite ? <span style={{ ...ANTON, fontSize: Math.round(taille * 0.38), color: couleur, marginLeft: 12, marginTop: taille * 0.083 }}>{unite}</span> : null}
    </div>
  );
}

/** Dix messages de la nuit en appoint : la part réglée cochée (8 sur 10 pour 80 %), le reste laissé en pointillés. */
function DixMessages({ y, fond, part, t }: { y: number; fond: NomFond; part: number | null; t: number }) {
  const regles = part === null ? 10 : Math.round(part / 10);
  const l = 128,
    h = 90,
    pas = 160;
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const x = 72 + (i % 5) * pas;
        const yy = y + Math.floor(i / 5) * 118;
        const regle = i < regles;
        const o = avance(t, 0.15 + i * 0.04, 0.2);
        return (
          <div key={i} style={{ opacity: o }}>
            <Bulle x={x} y={yy} l={l} h={h} fond={regle ? (fond === "sombre" ? C.ivoire : C.blanc) : "transparent"} contour={regle ? undefined : C.grisClair} epaisseur={5} pointille={!regle} />
            {regle ? <Coche x={x + l - 6} y={yy + 6} r={22} echelle={claque(t, 0.35 + i * 0.04, 0.25)} /> : null}
          </div>
        );
      })}
    </>
  );
}

/** 1re image : le chiffre final claque ; le trait d'impact se dessine ; en appoint, les dix messages. */
function Resultat({ d, t, boucle, phrase }: { d: D; t: number; boucle?: boolean; phrase?: PhraseBoucle }) {
  const tt = boucle ? 9 : t;
  const libelle = d.resultat.libelle;
  return (
    <>
      <Lueur x={420} y={700} r={640} o={0.75} />
      {d.situation ? <Etiquette texte="Situation type" y={270} fond="sombre" /> : null}
      <ChiffreGeant d={d} x={60} y={322} largeur={936} max={580} couleur={C.orangeVif} echelle={Math.max(0.0001, claque(tt, 0, 0.3))} />
      <div style={{ position: "absolute", left: 72, top: 924, width: 630 * avance(tt, 0.12, 0.5), height: 14, borderRadius: 7, background: C.ivoire }} />
      {boucle && phrase ? (
        <PhraseChoc p={phrase} t={t} zone={zonePhrase("OUV-A", "9:16")} couleur={C.ivoire} orange={C.orangeVif} />
      ) : libelle ? (
        <T x={72} y={972} taille={tailleQuiTient(libelle, 96, 936)} couleur={C.ivoire} style={{ opacity: avance(tt, 0.2, 0.25) }}>
          {libelle}
        </T>
      ) : null}
      <DixMessages y={1312} fond="sombre" part={d.resultat.part} t={tt} />
    </>
  );
}

/** 2e image : le chiffre rangé en pastille, retour au début (la carte qui est dite), la suite du schéma en appoint. */
export function Rembobine({ d, t, fond, appoint = true }: { d: D; t: number; fond: NomFond; appoint?: boolean }) {
  const e = avance(t, 0, 0.2);
  const texte = texteDe(fond);
  const libelle = d.depart.libelle;
  const chiffre = d.depart.chiffre?.texte;
  const tailleLibelle = libelle ? tailleQuiTient(libelle, 100, 660, 66) : 0;
  const suite = d.suite.slice(0, 3);
  return (
    <>
      {fond === "sombre" ? <Lueur x={520} y={780} r={620} o={0.6} /> : null}
      {d.situation ? <Etiquette texte="Situation type" y={270} fond={fond} /> : null}
      <div style={{ position: "absolute", left: 60, top: 320, width: 440, height: 196, borderRadius: 999, border: `4px dashed ${a(C.grisClair, 0.25 * e)}` }} />
      <div style={{ position: "absolute", left: 66, top: 326, width: 350, height: 156, borderRadius: 999, border: `4px dashed ${a(C.grisClair, 0.45 * e)}` }} />
      <div style={{ position: "absolute", left: 72, top: 332, ...ANTON, fontSize: 110, color: texte, padding: "14px 40px 10px", borderRadius: 999, border: `6px solid ${C.grisClair}`, whiteSpace: "nowrap" }}>{d.resultat.chiffre.texte}</div>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <g transform={`translate(${700 - 60 * e} 358)`} fill={accentDe(fond)}>
          <path d="M70 0 L0 58 L70 116 Z" />
          <path d="M150 0 L80 58 L150 116 Z" />
        </g>
        <path d="M430 516 C 480 540, 540 530, 540 572" fill="none" stroke={accentDe(fond)} strokeWidth={8} strokeDasharray="4 22" strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 80 * (1 - e), width: 1080, height: 1920, opacity: e }}>
        <Carte x={150} y={590} l={740} h={470} icone={d.depart.icone} contour={C.orangeVif} pastille={C.ivoire} couleurIcone={C.orange} />
        {libelle ? (
          <div style={{ position: "absolute", left: 190, top: chiffre ? 640 : 700, width: 660, textAlign: "center", ...ANTON, textTransform: "none", fontSize: tailleLibelle, lineHeight: 1.05, color: C.encre }}>{libelle}</div>
        ) : null}
        {chiffre ? <T x={150} y={libelle && tailleLibelle * 1.05 > 110 ? 800 : 782} largeur={740} align="center" taille={tailleQuiTient(chiffre, 220, 660, 96)} couleur={C.orange}>{chiffre}</T> : null}
      </div>
      {appoint && suite.length ? (
        <>
          <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
            <path d="M540 1300 L540 1314" stroke={C.orangeVif} strokeWidth={7} strokeLinecap="round" />
            {suite.length > 1 ? <path d="M540 1410 C 540 1428, 300 1416, 300 1440" fill="none" stroke={C.orangeVif} strokeWidth={7} /> : null}
            {suite.length > 2 ? <path d="M540 1410 C 540 1428, 780 1416, 780 1440" fill="none" stroke={texte} strokeWidth={7} /> : null}
          </svg>
          <CarteIcone cx={540} cy={1362} l={620} h={96} icone={suite[0]} contour={C.orangeVif} ombre={0} />
          {suite.length > 1 ? <CarteIcone cx={300} cy={1484} l={400} h={88} icone={suite[1]} contour={C.orangeVif} ombre={0} /> : null}
          {suite.length > 2 ? <CarteIcone cx={780} cy={1484} l={400} h={88} icone={suite[2]} couleurIcone={C.blanc} ombre={0} /> : null}
        </>
      ) : null}
    </>
  );
}

/** 4:5 (R45-OUV-A-1) : sur ivoire, le chiffre en majesté, la barre de la part achève de se remplir. */
function Resultat45({ d, t, tReel, phrase }: { d: D; t: number; tReel: number; phrase?: PhraseBoucle }) {
  const libelle = d.resultat.libelle;
  const part = d.resultat.part;
  const remplie = avance(t, 0.1, 0.8);
  return (
    <>
      {d.situation ? <Etiquette texte="Situation type" y={190} fond="ivoire" /> : null}
      <ChiffreGeant d={d} x={56} y={236} largeur={960} max={600} couleur={C.orange} echelle={Math.max(0.0001, claque(t, 0, 0.3))} />
      {phrase ? <PhraseChoc p={phrase} t={tReel} zone={zonePhrase("OUV-A", "4:5")} couleur={C.encre} orange={C.orange} /> : libelle ? <T x={72} y={850} taille={tailleQuiTient(libelle, 104, 936)} couleur={C.encre}>{libelle}</T> : null}
      <div style={{ position: "absolute", left: 72, top: 990, width: 936, height: 30, borderRadius: 15, background: C.encre }} />
      <div style={{ position: "absolute", left: 72, top: 990, width: Math.max(30, (936 * (part ?? 100)) / 100 - 6) * remplie, height: 30, borderRadius: 15, background: C.orange }} />
    </>
  );
}

export function OuvertureA({ d, t, format, boucle, phrase }: { d: D; t: number; format: FormatIV; boucle?: boolean; phrase?: PhraseBoucle }) {
  const deuxieme = !boucle && t >= d.bascule;
  if (format === "4:5") {
    return (
      <Ecran fond="ivoire" largeur={1080} hauteur={1350} cadre45={deuxieme}>
        {deuxieme ? <Rembobine d={d} t={t - d.bascule} fond="ivoire" appoint={false} /> : <Resultat45 d={d} t={boucle ? 9 : t} tReel={t} phrase={boucle ? phrase : undefined} />}
      </Ecran>
    );
  }
  return (
    <Ecran fond="sombre" largeur={1080} hauteur={1920}>
      {deuxieme ? <Rembobine d={d} t={t - d.bascule} fond="sombre" /> : <Resultat d={d} t={t} boucle={boucle} phrase={phrase} />}
    </Ecran>
  );
}
