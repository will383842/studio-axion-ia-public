import React from "react";
/**
 * AXE 6 · APPARITION DU SCHÉMA (image C, chatbot). APP-A = la vraie scène (rebond) ; APP-B à APP-D = maquettes.
 */
import { BEIGE_ETEINT, C, Carte, Ecran, Fil, Icone, Jeton, Part, Svg, enS, teinte } from "./kit";

/* ------------------------------------------------------------------ */
/* APP-B · Tracé au feutre : le contour se dessine, puis la carte se remplit, puis le texte arrive. */
/* ------------------------------------------------------------------ */

/** Contour arrondi (rayon 34) en un seul trait, départ en haut à gauche, sens horaire. */
function contour(x: number, y: number, l: number, h: number, r = 34) {
  return `M ${x + r} ${y} L ${x + l - r} ${y} A ${r} ${r} 0 0 1 ${x + l} ${y + r} L ${x + l} ${y + h - r} A ${r} ${r} 0 0 1 ${x + l - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y}`;
}

/** Le feutre : corps encre, pointe posée sur le bout du trait (x, y). */
function Feutre({ x, y, angle = 28 }: { x: number; y: number; angle?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `rotate(${angle}deg)` }}>
      {/* ombre douce sous le feutre */}
      <div style={{ position: "absolute", left: 6, top: -230, width: 64, height: 236, borderRadius: 30, background: teinte(C.encre, 0.08), filter: "blur(14px)", transform: "translate(18px, 18px)" }} />
      {/* pointe */}
      <svg width={60} height={60} style={{ position: "absolute", left: -30, top: -58 }} viewBox="0 0 60 60">
        <path d="M 14 0 L 46 0 L 34 54 Q 30 60 26 54 Z" fill={C.encre} />
      </svg>
      {/* corps */}
      <div style={{ position: "absolute", left: -32, top: -250, width: 64, height: 196, borderRadius: "14px 14px 8px 8px", background: C.encre }} />
      <div style={{ position: "absolute", left: -32, top: -250, width: 64, height: 54, borderRadius: "14px 14px 0 0", background: C.orangeVif }} />
    </div>
  );
}

/** Trait « au feutre » : même chemin, bords un peu vivants (deux passes légèrement décalées). */
function TraitFeutre({ d, trace }: { d: string; trace: number }) {
  return (
    <Svg>
      <path d={d} pathLength={1} fill="none" stroke={C.encre} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} />
      <path d={d} pathLength={1} fill="none" stroke={C.encre} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} opacity={0.35} transform="translate(1.5 -1.5)" />
    </Svg>
  );
}

export function AppB1() {
  const x = 130;
  const y = 560;
  const l = 700;
  const h = 360;
  return (
    <Ecran fond="ivoire" sousTitre="Un e-mail *propre* part.">
      <Svg>
        <Fil d={`M 250 250 C 250 420, 480 420, 480 ${y - 6}`} couleur={C.encre} />
      </Svg>
      <Part x={300} y={430} texte="20 %" couleur="noir" taille={96} />
      <TraitFeutre d={contour(x, y, l, h)} trace={0.62} />
      <Feutre x={543} y={y + h} angle={125} />
    </Ecran>
  );
}

/** Contour arrondi qui part du MILIEU du bord bas (sens horaire) : le feutre le referme là où il l'a commencé. */
function contourBas(x: number, y: number, l: number, h: number, r = 34) {
  const m = x + l / 2;
  return `M ${m} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + l - r} ${y} A ${r} ${r} 0 0 1 ${x + l} ${y + r} L ${x + l} ${y + h - r} A ${r} ${r} 0 0 1 ${x + l - r} ${y + h} L ${m} ${y + h}`;
}

export function AppB2() {
  // v3 : milieu de l'animation. En haut, « Email structuré » est fini (contour + carte + texte). Dessous, la carte
  // suivante, grande : le feutre vient de REFERMER son contour (il repart du bas), le blanc de la carte se pose de
  // gauche à droite, le texte n'est pas encore là. Zone d'appoint : l'étape d'après, déjà posée en vraie carte.
  const x = 150;
  const l = 780;
  const y1 = 296;
  const h1 = 320;
  const y2 = 712;
  const h2 = 420;
  const remplie = 0.64;
  return (
    <Ecran fond="ivoire" sousTitre="Vers la bonne *équipe.*">
      <Svg>
        <Fil d={`M 540 236 L 540 ${y1}`} couleur={C.encre} pointe={false} />
        <Fil d={`M 540 ${y1 + h1} L 540 ${y2 - 16}`} couleur={C.encre} bout={[540, y2 - 16]} />
        <Fil d="M 540 1294 L 540 1326" couleur={C.encre} pointe={false} />
      </Svg>
      <Carte x={x} y={y1} l={l} h={h1} libelle={"Email\nstructuré"} taille={112} icone="mail" etat="pose" ombre={`0 0 0 7px ${C.encre}, 0 18px 44px ${teinte(C.encre, 0.1)}`} />
      {/* Le blanc de la carte se pose (bord doux), derrière le trait. */}
      <div style={{ position: "absolute", left: x, top: y2, width: l, height: h2, borderRadius: 34, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: l * remplie + 60, height: h2, background: `linear-gradient(to right, ${C.blanc} 0, ${C.blanc} ${l * remplie - 40}px, ${teinte(C.blanc, 0)} ${l * remplie + 60}px)` }} />
      </div>
      <TraitFeutre d={contourBas(x, y2, l, h2)} trace={1} />
      {/* Sa pastille d'icône arrive (posée à cheval sur le bord, comme le nœud réel). */}
      <Jeton x={x - 16} y={y2 + h2 / 2} r={46} icone="cloche" />
      <Feutre x={x + l / 2 + 4} y={y2 + h2} angle={32} />
      {/* Zone d'appoint : l'étape suivante, vraie carte pleine (sans texte). */}
      <Carte x={210} y={1326} l={660} h={184} icone="utilisateur" etat="pose" />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* APP-C · Fantôme qui s'allume : tout le schéma est là, pâle ; chaque étape s'allume quand on en parle. */
/* ------------------------------------------------------------------ */

const F = { gx: 130, gl: 590, dx: 770, dl: 250, rangs: [690, 800, 910, 1020], h: 92 };

function SchemaFantome({ allumees }: { allumees: number }) {
  const cg = F.gx + F.gl / 2;
  const cd = F.dx + F.dl / 2;
  const gauche = [
    { libelle: "Réponse générée", icone: "etincelles" },
    { libelle: "Envoyée en 4 s", icone: "eclair" },
    { libelle: "Ticket clôturé", icone: "document" },
    { libelle: "Résolu sans humain", icone: "coche" },
  ];
  const pale = teinte(C.grisClair, 0.7);
  return (
    <>
      <Svg>
        <Fil d="M 475 410 L 475 450" couleur={C.orangeVif} pointe={false} />
        <Fil d={enS(475, 560, cg, F.rangs[0])} couleur={C.orangeVif} pointe={false} />
        <Fil d={enS(475, 560, cd, F.rangs[0])} couleur={pale} pointe={false} />
        {F.rangs.slice(0, -1).map((y, i) => (
          <React.Fragment key={y}>
            <Fil d={`M ${cg} ${y + F.h} L ${cg} ${y + 110}`} couleur={i < allumees - 1 ? C.orangeVif : pale} pointe={false} />
            <Fil d={`M ${cd} ${y + F.h} L ${cd} ${y + 110}`} couleur={pale} pointe={false} />
          </React.Fragment>
        ))}
      </Svg>
      <Carte x={260} y={300} l={430} h={110} libelle="23h14" icone="message" taille={72} etat="pose" />
      <Carte x={260} y={450} l={430} h={110} libelle="Chatbot IA" icone="robot" taille={68} couleur="orange" etat="pose" />
      {gauche.map((g, i) =>
        i < allumees ? (
          <Carte key={g.libelle} x={F.gx} y={F.rangs[i]} l={F.gl} h={F.h} libelle={g.libelle} icone={g.icone} taille={58} couleur={i === 3 ? "vert" : "orange"} etat={i === allumees - 1 ? "actif" : "pose"} coche={i === 3 ? 1 : 0} />
        ) : (
          <Carte key={g.libelle} x={F.gx} y={F.rangs[i]} l={F.gl} h={F.h} icone={g.icone} etat="fantome" />
        ),
      )}
      {["mail", "utilisateurs", "cloche", "utilisateur"].map((ic, i) => (
        <Carte key={ic} x={F.dx} y={F.rangs[i]} l={F.dl} h={F.h} icone={ic} etat="fantome" />
      ))}
      <Part x={cg - 30} y={625} texte="80 %" couleur="orange" taille={96} />
      {/* La part 20 % attend, pâle, sans chiffre lisible : elle s'allumera avec sa branche. */}
      <div style={{ position: "absolute", left: cd - 92, top: 625 - 58, width: 184, height: 116, borderRadius: 999, background: teinte(C.blanc, 0.5), border: `3px solid ${pale}`, boxSizing: "border-box" }} />
    </>
  );
}

export function AppC1() {
  return (
    <Ecran fond="ivoire" sousTitre="Personne n'a *bougé.*">
      <SchemaFantome allumees={4} />
    </Ecran>
  );
}

/**
 * v3 : schéma plus grand et sur toute la hauteur. « 23h14 » et « Chatbot IA » partagent la première rangée, les parts
 * dessous, puis les étapes (hauteur 170) : trois rangs au-dessus de la bande des sous-titres, le 4e dans la zone
 * d'appoint. Les étapes pas encore allumées sont des cartes ÉTEINTES pleines (beige pâle opaque, sans texte) : le
 * schéma entier est là, présent, et une seule carte est allumée.
 */
const F2 = { gx: 130, gl: 540, dx: 750, dl: 260, rangs: [566, 752, 938, 1300], h: 166 };

function SchemaFantome2() {
  const cg = F2.gx + F2.gl / 2;
  const cd = F2.dx + F2.dl / 2;
  const icG = ["etincelles", "eclair", "document", "coche"];
  const icD = ["mail", "utilisateurs", "cloche", "utilisateur"];
  const pale = C.grisClair;
  const liens = (c: number) =>
    F2.rangs.slice(0, -1).map((y, i) =>
      i === 2 ? (
        <React.Fragment key={`${c}${y}`}>
          <Fil d={`M ${c} ${y + F2.h} L ${c} 1140`} couleur={pale} pointe={false} />
          <Fil d={`M ${c} 1294 L ${c} ${F2.rangs[3]}`} couleur={pale} pointe={false} />
        </React.Fragment>
      ) : (
        <Fil key={`${c}${y}`} d={`M ${c} ${y + F2.h} L ${c} ${F2.rangs[i + 1]}`} couleur={pale} pointe={false} />
      ),
    );
  return (
    <>
      <Svg>
        <Fil d="M 410 332 L 458 332" couleur={C.encre} pointe={false} />
        <Fil d={`M 730 384 C 730 460, ${cg} 480, ${cg} ${F2.rangs[0]}`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M 730 384 C 730 460, ${cd} 480, ${cd} ${F2.rangs[0]}`} couleur={pale} pointe={false} />
        {liens(cg)}
        {liens(cd)}
      </Svg>
      <Carte x={130} y={280} l={280} h={104} libelle="23h14" icone="message" taille={76} etat="pose" />
      <Carte x={520} y={280} l={420} h={104} libelle="Chatbot IA" icone="robot" taille={72} couleur="orange" etat="pose" />
      {icG.map((ic, i) =>
        i === 0 ? (
          <Carte key={ic} x={F2.gx} y={F2.rangs[i]} l={F2.gl} h={F2.h} libelle={"Réponse\ngénérée"} icone={ic} taille={64} couleur="orange" etat="actif" />
        ) : (
          <Carte key={ic} x={F2.gx} y={F2.rangs[i]} l={F2.gl} h={F2.h} icone={ic} etat="eteinte" />
        ),
      )}
      {icD.map((ic, i) => (
        <Carte key={ic} x={F2.dx} y={F2.rangs[i]} l={F2.dl} h={F2.h} icone={ic} etat="eteinte" />
      ))}
      {/* La part 80 % : à gauche du fil, entre le Chatbot et la première étape, rien ne la touche. */}
      <Part x={232} y={470} texte="80 %" couleur="orange" taille={96} />
    </>
  );
}

export function AppC2() {
  return (
    <Ecran fond="ivoire" sousTitre="Il connaît la solution.">
      <SchemaFantome2 />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* APP-D · Cartes qui tombent : les cartes tombent d'en haut et se posent, comme des fiches sur une table. */
/* ------------------------------------------------------------------ */

const ombreFiche = `0 6px 10px ${teinte(C.encre, 0.08)}, 0 22px 40px ${teinte(C.encre, 0.1)}`;

/** Place réservée (la fiche qui tombera ensuite) : emplacement plein, beige éteint, pastille pâle. */
function Place({ x, y, l, h, icone }: { x: number; y: number; l: number; h: number; icone: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 34, background: BEIGE_ETEINT, transform: "rotate(-1.5deg)" }} />
      <div style={{ position: "absolute", left: -44, top: h / 2 - 44, width: 88, height: 88, borderRadius: "50%", background: C.grisClair, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={50} couleur={C.ivoire} epaisseur={2.6} />
      </div>
    </div>
  );
}

export function AppD1() {
  // v2 : fiches plus grandes, la 3e tombe (encore haute, ombre floue au sol), la place de la 4e attend sous la bande.
  return (
    <Ecran fond="ivoire" sousTitre="Personne n'y a *touché.*">
      <Svg>
        <Fil d={enS(450, 455, 540, 535)} couleur={C.orangeVif} pointe={false} />
      </Svg>
      <Carte x={135} y={276} l={740} h={180} libelle="Réponse générée" taille={88} icone="etincelles" couleur="orange" etat="pose" rotation={-2.5} ombre={ombreFiche} />
      <Carte x={170} y={535} l={720} h={180} libelle="Envoyée en 4 s" taille={96} icone="eclair" couleur="orange" etat="pose" rotation={1.8} ombre={ombreFiche} />
      {/* Ombre de la fiche qui tombe : posée sur la table, là où elle va atterrir (encore floue, la fiche est haute). */}
      <div style={{ position: "absolute", left: 210, top: 1030, width: 620, height: 100, borderRadius: 40, background: teinte(C.encre, 0.12), filter: "blur(26px)" }} />
      <Carte x={180} y={810} l={660} h={180} libelle="Ticket clôturé" taille={90} icone="document" couleur="orange" etat="actif" rotation={6} echelle={1.08} ombre={`0 40px 70px ${teinte(C.encre, 0.12)}`} />
      {/* v3 : la place de la 4e fiche, PLEINE (beige éteint opaque, pas de pointillés), assez haute pour la zone d'appoint. */}
      <Place x={170} y={1318} l={720} h={190} icone="coche" />
    </Ecran>
  );
}

void Jeton;
