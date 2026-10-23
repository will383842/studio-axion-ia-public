import React from "react";
/**
 * CARTE « VOLET AVANT / APRÈS » (`volet-avant-apres`) — version premium du designer n° 4 (15/10/2026), reprise du
 * brouillon, avec un mode « problème → solution » repris de la Bascule (brouillon écarté).
 * Quand : « Avant… maintenant… », « sans… avec… », un problème puis sa réponse.
 *
 * Panneau qui COUVRE TOUT LE VISAGE (0,045 → 0,955 L, 0,10 → 0,575 H ; la prise ne bouge pas), coupé par une
 * DIAGONALE nette (filet encre-douce) :
 *  - zone « avant » (en haut) : ivoire-creux, grain renforcé à 6 %, pictogrammes en sable-profond dans des cercles
 *    plats ; en mode « problème », le mot fort en HÉROS (≥ 0,09 L), FISSURÉ ;
 *  - zone « après » (en bas) : ivoire, pictogrammes ivoire dans des disques orange (dégradé, reflet, micro-ombre).
 *  - Légendes en corps (0,027 L) sous chaque pictogramme ; titres de zone dans des ONGLETS (titre 0,041 L). L'onglet
 *    « après » est le seul élément intérieur en relief (contour 0,003 L, ombre 0,005 L).
 * Avant leur mot, les emplacements restent visibles en pointillés sable (« en attente ») : le panneau est plein dès
 * son entrée.
 *  - N1 : le panneau entre par la droite, incliné, et se redresse (entrée « fenêtre » du format).
 *  - N2 : chaque pictogramme « avant » arrive sur son mot (translation 0,03 L + fondu) ; en mode problème, le mot fort
 *         CLAQUE puis se FISSURE (trait 0,14 s, les deux moitiés s'écartent). Sur le mot de bascule, un VOLET ORANGE
 *         balaie tout le panneau de haut en bas en 0,22 s, étiré par la vitesse (5 %) ; sous lui, l'« avant » se
 *         désature vers le sable et l'onglet « après » s'allume ; les pictogrammes « après » sautent en cascade de 50 ms
 *         (chacun au plus tôt sur son mot). Chaque arrivée écrase le panneau de 1,5 % (suivi).
 *  - N3 : l'« avant » tremble de 1 px (la corvée), l'« après » respire (1,5 %).
 */
import { Easing, interpolate } from "remotion";
import { animationFenetre } from "../cadrage";
import { largeurTexte, POLICES } from "../charte";
import { Icone } from "../elements";
import { fondParDefaut, ScenePrise } from "./commun";
import type { Bruitage } from "./commun";
import { bosse, claque, DEGRADE_ORANGE, enEclat, entree, epFilet, fondu, Grain, lin, microOmbre, N4, pose, refletInset, respire, styleCoque, styleHeros, suivi, tremble, TYPO4 } from "./premium-4";

export type PictoVolet = { icone: string; texte: string; a: number };

/** Mode « problème → solution » : quelques mots en corps puis le mot fort en héros, fissuré. */
export type ProblemeVolet = { mots: { texte: string; a: number }[]; fort: { texte: string; a: number }; fissureA?: number };

export type DonneesVoletAvantApres = {
  debut: number;
  fin: number;
  /** « avant-apres » (par défaut) ou « probleme » (zone du haut = le problème, mot fort fissuré). */
  mode?: "avant-apres" | "probleme";
  titreAvant: string;
  titreApres: string;
  /** Mode avant-après : 2 ou 3 pictogrammes, chacun sur son mot. */
  avant: PictoVolet[];
  /** Mode problème : mots et mot fort. */
  probleme?: ProblemeVolet;
  /** 2 ou 3 pictogrammes, chacun sur son mot (au plus tôt après le volet). */
  apres: PictoVolet[];
  /** Instant du mot de bascule (« maintenant », « avec », « la solution ») : le volet orange balaie. */
  basculeA: number;
};

export const EXEMPLE_PHRASE_VOLET_AVANT_APRES = "Avant, vos relances partaient à la main ; maintenant, elles partent seules.";
export const EXEMPLE_VOLET_AVANT_APRES: DonneesVoletAvantApres = {
  debut: 0.1,
  fin: 4.4,
  mode: "avant-apres",
  titreAvant: "Avant",
  titreApres: "Maintenant",
  avant: [
    { icone: "mail", texte: "Vos relances", a: 0.55 },
    { icone: "crayon", texte: "À la main", a: 1.0 },
    { icone: "horloge", texte: "Une par une", a: 1.3 },
  ],
  apres: [
    { icone: "robot", texte: "Automatiques", a: 2.05 },
    { icone: "envoyer", texte: "Parties seules", a: 2.35 },
    { icone: "coche", texte: "À l'heure", a: 2.65 },
  ],
  basculeA: 1.6,
};
/** Instant le plus représentatif (avant désaturé, les 3 pictogrammes « après » posés). */
export const INSTANT_VOLET_AVANT_APRES = 3.1;
/** Instant de construction (les 3 « avant » posés, « après » en attente). */
export const INSTANT_CONSTRUCTION_VOLET = 1.5;

export const EXEMPLE_PHRASE_VOLET_PROBLEME = "Le problème, ce n'est pas votre équipe : c'est la ressaisie. La solution : relier vos outils, saisir une fois, partager partout.";
export const EXEMPLE_VOLET_PROBLEME: DonneesVoletAvantApres = {
  debut: 0,
  fin: 5.6,
  mode: "probleme",
  titreAvant: "Le problème",
  titreApres: "La solution",
  avant: [],
  probleme: {
    mots: [
      { texte: "Pas votre équipe :", a: 0.75 },
      { texte: "c'est la", a: 1.5 },
    ],
    fort: { texte: "Ressaisie", a: 1.8 },
    fissureA: 1.95,
  },
  apres: [
    { icone: "lien", texte: "Relier vos outils", a: 3.45 },
    { icone: "crayon", texte: "Saisir une fois", a: 3.95 },
    { icone: "partage", texte: "Partager partout", a: 4.35 },
  ],
  basculeA: 2.95,
};
export const INSTANT_VOLET_PROBLEME = 4.9;
export const INSTANT_CONSTRUCTION_VOLET_PROBLEME = 2.5;

/** Emprise du panneau (fractions de l'image) : couvre tout le visage, cheveux → menton, oreilles comprises. */
export const CADRAGE_VOLET = Object.freeze({ x0: 0.045, x1: 0.955, y0: 0.1, y1: 0.575, couvreVisage: true });

/** Diagonale : hauteur (fraction de l'intérieur) à gauche et à droite. */
const DIAG = { gauche: 0.55, droite: 0.44 };
/** Volet : balayage 0,22 s ; l'« avant » se désature à +0,07 s, l'« après » s'allume à +0,15 s. */
const VOLET = { duree: 0.22, gris: 0.07, allume: 0.15, cascade: 0.05 };

const instantApres = (d: DonneesVoletAvantApres, i: number) => Math.max(d.apres[i].a, d.basculeA + VOLET.allume + 0.02 + i * VOLET.cascade);

/**
 * Fissure : ligne brisée (en % de la boîte du mot) qui traverse TOUT le mot de gauche à droite, à mi-hauteur, parallèle
 * à la diagonale du panneau. Le mot se casse en deux : la moitié basse glisse et s'incline.
 */
const FISSURE: [number, number][] = [
  [-3, 56],
  [10, 50],
  [22, 58],
  [35, 49],
  [48, 57],
  [61, 48],
  [74, 56],
  [88, 49],
  [103, 54],
]

function MotFissure({ t, texte, a, fissureA, taille, couleur, W }: { t: number; texte: string; a: number; fissureA: number; taille: number; couleur: string; W: number }) {
  if (t < a) return null;
  const e = claque(t, a, 0.1);
  const trace = lin(t, fissureA, 0.14);
  const ecart = pose(t, fissureA + 0.1, 0.2);
  const casse = trace > 0;
  const pts = FISSURE.map(([x, y]) => `${x}% ${y}%`);
  const haut = `polygon(-5% -20%, 105% -20%, ${[...pts].reverse().join(", ")})`;
  const bas = `polygon(${pts.join(", ")}, 105% 120%, -5% 120%)`;
  const style: React.CSSProperties = { position: "absolute", left: 0, top: 0, fontFamily: POLICES.titre, fontSize: taille, lineHeight: 1, color: couleur, textTransform: "uppercase", letterSpacing: "0.01em", whiteSpace: "nowrap" };
  return (
    <div style={{ position: "relative", display: "inline-block", opacity: fondu(t, a), transform: `scale(${0.93 + 0.07 * e})`, transformOrigin: "0% 60%" }}>
      {/* Le mot lui-même (invisible) donne la taille de la boîte. */}
      <span style={{ ...style, position: "relative", visibility: "hidden" }}>{texte}</span>
      {casse ? (
        <>
          <span style={{ ...style, clipPath: haut }}>{texte}</span>
          <span style={{ ...style, clipPath: bas, transform: `translate(${0.003 * W * ecart}px, ${0.004 * W * ecart}px) rotate(${0.4 * ecart}deg)`, transformOrigin: "0% 50%" }}>{texte}</span>
          {/* Le trait de fissure (couleur du fond) se dessine de gauche à droite en 0,14 s. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", clipPath: `inset(-20% ${(1 - trace) * 100}% -20% -5%)` }}>
            <polyline points={FISSURE.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={N4.ivoireCreux} strokeWidth={0.007 * W} strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
            <polyline points="35,49 38,36 43,31" fill="none" stroke={N4.ivoireCreux} strokeWidth={0.003 * W} vectorEffect="non-scaling-stroke" />
            <polyline points="61,48 65,62 63,70" fill="none" stroke={N4.ivoireCreux} strokeWidth={0.003 * W} vectorEffect="non-scaling-stroke" />
          </svg>
        </>
      ) : (
        <span style={style}>{texte}</span>
      )}
    </div>
  );
}

/** Onglet de zone (titre 0,041 L). `etat` : en attente (sable), éteint (désaturé), allumé (héros orange). */
function Onglet({ texte, etat, W, x, y, e }: { texte: string; etat: "attente" | "eteint" | "normal" | "allume"; W: number; x: number; y: number; e: number }) {
  const hO = 0.062 * W;
  const fond = etat === "allume" ? DEGRADE_ORANGE : etat === "normal" ? N4.sableClair : etat === "eteint" ? N4.ivoireCreux : N4.ivoire;
  const couleur = etat === "allume" ? N4.ivoire : etat === "normal" ? N4.encreDouce : N4.sableProfond;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        height: hO,
        padding: `0 ${0.024 * W}px`,
        borderRadius: 0.014 * W,
        background: fond,
        ...(etat === "allume" ? { ...styleHeros(W), boxShadow: `${Math.max(3, Math.round(0.005 * W))}px ${Math.max(3, Math.round(0.005 * W))}px 0 ${N4.encre}, ${refletInset(W)}` } : etat === "attente" ? { border: `${epFilet(W)}px dashed ${N4.sable}`, boxSizing: "border-box" as const } : {}),
        display: "flex",
        alignItems: "center",
        transform: `scale(${0.94 + 0.06 * e})`,
        transformOrigin: "0% 50%",
      }}
    >
      <span style={{ position: "relative", fontFamily: POLICES.titre, fontSize: TYPO4.titre * W, lineHeight: 1, color: couleur, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{texte}</span>
    </div>
  );
}

/** Panneau seul (sans la prise) : à poser par-dessus la scène. */
export function PanneauVolet({ t, largeurImage: W, hauteurImage: H, donnees: d }: { t: number; largeurImage: number; hauteurImage: number; donnees: DonneesVoletAvantApres }) {
  if (t < d.debut || t >= d.fin) return null;
  const C = CADRAGE_VOLET;
  const an = animationFenetre(t, d.debut, d.fin, "droite");
  const l = (C.x1 - C.x0) * W;
  const h = (C.y1 - C.y0) * H;
  const contour = Math.max(3, Math.round(0.0045 * W));
  const Li = l - 2 * contour;
  const Hi = h - 2 * contour;
  const pad = 0.04 * W;
  const corps = TYPO4.corps * W;
  const filet = epFilet(W);
  const yG = DIAG.gauche * Hi;
  const yD = DIAG.droite * Hi;
  const yDiag = (x: number) => yG + ((yD - yG) * x) / Li;
  const b = d.basculeA;
  const gris = t >= b + VOLET.gris;
  const allume = t >= b + VOLET.allume;
  const probleme = d.mode === "probleme" && !!d.probleme;

  // Suivi : chaque arrivée (avant, mot fort, après) écrase le panneau de 1,5 %.
  const arrivees = [...(probleme ? [d.probleme!.fort.a] : d.avant.map((x) => x.a)), ...d.apres.map((_, i) => instantApres(d, i))];
  const s = suivi(t, arrivees.map((x) => x + 0.06), 0.015);

  // Grille : 3 colonnes égales dans les marges.
  const nCol = 3;
  const lCol = (Li - 2 * pad) / nCol;
  const disque = 0.135 * W;
  const hOnglet = 0.062 * W;
  const yOngletAvant = pad;
  const yRangAvant = pad + hOnglet + 0.026 * W;
  const yOngletApres = yG + 0.026 * W;
  const yRangApres = yOngletApres + hOnglet + 0.026 * W;

  // Volet : centre du bandeau de -bande à Hi + bande en 0,22 s (accélère puis freine), étiré par la vitesse.
  const bande = 0.3 * Hi;
  const pv = interpolate(t, [b, b + VOLET.duree], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const voletVisible = t >= b && pv < 1;
  const yc = -bande + pv * (Hi + 2 * bande);
  const etire = 1 + 0.05 * bosse(t, b, VOLET.duree);
  const pente = yD - yG;
  const hb = (bande * etire) / 2;

  const Picto = ({ p, i, cote }: { p: PictoVolet; i: number; cote: "avant" | "apres" }) => {
    const avant = cote === "avant";
    const a = avant ? p.a : instantApres(d, i);
    const x0 = pad + i * lCol;
    const y0 = avant ? yRangAvant : yRangApres;
    const e = entree(t, a, 0.2);
    const tr = avant ? tremble(t, i) : { x: 0, y: 0 };
    const vie = !avant && e.visible ? respire(t - a, i * 1.7, 0.015) : 1;
    const enAttente = !e.visible;
    // Éclat d'arrivée (N2, 0,16 s) : la case de la colonne passe pleine 0,16 s (encre-douce pour l'« avant », orange pour l'« après »).
    const eclat = enEclat(t, a);
    const hCase = disque + 0.012 * W + corps * 1.22 * 2 + 0.036 * W;
    return (
      <>
      {eclat ? <div style={{ position: "absolute", left: x0 + 0.008 * W, top: y0 - 0.018 * W, width: lCol - 0.016 * W, height: hCase, borderRadius: 0.02 * W, background: avant ? N4.encreDouce : DEGRADE_ORANGE }} /> : null}
      <div style={{ position: "absolute", left: x0, top: y0, width: lCol, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.012 * W }}>
        {enAttente ? (
          <div style={{ width: disque, height: disque, borderRadius: "50%", border: `${filet}px dashed ${N4.sable}`, boxSizing: "border-box" }} />
        ) : (
          <div style={{ opacity: e.o, transform: `translate(${tr.x}px, ${tr.y + e.d * 0.03 * W}px) scale(${(avant ? 1 : 0.92 + 0.08 * claque(t, a, 0.12)) * vie})` }}>
            {avant ? (
              <div style={{ width: disque, height: disque, borderRadius: "50%", background: N4.ivoire, border: `${filet}px solid ${gris ? N4.sableClair : N4.filet}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={p.icone} taille={0.055 * W} couleur={gris ? N4.sable : N4.sableProfond} epaisseur={2.2} />
              </div>
            ) : (
              <div style={{ position: "relative", width: disque, height: disque, borderRadius: "50%", background: DEGRADE_ORANGE, boxShadow: `${microOmbre(W, 0.14)}, ${refletInset(W)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={p.icone} taille={0.055 * W} couleur={N4.ivoire} epaisseur={2.4} />
              </div>
            )}
          </div>
        )}
        {enAttente ? (
          <div style={{ width: lCol * 0.56, height: corps * 0.7, marginTop: corps * 0.25, borderRadius: 999, background: avant ? N4.sableClair : N4.ivoireCreux }} />
        ) : (
          <span style={{ fontFamily: POLICES.texte, fontSize: corps, lineHeight: 1.22, color: eclat ? N4.ivoire : avant ? (gris ? N4.sableProfond : N4.encre) : N4.encre, textAlign: "center", maxWidth: lCol - 0.016 * W, opacity: e.o, transform: `translate(${tr.x}px, ${e.d * 0.02 * W}px)` }}>{p.texte}</span>
        )}
      </div>
      </>
    );
  };

  // Mode problème : taille du héros ajustée à la largeur (0,09 → 0,13 L).
  const fort = d.probleme?.fort;
  const tailleFort = fort ? Math.max(0.09 * W, Math.min(0.13 * W, ((Li - 2 * pad) * 0.97) / largeurTexte(fort.texte, 1))) : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: C.x0 * W,
        top: C.y0 * H,
        width: l,
        height: h,
        transform: `translate(${an.dx * W}px, ${an.dy * H}px) rotate(${an.rotation}deg) scale(${an.echelle * s.sx}, ${an.echelle * s.sy})`,
        ...styleCoque(W),
        overflow: "hidden",
      }}
    >
      {/* Zone « après » (fond ivoire + grain 3,5 %) : tout le panneau, la zone « avant » se pose dessus. */}
      <Grain id="va4-grain" />
      {/* Zone « avant » : ivoire-creux + grain 6 %, coupée par la diagonale. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: Li, height: Hi, clipPath: `polygon(0 0, 100% 0, 100% ${yD}px, 0 ${yG}px)`, background: N4.ivoireCreux }}>
        <Grain id="va4-grain-avant" opacite={0.06} />
      </div>
      {/* Diagonale nette (filet encre-douce 0,003 L). */}
      <svg width={Li} height={Hi} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={0} y1={yG} x2={Li} y2={yD} stroke={N4.encreDouce} strokeWidth={Math.max(2, Math.round(0.003 * W))} />
      </svg>

      {/* ---------------- Zone « avant » ---------------- */}
      <Onglet texte={d.titreAvant} etat={gris ? "eteint" : "normal"} W={W} x={pad} y={yOngletAvant} e={1} />
      {probleme ? (
        <div style={{ position: "absolute", left: pad, top: yRangAvant, width: Li - 2 * pad, display: "flex", flexDirection: "column", gap: 0.006 * W }}>
          <div style={{ display: "flex", gap: corps * 0.3, height: corps * 1.3 }}>
            {d.probleme!.mots.map((m, k) => {
              const e = entree(t, m.a, 0.12);
              return (
                <span key={k} style={{ fontFamily: POLICES.texte, fontSize: corps * 1.08, color: gris ? N4.sableProfond : N4.encreDouce, whiteSpace: "nowrap", opacity: e.o, transform: `translateY(${e.d * 0.02 * W}px)` }}>
                  {m.texte}
                </span>
              );
            })}
          </div>
          <div style={{ position: "relative", transform: `translate(${tremble(t, 3).x}px, ${tremble(t, 4).y}px)` }}>
            {enEclat(t, fort!.a) ? <div style={{ position: "absolute", left: -0.02 * W, right: -0.02 * W, top: -0.014 * W, bottom: -0.01 * W, borderRadius: 0.02 * W, background: N4.encreDouce }} /> : null}
            <MotFissure t={t} texte={fort!.texte} a={fort!.a} fissureA={d.probleme!.fissureA ?? fort!.a + 0.15} taille={tailleFort} couleur={enEclat(t, fort!.a) ? N4.ivoire : gris ? N4.sableProfond : N4.encre} W={W} />
          </div>
        </div>
      ) : (
        d.avant.slice(0, 3).map((p, i) => <Picto key={`av${i}`} p={p} i={i} cote="avant" />)
      )}

      {/* ---------------- Zone « après » ---------------- */}
      <Onglet texte={d.titreApres} etat={allume ? "allume" : "attente"} W={W} x={pad} y={yOngletApres} e={allume ? claque(t, b + VOLET.allume, 0.12) : 1} />
      {d.apres.slice(0, 3).map((p, i) => (
        <Picto key={`ap${i}`} p={p} i={i} cote="apres" />
      ))}

      {/* ---------------- Volet orange ---------------- */}
      {voletVisible ? (
        <svg width={Li} height={Hi} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="va4-volet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={N4.orangeChaud} />
              <stop offset="1" stopColor={N4.orangeProfond} />
            </linearGradient>
          </defs>
          <polygon points={`0,${yc - hb} ${Li},${yc - hb + pente} ${Li},${yc + hb + pente} 0,${yc + hb}`} fill="url(#va4-volet)" />
          <line x1={0} y1={yc - hb} x2={Li} y2={yc - hb + pente} stroke={N4.encre} strokeWidth={Math.max(2, Math.round(0.003 * W))} />
          <line x1={0} y1={yc - hb + 3} x2={Li} y2={yc - hb + pente + 3} stroke="rgba(233, 220, 200, 0.22)" strokeWidth={2} />
          <line x1={0} y1={yc + hb} x2={Li} y2={yc + hb + pente} stroke={N4.encre} strokeWidth={Math.max(2, Math.round(0.003 * W))} />
        </svg>
      ) : null}
      {/* Hauteur de diagonale exposée pour les tests de boîtes (aucun contenu ne la croise). */}
      <span data-diagonale={`${yDiag(0).toFixed(1)}-${yDiag(Li).toFixed(1)}`} style={{ display: "none" }} />
    </div>
  );
}

/** Scène complète de maquette : la prise FIXE (aucune descente, aucun zoom) et le panneau par-dessus. */
export function VoletAvantApres({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_VOLET_AVANT_APRES, fond }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesVoletAvantApres; fond?: string }) {
  return (
    <ScenePrise W={W} H={H} fond={fond ?? fondParDefaut()} pousse={0}>
      <PanneauVolet t={t} largeurImage={W} hauteurImage={H} donnees={donnees} />
    </ScenePrise>
  );
}

export function bruitagesVoletAvantApres(d: DonneesVoletAvantApres = EXEMPLE_VOLET_AVANT_APRES): Bruitage[] {
  const s: Bruitage[] = [[d.debut - 0.02, "whoosh-in", 0.25]];
  if (d.mode === "probleme" && d.probleme) s.push([d.probleme.fort.a, "drop_003", 0.07], [d.probleme.fissureA ?? d.probleme.fort.a + 0.15, "minimize_004", 0.07]);
  else d.avant.forEach((p) => s.push([p.a, "drop_003", 0.05]));
  s.push([d.basculeA, "whoosh-in", 0.3]);
  d.apres.forEach((_, i) => s.push([instantApres(d, i), i === d.apres.length - 1 ? "confirmation_002" : "maximize_004", 0.06]));
  s.push([d.fin - 0.17, "whoosh-out", 0.18]);
  return s;
}
