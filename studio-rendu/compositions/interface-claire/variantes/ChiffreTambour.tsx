import React from "react";
/**
 * CARTE « CHIFFRE À PALETTES » (nouvelle, reprise améliorée du brouillon ; designer n° 3, 15/10/2026 — standard premium).
 * Quand : la phrase dit un chiffre clé d'EXEMPLE (une durée, un nombre, une part). Tampon « EXEMPLE » obligatoire.
 *
 * Composition : le chiffre héros (0,30 L de haut) sur des PALETTES À VOLET (split-flap) : deux demi-plaques encre-douce
 * et encre par chiffre, une fente avec ses charnières, un reflet. À droite : l'unité en titre de 0,06 L, le complément
 * (« par semaine ») en corps, une précision en sable-profond. Un trait orange se dessine sous l'ensemble. En-tête
 * « étiquette » (icône nue + titre sur filet) et progression en points : plus de bandeau orange « 1/10 ».
 * Mouvement :
 *  - N1 : la carte tombe (même animation que les cartes du moteur), la prise descend dessous, visage entier ;
 *  - N2 : les palettes basculent (demi-plaque qui pivote en X, 3 images par chiffre), DÉCÉLÈRENT et s'arrêtent sur le
 *         mot du chiffre, avec une secousse de 1 % de la carte et un écrasement de 2 % (suivi) ; l'unité glisse depuis la
 *         droite, le complément suit à 50 ms ; le trait orange se dessine ; le tampon claque ;
 *  - N3 : un reflet passe sur les plaques toutes les 1,2 s.
 */
import { BAS_CARTE, descente, fondParDefaut, pousseeSousCarte, ScenePrise } from "./commun";
import type { Bruitage } from "./commun";
import { ticTac } from "./commun";
import { GEOMETRIE, POLICES } from "../charte";
import { bosse, CoquePremium, DEGRADE, encreA, filet, fondu, glisse, ivoireA, N3, pointsDepuisNumero, Reflet, secousse, styleCorps, styleTitre, TamponExemple3, typo } from "./premium-3";

export type DonneesChiffreTambour = {
  /** Entrée et sortie de la carte (s). */
  debut: number;
  fin: number;
  /** Sujet, dans l'en-tête (« Vos devis »). */
  titre: string;
  iconeTitre?: string;
  /** Repère de progression « 1/3 » (montré en points). */
  numero?: string;
  /** Chiffres affichés, une palette par chiffre (« 6 », « 12 », « 40 »). */
  chiffres: string;
  /** Unité principale (« h », « % », « tâches »). */
  unite: string;
  /** Complément sous l'unité, en corps (« par semaine »). */
  complement?: string;
  /** Précision facultative, en sable-profond (« sur les devis »). */
  contexte?: string;
  /** Instant du MOT DU CHIFFRE : la première palette s'arrête là. */
  arretA: number;
  /** Écart entre deux arrêts de palette (s). */
  ecartArret?: number;
  /** Arrivée de l'unité (défaut : 0,15 s après le dernier arrêt). */
  uniteA?: number;
  /** Trait orange qui se dessine sous l'ensemble. */
  traitA?: number;
  /** Tampon EXEMPLE (obligatoire si le chiffre n'est pas un résultat réel). */
  exempleA?: number;
};

/**
 * ⚠️ Chiffre d'EXEMPLE, non réel, non sourcé — d'où le tampon EXEMPLE.
 * Phrase : « Un dirigeant de PME passe souvent six heures par semaine sur ses devis. » (affiché : 6 h par semaine).
 * Mots : « six » 1,55 s · « heures » 1,8 s · « semaine » 2,2 s · « devis » 2,55 s.
 */
export const EXEMPLE_PHRASE_CHIFFRE_TAMBOUR = "Un dirigeant de PME passe souvent six heures par semaine sur ses devis.";
export const EXEMPLE_CHIFFRE_TAMBOUR: DonneesChiffreTambour = {
  debut: 0.1,
  fin: 4.7,
  titre: "Vos devis",
  iconeTitre: "document",
  numero: "1/3",
  chiffres: "6",
  unite: "h",
  complement: "par semaine",
  contexte: "sur les devis",
  arretA: 1.55,
  uniteA: 1.8,
  traitA: 2.2,
  exempleA: 2.55,
};
/** Instant le plus représentatif pour une image fixe (palette arrêtée, unité, trait et tampon posés). */
export const INSTANT_CHIFFRE_TAMBOUR = 3.0;

/** Nombre de bascules avant l'arrêt et intervalles (décélération géométrique de 0,05 s à 0,17 s). */
const BASCULES = 12;
const INTERVALLES = Array.from({ length: BASCULES }, (_, k) => 0.05 * Math.pow(0.17 / 0.05, k / (BASCULES - 1)));
const DUREE_BASCULE = 0.12;

const arrets = (d: DonneesChiffreTambour) => [...d.chiffres].map((_, i) => d.arretA + i * (d.ecartArret ?? 0.12));

/** État d'une palette : chiffre affiché ou bascule en cours (de `de` vers `vers`, avancement `u`). */
function etatPalette(t: number, cible: number, arret: number): { de: number; vers: number; u: number | null } {
  const total = INTERVALLES.reduce((s, x) => s + x, 0);
  let s = arret - total;
  const valeur = (k: number) => (((cible - (BASCULES - k)) % 10) + 10) % 10;
  for (let k = 0; k < BASCULES; k++) {
    const dur = Math.min(DUREE_BASCULE, INTERVALLES[k]);
    if (t < s) return { de: valeur(k), vers: valeur(k), u: null };
    if (t < s + dur) return { de: valeur(k), vers: valeur(k + 1), u: (t - s) / dur };
    s += INTERVALLES[k];
  }
  return { de: cible, vers: cible, u: null };
}

function Demi({ chiffre, haut, l, h, rayon }: { chiffre: number | string; haut: boolean; l: number; h: number; rayon: number }) {
  return (
    <div style={{ position: "relative", width: l, height: h / 2, overflow: "hidden", background: haut ? N3.encreDouce : N3.encre, borderRadius: haut ? `${rayon}px ${rayon}px 0 0` : `0 0 ${rayon}px ${rayon}px` }}>
      <div style={{ position: "absolute", left: 0, top: haut ? 0 : -h / 2, width: l, height: h, lineHeight: `${h}px`, textAlign: "center", fontFamily: POLICES.titre, fontSize: h * 0.8, color: N3.ivoire, fontVariantNumeric: "tabular-nums" }}>{chiffre}</div>
      {haut ? <Reflet rayon={rayon} retrait={rayon * 0.6} /> : null}
    </div>
  );
}

function Palette({ t, chiffre, arret, l, h, W }: { t: number; chiffre: string; arret: number; l: number; h: number; W: number }) {
  const cible = Number.isNaN(Number(chiffre)) ? 0 : Number(chiffre);
  const { de, vers, u } = etatPalette(t, cible, arret);
  const rayon = Math.round(W * 0.016);
  const fente = Math.max(3, Math.round(W * 0.004));
  // Reflet N3 : bande claire qui traverse la plaque toutes les 1,2 s (0,6 s de passage).
  const cycle = ((t - arret) % 1.2 + 1.2) % 1.2;
  const passe = t > arret + 0.3 && cycle < 0.6 ? cycle / 0.6 : -1;
  return (
    <div style={{ position: "relative", width: l, height: h + fente, perspective: h * 4, filter: `drop-shadow(0 ${Math.round(W * 0.004)}px ${Math.round(W * 0.007)}px ${encreA(0.18)})` }}>
      {/* Demi-plaques fixes : haut = chiffre suivant, bas = chiffre courant (jusqu'à ce que le volet retombe). */}
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <Demi chiffre={vers} haut l={l} h={h} rayon={rayon} />
      </div>
      <div style={{ position: "absolute", left: 0, top: h / 2 + fente }}>
        <Demi chiffre={u !== null && u < 0.5 ? de : vers} haut={false} l={l} h={h} rayon={rayon} />
      </div>
      {/* Volet qui bascule. */}
      {u !== null && u < 0.5 ? (
        <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "50% 100%", transform: `rotateX(${-180 * u}deg)` }}>
          <Demi chiffre={de} haut l={l} h={h} rayon={rayon} />
          <div style={{ position: "absolute", inset: 0, background: encreA(0.5 * u * 2), borderRadius: `${rayon}px ${rayon}px 0 0` }} />
        </div>
      ) : null}
      {u !== null && u >= 0.5 ? (
        <div style={{ position: "absolute", left: 0, top: h / 2 + fente, transformOrigin: "50% 0%", transform: `rotateX(${90 - 180 * (u - 0.5)}deg)` }}>
          <Demi chiffre={vers} haut={false} l={l} h={h} rayon={rayon} />
          <div style={{ position: "absolute", inset: 0, background: ivoireA(0.12 * (1 - (u - 0.5) * 2)), borderRadius: `0 0 ${rayon}px ${rayon}px` }} />
        </div>
      ) : null}
      {/* Fente et charnières. */}
      <div style={{ position: "absolute", left: 0, top: h / 2, width: l, height: fente, background: N3.encre }} />
      {[0, 1].map((k) => (
        <div key={k} style={{ position: "absolute", [k ? "right" : "left"]: -Math.round(W * 0.003), top: h / 2 + fente / 2 - Math.round(W * 0.012), width: Math.round(W * 0.007), height: Math.round(W * 0.024), borderRadius: 3, background: `linear-gradient(180deg, ${N3.sableClair} 0%, ${N3.sableProfond} 100%)` }} />
      ))}
      {passe >= 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: l, height: h + fente, overflow: "hidden", borderRadius: rayon, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, left: -l * 0.6 + passe * l * 1.8, width: l * 0.5, height: h + fente, background: `linear-gradient(105deg, ${ivoireA(0)} 0%, ${ivoireA(0.07)} 50%, ${ivoireA(0)} 100%)` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Contenu de la carte (temps absolu) dans la place intérieure `l × h`. */
export function ContenuChiffreTambour({ t, d, W, l, h }: { t: number; d: DonneesChiffreTambour; W: number; l: number; h: number }) {
  const ty = typo(W);
  const liste = arrets(d);
  const dernier = liste[liste.length - 1];
  const n = d.chiffres.length;
  const tailleUnite = Math.round(W * 0.06);
  const lColonne = Math.round(Math.max(W * 0.24, Math.min(W * 0.3, Math.max((d.complement ?? "").length * W * 0.032, (d.contexte ?? "").length * ty.corps) * 0.58)));
  const gout = Math.round(W * 0.04);
  const ecartP = Math.round(W * 0.012);
  const hTrait = Math.round(W * 0.012);
  const espaceTrait = Math.round(W * 0.028);
  // Palette : 0,30 L de haut, réduite si plusieurs chiffres ne tiennent pas.
  const hP = Math.round(Math.min(W * 0.3, h - hTrait - espaceTrait - 8, (l - lColonne - gout - (n - 1) * ecartP) / (n * 0.72)));
  const lP = Math.round(hP * 0.72);
  const lGroupe = n * lP + (n - 1) * ecartP + gout + lColonne;
  const x0 = (l - lGroupe) / 2;
  const hGroupe = hP + espaceTrait + hTrait;
  const y0 = (h - hGroupe) / 2;
  const uniteA = d.uniteA ?? dernier + 0.15;
  const eU = glisse(t, uniteA, 0.2);
  const eC = glisse(t, uniteA + 0.05, 0.2);
  const eX = glisse(t, uniteA + 0.1, 0.2);
  const trait = d.traitA === undefined ? 0 : glisse(t, d.traitA, 0.22);
  const xCol = x0 + n * lP + (n - 1) * ecartP + gout;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {[...d.chiffres].map((c, i) => (
        <div key={i} style={{ position: "absolute", left: x0 + i * (lP + ecartP), top: y0 }}>
          <Palette t={t} chiffre={c} arret={liste[i]} l={lP} h={hP} W={W} />
        </div>
      ))}
      {/* Colonne de droite : unité, complément, filet, précision. */}
      <div style={{ position: "absolute", left: xCol, top: y0, width: lColonne, height: hP, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: hP * 0.06, boxSizing: "border-box" }}>
        {t >= uniteA ? (
          <div style={{ ...styleTitre(tailleUnite, N3.encre), letterSpacing: "0.02em", textTransform: "none", lineHeight: 1, opacity: fondu(t, uniteA), transform: `translateX(${(1 - eU) * W * 0.045}px)` }}>{d.unite}</div>
        ) : null}
        {d.complement && t >= uniteA + 0.05 ? (
          <div style={{ ...styleCorps(Math.round(W * 0.032), N3.encreDouce), marginTop: Math.round(W * 0.012), whiteSpace: "nowrap", opacity: fondu(t, uniteA + 0.05), transform: `translateX(${(1 - eC) * W * 0.04}px)` }}>{d.complement}</div>
        ) : null}
        {d.contexte && t >= uniteA + 0.1 ? (
          <div style={{ marginTop: Math.round(W * 0.016), paddingTop: Math.round(W * 0.014), borderTop: filet(W), ...styleCorps(ty.corps, N3.sableProfond), whiteSpace: "nowrap", opacity: fondu(t, uniteA + 0.1), transform: `translateX(${(1 - eX) * W * 0.035}px)` }}>{d.contexte}</div>
        ) : null}
      </div>
      {/* Trait orange : se dessine de gauche à droite sous l'ensemble. */}
      {trait > 0 ? (
        <div style={{ position: "absolute", left: x0, top: y0 + hP + espaceTrait, width: lGroupe * trait, height: hTrait, borderRadius: hTrait, background: DEGRADE.orange, overflow: "hidden" }}>
          <Reflet rayon={hTrait} retrait={4} />
        </div>
      ) : null}
      {d.exempleA !== undefined ? <TamponExemple3 t={t} a={d.exempleA} W={W} style={{ right: 0, top: 0 }} /> : null}
    </div>
  );
}

/** Carte complète sur la prise fixe (maquette). `t` en secondes. */
export function ChiffreTambour({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_CHIFFRE_TAMBOUR, fond, yeux }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesChiffreTambour; fond?: string; yeux?: number }) {
  const d = donnees;
  const pousse = descente(t, d.debut, d.fin, pousseeSousCarte(yeux, BAS_CARTE));
  const hCarte = (BAS_CARTE - GEOMETRIE.carteY) * H;
  // Secousse de 1 % de la carte à chaque arrêt ; écrasement de 2 % au dernier (suivi).
  const liste = arrets(d);
  const dy = liste.reduce((s, a) => s + secousse(t, a, 0.2, hCarte * 0.01), 0);
  const ecrase = 0.02 * bosse(t, liste[liste.length - 1], 0.1);
  return (
    <ScenePrise W={W} H={H} fond={fond ?? fondParDefaut()} pousse={pousse}>
      <CoquePremium
        t={t}
        debut={d.debut}
        fin={d.fin}
        W={W}
        H={H}
        y0={GEOMETRIE.carteY}
        y1={BAS_CARTE}
        dy={dy}
        ecrase={ecrase}
        entete={{ mode: "etiquette", titre: d.titre, icone: d.iconeTitre, points: pointsDepuisNumero(d.numero) }}
        enfants={(l, h) => <ContenuChiffreTambour t={t} d={d} W={W} l={l} h={h} />}
      />
    </ScenePrise>
  );
}

/** Bruitages : whoosh d'entrée, tic-tac des palettes (qui ralentit), claquement à chaque arrêt, glisse de l'unité, tampon. */
export function bruitagesChiffreTambour(d: DonneesChiffreTambour = EXEMPLE_CHIFFRE_TAMBOUR): Bruitage[] {
  const liste = arrets(d);
  const dernier = liste[liste.length - 1];
  const total = INTERVALLES.reduce((s, x) => s + x, 0);
  const s: Bruitage[] = [[d.debut - 0.02, "whoosh-in", 0.25], ...ticTac(Math.max(d.debut + 0.12, liste[0] - total), liste[0] - 0.05, 0.08)];
  liste.forEach((a) => s.push([a, "click_003", 0.12], [a + 0.01, "drop_004", 0.06]));
  s.push([d.uniteA ?? dernier + 0.15, "select_001", 0.05]);
  if (d.traitA !== undefined) s.push([d.traitA, "select_002", 0.05]);
  if (d.exempleA !== undefined) s.push([d.exempleA, "drop_001", 0.08]);
  s.push([d.fin - 0.12, "whoosh-out", 0.18]);
  return s;
}
