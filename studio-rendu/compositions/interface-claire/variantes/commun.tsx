/**
 * Socle commun des MAQUETTES DE VARIÉTÉ du face caméra animé (« interface claire »), écrites le 15/10 par le designer
 * n° 1 : la prise de Will en IMAGE FIXE (aucun zoom, aucun déplacement horizontal ; seule la DESCENTE quand une carte
 * arrive est gardée), la bande ivoire au-dessus, le tampon « Exemple », les petites courbes (bosse, secousse) et les
 * bruitages. Réutilise la charte, les mouvements et la boîte de `interface-claire/` SANS les modifier.
 */
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { Audio, Img, Sequence, staticFile } from "remotion";
import { COULEURS, GEOMETRIE, POLICES } from "../charte";
import { DESCENTE } from "../cadrage";
import { progression, rebond, sortie } from "../mouvement";

/** Cadence de la prise de Will (25 i/s) : sert à convertir les durées « en images » de `DESCENTE`. */
export const IMAGES_PAR_SEC = 25;

/** Prise de démonstration (`prise-large.mp4`, image à 4 s) : hauteur des yeux mesurée à 0,307 H (1080 × 1920). */
export const PRISE_MAQUETTE = Object.freeze({ yeux: 0.307, fichier: "prise-fixe.jpg" });

/** Bas d'une carte posée sur la bande (fraction de H) : 0,13 → 0,47, comme `FIN_SUR_VISAGE` et la référence. */
export const BAS_CARTE = 0.47;

/** Panneau qui couvre TOUT le visage (même emprise que la fenêtre « sur-le-visage » de `cadrage.ts`). */
export const PANNEAU_VISAGE = Object.freeze({ x0: 0.05, x1: 0.86, y0: 0.12, y1: 0.69 });

/** Descente de la prise sous une carte : yeux affichés = bas de la carte + 0,12 H (règle de `cadrage.ts`). */
export function pousseeSousCarte(yeux: number = PRISE_MAQUETTE.yeux, basObjet: number = BAS_CARTE): number {
  return Math.min(DESCENTE.max, Math.max(0, basObjet + DESCENTE.yeuxSousObjet - yeux));
}

/** Descente animée : 3 images avec léger dépassement à l'arrivée, remontée en 3,5 images après la sortie. */
export function descente(t: number, debut: number, fin: number, cible: number): number {
  const e = rebond(t, debut, DESCENTE.images / IMAGES_PAR_SEC, DESCENTE.force);
  const r = sortie(t, fin + DESCENTE.imagesRetard / IMAGES_PAR_SEC, DESCENTE.imagesRemontee / IMAGES_PAR_SEC);
  return cible * e * (1 - r);
}

/** Bosse 0 → 1 → 0 sur `duree` (choc, pulsation). */
export const bosse = (t: number, debut: number, duree: number) => Math.sin(Math.PI * progression(t, debut, duree));

/** Secousse amortie (px ou degrés) : oscillation rapide qui s'éteint en `duree`. */
export function secousse(t: number, debut: number, duree: number, amplitude: number, frequence = 22): number {
  if (t < debut || t > debut + duree) return 0;
  const p = (t - debut) / duree;
  return amplitude * Math.sin(2 * Math.PI * frequence * (t - debut)) * (1 - p) ** 2;
}

/** Ralenti de fin. */
export const ralenti = (p: number) => 1 - (1 - p) ** 3;

/**
 * Largeur ESTIMÉE (px) d'un texte en Montserrat ExtraBold, casse NATURELLE (minuscules ≈ 0,62 em, capitales ≈ 0,76 em).
 * Volontairement un peu large : le texte est réduit avant de déborder, jamais coupé.
 */
export function largeurNaturelle(texte: string, taille: number): number {
  let s = 0;
  for (const c of texte) {
    if (/\s/.test(c)) s += 0.28;
    else if (/[MWmwÆŒœæ]/.test(c)) s += 0.98;
    else if (/[iljI'’.,:;!|]/.test(c)) s += 0.34;
    else if (/[?]/.test(c)) s += 0.6;
    else if (/[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]/.test(c)) s += 0.78;
    else if (/\d/.test(c)) s += 0.72;
    else s += 0.64;
  }
  return s * taille;
}

/** Taille (px) qui fait tenir `texte` dans `largeur`, bornée à [min, max]. */
export const tailleQuiTient = (texte: string, largeur: number, min: number, max: number) => Math.max(min, Math.min(max, largeur / Math.max(1e-6, largeurNaturelle(texte, 1))));

/**
 * Scène de maquette : la prise de Will en image fixe, qui DESCEND de `pousse` × H (jamais de zoom, jamais de glissement
 * horizontal), la bande ivoire qui couvre le haut libéré, puis les objets par-dessus.
 */
export function ScenePrise({ W, H, fond, pousse, children }: { W: number; H: number; /** Image fixe de la prise (URL) ; absente : fond neutre. */ fond?: string; pousse: number; children?: ReactNode }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: COULEURS.encre }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${pousse * H}px)` }}>
        {fond ? <Img src={fond} style={{ width: W, height: H, objectFit: "cover" }} /> : <div style={{ width: W, height: H, background: "#8A8F99" }} />}
      </div>
      {pousse > 0 ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: (pousse + 0.004) * H, background: COULEURS.ivoire }} /> : null}
      {children}
    </div>
  );
}

/** Image fixe par défaut des maquettes (dossier public du rendu de maquettes). */
export const fondParDefaut = () => staticFile(PRISE_MAQUETTE.fichier);

/**
 * TAMPON « EXEMPLE » : posé dès qu'un chiffre affiché n'est PAS un résultat réel. Il s'écrase (échelle 2,4 → 1 en
 * 3 images) puis tremble une fois, comme un coup de tampon.
 */
export function TamponExemple({ t, a, taille, rotation = -9, style }: { t: number; a: number; taille: number; rotation?: number; style?: CSSProperties }) {
  if (t < a) return null;
  const e = progression(t, a, 0.12);
  const echelle = 1 + 1.4 * (1 - e) ** 2 - 0.07 * bosse(t, a + 0.12, 0.1);
  return (
    <div
      style={{
        position: "absolute",
        ...style,
        border: `${Math.max(4, taille * 0.11)}px solid ${COULEURS.orange}`,
        borderRadius: taille * 0.22,
        background: "rgba(233, 220, 200, 0.92)",
        color: COULEURS.orange,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1,
        letterSpacing: taille * 0.08,
        padding: `${taille * 0.16}px ${taille * 0.3}px`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        opacity: progression(t, a, 0.04),
        transform: `rotate(${rotation + secousse(t, a + 0.1, 0.18, 2)}deg) scale(${echelle})`,
      }}
    >
      Exemple
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. */
export type Bruitage = [number, string, number];

/** Joue une liste de bruitages (fichiers `sons/*.wav` du dossier public du rendu). Aucune musique. */
export function Bruitages({ liste, fps }: { liste: Bruitage[]; fps: number }) {
  return (
    <>
      {liste.map(([a, son, volume], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(a * fps))} durationInFrames={Math.round(1.2 * fps)} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
}

/** Carte posée sur la bande, en pixels. */
export const rectCarte = (W: number, H: number) => ({ x: GEOMETRIE.carteX * W, y: GEOMETRIE.carteY * H, l: GEOMETRIE.carteL * W, h: (BAS_CARTE - GEOMETRIE.carteY) * H });

/** Panneau qui couvre le visage, en pixels. */
export const rectPanneau = (W: number, H: number) => ({ x: PANNEAU_VISAGE.x0 * W, y: PANNEAU_VISAGE.y0 * H, l: (PANNEAU_VISAGE.x1 - PANNEAU_VISAGE.x0) * W, h: (PANNEAU_VISAGE.y1 - PANNEAU_VISAGE.y0) * H });

/** Tic-tac régulier (un « tick » tous les `pas`) entre deux instants. */
export function ticTac(debut: number, fin: number, pas = 0.09, volume = 0.035): Bruitage[] {
  const s: Bruitage[] = [];
  for (let a = debut; a < fin - 1e-6; a += pas) s.push([a, s.length % 2 ? "tick_002" : "tick_001", volume]);
  return s;
}
