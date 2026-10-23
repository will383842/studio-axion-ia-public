/**
 * Éléments de base du style « interface claire » : icônes, boîte (contour épais + ombre dure), étiquettes,
 * tuile logo, étiquette qui glisse, barre de progression. Tous pilotés par le temps `t` (secondes).
 */
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { COULEURS, GEOMETRIE, POLICES, TEMPS } from "./charte";
import { progression, rebond } from "./mouvement";

/** Tracés d'icônes (Lucide, licence ISC), grille 24 × 24. */
const TRACES: Record<string, ReactNode> = {
  utilisateurs: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  batiment: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </>
  ),
  reseau: (
    <>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" />
    </>
  ),
  etincelles: (
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  ),
  former: (
    <>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  boussole: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </>
  ),
  loupe: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  eclair: (
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  coche: <path d="M20 6 9 17l-5-5" />,
  plus: <path d="M5 12h14M12 5v14" />,
  // Lot B : icônes des cartes (mails, factures, agenda, chiffres, outils…).
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  document: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  calendrier: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  utilisateur: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  graphique: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  tendance: (
    <>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  cadenas: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  ecran: (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  image: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  telephone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  euro: (
    <>
      <path d="M4 10h12M4 14h9" />
      <path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2" />
    </>
  ),
  cloche: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  envoyer: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  robot: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </>
  ),
  dossier: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  tableur: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
    </>
  ),
  etoile: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  coeur: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  partage: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </>
  ),
  crayon: <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </>
  ),
  video: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  lien: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  // Image → vidéo : icônes lues sur les images (résultats = cible, clé USB, scan).
  cible: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  usb: (
    <>
      <path d="M8 2h8v6H8z" />
      <path d="M6 8h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" />
      <path d="M10.5 4.5v1M13.5 4.5v1" />
    </>
  ),
  scan: (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </>
  ),
};

/** Noms d'icônes disponibles (une icône inconnue s'affiche comme un rond, jamais comme un vide). */
export const NOMS_ICONES = Object.freeze(Object.keys(TRACES));

export function Icone({ nom, taille, couleur, epaisseur = 2.4 }: { nom: string; taille: number; couleur: string; epaisseur?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round">
      {TRACES[nom] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/** Mesures en pixels dépendant de la largeur de l'image. */
export function mesures(largeur: number) {
  return {
    contour: Math.max(3, Math.round(GEOMETRIE.contourL * largeur)),
    ombre: Math.max(4, Math.round(GEOMETRIE.ombreL * largeur)),
    rayon: Math.round(GEOMETRIE.rayonL * largeur),
  };
}

/** Boîte de la grammaire : contour encre épais, ombre dure décalée en bas à droite, coins arrondis. */
export function styleBoite(largeur: number, fond: string, rayon?: number): CSSProperties {
  const m = mesures(largeur);
  return {
    background: fond,
    border: `${m.contour}px solid ${COULEURS.encre}`,
    borderRadius: rayon ?? m.rayon,
    boxShadow: `${m.ombre}px ${m.ombre}px 0 ${COULEURS.encre}`,
    boxSizing: "border-box",
  };
}

/* ------------------------------------------------------------------ Flash d'entrée des sous-éléments de carte ------------------------------------------------------------------ */

/**
 * Revue passe 3 du 15/10, priorité 2 : un sous-élément de carte (ligne, étape, vignette, case) doit produire un VRAI
 * mouvement visible, comme dans la référence. `dynamisme.py` ne compte un « gros mouvement » que si ≥ 5 % de l'image change
 * de plus de 40 niveaux de gris EN UNE IMAGE. D'où trois états francs, sans fondu :
 *  - « flash » : sur son mot, l'élément arrive sur un fond ORANGE PLEIN (texte ivoire), d'un coup ;
 *  - « actif » : après `FLASH.duree`, le fond passe d'un coup au SABLE plein (2ᵉ changement franc, qui comble les trous) ;
 *  - « pose »  : quand l'élément suivant arrive, le fond sable disparaît d'un coup, en même temps que le suivant flashe.
 * Orange ↔ ivoire = 116 niveaux de gris, orange ↔ sable = 67, sable ↔ ivoire = 49 : tous au-dessus du seuil de 40.
 */
export const FLASH = Object.freeze({
  /** Durée du fond orange (s) : 8 images. */
  duree: 0.32,
  /** Durée minimale (s) : 4 images, pour que l'entrée et le passage au sable soient deux pics distincts de la mesure. */
  minimum: 0.16,
  /** Le flash finit au moins 3 images avant l'élément suivant (pics séparés). */
  ecartSuivant: 0.12,
});

export type PhaseFlash = "avant" | "flash" | "actif" | "pose";

/** Instant (s) où le fond orange d'un élément arrivé à `a` passe au sable, `suivant` étant l'arrivée de l'élément suivant. */
export function finFlash(a: number, suivant?: number): number {
  const f = a + FLASH.duree;
  if (suivant === undefined || suivant <= a) return f;
  return Math.max(a + FLASH.minimum, Math.min(f, suivant - FLASH.ecartSuivant));
}

/** Phase d'un sous-élément arrivé à `a` (voir `FLASH`). `suivant` absent : il reste actif jusqu'à la fin de la carte. */
export function phaseFlash(t: number, a: number, suivant?: number): PhaseFlash {
  if (t < a) return "avant";
  if (t < finFlash(a, suivant)) return "flash";
  if (suivant === undefined || suivant <= a || t < suivant) return "actif";
  return "pose";
}

/** Instant de l'élément qui suit `a` dans `instants` (le plus petit instant strictement postérieur), s'il existe. */
export function instantSuivant(a: number, instants: number[]): number | undefined {
  let s: number | undefined;
  for (const x of instants) if (x > a + 1e-9 && (s === undefined || x < s)) s = x;
  return s;
}

/**
 * Fond d'un sous-élément selon sa phase : orange plein (flash), sable plein + contour encre (actif), rien sinon. Bords
 * NETS, aucun fondu ni mise à l'échelle : le changement tient en une image. À poser en `position: absolute` derrière
 * le contenu (le parent doit être `position: relative`). `deborde` (px) l'élargit au-delà de l'élément.
 */
export function FondFlash({ phase, largeurImage, rayon, deborde = 0, debordeV = 0 }: { phase: PhaseFlash; largeurImage: number; rayon: number; deborde?: number; debordeV?: number }) {
  if (phase !== "flash" && phase !== "actif") return null;
  const { contour } = mesures(largeurImage);
  return (
    <div
      style={{
        position: "absolute",
        left: -deborde,
        right: -deborde,
        top: -debordeV,
        bottom: -debordeV,
        background: phase === "flash" ? COULEURS.orange : COULEURS.sable,
        border: `${contour}px solid ${COULEURS.encre}`,
        borderRadius: rayon,
        boxSizing: "border-box",
      }}
    />
  );
}

/** Couleur du texte posé sur un `FondFlash` (ivoire sur l'orange, encre sinon). */
export const encreFlash = (phase: PhaseFlash, sinon: string = COULEURS.encre) => (phase === "flash" ? COULEURS.ivoire : sinon);

/**
 * Apparition « pop » (grossit avec rebond) puis disparition FRANCHE à `fin`.
 * Revue passe 3 (priorité 2, « entrées plus amples ») : l'étiquette apparaît d'emblée à 45 % de sa taille (gros
 * changement dès la première image) et tourne de 22° ; elle sort par un petit gonflement (2 images) puis disparaît d'un
 * coup — un 2ᵉ gros mouvement mesurable au lieu d'un fondu étalé sur 3 images.
 */
function echellePop(t: number, debut: number, fin: number) {
  // Dépassement du « pop » ≈ 10 % (force 1,8) : l'étiquette ne sort jamais du cadre, même au sommet du rebond.
  const entree = rebond(t, debut, TEMPS.pop, 1.8);
  const gonfle = t >= fin - 0.08 ? 0.06 : 0;
  return { echelle: 0.45 + 0.55 * entree + gonfle, opacite: 1, tourne: (1 - rebond(t, debut, TEMPS.pop * 1.3, 2)) * -22 };
}

export type EtiquetteProps = {
  t: number;
  debut: number;
  fin: number;
  /** Centre de l'étiquette, en pixels. */
  x: number;
  y: number;
  largeurImage: number;
  texte: string;
  sousTexte?: string;
  fond?: "ivoire" | "orange" | "encre";
  taille: number;
  rotation?: number;
  /** Icônes qui arrivent une à une (instant d'apparition de chacune). */
  icones?: { nom: string; a: number }[];
  /** Instant où un trait vient barrer l'étiquette. */
  barreA?: number;
};

/** Étiquette inclinée posée au-dessus de la tête (texte, icônes en cascade, trait qui barre). */
export function Etiquette(p: EtiquetteProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const { echelle, opacite, tourne } = echellePop(p.t, p.debut, p.fin);
  const fond = p.fond === "orange" ? COULEURS.orange : p.fond === "encre" ? COULEURS.encre : COULEURS.ivoire;
  const couleurTexte = p.fond === "ivoire" || !p.fond ? COULEURS.encre : COULEURS.ivoire;
  const pad = Math.round(p.taille * 0.38);
  const trait = p.barreA !== undefined ? progression(p.t, p.barreA, TEMPS.trait) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(-50%, -50%) rotate(${(p.rotation ?? -TEMPS.inclinaison) + tourne}deg) scale(${echelle})`,
        opacity: opacite,
        ...styleBoite(p.largeurImage, fond, Math.round(p.taille * 0.32)),
        padding: `${Math.round(pad * 0.55)}px ${pad}px`,
        display: "flex",
        alignItems: "center",
        gap: Math.round(p.taille * 0.35),
        whiteSpace: "nowrap",
      }}
    >
      {p.icones?.map((ic) => {
        const e = rebond(p.t, ic.a, TEMPS.pop, 3);
        return (
          <div
            key={ic.nom}
            style={{
              width: p.taille * 1.6,
              height: p.taille * 1.6,
              borderRadius: "50%",
              background: COULEURS.orange,
              border: `${mesures(p.largeurImage).contour}px solid ${COULEURS.encre}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${p.t < ic.a ? 0 : e})`,
            }}
          >
            <Icone nom={ic.nom} taille={p.taille * 0.95} couleur={COULEURS.ivoire} />
          </div>
        );
      })}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.02 }}>
        <span style={{ fontFamily: POLICES.titre, fontSize: p.taille, color: couleurTexte, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.texte}</span>
        {p.sousTexte ? (
          <span style={{ fontFamily: POLICES.titre, fontSize: p.taille * 0.62, color: p.fond === "ivoire" || !p.fond ? COULEURS.orange : COULEURS.ivoire, textTransform: "uppercase" }}>{p.sousTexte}</span>
        ) : null}
      </div>
      {trait > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "6%",
            top: "52%",
            width: `${88 * trait}%`,
            height: Math.max(7, p.taille * 0.17),
            background: COULEURS.orange,
            borderRadius: 4,
            transform: "rotate(-4deg)",
            transformOrigin: "left center",
          }}
        />
      ) : null}
    </div>
  );
}

/** Tuile logo (icône dans un carré, légende dessous), en haut à gauche. */
export function TuileLogo({ t, debut, fin, x, y, largeurImage, icone, legende, tailleLegende }: { t: number; debut: number; fin: number; x: number; y: number; largeurImage: number; icone: string; legende: string; /** Police de la légende (px), réduite par la mise en page si la légende est longue. */ tailleLegende?: number }) {
  if (t < debut || t >= fin) return null;
  const { echelle, opacite, tourne } = echellePop(t, debut, fin);
  const cote = Math.round(largeurImage * 0.12);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${-4 + tourne}deg) scale(${echelle})`, opacity: opacite, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ width: cote, height: cote, ...styleBoite(largeurImage, COULEURS.ivoire), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={cote * 0.62} couleur={COULEURS.orange} epaisseur={2} />
      </div>
      <div style={{ ...styleBoite(largeurImage, COULEURS.ivoire, 10), padding: "2px 10px", fontFamily: POLICES.titre, fontSize: tailleLegende ?? cote * 0.17, color: COULEURS.encre, whiteSpace: "nowrap" }}>{legende}</div>
    </div>
  );
}

/** Étiquette de rôle qui glisse depuis le bord droit (« Le rédacteur »…). */
export function EtiquetteGlisse({ t, debut, fin, y, largeurImage, texte, icone, taille: tailleDemandee }: { t: number; debut: number; fin: number; y: number; largeurImage: number; texte: string; icone?: string; /** Taille du texte (px), réduite par la mise en page si le texte est long. */ taille?: number }) {
  if (t < debut || t >= fin) return null;
  const g = rebond(t, debut, TEMPS.glisse, 1.3);
  // Sortie FRANCHE (revue passe 3, priorité 2) : l'étiquette disparaît d'un coup à `fin` — un gros changement mesurable.
  const s: number = 0;
  const taille = tailleDemandee ?? Math.round(largeurImage * 0.034);
  return (
    <div
      style={{
        position: "absolute",
        right: largeurImage * 0.05,
        top: y,
        transform: `translateX(${(1 - g) * largeurImage * 0.6}px) rotate(3deg)`,
        opacity: 1 - s,
        ...styleBoite(largeurImage, COULEURS.orange, 12),
        padding: `${taille * 0.3}px ${taille * 0.55}px`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        whiteSpace: "nowrap",
      }}
    >
      {icone ? <Icone nom={icone} taille={taille * 1.1} couleur={COULEURS.ivoire} /> : null}
      <span style={{ fontFamily: POLICES.titre, fontSize: taille, color: COULEURS.ivoire, textTransform: "uppercase" }}>{texte}</span>
    </div>
  );
}

/** Barre de progression fine en haut de l'image. */
export function BarreProgression({ t, duree, largeur }: { t: number; duree: number; largeur: number }) {
  const h = Math.max(6, Math.round(largeur * 0.008));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: largeur, height: h, background: `${COULEURS.encre}99` }}>
      <div style={{ width: `${Math.min(100, (t / duree) * 100)}%`, height: h, background: COULEURS.orange }} />
    </div>
  );
}
