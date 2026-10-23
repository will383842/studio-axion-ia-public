import React from "react";
/**
 * FAMILLE DE MOTION « VOLET DE TRANSITION COLORÉ » (hors cartes, designer n° 2 — refonte du 15/10/2026 après la
 * critique) — changement de PARTIE du script.
 *
 * Trois bandes plein cadre balaient l'image en diagonale l'une après l'autre : IVOIRE, puis ORANGE, puis le FOND
 * (encre par défaut ; orange ou sable au choix du plan — l'accent devient alors encre). Sur le fond, le TITRE DE
 * CHAPITRE claque en TRÈS GRAND : chaque mot principal remplit 88 % de la largeur (une ligne par mot), les petits mots
 * (« la », « le », « vos »…) passent en surtitre au-dessus ; les lignes montent une à une derrière un cache. Le dernier
 * mot prend la couleur d'accent ; un trait d'accent se tend sous le titre ; deux SILLAGES rayés aux couleurs des bandes
 * restent dans les coins (rappel du balayage). Un numéro de chapitre ne s'affiche QUE s'il est dit.
 * Sortie : les bandes repartent dans le même sens, dans l'ordre inverse (fond, accent, ivoire), en escalier.
 *
 *  - Visage : COUVERT (en entier, plein cadre) pendant 0,5 à 0,8 s ; la prise ne bouge pas.
 *  - INTERDIT dans les 4 premières secondes (`FICHE.interditAvant`) : la vidéo s'ouvre sur le visage.
 *  - Chaque bande change bien plus de 5 % de l'image par image (balayage plein cadre en 4 images).
 *  - Au plus DEUX volets par vidéo.
 *  - Fusion proposée avec le MOT GÉANT (designer 1) : `BalayageVolet` et `calendrierVolet` sont exportés pour servir
 *    d'ENTRÉE et de SORTIE à un mot géant (le fond est alors celui du mot géant).
 *  - Bruitage : souffle large à l'entrée, coup sourd sur le titre, souffle de sortie.
 */
import { COULEURS, POLICES } from "../charte";
import { avanceEm } from "../SousTitres";
import { progression, rebond } from "../mouvement";

export type FondVolet = "encre" | "orange" | "sable";

export type DonneesVoletChapitre = {
  debut: number;
  /** Fin : 0,5 à 0,8 s après `debut`. */
  fin: number;
  /** Titre de chapitre, 1 à 3 mots (« Le problème », « La solution », « L'offre »…). */
  titre: string;
  /** Couleur du fond qui porte le titre (défaut : encre). */
  fond?: FondVolet;
  /** Numéro de chapitre, SEULEMENT s'il est dit par Will (« deuxième point »…). */
  numero?: string;
  /** Sens du balayage (défaut : de gauche à droite). */
  sens?: "droite" | "gauche";
};

export const FICHE_VOLET_CHAPITRE = Object.freeze({
  id: "volet",
  nom: "Volet de transition coloré",
  visage: "couvert" as const,
  dureeMin: 0.5,
  dureeMax: 0.8,
  /** Jamais avant cette seconde : la vidéo s'ouvre sur le visage de Will. */
  interditAvant: 4,
  parVideoMax: 2,
  quandUtiliser: "Pour changer de partie dans le script (problème, puis solution, puis offre, puis appel). Deux par vidéo au plus, jamais dans les 4 premières secondes.",
});

export const EXEMPLE_PHRASE_VOLET_CHAPITRE = "Passons maintenant à la solution.";
export const EXEMPLE_VOLET_CHAPITRE: DonneesVoletChapitre = { debut: 0.3, fin: 1.05, titre: "La solution" };
/** Instants de contrôle : bandes en plein balayage, puis titre posé. */
export const INSTANT_CONSTRUCTION_VOLET_CHAPITRE = 0.4;
export const INSTANT_VOLET_CHAPITRE = 0.78;

/** Contenu de la famille dans le plan (`SCHEMAS_CONTENU_MOTION.volet`). */
export type ContenuPlanVolet = { titre: string; a: number; couleur?: FondVolet; numero?: string };
/** Passe du plan du réalisateur aux données du composant. */
export function voletDepuisPlan(c: ContenuPlanVolet, debut: number, fin: number): DonneesVoletChapitre {
  return { debut, fin, titre: c.titre, fond: c.couleur, numero: c.numero };
}

/** Angle du bord d'attaque (degrés) et décalage (s) entre les bandes. */
const INCLINAISON = 18;
const ECART = 0.045;
const ORANGE_CLAIR = "#CF6A3F";

/** Couleurs des trois bandes (la dernière porte le titre) et couleurs du titre. */
export function couleursVolet(fond: FondVolet = "encre") {
  const accent = fond === "orange" ? COULEURS.encre : COULEURS.orange;
  const fondC = fond === "orange" ? COULEURS.orange : fond === "sable" ? COULEURS.sable : COULEURS.encre;
  const texte = fond === "sable" ? COULEURS.encre : COULEURS.ivoire;
  const motAccent = fond === "orange" ? COULEURS.encre : fond === "sable" ? COULEURS.orange : ORANGE_CLAIR;
  return { bandes: [COULEURS.ivoire, accent, fondC], texte, motAccent, accent };
}

/** Calendrier : entrée de chaque bande, sortie de chaque bande, instant du titre. */
export function calendrierVolet(debut: number, fin: number) {
  const duree = Math.max(0.45, fin - debut);
  const passe = Math.min(0.16, duree * 0.22);
  const entrees = [0, 1, 2].map((k) => debut + k * ECART);
  // Sortie dans l'ordre inverse : le fond part le premier.
  const sorties = [0, 1, 2].map((k) => fin - passe - k * ECART);
  return { passe, entrees, sorties, titreA: entrees[2] + passe * 0.65 };
}

/** Position d'une bande : -1 (hors image, départ) → 0 (couvre tout) → +1 (hors image, arrivée). */
function position(t: number, entree: number, sortieA: number, passe: number): number {
  const e = progression(t, entree, passe);
  const s = progression(t, sortieA, passe);
  return -1 + (1 - (1 - e) ** 3) + s ** 2.2;
}

/**
 * Les trois bandes qui balaient l'image (réutilisable comme entrée/sortie d'un plein écran). `contenu` est posé sur la
 * dernière bande et voyage avec elle à la sortie.
 */
export function BalayageVolet({ t, W, H, debut, fin, couleurs, sens = "droite", contenu }: { t: number; W: number; H: number; debut: number; fin: number; couleurs: string[]; sens?: "droite" | "gauche"; contenu?: React.ReactNode }) {
  const c = calendrierVolet(debut, fin);
  const s = sens === "droite" ? 1 : -1;
  const decalage = H * Math.tan((INCLINAISON * Math.PI) / 180);
  const largeurBande = W + decalage + 8;
  const course = largeurBande + decalage;
  const demi = Math.tan((INCLINAISON * Math.PI) / 180) * (H / 2 + 4);
  const formes = [0, 1, 2].map((k) => {
    const p = position(t, c.entrees[k], c.sorties[2 - k], c.passe);
    const x = -decalage / 2 + s * p * course - 4;
    return { k, p, x };
  });
  const fond = formes[2];
  // Contour de la bande du fond dans l'image (parallélogramme) : le contenu y est découpé et voyage avec elle.
  const decoupe = `polygon(${fond.x + s * demi}px -4px, ${fond.x + largeurBande + s * demi}px -4px, ${fond.x + largeurBande - s * demi}px ${H + 4}px, ${fond.x - s * demi}px ${H + 4}px)`;
  return (
    <>
      {formes.map(({ k, p, x }) => {
        if (p <= -0.999 || p >= 0.999) return null;
        return <div key={k} style={{ position: "absolute", top: -4, left: x, width: largeurBande, height: H + 8, background: couleurs[k], transform: `skewX(${-s * INCLINAISON}deg)`, zIndex: k }} />;
      })}
      {contenu && fond.p > -0.999 && fond.p < 0.999 ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, zIndex: 3, clipPath: decoupe }}>{contenu}</div> : null}
    </>
  );
}

/** Petits mots qui passent en surtitre au-dessus du mot suivant. */
const PETITS = new Set(["la", "le", "les", "l'", "un", "une", "des", "vos", "votre", "nos", "notre", "et", "à", "en", "du", "de", "d'"]);

/** Découpe le titre en lignes : chaque mot principal a sa ligne, précédé de son surtitre éventuel. */
function lignesTitre(titre: string) {
  const mots = titre.trim().split(/\s+/).slice(0, 3);
  const lignes: { sur?: string; mot: string }[] = [];
  let sur: string[] = [];
  mots.forEach((m, i) => {
    // « L'offre » : l'article élidé passe aussi en surtitre.
    const elide = /^([ldLD]['’])(.+)$/.exec(m);
    if (elide) {
      lignes.push({ sur: [...sur, elide[1]].join(" ") || undefined, mot: elide[2] });
      sur = [];
    } else if (PETITS.has(m.toLowerCase()) && i < mots.length - 1) sur.push(m);
    else {
      lignes.push({ sur: sur.join(" ") || undefined, mot: m });
      sur = [];
    }
  });
  return lignes;
}

/** Sillage rayé aux couleurs des bandes, dans un coin (rappel du balayage), qui s'étire depuis le bord. */
function Sillage({ W, H, coin, couleurs, p }: { W: number; H: number; coin: "hg" | "bd"; couleurs: string[]; p: number }) {
  const e = W * 0.024;
  const traits = [couleurs[1], couleurs[0], couleurs[1]];
  const haut = coin === "hg";
  return (
    <div style={{ position: "absolute", left: haut ? -W * 0.04 : undefined, right: haut ? undefined : -W * 0.04, top: haut ? H * 0.06 : H * 0.86, width: W * 0.52, display: "flex", flexDirection: "column", gap: e * 0.55, alignItems: haut ? "flex-start" : "flex-end" }}>
      {traits.map((c, k) => (
        <div key={k} style={{ width: W * 0.52 * (1 - 0.24 * (haut ? k : 2 - k)) * (1 - (1 - p) ** 3), height: e, background: c, transform: `skewX(${-INCLINAISON}deg)` }} />
      ))}
    </div>
  );
}

export function VoletChapitre({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_VOLET_CHAPITRE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesVoletChapitre }) {
  const d = donnees;
  if (t < d.debut || t >= d.fin) return null;
  const c = calendrierVolet(d.debut, d.fin);
  const k = couleursVolet(d.fond);
  const lignes = lignesTitre(d.titre);
  const largeurUtile = W * 0.88;
  // Chaque mot principal remplit la largeur utile, plafonné en hauteur pour que tout tienne (≤ 0,6 H au total).
  const tailles = lignes.map((l) => Math.min(H * 0.2, largeurUtile / Math.max(1, avanceEm(l.mot.toUpperCase()) * 0.97)));
  const hauteurTotale = lignes.reduce((s, l, i) => s + tailles[i] * 0.86 + (l.sur ? tailles[i] * 0.3 : 0), 0);
  const reduit = Math.min(1, (H * 0.56) / Math.max(1, hauteurTotale));
  // Texture cinétique : le mot principal répété en rangées détourées qui défilent en sens alternés (au-dessus et
  // au-dessous du titre), pour que le plein écran vive au lieu d'être un aplat.
  const principal = lignes[lignes.length - 1].mot.toUpperCase();
  const tailleRangee = Math.min(H * 0.085, (W * 0.7) / Math.max(1, avanceEm(principal)));
  const hTitre = hauteurTotale * reduit + H * 0.05 + (d.numero ? H * 0.1 * reduit : 0);
  const zoneLibre = [(H - hTitre) / 2 - H * 0.03, (H + hTitre) / 2 + H * 0.03];
  const rangees: number[] = [];
  for (let y = H * 0.13; y < H * 0.84; y += tailleRangee * 1.08) if (y + tailleRangee < zoneLibre[0] || y > zoneLibre[1]) rangees.push(y);
  const defile = (t - c.titreA) * W * 0.9;
  const contenu = (
    <div style={{ position: "absolute", inset: 0 }}>
      {rangees.map((y, i) => (
        <div key={`r${i}`} style={{ position: "absolute", top: y, left: 0, whiteSpace: "nowrap", fontFamily: POLICES.titre, fontSize: tailleRangee, lineHeight: 1, color: "transparent", WebkitTextStroke: `${Math.max(2, W * 0.0022)}px ${k.motAccent}`, opacity: 0.32 * progression(t, c.titreA + 0.02 * i, 0.08), transform: `translateX(${(i % 2 ? -1 : 1) * defile - W * (0.3 + 0.17 * (i % 3))}px)`, letterSpacing: -tailleRangee * 0.01 }}>
          {`${principal} · ${principal} · ${principal} · ${principal}`}
        </div>
      ))}
      <Sillage W={W} H={H} coin="hg" couleurs={k.bandes} p={progression(t, c.titreA, 0.16)} />
      <Sillage W={W} H={H} coin="bd" couleurs={k.bandes} p={progression(t, c.titreA + 0.04, 0.16)} />
      <div style={{ position: "absolute", left: (W - largeurUtile) / 2, width: largeurUtile, top: 0, height: H, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
        {d.numero ? (
          <div style={{ fontFamily: POLICES.titre, fontSize: H * 0.09 * reduit, lineHeight: 0.9, color: "transparent", WebkitTextStroke: `${Math.max(3, W * 0.004)}px ${k.motAccent}`, opacity: progression(t, c.titreA, 0.06), marginBottom: H * 0.01 }}>{d.numero}</div>
        ) : null}
        {lignes.map((l, i) => {
          const a = c.titreA + i * 0.035;
          const monte = 1 - (1 - progression(t, a, 0.12)) ** 3;
          const taille = tailles[i] * reduit;
          const dernier = i === lignes.length - 1;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              {l.sur ? (
                <div style={{ overflow: "hidden", paddingBottom: taille * 0.02 }}>
                  <div style={{ fontFamily: POLICES.titre, fontSize: taille * 0.27, lineHeight: 1, color: k.texte, textTransform: "uppercase", letterSpacing: taille * 0.05, transform: `translateY(${(1 - monte) * 110}%)` }}>{l.sur}</div>
                </div>
              ) : null}
              <div style={{ overflow: "hidden", height: taille * 0.86 }}>
                <div style={{ fontFamily: POLICES.titre, fontSize: taille, lineHeight: 0.86, color: dernier && lignes.length > 1 ? k.motAccent : lignes.length === 1 ? k.motAccent : k.texte, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: -taille * 0.02, transform: `translateY(${(1 - monte) * 105}%)` }}>{l.mot}</div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: H * 0.022, height: Math.max(8, H * 0.009), width: largeurUtile * 0.36 * rebond(t, c.titreA + 0.08, 0.14, 1.6), background: k.motAccent, borderRadius: 999 }} />
      </div>
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      <BalayageVolet t={t} W={W} H={H} debut={d.debut} fin={d.fin} couleurs={k.bandes} sens={d.sens} contenu={t >= c.titreA ? contenu : undefined} />
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume] — le format que lit `VideoAnimee`. */
export type BruitageMotion = [number, string, number];

/** Souffle large (deux souffles superposés), coup sourd du titre, souffle de sortie. */
export function bruitagesVoletChapitre(d: DonneesVoletChapitre = EXEMPLE_VOLET_CHAPITRE): BruitageMotion[] {
  const c = calendrierVolet(d.debut, d.fin);
  return [
    [d.debut - 0.03, "whoosh-in", 0.3],
    [d.debut + 0.04, "whoosh-in", 0.18],
    [c.titreA, "drop_004", 0.12],
    [c.sorties[0], "whoosh-out", 0.26],
  ];
}
