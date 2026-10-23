/**
 * FAMILLE « MOT GÉANT CINÉTIQUE PLEIN ÉCRAN » (`mot-geant`) — motion designer n° 1, 15/10/2026 (révision 2).
 *
 * Quand : la phrase choc ou le basculement du script (« fuite », « stop », « gratuit »). Au plus UN par tranche de 30 s,
 * jamais avant 10 s (le visage reste visible au début de la vidéo). Visage : COUVERT (dalle plein écran).
 * Groupe « couvre-visage typographique » : partage son quota avec le VOLET de chapitre (designer 2) — le réalisateur
 * ne doit pas enchaîner les deux, ni en mettre plus d'un des deux par tranche de 30 s.
 *
 * Mouvement :
 *  - sur le mot, la dalle (encre ou orange) arrive d'un coup (coupe franche, 1 image) ;
 *  - derrière, le même mot en CREUX, droit, centré, à ~140 % de la largeur (coupé franchement des deux côtés), défile
 *    lentement vers la gauche ; en bas, une ligne de rappel en creux défile en sens inverse (parti pris « affiche ») ;
 *  - les lettres TOMBENT une à une du haut, en rebond, avec un écrasement à l'atterrissage ; sous le mot, une rangée de
 *    tirets (un par lettre) s'allume au rythme des atterrissages ; la dernière lettre déclenche l'impact : secousse de la
 *    dalle, soulignement qui jaillit du centre ;
 *  - SORTIE en deux temps : le mot s'envole d'abord (lettres aspirées vers le haut, 0,1 s), PUIS la dalle vide se fend
 *    (fente ivoire 1 image) et ses deux moitiés s'écartent en 2 images. Le visage n'est « à moitié visible » que 2 images.
 *  Durée bornée à 0,6-1,2 s. Bruitage : impact sourd à l'atterrissage, souffle à la casse.
 *
 * Calque à poser AU-DESSUS de la prise (qui ne bouge jamais) ; transparent hors de la dalle.
 * Seul texte affiché : le mot dit par Will (1-2 mots, 12 lettres au plus). Aucun chiffre ajouté.
 */
import React from "react";
import type { CSSProperties } from "react";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { progression, rebond, sortie } from "../mouvement";

export const ID_MOT_GEANT = "mot-geant";

export type DonneesMotGeant = {
  /** Instant (s) où Will dit le mot : la dalle arrive à cet instant précis. */
  a: number;
  /** Fin souhaitée (s) ; la durée est ramenée dans [0,6 ; 1,2] s. */
  fin: number;
  /** Le mot dit par Will (1-2 mots, 12 lettres au plus, chiffres interdits sauf s'ils sont dits). */
  mot: string;
  /** Couleur de la dalle (encre par défaut). */
  fond?: "encre" | "orange";
};

export const EXEMPLE_PHRASE_MOT_GEANT = "Vous n'avez pas un problème de travail. Vous avez une fuite.";
/** Instants relevés sur la vidéo 5 (« fuite » à 6,10 s), ramenés à une phrase qui commence à 0. */
export const EXEMPLE_MOT_GEANT: DonneesMotGeant = { a: 0.68, fin: 1.78, mot: "fuite", fond: "encre" };
/** Instants représentatifs : construction (lettres en chute) et image complète (mot posé, soulignement tiré). */
export const INSTANTS_MOT_GEANT = Object.freeze({ construction: 0.82, complete: 1.32 });

export const FICHE_MOT_GEANT = Object.freeze({
  id: ID_MOT_GEANT,
  nom: "Mot géant cinétique plein écran",
  visage: "couvert" as const,
  /** Quota partagé avec le volet de chapitre (designer 2). */
  groupe: "couvre-visage-typographique" as const,
  /** Jamais avant cet instant de la vidéo (s). */
  pasAvant: 10,
  dureeMin: 0.6,
  dureeMax: 1.2,
  quandUtiliser: "Phrase choc ou basculement (fuite, stop, gratuit). Au plus un par tranche de 30 s (volet compris), jamais avant 10 s.",
});

/** Durées internes (s). */
const CHUTE = 0.15;
/** Envol du mot avant la casse. */
const ENVOL = 0.1;
/** Fente (1 image) + écartement (2 images). */
const CASSE = 0.12;
const LETTRES_MAX = 12;
/** Hauteur du centre du mot (fraction de H) : remonté pour équilibrer la dalle. */
const Y_MOT = 0.4;

/** Durée réelle (bornée), début de l'envol du mot et instant de la casse. */
export function tempsMotGeant(d: DonneesMotGeant) {
  const duree = Math.min(FICHE_MOT_GEANT.dureeMax, Math.max(FICHE_MOT_GEANT.dureeMin, d.fin - d.a));
  const fin = d.a + duree;
  return { fin, envol: fin - CASSE - ENVOL, casse: fin - CASSE };
}

/**
 * Le mot en lignes. Au plus 2 mots et 12 lettres : si le 2ᵉ mot ferait dépasser 12 lettres, il est laissé de côté (on ne
 * coupe JAMAIS un mot). Deux mots de plus de 8 lettres en tout passent sur deux lignes, chacune à 80 % de la largeur.
 */
function lignesDuMot(mot: string): string[] {
  const tous = mot.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const mots = tous.length >= 2 && tous[0].length + tous[1].length <= LETTRES_MAX ? tous.slice(0, 2) : tous.slice(0, 1);
  const lettres = mots.join("").length;
  return mots.length === 2 && lettres > 8 ? mots : [mots.join(" ")];
}

/** Décalage d'une lettre à l'autre : toutes les lettres sont posées au plus tard 0,36 s après le mot. */
const pasLettres = (n: number) => Math.min(0.055, 0.21 / Math.max(1, n - 1));

/** Graine pseudo-aléatoire déterministe (rotation de départ de chaque lettre). */
const hasard = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function MotGeant({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_MOT_GEANT }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesMotGeant }) {
  const d = donnees;
  const { fin, envol, casse } = tempsMotGeant(d);
  if (t < d.a || t >= fin) return null;

  const lignes = lignesDuMot(d.mot);
  const texteSeul = lignes.join(" ");
  const nbLettres = lignes.join("").replace(/\s/g, "").length;
  const pas = pasLettres(nbLettres);
  const atterrissage = d.a + (nbLettres - 1) * pas + CHUTE;
  const orange = d.fond === "orange";
  const fond = orange ? COULEURS.orange : COULEURS.encre;
  const ombre = orange ? COULEURS.encre : COULEURS.orange;
  const creux = orange ? "rgba(17, 10, 5, 0.2)" : "rgba(191, 168, 139, 0.2)";
  const ecoule = t - d.a;

  // Taille de chaque ligne : 80 % de la largeur. `largeurTexte` surestime les capitales d'environ 9 % : on vise 0,87 L
  // estimés (≈ 0,8 L réels, mesuré sur « FUITE »), plafonné par la hauteur.
  const tailles = lignes.map((l) => Math.min(H * (lignes.length > 1 ? 0.15 : 0.21), (W * 0.87) / Math.max(1e-6, largeurTexte(l, 1))));
  const hBloc = tailles.reduce((s, x) => s + x * 0.98, 0);
  const decalOmbre = Math.max(6, W * 0.011);

  // Écho en creux : ~140 % de la largeur réelle (0,87 → 1,52 en largeur estimée), droit, centré, défilement lent.
  const tailleEcho = (W * 1.52) / Math.max(1e-6, largeurTexte(texteSeul, 1));
  const derive = -ecoule * W * 0.09;
  // Ligne de rappel du bas : le mot répété, plus petit, défile en sens inverse.
  const tailleRappel = H * 0.085;
  const rappel = Array.from({ length: 6 }, () => texteSeul).join("   ·   ");
  const largeurRappel = largeurTexte(rappel, tailleRappel) * 0.92;

  // Impact : secousse amortie de toute la dalle pendant 0,22 s après la dernière lettre.
  const k = progression(t, atterrissage - 0.04, 0.22);
  const choc = t >= atterrissage - 0.04 && k < 1 ? Math.sin(k * Math.PI * 7) * (1 - k) ** 2 * W * 0.014 : 0;
  const envolP = progression(t, envol, ENVOL);
  const souligne = rebond(t, atterrissage - 0.02, 0.16, 1.8) * (1 - envolP);

  let rang = 0;
  const lettresPosees = Array.from({ length: nbLettres }, (_, i) => t >= d.a + i * pas + CHUTE * 0.62);
  const largeurTirets = Math.min(W * 0.62, nbLettres * W * 0.075);
  const contenu = (motVisible: boolean) => (
    <div style={{ position: "absolute", inset: 0, background: fond, overflow: "hidden" }}>
      {/* Écho du mot, en creux, droit et centré, à ~140 % de la largeur : coupé franchement, il défile lentement. */}
      <div
        style={{
          position: "absolute",
          left: W / 2 + derive,
          top: H * Y_MOT,
          transform: "translate(-50%, -50%)",
          fontFamily: POLICES.titre,
          fontSize: tailleEcho,
          color: "transparent",
          WebkitTextStroke: `${Math.max(2, W * 0.0028)}px ${creux}`,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {texteSeul}
      </div>
      {/* Lignes de rappel, en haut et en bas, défilement en sens inverse l'une de l'autre (cadre « affiche »). */}
      <div
        style={{
          position: "absolute",
          left: -largeurRappel * 0.4 - ecoule * W * 0.12,
          top: H * 0.12,
          fontFamily: POLICES.titre,
          fontSize: tailleRappel,
          lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: `${Math.max(2, W * 0.0022)}px ${creux}`,
          whiteSpace: "nowrap",
        }}
      >
        {rappel}
      </div>
      <div
        style={{
          position: "absolute",
          left: -largeurRappel * 0.25 + ecoule * W * 0.12,
          top: H * 0.68,
          fontFamily: POLICES.titre,
          fontSize: tailleRappel,
          lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: `${Math.max(2, W * 0.0022)}px ${creux}`,
          whiteSpace: "nowrap",
        }}
      >
        {rappel}
      </div>
      {motVisible ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * Y_MOT - hBloc / 2, display: "flex", flexDirection: "column", alignItems: "center", transform: `translate(${choc}px, ${-choc * 0.6}px)` }}>
          {lignes.map((ligne, li) => (
            <div key={li} style={{ display: "flex", height: tailles[li] * 0.98, alignItems: "center" }}>
              {[...ligne].map((c, ci) => {
                if (/\s/.test(c)) return <span key={ci} style={{ width: tailles[li] * 0.28 }} />;
                const i = rang++;
                const depart = d.a + i * pas;
                const e = rebond(t, depart, CHUTE, 2.1);
                const pose = depart + CHUTE * 0.62;
                // Écrasement à l'atterrissage (écrasée en hauteur, élargie), puis repos.
                const ecrase = t >= pose ? Math.sin(Math.PI * progression(t, pose, 0.1)) : 0;
                const rot = (hasard(i) - 0.5) * 50 * (1 - e);
                // Envol : chaque lettre est aspirée vers le haut, en décalé, en s'étirant.
                const v = progression(t, envol + i * 0.008, ENVOL * 0.8);
                const vv = v * v;
                const style: CSSProperties = {
                  display: "inline-block",
                  fontFamily: POLICES.titre,
                  fontSize: tailles[li],
                  lineHeight: 1,
                  color: COULEURS.ivoire,
                  textShadow: `${decalOmbre}px ${decalOmbre}px 0 ${ombre}`,
                  transformOrigin: "50% 100%",
                  transform: `translateY(${-(1 - e) * H * 0.62 - vv * H * 0.7}px) rotate(${rot + (hasard(i + 7) - 0.5) * 30 * vv}deg) scale(${1 + 0.12 * ecrase - 0.25 * vv}, ${1 - 0.2 * ecrase + 0.6 * vv})`,
                  opacity: t >= depart ? 1 - vv * 0.6 : 0,
                };
                return (
                  <span key={ci} style={style}>
                    {c}
                  </span>
                );
              })}
            </div>
          ))}
          {/* Soulignement qui jaillit du centre à l'impact. */}
          <div style={{ marginTop: H * 0.022, width: W * 0.8 * souligne, height: Math.max(10, H * 0.012), background: orange ? COULEURS.ivoire : COULEURS.orange, borderRadius: 999, boxShadow: `${decalOmbre * 0.6}px ${decalOmbre * 0.6}px 0 ${orange ? COULEURS.encre : "rgba(233, 220, 200, 0.18)"}` }} />
          {/* Compte des lettres : un tiret par lettre, qui s'allume à son atterrissage. */}
          <div style={{ marginTop: H * 0.03, width: largeurTirets, display: "flex", justifyContent: "space-between", opacity: 1 - envolP }}>
            {lettresPosees.map((ok, i) => (
              <div
                key={i}
                style={{
                  width: (largeurTirets / nbLettres) * 0.62,
                  height: Math.max(8, H * 0.007),
                  borderRadius: 999,
                  background: ok ? (orange ? COULEURS.encre : COULEURS.ivoire) : "transparent",
                  border: `${Math.max(2, W * 0.002)}px solid ${orange ? "rgba(17, 10, 5, 0.45)" : "rgba(233, 220, 200, 0.45)"}`,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (t < casse) return <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>{contenu(true)}</div>;

  // CASSE de la dalle VIDE (le mot est déjà parti) : image 1 = fente ivoire ; images 2-3 = les deux moitiés s'écartent.
  // Image par image (25 i/s) : 0 = fente, 1 = moitiés écartées de 40 %, 2 = de 85 %, puis plus rien.
  const image = Math.min(2, Math.max(0, Math.floor((t - casse) * 25 + 1e-6)));
  const ecart = [0, 0.4, 0.85][image];
  const pente = Math.tan((-11 * Math.PI) / 180);
  const yC = H * 0.48;
  const yG = yC - (pente * W) / 2;
  const yD = yC + (pente * W) / 2;
  const haut = `polygon(0px 0px, ${W}px 0px, ${W}px ${yD}px, 0px ${yG}px)`;
  const bas = `polygon(0px ${yG}px, ${W}px ${yD}px, ${W}px ${H}px, 0px ${H}px)`;
  const fente = image === 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, clipPath: haut, transform: `translate(${-ecart * W * 1.1}px, ${-ecart * H * 0.2}px)` }}>{contenu(false)}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: bas, transform: `translate(${ecart * W * 1.1}px, ${ecart * H * 0.2}px)` }}>{contenu(false)}</div>
      {fente ? (
        <div style={{ position: "absolute", left: -W * 0.1, top: yC - H * 0.004, width: W * 1.2, height: H * 0.008, background: COULEURS.ivoire, transform: `rotate(${-11}deg)`, boxShadow: `0 0 ${W * 0.03}px ${COULEURS.ivoire}` }} />
      ) : null}
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. */
export type BruitageMotion = [number, string, number];

/** Impact sourd à l'atterrissage de la dernière lettre (deux sons superposés), petits chocs des lettres, souffle à la casse. */
export function bruitagesMotGeant(d: DonneesMotGeant = EXEMPLE_MOT_GEANT): BruitageMotion[] {
  const n = lignesDuMot(d.mot).join("").replace(/\s/g, "").length;
  const pas = pasLettres(n);
  const { envol, casse } = tempsMotGeant(d);
  const s: BruitageMotion[] = [];
  for (let i = 0; i < n - 1; i++) s.push([d.a + i * pas + CHUTE * 0.6, i % 2 ? "drop_001" : "drop_002", 0.05]);
  const impact = d.a + (n - 1) * pas + CHUTE * 0.6;
  s.push([impact, "drop_004", 0.45], [impact, "minimize_006", 0.12], [envol, "whoosh-in", 0.12], [casse, "whoosh-out", 0.3]);
  return s;
}
