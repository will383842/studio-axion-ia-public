import React from "react";
/**
 * Axe 5 · Écrans de texte (image C). TYP-B Un mot géant à la fois (« Même. / À. / 3h. / du matin. »), TYP-C Lignes
 * qui glissent (la phrase-choc sort de ses caches), TYP-D Le mot devient l'objet (« alerte » devient la cloche).
 * Phrase-choc mot pour mot : « Votre client a toujours une réponse. Même à 3h du matin. »
 */
import { a, ANTON, Affiche, Appoint, Bulle, C, CartePleine, Coche, Ecran, Icone, INTER, Points } from "./outils";

/* ------------------------------------------------------------------ */
/* TYP-B · Un mot géant à la fois (battement)                            */
/* ------------------------------------------------------------------ */
/** Les 4 battements de la phrase : le courant est plein, les passés pâles. */
function Battements({ courant, couleur, passe, y = 1128 }: { courant: number; couleur: string; passe: string; y?: number }) {
  return (
    <div style={{ position: "absolute", left: 72, top: y, display: "flex", gap: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ width: i === courant ? 120 : 56, height: 12, borderRadius: 6, background: i === courant ? couleur : i < courant ? passe : a(passe, 0.35) }} />
      ))}
    </div>
  );
}

export const TYP_B_1 = () => (
  <Ecran fond="sombre">
    {/* 2e battement : « À. » occupe toute la hauteur utile. */}
    <div style={{ position: "absolute", left: 0, width: 950, textAlign: "center", top: 452, ...ANTON, fontSize: 716, lineHeight: 1, color: C.blanc }}>À.</div>
    <Battements courant={1} couleur={C.ivoire} passe={C.gris} />
  </Ecran>
);

/* v2 : « 3H. » descendu au milieu (capitales de y ≈ 400 à 968), battements juste au-dessus des sous-titres.
   Appoint : le cadran qui marque 3 h, en encre sur l'orange, qui monte du bas. */
export const TYP_B_2 = () => (
  // Le battement fort : « 3h. » plein écran, en encre sur panneau orange (contraste 6,4).
  <Ecran fond="sombre">
    {/* Panneau orange plein (aplat de fond) sous la marque, qui reste sur la nuit. */}
    <div style={{ position: "absolute", left: 0, top: 220, width: 1080, bottom: 0, background: C.orangeVif }} />
    {/* v3 : « 3H. » descendu (capitales y ≈ 490 → 1100), battements remontés en tête du panneau ; appoint : le
        cadran à 3 h devenu un disque plein (encre, aiguilles orange) et large, qui monte du bas. */}
    <div style={{ position: "absolute", left: 80, top: 476, ...ANTON, fontSize: 680, lineHeight: 1.0, color: C.encre, transform: "rotate(-3deg)", transformOrigin: "0 100%" }}>3h.</div>
    <Battements courant={2} couleur={C.encre} passe={C.encre} y={330} />
    <Appoint fondu={24}>
      <Cadran3h cx={540} cy={1504} r={204} plein />
    </Appoint>
  </Ecran>
);

/** Cadran d'horloge à 3 h : 12 graduations, aiguille des minutes sur 12, des heures sur 3 (encre sur orange). */
function Cadran3h({ cx, cy, r, plein }: { cx: number; cy: number; r: number; plein?: boolean }) {
  // `plein` : disque encre, graduations et aiguilles orange vif (la couleur du panneau).
  const t = plein ? C.orangeVif : C.encre;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={t} strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} strokeWidth={14} fill={plein ? C.encre : "none"} stroke={C.encre} />
      {Array.from({ length: 12 }, (_, h) => {
        const t = (h * 30 * Math.PI) / 180;
        const r0 = r - 30;
        const r1 = r - (h % 3 === 0 ? 74 : 52);
        return <path key={h} d={`M${(cx + r0 * Math.sin(t)).toFixed(1)} ${(cy - r0 * Math.cos(t)).toFixed(1)}L${(cx + r1 * Math.sin(t)).toFixed(1)} ${(cy - r1 * Math.cos(t)).toFixed(1)}`} strokeWidth={h % 3 === 0 ? 14 : 8} />;
      })}
      <path d={`M${cx} ${cy}V${cy - r + 92}`} strokeWidth={plein ? 18 : 12} />
      <path d={`M${cx} ${cy}H${cx + r - 120}`} strokeWidth={plein ? 26 : 18} />
      <circle cx={cx} cy={cy} r={16} fill={t} stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* TYP-C · Lignes qui glissent (chaque ligne sort de son cache)           */
/* ------------------------------------------------------------------ */
/** Une ligne derrière son cache : `sortie` 0 → 1 (1 = posée). Le bord du cache est un filet encre. */
function LigneCache({ texte, y, taille, sortie, filet = 1 }: { texte: string; y: number; taille: number; sortie: number; filet?: number }) {
  const h = taille * 1.0;
  // Marge haute de 0,25 em dans le cache : les accents d'Anton (Ê, À) dépassent la boîte de ligne.
  const m = taille * 0.25;
  return (
    <>
      <div style={{ position: "absolute", left: 66, top: y - m, width: 830, height: h + m, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 6, top: m + (1 - sortie) * h }}>
          <Affiche t={texte} taille={taille} fond="ivoire" style={{ lineHeight: 1 }} />
        </div>
      </div>
      {/* Le filet est le bord du cache ; tant que la ligne monte, il se trace encore (point au bout). */}
      <div style={{ position: "absolute", left: 72, top: y + h + 10, width: 810 * filet, height: 6, background: a(C.encre, 0.85), borderRadius: 3 }} />
      {filet < 1 ? <div style={{ position: "absolute", left: 72 + 810 * filet - 11, top: y + h + 2, width: 22, height: 22, borderRadius: "50%", background: C.encre }} /> : null}
    </>
  );
}

/* v2 : la phrase occupe la hauteur (4 lignes, la dernière plus grande) ; interligne réglé pour que l'accent de
   « RÉPONSE » reste à 17 px sous le filet de la ligne du dessus (filet à y + taille + 10, accent à 0,177 em au-dessus
   de la boîte de ligne d'Anton). Appoint : C-1, les filets des lignes qui viennent ; C-2, la réponse cochée. */
export const TYP_C_1 = () => (
  <Ecran fond="ivoire">
    <LigneCache texte="Votre client" y={262} taille={150} sortie={1} />
    <LigneCache texte="a toujours" y={462} taille={150} sortie={1} />
    <LigneCache texte="une" y={662} taille={150} sortie={1} />
    <LigneCache texte="réponse." y={880} taille={200} sortie={1} filet={0.64} />
    <Appoint>
      <div style={{ position: "absolute", left: 72, top: 1352, width: 810, height: 6, background: a(C.encre, 0.3), borderRadius: 3 }} />
      <div style={{ position: "absolute", left: 72, top: 1490, width: 810, height: 6, background: a(C.encre, 0.3), borderRadius: 3 }} />
    </Appoint>
  </Ecran>
);

export const TYP_C_2 = () => (
  <Ecran fond="ivoire">
    {/* « 3H » isolé en grand sur sa ligne : le mot orange devient le point focal. */}
    {/* v3 : bloc descendu de 28 px (accents de MÊME / À sous la zone cachée de 269 px) ; le filet de « du matin. » est
        presque tracé, son point au bout passe au-delà du point final (plus de point sous une lettre). */}
    <LigneCache texte="Même à" y={314} taille={190} sortie={1} />
    <LigneCache texte="*3h*" y={542} taille={380} sortie={1} />
    <LigneCache texte="du matin." y={948} taille={180} sortie={1} filet={0.92} />
    {/* v3 · Appoint : la réponse, cochée, en bulle pleine et large (aucun mot). */}
    <Appoint fondu={24}>
      <Bulle x={110} y={1316} l={640} h={176} contour={C.vert} ombre={false}>
        <Points taille={28} couleur={C.gris} />
      </Bulle>
      <Coche x={744} y={1358} r={52} />
    </Appoint>
  </Ecran>
);

/* ------------------------------------------------------------------ */
/* TYP-D · Le mot devient l'objet : « alerte » devient la cloche          */
/* ------------------------------------------------------------------ */
/* v2 : nouvelle cloche dessinée (grille 24, d'après le tracé CLOCHE d'outils.tsx) : bouton en haut, corps à épaules
   rondes, bord évasé, lèvre, battant. Le mot « ALERTE » est centré dans la partie droite (verticale) du corps, à 24 px au
   moins de chaque trait (largeur intérieure 11,6 unités). */
const CORPS = "M3.2 17.2C5 16.2 6.2 14.9 6.2 12.6V9.8C6.2 6.2 8.4 3.4 12 3.4C15.6 3.4 17.8 6.2 17.8 9.8V12.6C17.8 14.9 19 16.2 20.8 17.2";
const CORPS_PLEIN = CORPS + "Z";
const LEVRE = { x: 2.2, y: 17.2, l: 19.6, h: 1.6 };
const BOUTON = { cx: 12, cy: 2.2, r: 1.2 };
const BATTANT = { cx: 12, cy: 20.6, r: 1.4 };
const EP = 0.9;

/** La cloche à l'échelle `e` (px par unité), origine (x, y) = coin haut gauche de la grille 24.
 *  `trace` (0 → 1) : part du corps déjà dessinée (de la lèvre gauche, par le haut, vers la droite) ; à 1, lèvre, bouton
 *  et battant sont posés. `plein` : couleur de remplissage (cloche devenue objet). */
function Cloche({ x, y, e, trace, plein, trait, rotation = 0, battant = 0, mot, motTaille, motCouleur }: { x: number; y: number; e: number; trace: number; plein?: string; trait: string; rotation?: number; battant?: number; mot?: string; motTaille?: number; motCouleur?: string }) {
  // Lèvre, bouton et battant sont posés dès que le corps est presque fini : la silhouette se lit déjà en entier.
  const fini = trace >= 0.85;
  // Point du feutre au bout du tracé (calculé sur le tracé : 0,86 → (17,84 ; 13,29) ; 0,96 → (19,59 ; 16,40)).
  const bout: [number, number] | null = trace >= 0.85 && trace <= 0.87 ? [17.84, 13.29] : trace >= 0.955 && trace <= 0.965 ? [19.59, 16.4] : null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 24 * e, height: 24 * e, transform: `rotate(${rotation}deg)`, transformOrigin: `${12 * e}px ${2.2 * e}px` }}>
      <svg width={24 * e} height={24 * e} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} fill="none" stroke={trait} strokeWidth={EP} strokeLinecap="round" strokeLinejoin="round">
        {plein ? <path d={CORPS_PLEIN} fill={plein} stroke="none" /> : null}
        <path d={CORPS} pathLength={1} strokeDasharray={`${trace} 2`} />
        {fini ? (
          <>
            <rect x={LEVRE.x} y={LEVRE.y} width={LEVRE.l} height={LEVRE.h} rx={0.8} fill={plein ?? "none"} />
            <circle cx={BOUTON.cx} cy={BOUTON.cy} r={BOUTON.r} fill={plein ?? "none"} />
            <circle cx={BATTANT.cx + battant} cy={BATTANT.cy} r={BATTANT.r} fill={plein ?? trait} stroke={plein ? trait : "none"} />
          </>
        ) : null}
        {bout ? <circle cx={bout[0]} cy={bout[1]} r={0.75} fill={trait} stroke="none" /> : null}
      </svg>
      {mot ? (
        // Le mot est centré dans la partie droite du corps (capitales de 9,0 à 12,2 unités).
        <div style={{ position: "absolute", left: 0, width: 24 * e, textAlign: "center", top: 9.0 * e - 0.063 * (motTaille ?? 100) }}>
          <Affiche t={mot} taille={motTaille ?? 100} fond="sombre" couleur={motCouleur} />
        </div>
      ) : null}
    </div>
  );
}

/* TYP-D-1 : le mot est posé, le contour de la cloche se referme autour de lui (bouton, lèvre et battant posés, le
   feutre finit le bas du flanc droit ; v3 : il ne reste qu'un court bout de flanc à tracer).
   Appoint (v3) : la carte de l'alerte Telegram arrive, pleine (pastille « envoyer », message en cours) : aucun mot. */
export const TYP_D_1 = () => (
  <Ecran fond="sombre" temoin="Ici, il faut un humain.">
    <Cloche x={60} y={250} e={40} trace={0.96} trait={C.ivoire} mot="*Alerte*" motTaille={147} />
    <Appoint fondu={24}>
      <CartePleine x={150} y={1302} l={780} h={226} fond="sombre" icone="envoyer">
        <Points taille={24} />
      </CartePleine>
    </Appoint>
  </Ecran>
);

/* TYP-D-2 : la cloche est devenue l'objet : pleine, elle sonne (penchée, battant déporté, ondes) ; le mot reste gravé
   dedans, en encre. La vraie notification (« Intervention requise ») tombe dessous. Appoint : l'équipe prévenue. */
export const TYP_D_2 = () => (
  <Ecran fond="sombre" temoin="L'équipe est prévenue.">
    <Cloche x={204} y={234} e={28} trace={1} plein={C.orangeVif} trait={C.orangeVif} rotation={-10} battant={1.2} mot="Alerte" motTaille={100} motCouleur={C.encre} />
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={C.ivoire} strokeWidth={10} strokeLinecap="round">
      <path d="M200 380 Q 160 470 200 560" opacity={0.85} />
      <path d="M140 340 Q 90 470 140 600" opacity={0.45} />
      <path d="M880 380 Q 920 470 880 560" opacity={0.85} />
      <path d="M940 340 Q 990 470 940 600" opacity={0.45} />
    </svg>
    {/* La notification réelle (« Intervention requise »), carte blanche cerclée d'encre. */}
    <div style={{ position: "absolute", left: 90, top: 912, width: 780, boxSizing: "border-box", padding: "26px 34px", borderRadius: 40, background: C.blanc, border: `6px solid ${C.encre}`, display: "flex", alignItems: "center", gap: 28, boxShadow: `0 20px 50px ${a(C.nuit, 0.5)}` }}>
      <div style={{ width: 100, height: 100, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icone nom="envoyer" taille={56} couleur={C.blanc} epaisseur={2.6} />
      </div>
      <div style={{ ...INTER, fontSize: 60, color: C.encre }}>Intervention requise</div>
    </div>
    {/* v3 · Appoint : l'équipe prévenue, en carte pleine et large (pastille « équipe », réponse en cours) : aucun mot. */}
    <Appoint fondu={24}>
      <CartePleine x={150} y={1316} l={780} h={214} fond="sombre" icone="utilisateurs">
        <Points taille={24} />
      </CartePleine>
    </Appoint>
  </Ecran>
);
