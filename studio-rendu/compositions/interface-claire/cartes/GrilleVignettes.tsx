import React from "react";
/**
 * CARTE « GRILLE DE VIGNETTES » (redessinée le 15/10, standard premium ; référence : carte ChatGPT · Images,
 * `planche_03` et `planche_04`).
 * Chaque vignette est une MINI-FENÊTRE (barre de titre fine à 3 points, filet, coins de 0,012 L) au contenu crédible :
 *  - `image`  : paysage stylisé (ciel ivoire-creux → sable-clair, deux plans de reliefs, soleil orange) ;
 *  - `ecran`  : graphique à barres avec axe et repères, la dernière barre en orange ;
 *  - `fiche`  : un titre et des lignes à puces, icône nue dans le coin (relancée à `iconeA`) ;
 *  - `texte`  : un gros mot centré, pastille orange-voile dessous.
 * Légende SOUS la vignette (numéro + libellé en titre). La vignette ACTIVE (la dernière arrivée) est relevée de 0,01 L
 * avec la micro-ombre et une barre de titre orange-voile ; les autres restent à plat.
 *
 * Mouvement : sur son mot, la vignette se DÉPLIE depuis le haut (échelle Y 0,9 → 1, translation de 0,02 L, 0,2 s),
 * recouverte d'un volet orange qui descend puis se retire vers le bas (changement franc ≥ 5 % de l'image) ; son contenu
 * se construit 80 ms après ; la précédente perd sa surélévation. N3 : une lueur orange-voile parcourt la vignette
 * active toutes les 1,2 s.
 */
import { NUANCES, degradeOrange, fondu, glisse, largeurCorps, largeurInter, largeurTitre, microOmbre, pose, claque, Reflet, RELIEF, styleCorps, styleTitre, tailleQuiTient, TYPO } from "../variantes/premium-1";
import { Icone } from "../elements";

export type ContenuVignette =
  | { type: "image" }
  | { type: "ecran"; /** Nombre de barres dans l'écran (défaut 3). */ barres?: number }
  | { type: "fiche"; /** Nombre de lignes (défaut 4). */ lignes?: number; /** Icône du coin (`NOMS_ICONES`). */ icone?: string; /** Instant du mot qui relance l'icône (défaut : a + 0,45 s). */ iconeA?: number }
  | { type: "texte"; /** Titre court (2-3 mots). */ titre: string; /** Pastille sous le titre. */ pastille?: string };

export type Vignette = {
  /** Instant du mot (s) : la vignette se déplie. */
  a: number;
  /** Légende sous la vignette. */
  legende: string;
  contenu: ContenuVignette;
};

export type GrilleVignettesProps = {
  /** Temps courant (s), même horloge que la `Carte`. */
  t: number;
  /** Largeur de l'image (px). */
  largeurImage: number;
  /** Hauteur d'une vignette (px, légende non comprise), ≈ 9-11 % de la hauteur de l'image. */
  hauteurVignette: number;
  /** 2 (défaut) ou 3 colonnes. Les vignettes remplissent la grille ligne par ligne. */
  colonnes?: 2 | 3;
  vignettes: Vignette[];
};

/** Proportions (en hauteur de vignette) : INCHANGÉES (la mise en page de `cadrage.ts` en dépend). */
const H_LEGENDE = 0.26;
const ECART = 0.12;

/** Hauteur du contenu (px) pour dimensionner la `Carte`. */
export function hauteurGrilleVignettes(hauteurVignette: number, nbVignettes: number, colonnes: 2 | 3 = 2) {
  const rangs = Math.ceil(nbVignettes / colonnes);
  return rangs * hauteurVignette * (1 + H_LEGENDE) + Math.max(0, rangs - 1) * hauteurVignette * ECART;
}

/* ------------------------------------------------------------------ Contenus (repère 160 × 100) ------------------------------------------------------------------ */

function ContenuImage({ t, d0, id }: { t: number; d0: number; id: string }) {
  const fond = pose(t, d0, 0.22);
  const devant = pose(t, d0 + 0.05, 0.22);
  const soleil = t >= d0 + 0.1 ? claque(t, d0 + 0.1, 0.12) : 0;
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`ciel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NUANCES.ivoireCreux} />
          <stop offset="1" stopColor={NUANCES.sableClair} />
        </linearGradient>
        <linearGradient id={`soleil-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NUANCES.orangeChaud} />
          <stop offset="1" stopColor={NUANCES.orangeProfond} />
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill={`url(#ciel-${id})`} />
      <circle cx="116" cy="32" r="13" fill={`url(#soleil-${id})`} style={{ transform: `translateY(${(1 - soleil) * 30}px)` }} />
      <path d="M-4 100 L38 46 L62 70 L92 36 L132 78 L164 58 L164 100 Z" fill={NUANCES.sable} style={{ transform: `translateY(${(1 - fond) * 50}px)` }} />
      <path d="M92 36 L100 46 L94 49 L86 44 Z" fill={NUANCES.ivoire} style={{ transform: `translateY(${(1 - fond) * 50}px)` }} />
      <path d="M-4 100 L24 74 L50 88 L84 62 L120 90 L164 80 L164 100 Z" fill={NUANCES.sableProfond} style={{ transform: `translateY(${(1 - devant) * 40}px)` }} />
    </svg>
  );
}

function ContenuEcran({ t, d0, barres, id }: { t: number; d0: number; barres: number; id: string }) {
  const n = Math.max(1, Math.min(5, barres));
  const hauteurs = [0.42, 0.6, 0.5, 0.74, 0.86];
  const zone = 128;
  const pas = zone / n;
  const largeur = pas * 0.58;
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`barre-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NUANCES.orangeChaud} />
          <stop offset="1" stopColor={NUANCES.orangeProfond} />
        </linearGradient>
      </defs>
      {[30, 52, 74].map((y) => (
        <line key={y} x1="16" y1={y} x2="150" y2={y} stroke={NUANCES.filet} strokeWidth="1.6" strokeDasharray="4 4" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const k = pose(t, d0 + i * 0.05, 0.22);
        const h = 66 * hauteurs[(i + 5 - n) % 5] * k;
        const x = 20 + i * pas + (pas - largeur) / 2;
        return <rect key={i} x={x} y={86 - h} width={largeur} height={Math.max(0, h)} rx="3" fill={i === n - 1 ? `url(#barre-${id})` : NUANCES.sableProfond} />;
      })}
      <line x1="14" y1="86" x2="152" y2="86" stroke={NUANCES.encreDouce} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ContenuFiche({ t, d0, lignes, icone, iconeA, W }: { t: number; d0: number; lignes: number; icone?: string; iconeA?: number; W: number }) {
  const n = Math.max(1, Math.min(5, lignes));
  const longueurs = [0.92, 0.74, 0.84, 0.6, 0.78];
  const pas = 62 / n;
  const ai = iconeA ?? d0 + 0.37;
  const relance = icone && t >= ai ? 1 + 0.18 * Math.sin(Math.PI * Math.min(1, (t - ai) / 0.18)) : 1;
  const eIcone = icone ? pose(t, d0 + 0.04, 0.2) : 0;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="none">
        {/* Titre de la fiche. */}
        <rect x="14" y="12" width={icone ? 84 * glisse(t, d0, 0.18) : 110 * glisse(t, d0, 0.18)} height="10" rx="5" fill={NUANCES.encreDouce} />
        {Array.from({ length: n }, (_, i) => {
          const d = d0 + 0.05 + i * 0.05;
          const k = glisse(t, d, 0.18);
          const y = 36 + i * pas;
          return (
            <g key={i} opacity={t >= d ? 1 : 0}>
              <circle cx="18" cy={y} r="4" fill={i === 0 ? NUANCES.orange : NUANCES.sableProfond} />
              <rect x="30" y={y - 3.5} width={Math.max(0, 118 * longueurs[i % 5] * k)} height="7" rx="3.5" fill={NUANCES.sableClair} />
            </g>
          );
        })}
      </svg>
      {icone ? (
        <div style={{ position: "absolute", right: "6%", top: "6%", transform: `scale(${eIcone * relance})`, transformOrigin: "100% 0%" }}>
          <Icone nom={icone} taille={W * 0.055} couleur={NUANCES.orange} epaisseur={2.4} />
        </div>
      ) : null}
    </div>
  );
}

function ContenuTexte({ t, d0, titre, pastille, largeur, hauteur, W }: { t: number; d0: number; titre: string; pastille?: string; largeur: number; hauteur: number; W: number }) {
  const k = pose(t, d0, 0.22);
  const taille = tailleQuiTient(largeurTitre(titre, 1), largeur * 0.84, TYPO.minimum(W), Math.min(W * 0.06, hauteur * 0.3));
  // Titre sur 2 lignes s'il est long : jamais sous le minimum.
  const deuxLignes = largeurTitre(titre, TYPO.minimum(W)) > largeur * 0.84 && titre.includes(" ");
  const tailleFinale = deuxLignes ? tailleQuiTient(Math.max(...titre.split(" ").map((m) => largeurTitre(m, 1))), largeur * 0.84, TYPO.minimum(W), Math.min(W * 0.05, hauteur * 0.22)) : taille;
  const C = TYPO.minimum(W);
  const pastilleTient = pastille && largeurInter(pastille, C) + C * 1.2 < largeur * 0.92;
  const eP = pastilleTient ? glisse(t, d0 + 0.08, 0.18) : 0;
  return (
    <div style={{ width: "100%", height: "100%", background: NUANCES.ivoireCreux, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: hauteur * 0.06 }}>
      <div style={{ ...styleTitre(tailleFinale, NUANCES.encre), whiteSpace: deuxLignes ? "normal" : "nowrap", textAlign: "center", lineHeight: 1.02, transform: `translateY(${(1 - k) * hauteur * 0.12}px)`, opacity: fondu(t, d0) }}>{titre}</div>
      {pastilleTient ? (
        <div style={{ ...styleCorps(C, NUANCES.orangeProfond), whiteSpace: "nowrap", lineHeight: 1, padding: `${C * 0.28}px ${C * 0.6}px`, borderRadius: C, background: NUANCES.orangeVoile, opacity: fondu(t, d0 + 0.08), transform: `translateY(${(1 - eP) * C * 0.5}px)` }}>{pastille}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Grille ------------------------------------------------------------------ */

export function GrilleVignettes(p: GrilleVignettesProps) {
  const W = p.largeurImage;
  const h = p.hauteurVignette;
  const colonnes = p.colonnes ?? 2;
  const gouttiere = W * 0.02;
  const L = largeurCorps(W);
  const colonne = (L - (colonnes - 1) * gouttiere) / colonnes;
  const filet = RELIEF.filet(W);
  const rayon = RELIEF.rayon(W);
  const hBarre = Math.max(W * 0.022, h * 0.12);
  const point = hBarre * 0.32;
  const hLegende = h * H_LEGENDE;
  const tailleLegende = (texte: string) => tailleQuiTient(largeurTitre(texte, 1), colonne - largeurTitre("00 ", Math.min(W * 0.034, hLegende * 0.62)), TYPO.minimum(W), Math.min(W * 0.034, hLegende * 0.62));
  const arrivees = p.vignettes.map((v) => v.a).filter((a) => p.t >= a);
  const derniere = arrivees.length ? Math.max(...arrivees) : Infinity;
  const relevement = W * 0.01;

  return (
    <div style={{ position: "relative", height: hauteurGrilleVignettes(h, p.vignettes.length, colonnes), display: "grid", gridTemplateColumns: `repeat(${colonnes}, ${colonne}px)`, gridAutoRows: h * (1 + H_LEGENDE), columnGap: gouttiere, rowGap: h * ECART }}>
      {p.vignettes.map((v, i) => {
        if (p.t < v.a) return <div key={i} />;
        const active = v.a === derniere;
        const ePli = pose(p.t, v.a, 0.2);
        // Surélévation : monte en « glisse » à l'arrivée, redescend quand la suivante arrive.
        const suivante = p.vignettes.filter((x) => x.a > v.a + 1e-9 && p.t >= x.a).map((x) => x.a);
        const releve = active ? glisse(p.t, v.a, 0.18) : suivante.length ? 1 - glisse(p.t, Math.min(...suivante), 0.16) : 0;
        // Volet orange : descend (0 → 0,1 s), reste, puis se retire vers le bas (0,12 → 0,22 s).
        const voletEntre = glisse(p.t, v.a, 0.1);
        const voletSort = glisse(p.t, v.a + 0.12, 0.1);
        const volet = p.t < v.a + 0.22;
        const d0 = v.a + 0.08;
        const lueur = active ? (((p.t - v.a - 0.3) % 1.2) + 1.2) % 1.2 : -1;
        const id = `v${i}`;
        const hCorps = h - hBarre;
        return (
          <div key={i} style={{ position: "relative", minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                height: h,
                boxSizing: "border-box",
                borderRadius: rayon,
                border: `${filet}px solid ${active ? NUANCES.orange : NUANCES.filet}`,
                background: NUANCES.ivoire,
                overflow: "hidden",
                boxShadow: releve > 0.02 ? microOmbre(W, 0.6 + releve) : undefined,
                transform: `translateY(${(1 - ePli) * -W * 0.02 - releve * relevement}px) scaleY(${0.9 + 0.1 * ePli})`,
                transformOrigin: "50% 0%",
                opacity: fondu(p.t, v.a),
              }}
            >
              {/* Barre de titre : 3 points. */}
              <div style={{ height: hBarre, display: "flex", alignItems: "center", gap: point * 0.8, padding: `0 ${point * 1.2}px`, background: active ? NUANCES.orangeVoile : NUANCES.ivoireCreux, borderBottom: `${filet}px solid ${NUANCES.filet}` }}>
                {[0, 1, 2].map((k) => (
                  <div key={k} style={{ width: point, height: point, borderRadius: "50%", background: active ? (k === 0 ? NUANCES.orange : NUANCES.orangeChaud) : NUANCES.sableClair, opacity: active && k > 0 ? 0.55 : 1 }} />
                ))}
              </div>
              <div style={{ position: "relative", height: hCorps - filet }}>
                {p.t >= d0 && v.contenu.type === "image" ? <ContenuImage t={p.t} d0={d0} id={id} /> : null}
                {p.t >= d0 && v.contenu.type === "ecran" ? <ContenuEcran t={p.t} d0={d0} barres={v.contenu.barres ?? 3} id={id} /> : null}
                {p.t >= d0 && v.contenu.type === "fiche" ? <ContenuFiche t={p.t} d0={d0} lignes={v.contenu.lignes ?? 4} icone={v.contenu.icone} iconeA={v.contenu.iconeA} W={W} /> : null}
                {p.t >= d0 && v.contenu.type === "texte" ? <ContenuTexte t={p.t} d0={d0} titre={v.contenu.titre} pastille={v.contenu.pastille} largeur={colonne} hauteur={hCorps} W={W} /> : null}
                {/* N3 : lueur orange-voile qui traverse la vignette active. */}
                {lueur >= 0 && lueur < 0.6 && p.t > v.a + 0.3 ? (
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${-40 + (lueur / 0.6) * 160}%`, width: "35%", background: `linear-gradient(100deg, rgba(222,192,168,0) 0%, rgba(222,192,168,0.55) 50%, rgba(222,192,168,0) 100%)`, pointerEvents: "none" }} />
                ) : null}
              </div>
              {volet ? (
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: degradeOrange, transform: `scaleY(${voletEntre * (1 - voletSort)})`, transformOrigin: p.t < v.a + 0.12 ? "50% 0%" : "50% 100%" }}>
                  <Reflet rayon={rayon} />
                </div>
              ) : null}
            </div>
            {/* Légende sous la vignette : numéro (sable-profond) + libellé (titre). */}
            <div style={{ height: hLegende, display: "flex", alignItems: "center", gap: hLegende * 0.18, transform: `translateY(${(1 - glisse(p.t, v.a + 0.06, 0.18)) * W * 0.015}px)`, opacity: fondu(p.t, v.a + 0.06) }}>
              <span style={styleTitre(tailleLegende(v.legende), active ? NUANCES.orange : NUANCES.sableProfond)}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ ...styleTitre(tailleLegende(v.legende), active ? NUANCES.encre : NUANCES.encreDouce), overflow: "hidden" }}>{v.legende}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Exemple pour la galerie (contenu Axion-IA plausible, aucun chiffre). Instants relatifs au début de la carte. */
export const EXEMPLE_GRILLE_VIGNETTES = {
  titre: "ChatGPT · images",
  phrase: "Il vous fait des images, des maquettes, des visuels de pub et même des fiches pense-bête.",
  colonnes: 2,
  vignettes: [
    { a: 0.35, legende: "Images", contenu: { type: "image" } },
    { a: 1.0, legende: "Maquettes", contenu: { type: "ecran", barres: 4 } },
    { a: 1.7, legende: "Visuels pub", contenu: { type: "texte", titre: "Formation IA", pastille: "Inscriptions" } },
    { a: 2.4, legende: "Pense-bête", contenu: { type: "fiche", lignes: 4, icone: "partage", iconeA: 3.2 } },
  ],
} satisfies Omit<GrilleVignettesProps, "t" | "largeurImage" | "hauteurVignette"> & { titre: string; phrase: string };
