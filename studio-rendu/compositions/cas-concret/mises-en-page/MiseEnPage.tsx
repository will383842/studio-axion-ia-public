import React from "react";
/**
 * L6 · AIGUILLAGE DES MISES EN PAGE ET RACCORDS. `codeL6` dit si un écran est rendu par une mise en page L6 (code tiré
 * dans son `jeu`, données présentes, rien ne déborde) ; sinon l'écran reste la v4, à l'identique. `Raccorde` pose les
 * raccords modernes de #308 autour de N'IMPORTE QUEL écran (v4 compris) : « objet » (la coche de l'écran qui finit
 * grossit au centre et devient l'écran suivant) et « dedans » (l'écran naît dans une carte et la caméra y entre).
 * Sans `jeu`, aucune enveloppe : l'arbre rendu est celui de la v4.
 */
import { AbsoluteFill } from "remotion";
import { imagesEcran, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { DUREE_RACCORD_S, eligible, estCodeDuType, type CodeMiseEnPageL6 } from "../../../../src/briques/ecrans-motion/mises-en-page";
import { estFort } from "../plans/fond-fort";
import { AccDetailRecul, AccDuelTailles, AccPageEcrite, TitLignesMagazine, TitMotObjet } from "./textes";
import { AvaBarreFeutre, AvaCadran, AvaCartesTombent, EtaEntrerDedans, EtaFantome, EtaSchemaFeutre, ObjEtiquettePend, ObjPleinCadre } from "./listes-etapes";
import { ChiAplatOrange, ChiCompterObjets, ChiJaugeAnneau, PreCasesCochees, PreCompterObjets, PreJaugeSeuil, QueChampReponse, QueGeante, ResCoupeDeux, ResMoisRempli } from "./chiffres";
import { disposition } from "./dispositions";
import { C, couleurs } from "./geo";
import { borne, Coche, doux, FondL6, MarqueL6, prog, useImage } from "./kit";

/** Le code L6 rendu pour cet écran, ou `null` (v4) : code du type, données présentes, pas de fond fort, rien ne déborde. */
export function codeL6(p: ProprietesEcran): CodeMiseEnPageL6 | null {
  const code = p.jeu?.miseEnPage;
  if (!estCodeDuType(p.type, code) || estFort(p.jeu)) return null;
  if (!eligible(code, p)) return null;
  return disposition(code, p).ok ? code : null;
}

const RENDUS: Record<CodeMiseEnPageL6, React.FC<{ p: never; d: never }>> = {
  "acc-detail-recul": AccDetailRecul,
  "acc-page-ecrite": AccPageEcrite,
  "acc-duel-tailles": AccDuelTailles,
  "tit-lignes-magazine": TitLignesMagazine,
  "tit-mot-objet": TitMotObjet,
  "ava-cartes-tombent": AvaCartesTombent,
  "ava-cadran": AvaCadran,
  "ava-barre-feutre": AvaBarreFeutre,
  "eta-schema-feutre": EtaSchemaFeutre,
  "eta-entrer-dedans": EtaEntrerDedans,
  "eta-fantome": EtaFantome,
  "obj-etiquette-pend": ObjEtiquettePend,
  "obj-plein-cadre": ObjPleinCadre,
  "pre-jauge-seuil": PreJaugeSeuil,
  "pre-compter-objets": PreCompterObjets,
  "pre-cases-cochees": PreCasesCochees,
  "chi-aplat-orange": ChiAplatOrange,
  "chi-jauge-anneau": ChiJaugeAnneau,
  "chi-compter-objets": ChiCompterObjets,
  "que-geante": QueGeante,
  "que-champ-reponse": QueChampReponse,
  "res-coupe-deux": ResCoupeDeux,
  "res-mois-rempli": ResMoisRempli,
};

/** Un écran rendu par sa mise en page L6 (fond, marque, contenu). */
export function EcranL6({ p, code }: { p: ProprietesEcran; code: CodeMiseEnPageL6 }) {
  const d = disposition(code, p);
  const Rendu = RENDUS[code];
  const aplat = code === "chi-aplat-orange";
  // Écran coupé en deux : la marque est sur la moitié haute (l'autre fond).
  const haut = code === "res-coupe-deux" ? couleurs(p.fond === "sombre" ? "ivoire" : "sombre") : null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <FondL6 p={p} aplat={aplat} />
      <Rendu p={p as never} d={d as never} />
      <MarqueL6 p={p} couleur={aplat ? C.encre : haut?.texte} accent={aplat ? C.ivoire : haut?.accent} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Raccords                                                               */
/* ------------------------------------------------------------------ */

/** Rayon de la coche du raccord d'objet, au centre de l'écran. */
const rayonRaccord = (p: ProprietesEcran) => p.largeur * 0.28;

/** Raccords autour d'un écran rendu (`enfant`) ; sans raccord dans le `jeu`, l'enfant tel quel. */
export function Raccorde({ p, children }: { p: ProprietesEcran; children: React.ReactNode }) {
  const entree = p.jeu?.raccordEntree;
  const sortie = p.jeu?.raccordSortie === "objet";
  if (!entree && !sortie) return <>{children}</>;
  return <RaccordAnime p={p} entree={typeof entree === "string" ? entree : undefined} sortie={sortie}>{children}</RaccordAnime>;
}

function RaccordAnime({ p, entree, sortie, children }: { p: ProprietesEcran; entree?: string; sortie: boolean; children: React.ReactNode }) {
  const image = useImage();
  const n = imagesEcran(p);
  const D = Math.round(DUREE_RACCORD_S * 25);
  const cx = p.largeur / 2;
  const cy = p.hauteur * 0.46;
  const R = rayonRaccord(p);
  let contenu: React.CSSProperties = {};
  const dessus: React.ReactNode[] = [];
  // Entrée « objet » : la coche de l'écran précédent est au centre, elle rapetisse et laisse place au contenu.
  if (entree === "objet") {
    const q = doux(image, 0, D);
    contenu = { opacity: borne(q * 1.4), transform: `scale(${0.94 + 0.06 * q})` };
    if (q < 0.999) dessus.push(<Coche key="e" x={cx} y={cy} r={R} echelle={1 - q} trace={1} style={{ opacity: borne(1.2 - q) }} />);
  }
  // Entrée « dedans » : l'écran naît dans une carte posée sur le fond de l'écran précédent, la caméra y entre.
  if (entree?.startsWith("dedans-")) {
    const avant = couleurs(entree === "dedans-sombre" ? "sombre" : "ivoire");
    const z = doux(image, 0, Math.round(D * 1.2));
    const l0 = p.largeur * 0.24;
    const h0 = l0 * 1.6;
    const fen = { x: (cx - l0 / 2) * (1 - z), y: (cy - h0 / 2) * (1 - z), l: l0 + (p.largeur - l0) * z, h: h0 + (p.hauteur - h0) * z };
    if (z < 0.999) {
      return (
        <AbsoluteFill style={{ overflow: "hidden", background: avant.fond }}>
          <AbsoluteFill style={{ clipPath: `inset(${fen.y}px ${p.largeur - fen.x - fen.l}px ${p.hauteur - fen.y - fen.h}px ${fen.x}px round ${28 * (1 - z)}px)` }}>
            <AbsoluteFill style={{ transform: `scale(${0.6 + 0.4 * z})`, transformOrigin: `${cx}px ${cy}px` }}>{children}</AbsoluteFill>
          </AbsoluteFill>
          <div style={{ position: "absolute", left: fen.x, top: fen.y, width: fen.l, height: fen.h, boxSizing: "border-box", borderRadius: 28 * (1 - z), border: `${6 * (1 - z)}px solid ${C.orangeVif}` }} />
        </AbsoluteFill>
      );
    }
  }
  // Sortie « objet » : sur la dernière demi-seconde, le contenu recule et la coche grossit jusqu'au centre.
  if (sortie) {
    const q = doux(image, n - D, D);
    if (q > 0) {
      contenu = { ...contenu, opacity: (typeof contenu.opacity === "number" ? contenu.opacity : 1) * borne(1 - q * 1.6), transform: `${contenu.transform ?? ""} scale(${1 - 0.06 * q})` };
      const x = p.largeur * 0.78 + (cx - p.largeur * 0.78) * q;
      const y = p.hauteur * 0.66 + (cy - p.hauteur * 0.66) * q;
      dessus.push(<Coche key="s" x={x} y={y} r={46 + (R - 46) * q} echelle={1} trace={prog(image, n - D, 4)} />);
    }
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: couleurs(p.fond).fond }}>
      <AbsoluteFill style={{ ...contenu, transformOrigin: `${cx}px ${cy}px` }}>{children}</AbsoluteFill>
      {dessus}
    </AbsoluteFill>
  );
}
