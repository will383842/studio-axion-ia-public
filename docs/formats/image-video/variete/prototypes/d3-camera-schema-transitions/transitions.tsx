import React from "react";
/**
 * AXE 7 · TRANSITIONS (image C, chatbot). Chaque image montre l'instant du MILIEU de la transition, net.
 * TRA-A (coupe franche) = la vraie scène, juste avant / juste après la coupe.
 */
import { AbsoluteFill } from "remotion";
import { Entete, Fond } from "../socle";
import { ANTON, C, Carte, Ecran, Fil, Icone, INTER, Jeton, Part, SousTitre, Svg, Texte, enS, teinte } from "./kit";

/* ------------------------------------------------------------------ */
/* TRA-B · Raccord d'objet : la coche verte grossit et devient l'écran « Résolu ». */
/* ------------------------------------------------------------------ */

/** Grand disque vert avec la coche blanche (l'objet qui devient l'écran suivant). */
function DisqueCoche({ x, y, r, trait = 1 }: { x: number; y: number; r: number; trait?: number }) {
  const t = r * 1.05;
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, boxShadow: `0 30px 70px ${teinte(C.vert, 0.25)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.2 * trait} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/**
 * Zone d'appoint de TRA-B (v3) : la frise des 4 étapes de la branche 80 %, toutes faites, posée sur une VRAIE carte
 * pleine (rien d'indispensable : icônes seulement, on lit « Résolu » au-dessus).
 */
function PisteFaite({ y = 1318, h = 188 }: { y?: number; h?: number }) {
  const ic = ["etincelles", "eclair", "document", "coche"];
  const pas = 196;
  const x0 = 540 - 1.5 * pas;
  const yc = y + h / 2;
  return (
    <>
      <div style={{ position: "absolute", left: 150, top: y, width: 780, height: h, borderRadius: 34, background: C.blanc, boxShadow: `0 18px 44px ${teinte(C.encre, 0.1)}` }} />
      <Svg>
        <path d={`M ${x0} ${yc} L ${x0 + 3 * pas} ${yc}`} stroke={C.encre} strokeWidth={8} strokeLinecap="round" />
      </Svg>
      {ic.map((n, i) => (
        <Jeton key={n} x={x0 + i * pas} y={yc} r={56} icone={n} couleur={i === 3 ? "vert" : "noir"} />
      ))}
    </>
  );
}

/** Carte « Résolu sans humain » de TRA-B (pastille entière à x ≥ 68 ; coin de la coche en (816, 574)). */
const TB = { x: 130, y: 560, l: 700, h: 570, cx: 816, cy: 574 };

export function TraB1() {
  // La coche (rayon 46 sur la carte) a déjà grossi ×4 : elle grossit depuis le coin de la carte.
  const { cx, cy } = TB;
  return (
    <Ecran fond="ivoire" sousTitre="Personne n'a *bougé.*">
      <Svg>
        <Fil d={`M 330 236 L 330 ${TB.y}`} couleur={C.vert} pointe={false} />
      </Svg>
      <Carte x={TB.x} y={TB.y} l={TB.l} h={TB.h} libelle={"Résolu\nsans humain"} taille={106} icone="coche" couleur="vert" etat="actif" aligne="gauche" />
      {/* Onde de croissance, puis le disque, puis la taille d'origine de la coche (pointillés). */}
      <div style={{ position: "absolute", left: cx - 240, top: cy - 240, width: 480, height: 480, borderRadius: "50%", background: teinte(C.vert, 0.12) }} />
      <DisqueCoche x={cx} y={cy} r={186} />
      <PisteFaite />
    </Ecran>
  );
}

export function TraB2() {
  return (
    <Ecran fond="ivoire" sousTitre="Le client a sa *réponse.*">
      {/* v3 : plus de carte blanche derrière le disque (elle dépassait dessous) ; le disque a tout recouvert. */}
      <div style={{ position: "absolute", left: 540 - 450, top: 692 - 450, width: 900, height: 900, borderRadius: "50%", background: C.vert, boxShadow: `0 30px 70px ${teinte(C.vert, 0.25)}` }} />
      <svg width={300} height={300} viewBox="0 0 24 24" style={{ position: "absolute", left: 540 - 150, top: 340 }} fill="none" stroke={C.blanc} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <Texte x={540} y={660} taille={220} centre largeur={800} couleur={C.blanc}>
        Résolu.
      </Texte>
      <PisteFaite />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* TRA-C · Balayage orange : une bande orange traverse l'écran et révèle la suite (ici, de haut en bas). */
/* ------------------------------------------------------------------ */

/** Zone d'appoint de TRA-C (v3) : la branche 20 %, en cartes pleines éteintes (sans texte), qui attend son tour. */
function Branche20Pale() {
  return (
    <>
      <Carte x={150} y={1318} l={370} h={188} icone="mail" etat="eteinte" />
      <Carte x={610} y={1318} l={370} h={188} icone="utilisateurs" etat="eteinte" />
    </>
  );
}

export function TraC1() {
  // Bande inclinée : bord haut de (0, 700) à (1080, 620), bord bas de (0, 890) à (1080, 810).
  const haut = "polygon(0 0, 1080px 0, 1080px 620px, 0 700px)";
  const bande = "polygon(0 700px, 1080px 620px, 1080px 810px, 0 890px)";
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Scène qui part (ivoire) : la branche 80 % se termine. */}
      <Fond fond="ivoire" largeur={1080} hauteur={1920} />
      <Svg>
        <Fil d="M 470 800 L 470 940" couleur={C.orangeVif} pointe={false} />
      </Svg>
      <Carte x={140} y={940} l={740} h={190} libelle="Résolu sans humain" taille={76} icone="coche" couleur="vert" etat="pose" />
      <Branche20Pale />
      <SousTitre texte="Trop complexe pour lui." fond="ivoire" />
      {/* Scène qui arrive (nuit), révélée derrière la bande. */}
      <AbsoluteFill style={{ clipPath: haut }}>
        <Fond fond="sombre" largeur={1080} hauteur={1920} />
        <Part x={540} y={530} texte="20 %" couleur="nuit" taille={150} />
        <Entete entete={{ debut: 0, fin: 99, etiquette: "", titre: "Sa *limite.*" }} ecoule={5} sortie={0} fond="sombre" marque="axion-ia.com" largeur={1080} hauteur={1920} />
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: bande, background: C.orangeVif }} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* TRA-D · On entre dedans : la caméra plonge dans la carte « Chatbot IA », qui devient l'écran suivant. */
/* ------------------------------------------------------------------ */

export function TraD1() {
  // v3 : RIEN ne dépasse de la carte agrandie : plus de fil d'arrivée au-dessus, la pastille du chatbot est entrée
  // dans le cadre (en haut à gauche), les deux branches partent d'un point intérieur et s'arrêtent avant les chiffres.
  const X = 90;
  const L = 900;
  const Y = 290;
  const H = 850;
  const o = { x: 560, y: 420 };
  return (
    <Ecran fond="ivoire" sousTitre="Il sait où l'envoyer.">
      {/* La carte « Chatbot IA » à ×2,2 : son contour orange devient le cadre de l'écran suivant. */}
      <div style={{ position: "absolute", left: X, top: Y, width: L, height: H, boxSizing: "border-box", borderRadius: 96, border: `18px solid ${C.orangeVif}`, background: C.blanc, boxShadow: `0 40px 90px ${teinte(C.encre, 0.12)}` }} />
      {/* Sa pastille d'icône, géante, désormais DANS le cadre. */}
      <div style={{ position: "absolute", left: X + 50, top: Y + 50, width: 180, height: 180, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom="robot" taille={104} couleur={C.orangeVif} epaisseur={2.6} />
      </div>
      {/* L'écran suivant, déjà net à l'intérieur : la décision 80 / 20. */}
      <Svg>
        <Fil d={`M ${o.x} ${Y + 18} L ${o.x} ${o.y}`} couleur={C.orangeVif} pointe={false} epaisseur={12} />
        <Fil d={`M ${o.x} ${o.y} C ${o.x} 480, 400 470, 400 552`} couleur={C.orangeVif} pointe={false} epaisseur={12} />
        <Fil d={`M ${o.x} ${o.y} C ${o.x} 500, 830 470, 830 600 L 830 812`} couleur={C.encre} pointe={false} epaisseur={12} />
        <circle cx={o.x} cy={o.y} r={20} fill={C.orangeVif} />
      </Svg>
      <Texte x={400} y={575} taille={200} centre largeur={520} couleur={C.orange}>
        80 %
      </Texte>
      <Texte x={706} y={840} taille={150} centre largeur={400} couleur={C.encre}>
        20 %
      </Texte>
      {/* Zone d'appoint : hors de la carte, les étapes suivantes de chaque branche, en vraies cartes pleines. */}
      <Carte x={150} y={1318} l={370} h={188} icone="etincelles" couleur="orange" etat="pose" />
      <Carte x={610} y={1318} l={370} h={188} icone="mail" etat="pose" />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* TRA-E · Poussée : l'écran « 20 % » entre par la droite et pousse l'écran « 80 % » hors du cadre. */
/* ------------------------------------------------------------------ */

export function TraE1() {
  const bord = 536;
  const gauche = `polygon(0 0, ${bord}px 0, ${bord}px 1920px, 0 1920px)`;
  const droite = `polygon(${bord}px 0, 1080px 0, 1080px 1920px, ${bord}px 1920px)`;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Écran qui part : « 80 % », poussé vers la gauche. */}
      <AbsoluteFill style={{ clipPath: gauche }}>
        <Fond fond="ivoire" largeur={1080} hauteur={1920} />
        <Texte x={70} y={580} taille={200} couleur={C.orange}>
          80 %
        </Texte>
        <Texte x={78} y={830} taille={64} police="inter" couleur={C.encre}>
          Réponse
          <br />
          connue
        </Texte>
        <Entete entete={null} ecoule={5} sortie={0} fond="ivoire" marque="axion-ia.com" largeur={1080} hauteur={1920} />
        {/* Ombre douce portée par l'écran qui arrive. */}
        <div style={{ position: "absolute", left: bord - 160, top: 0, width: 160, height: 1920, background: `linear-gradient(to right, ${teinte(C.encre, 0)}, ${teinte(C.encre, 0.12)})` }} />
      </AbsoluteFill>
      {/* Écran qui arrive : « 20 % », sur nuit. */}
      <AbsoluteFill style={{ clipPath: droite }}>
        <Fond fond="sombre" largeur={1080} hauteur={1920} />
        <Texte x={592} y={610} taille={150} couleur={C.ivoire}>
          20 %
        </Texte>
        <Texte x={598} y={830} taille={64} police="inter" couleur={C.ivoire}>
          Limite
          <br />
          atteinte
        </Texte>
        <Entete entete={null} ecoule={5} sortie={0} fond="sombre" marque="axion-ia.com" largeur={1080} hauteur={1920} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

void ANTON;
void INTER;
void Part;
void enS;
