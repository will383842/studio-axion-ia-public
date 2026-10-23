import React from "react";
/**
 * MAQUETTE « BASCULE PROBLÈME → SOLUTION » (designer n° 3, 15/10) — « le souci, c'est… ; la solution, c'est… ».
 *
 * Panneau qui COUVRE TOUT LE VISAGE (0,06 → 0,94 L, 0,10 → 0,64 H : la boîte du visage cheveux → menton, × 1,2 en
 * largeur, est dedans ; la prise ne descend pas). Deux faces :
 *  - face PROBLÈME : encre pleine, texte ivoire, mot fort en orange qui se FISSURE ;
 *  - face SOLUTION : ivoire, en-tête orange, 2-3 lignes qui tombent, puis surlignage orange de la 1ʳᵉ.
 *  - N1 : le panneau sombre ENTRE EN SECOUSSE (arrive à 112 %, tremble 0,3 s) — rupture de contraste avec la prise.
 *  - N2 : les mots du problème CLAQUENT (arrivent à 180 %, s'écrasent en 3 images) ; une fissure se dessine sur le mot
 *         fort ; sur « la solution », le panneau se RETOURNE en 3D en 6 images (la face change à mi-course).
 *  - N3 : la fissure S'ÉTEND en branches sur le panneau ; côté solution, le surlignage orange passe sous la 1ʳᵉ ligne.
 */
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { Icone, mesures, styleBoite } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export type MotProbleme = { texte: string; a: number; /** Mot fort (gros, orange, fissuré). */ fort?: boolean };
export type LigneSolution = { texte: string; icone: string; a: number };

export type BasculeProblemeSolutionProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  titreProbleme?: string;
  /** Mots du problème, groupés par ligne (chaque ligne : 1 à 3 mots). */
  lignesProbleme: MotProbleme[][];
  /** Instant où la fissure commence (sur le mot fort). */
  fissureA: number;
  /** Instant du retournement (« la solution »). */
  basculeA: number;
  titreSolution?: string;
  lignesSolution: LigneSolution[];
  /** Instant du surlignage orange de la 1ʳᵉ ligne de solution. */
  surlignageA?: number;
};

export const CADRAGE_BASCULE = Object.freeze({ x0: 0.06, x1: 0.94, y0: 0.1, y1: 0.64, descente: 0, couvreVisage: true });

/** Retournement : 6 images à 25 i/s. */
const DUREE_BASCULE = 0.24;

/** Secousse d'entrée (px) : vibration amortie sur 0,3 s. */
function secousse(t: number, debut: number, ampl: number): { x: number; y: number; r: number } {
  const u = t - debut;
  if (u < 0 || u > 0.34) return { x: 0, y: 0, r: 0 };
  const k = Math.exp(-7 * u);
  return { x: ampl * k * Math.sin(u * 2 * Math.PI * 14), y: ampl * 0.5 * k * Math.cos(u * 2 * Math.PI * 11), r: 2.2 * k * Math.sin(u * 2 * Math.PI * 9) };
}

/** Fissure : un tracé principal en zigzag + branches, longueur normalisée (pathLength = 1). */
const FISSURE_PRINCIPALE = "M 0.02 0.55 L 0.14 0.42 L 0.22 0.6 L 0.33 0.38 L 0.41 0.58 L 0.52 0.33 L 0.6 0.62 L 0.71 0.4 L 0.8 0.57 L 0.9 0.36 L 0.99 0.5";
const BRANCHES = [
  "M 0.33 0.38 L 0.3 0.2 L 0.36 0.05 L 0.31 -0.25",
  "M 0.52 0.33 L 0.58 0.15 L 0.55 -0.1 L 0.63 -0.45",
  "M 0.6 0.62 L 0.56 0.85 L 0.63 1.1 L 0.58 1.5",
  "M 0.22 0.6 L 0.16 0.85 L 0.21 1.2",
  "M 0.8 0.57 L 0.86 0.82 L 0.82 1.15 L 0.9 1.45",
];

export function BasculeProblemeSolution(p: BasculeProblemeSolutionProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const C = CADRAGE_BASCULE;
  const x = C.x0 * W;
  const y = C.y0 * H;
  const l = (C.x1 - C.x0) * W;
  const h = (C.y1 - C.y0) * H;
  const { contour } = mesures(W);

  // N1 : entrée à 112 % qui s'écrase + secousse ; sortie : chute vers le bas en 3 images.
  const e = rebond(p.t, p.debut, 0.1, 1);
  const sec = secousse(p.t, p.debut, W * 0.03);
  const s = sortie(p.t, p.fin - 0.12, 0.12);
  const echelleEntree = 1.12 - 0.12 * e;

  // Retournement 3D : 0 → 180° ; la face solution s'affiche après 90°.
  const r = progression(p.t, p.basculeA, DUREE_BASCULE);
  const rotY = r * 180;
  const faceSolution = rotY >= 90;
  // Petit « saut » pendant le retournement (le panneau se soulève puis retombe).
  const saut = Math.sin(Math.PI * r) * 0.04;

  const pad = l * 0.06;
  const hEntete = h * 0.12;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, perspective: W * 2.2, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: l,
          height: h,
          transform: `translate(${sec.x}px, ${sec.y + s * H * 0.8}px) rotate(${sec.r + s * 8}deg) scale(${echelleEntree * (1 - saut)}) rotateY(${faceSolution ? rotY - 180 : rotY}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {faceSolution ? (
          <FaceSolution p={p} W={W} l={l} h={h} pad={pad} hEntete={hEntete} contour={contour} />
        ) : (
          <FaceProbleme p={p} W={W} l={l} h={h} pad={pad} hEntete={hEntete} />
        )}
      </div>
    </div>
  );
}

function FaceProbleme({ p, W, l, h, pad, hEntete }: { p: BasculeProblemeSolutionProps; W: number; l: number; h: number; pad: number; hEntete: number }) {
  const largeurUtile = l - 2 * pad;
  const fissure = progression(p.t, p.fissureA, 0.14);
  const extension = progression(p.t, p.fissureA + 0.2, 0.9);
  const lignes = p.lignesProbleme;
  // Taille de chaque ligne : le mot fort occupe toute la largeur, les autres ≈ 55 %.
  const tailleLigne = (ligne: MotProbleme[]) => {
    const texte = ligne.map((m) => m.texte).join(" ");
    const fort = ligne.some((m) => m.fort);
    const cible = fort ? h * 0.2 : h * 0.085;
    return Math.min(cible, (largeurUtile * (fort ? 0.98 : 0.9)) / Math.max(1e-6, largeurTexte(texte, 1)));
  };
  return (
    <div style={{ width: "100%", height: "100%", ...styleBoite(W, COULEURS.encre, W * 0.03), position: "relative", overflow: "hidden" }}>
      {/* En-tête : pastille « Le problème » + triangle d'alerte. */}
      <div style={{ position: "absolute", left: pad, top: pad * 0.8, display: "flex", alignItems: "center", gap: hEntete * 0.2, background: COULEURS.orange, border: `3px solid ${COULEURS.ivoire}`, borderRadius: hEntete, padding: `${hEntete * 0.08}px ${hEntete * 0.35}px` }}>
        <svg width={hEntete * 0.5} height={hEntete * 0.5} viewBox="0 0 24 24" fill="none" stroke={COULEURS.ivoire} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <span style={{ fontFamily: POLICES.titre, fontSize: hEntete * 0.38, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: 1.5 }}>{p.titreProbleme ?? "Le problème"}</span>
      </div>

      {/* Lignes de mots qui claquent. */}
      <div style={{ position: "absolute", left: pad, right: pad, top: hEntete + pad, bottom: pad, display: "flex", flexDirection: "column", justifyContent: "center", gap: h * 0.02 }}>
        {lignes.map((ligne, i) => {
          const taille = tailleLigne(ligne);
          const fort = ligne.some((m) => m.fort);
          return (
            <div key={i} style={{ position: "relative", display: "flex", justifyContent: fort ? "center" : "flex-start", gap: taille * 0.28, height: taille * 1.05, alignItems: "center" }}>
              {ligne.map((m) => {
                if (p.t < m.a) return <span key={m.texte} style={{ fontFamily: POLICES.titre, fontSize: taille, visibility: "hidden" }}>{m.texte}</span>;
                const c = progression(p.t, m.a, 0.12);
                return (
                  <span key={m.texte} style={{ position: "relative", fontFamily: POLICES.titre, fontSize: taille, lineHeight: 1, color: m.fort ? COULEURS.orange : COULEURS.ivoire, textTransform: "uppercase", whiteSpace: "nowrap", display: "inline-block", transform: `scale(${1.8 - 0.8 * c}) rotate(${(1 - c) * -6}deg)`, opacity: Math.min(1, c * 4) }}>
                    {m.texte}
                    {m.fort && fissure > 0 ? (
                      <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: "absolute", left: "-4%", top: 0, width: "108%", height: "100%", overflow: "visible" }}>
                        <path d={FISSURE_PRINCIPALE} stroke={COULEURS.encre} strokeWidth={W * 0.016} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fissure} strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
                        <path d={FISSURE_PRINCIPALE} stroke={COULEURS.ivoire} strokeWidth={W * 0.006} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fissure} vectorEffect="non-scaling-stroke" />
                        {BRANCHES.map((b, k) => {
                          const pr = Math.max(0, Math.min(1, extension * 1.6 - k * 0.15));
                          return pr > 0 ? <path key={k} d={b} stroke={COULEURS.ivoire} strokeWidth={W * 0.005} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pr} vectorEffect="non-scaling-stroke" /> : null;
                        })}
                      </svg>
                    ) : null}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FaceSolution({ p, W, l, h, pad, hEntete, contour }: { p: BasculeProblemeSolutionProps; W: number; l: number; h: number; pad: number; hEntete: number; contour: number }) {
  const largeurUtile = l - 2 * pad;
  const hLigne = (h - hEntete - 2 * pad) / Math.max(3, p.lignesSolution.length + 0.4);
  const surligne = p.surlignageA !== undefined ? progression(p.t, p.surlignageA, 0.16) : 0;
  return (
    <div style={{ width: "100%", height: "100%", ...styleBoite(W, COULEURS.ivoire, W * 0.03), overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: hEntete, flexShrink: 0, background: COULEURS.orange, borderBottom: `${contour}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", gap: hEntete * 0.22, padding: `0 ${pad}px` }}>
        <Icone nom="eclair" taille={hEntete * 0.55} couleur={COULEURS.ivoire} epaisseur={2.6} />
        <span style={{ fontFamily: POLICES.titre, fontSize: hEntete * 0.44, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: 1.5 }}>{p.titreSolution ?? "La solution"}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${pad}px`, gap: hLigne * 0.12 }}>
        {p.lignesSolution.map((ligne, i) => {
          if (p.t < ligne.a) return <div key={ligne.texte} style={{ height: hLigne }} />;
          // Chute depuis le haut avec rebond ; la 1ʳᵉ ligne (la réponse) est plus grosse que les suivantes.
          const e = rebond(p.t, ligne.a, 0.16, 2.2);
          const premiere = i === 0;
          const taille = Math.min(hLigne * (premiere ? 0.62 : 0.46), (largeurUtile - hLigne) / Math.max(1e-6, largeurTexte(ligne.texte, 1)));
          return (
            <div key={ligne.texte} style={{ position: "relative", height: hLigne, display: "flex", alignItems: "center", gap: hLigne * 0.22, transform: `translateY(${(1 - e) * -h * 0.5}px) rotate(${(1 - e) * (i % 2 ? 5 : -5)}deg)` }}>
              {premiere && surligne > 0 ? <div style={{ position: "absolute", left: -pad * 0.3, top: "14%", height: "72%", width: `calc(${surligne * 100}% + ${pad * 0.6 * surligne}px)`, background: COULEURS.orange, border: `${contour}px solid ${COULEURS.encre}`, borderRadius: hLigne * 0.16, boxSizing: "border-box", transform: "rotate(-1.2deg)" }} /> : null}
              <div style={{ position: "relative", width: hLigne * 0.72, height: hLigne * 0.72, flexShrink: 0, borderRadius: "50%", background: premiere ? COULEURS.encre : COULEURS.orange, border: `${contour}px solid ${COULEURS.encre}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={ligne.icone} taille={hLigne * 0.4} couleur={COULEURS.ivoire} epaisseur={2.8} />
              </div>
              <span style={{ position: "relative", fontFamily: POLICES.titre, fontSize: taille, color: premiere && surligne >= 1 ? COULEURS.ivoire : COULEURS.encre, textTransform: "uppercase", whiteSpace: "nowrap" }}>{ligne.texte}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PHRASE_BASCULE = "Le problème, ce n'est pas votre équipe, c'est la ressaisie. La solution : relier vos outils.";

export const EXEMPLE_BASCULE_PROBLEME_SOLUTION = {
  debut: 0,
  fin: 5.8,
  titreProbleme: "Le problème",
  lignesProbleme: [
    [{ texte: "Pas votre", a: 0.75 }, { texte: "équipe", a: 1.05 }],
    [{ texte: "C'est la", a: 1.5 }],
    [{ texte: "Ressaisie", a: 1.8, fort: true }],
  ],
  fissureA: 1.95,
  basculeA: 2.95,
  titreSolution: "La solution",
  lignesSolution: [
    { texte: "Relier vos outils", icone: "lien", a: 3.45 },
    { texte: "Saisir une fois", icone: "crayon", a: 3.95 },
    { texte: "Partager partout", icone: "partage", a: 4.35 },
  ],
  surlignageA: 4.75,
} satisfies Omit<BasculeProblemeSolutionProps, "t" | "largeurImage" | "hauteurImage">;

/** Instants représentatifs : face problème fissurée (2,6 s) et face solution surlignée (5,1 s, le plus parlant). */
export const INSTANT_FIXE_BASCULE = 5.1;
export const INSTANT_FIXE_BASCULE_PROBLEME = 2.6;
