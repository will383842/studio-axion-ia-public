import React from "react";
/**
 * CARTE « BADGE DE RÔLE » (designer n° 5, 15/10 — reprise du brouillon du designer n° 3, deux fois plus grand).
 * Un métier, un poste, une personne type (« votre assistante »).
 *
 * Composition (standard premium, CARTES-20-PREMIUM-2026-10-15.md) :
 *  - badge d'accès de 0,8 L × 0,24 H suspendu AU-DESSUS de la tête (la prise descend de 0,17 H : visage entier) ;
 *  - cordon orange tissé (rayures orange / orange-profond), attache métallique sable-profond avec reflet ;
 *  - bandeau encre (« Équipe », fente du cordon, code-barres), photo-silhouette dans un cadre ivoire-creux,
 *    sur-titre « Votre » en corps, rôle en HÉROS, service en corps ;
 *  - les tâches sont des lignes TAMPONNÉES en encre orange irrégulière, en bas du badge.
 * Mouvement :
 *  - N1 : le badge tombe au bout de son cordon (dépassement ≈ 8 %, étirement de vitesse), sortie anticipée vers le haut ;
 *  - N2 : chaque tâche est tamponnée sur son mot (140 % → écrasement, plaque d'encre pleine 0,16 s, secousse de 1 % du
 *         badge, relance du balancier) ;
 *  - N3 : oscillation amortie (3 allers-retours) puis balancement léger continu.
 * Le seul élément en relief à l'intérieur est la photo (contour 0,003 L + ombre dure 0,005 L).
 */
import { POLICES, largeurTexte } from "../charte";
import { claque, DEGRADE, ecrasement, encreA, fonduEntree, ivoireA, masqueEncre, microOmbre, N, ombreInterieure, pose, Reflet, reliefs, ScenePremium, secousse, sortieAnticipee, STYLE_CORPS, STYLE_HEROS, styleHeros, typo } from "./premium-5";

export type TacheBadge = { texte: string; /** Instant du mot (s). */ a: number };

export type BadgeRoleProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Petit mot au-dessus du rôle (« Votre »). */
  surRole?: string;
  role: string;
  /** Ligne sous le rôle (service, pôle), en corps. */
  service?: string;
  /** 3 tâches au plus (3 mots au plus chacune). */
  taches: TacheBadge[];
  /** Image fixe de la prise : présente, la scène (prise qui descend + bande) est dessinée autour du badge. */
  prise?: string;
  yeux?: number;
};

/** Mise en page (fractions de L et de H) : la prise descend de `descente`, le visage reste entier sous le badge. */
export const CADRAGE_BADGE_ROLE = Object.freeze({ x: 0.1, l: 0.8, y: 0.06, h: 0.24, descente: 0.19, couvreVisage: false });

/** Bas « équivalent carte » pour la descente de la prise : yeux = bas + 0,17 H → descente ≈ 0,17 H (balancier compris). */
const BAS_SCENE_BADGE = CADRAGE_BADGE_ROLE.y + CADRAGE_BADGE_ROLE.h + 0.025;
const DUREE_TAMPON = 0.08;
const DUREE_ENCRE = 0.16;

/** Angle du balancier (degrés) : 3 allers-retours amortis après la chute, relancés par chaque coup de tampon, puis un balancement léger continu (N3). */
export function angleBadge(t: number, debut: number, coups: number[]): number {
  const u = t - debut - 0.2;
  if (u < 0) return 0;
  let a = 3.4 * Math.exp(-0.9 * u) * Math.sin(2 * Math.PI * 0.95 * u) + 0.55 * Math.sin(2 * Math.PI * 0.38 * u);
  for (const c of coups) {
    const v = t - c - DUREE_TAMPON;
    if (v >= 0) a += 2.2 * Math.exp(-2.4 * v) * Math.sin(2 * Math.PI * 1.1 * v);
  }
  return a;
}

/** Silhouette de personne (grille 100 × 100), dégradé sable → sable-profond, liseré ivoire. */
function Silhouette({ cote, id }: { cote: number; id: string }) {
  return (
    <svg width={cote} height={cote} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`${id}-fond`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.ivoireCreux} />
          <stop offset="1" stopColor={N.sableClair} />
        </linearGradient>
        <linearGradient id={`${id}-corps`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.sable} />
          <stop offset="1" stopColor={N.sableProfond} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-fond)`} />
      <path d="M14 104 C14 78 30 66 50 66 C70 66 86 78 86 104 Z" fill={`url(#${id}-corps)`} />
      <circle cx="50" cy="40" r="19" fill={`url(#${id}-corps)`} />
      <path d="M36 30 C40 22 58 20 64 30" fill="none" stroke={ivoireA(0.45)} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 82 C30 74 38 71 46 70" fill="none" stroke={ivoireA(0.35)} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Code-barres (fins traits ivoire), motif fixe. */
function CodeBarres({ l, h }: { l: number; h: number }) {
  const traits = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2];
  const total = traits.reduce((s, x) => s + x + 1.4, 0);
  let x = 0;
  return (
    <svg width={l} height={h} viewBox={`0 0 ${total} 10`} preserveAspectRatio="none" style={{ display: "block" }}>
      {traits.map((w, i) => {
        const r = <rect key={i} x={x} y="0" width={w} height="10" fill={ivoireA(0.75)} />;
        x += w + 1.4;
        return r;
      })}
    </svg>
  );
}

export function BadgeRole(p: BadgeRoleProps) {
  if (p.t < p.debut || p.t >= p.fin) {
    return p.prise ? <ScenePremium t={p.t} debut={p.debut} fin={p.fin} W={p.largeurImage} H={p.hauteurImage} bas={BAS_SCENE_BADGE} prise={p.prise} yeux={p.yeux}>{null}</ScenePremium> : null;
  }
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const C = CADRAGE_BADGE_ROLE;
  const ty = typo(W);
  const rl = reliefs(W);
  const bx = C.x * W;
  const bw = C.l * W;
  const by = C.y * H;
  const bh = C.h * H;
  const pivotY = -0.06 * H;
  const cx = W / 2;

  // N1 : chute au bout du cordon (« pose » forte : le cordon tire), étirement de vitesse pendant la chute ; sortie anticipée.
  const chute = pose(p.t, p.debut, 0.24);
  const enChute = p.t < p.debut + 0.16;
  const s = sortieAnticipee(p.t, p.fin - 0.16, 0.12);
  const dy = -(by + bh + 0.05 * H) * (1 - Math.min(1.08, chute * 1.0)) - (by + bh + 0.08 * H) * s;
  const etire = enChute ? 1.05 : 1;

  // N2 : coups de tampon (secousse de 1 % du badge à l'impact).
  const taches = p.taches.slice(0, 3);
  const impacts = taches.map((x) => x.a + DUREE_TAMPON);
  const sx = impacts.reduce((v, a) => v + secousse(p.t, a, 0.2, 0.01 * W, 18), 0);
  const angle = angleBadge(p.t, p.debut, taches.map((x) => x.a));

  // Proportions internes (px).
  const pad = Math.round(0.04 * W);
  const hBandeau = Math.round(0.056 * W);
  const cote = Math.round(0.15 * W);
  const yIdentite = hBandeau + Math.round(0.026 * W);
  const xTexte = pad + cote + Math.round(0.035 * W);
  const lTexte = bw - xTexte - pad;
  const tailleRole = Math.min(Math.round(0.078 * W), lTexte / Math.max(1e-6, largeurTexte(p.role, 1) * 0.94));
  const yTaches = yIdentite + cote + Math.round(0.036 * W);
  const hTaches = bh - yTaches - Math.round(0.022 * W);
  // Tampons : titre 0,035 L (jamais moins de 0,034 L), au plus 2 rangées.
  const tailleTache = (texte: string) => Math.max(Math.round(0.034 * W), Math.min(Math.round(0.035 * W), (bw - 2 * pad - 0.09 * W) / Math.max(1e-6, largeurTexte(texte, 1) + 0.06 * texte.length)));

  // Cordon : deux sangles qui convergent vers l'attache.
  const attache = { x: cx, y: by - 0.012 * H };
  const sangles = [cx - 0.16 * W, cx + 0.16 * W].map((x0) => ({ x0, d: `M ${x0} ${pivotY} L ${attache.x + (x0 < cx ? -0.022 * W : 0.022 * W)} ${attache.y - 0.004 * H}` }));

  const badge = (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translate(${sx}px, ${dy}px) rotate(${angle}deg)`, transformOrigin: `${cx}px ${pivotY}px`, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scaleY(${etire * (1 - ecrasement(p.t, impacts, 0.02, 0.1))})`, transformOrigin: `${cx}px ${pivotY}px` }}>
        {/* Cordon tissé. */}
        <svg width={W} height={by + 0.02 * H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <pattern id="badge-tissu" width={0.016 * W} height={0.016 * W} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width={0.016 * W} height={0.016 * W} fill={N.orange} />
              <rect width={0.006 * W} height={0.016 * W} fill={N.orangeProfond} />
            </pattern>
          </defs>
          {sangles.map((sg) => (
            <g key={sg.x0}>
              <path d={sg.d} stroke={encreA(0.14)} strokeWidth={0.036 * W} strokeLinecap="butt" transform={`translate(${0.004 * W}, ${0.005 * W})`} />
              <path d={sg.d} stroke={N.encre} strokeWidth={0.034 * W} strokeLinecap="butt" />
              <path d={sg.d} stroke="url(#badge-tissu)" strokeWidth={0.028 * W} strokeLinecap="butt" />
              <path d={sg.d} stroke={ivoireA(0.22)} strokeWidth={0.003 * W} strokeLinecap="butt" transform={`translate(${(sg.x0 < cx ? -1 : 1) * -0.006 * W}, 0)`} />
            </g>
          ))}
        </svg>

        {/* Corps du badge (coque). */}
        <div style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, background: DEGRADE.ivoire, border: `${rl.contourCoque}px solid ${N.encre}`, borderRadius: 0.03 * W, boxShadow: `${rl.ombreCoque}px ${rl.ombreCoque}px 0 ${N.encre}`, boxSizing: "border-box", overflow: "hidden" }}>
          {/* Bandeau encre : « Équipe », fente du cordon, code-barres. */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: hBandeau, background: DEGRADE.encre, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px`, boxSizing: "border-box" }}>
            <Reflet opacite={0.2} />
            <span style={{ fontFamily: POLICES.titre, fontSize: ty.entete, letterSpacing: "0.14em", color: N.sableClair, textTransform: "uppercase" }}>Équipe</span>
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 0.15 * W, height: 0.022 * W, transform: "translate(-50%, -50%)", borderRadius: 999, background: N.encre, boxShadow: `inset 0 ${0.003 * W}px ${0.004 * W}px ${encreA(0.9)}, 0 1px 0 ${ivoireA(0.18)}` }} />
            <CodeBarres l={0.13 * W} h={0.03 * W} />
          </div>

          {/* Photo-silhouette (SEUL élément intérieur en relief). */}
          <div style={{ position: "absolute", left: pad, top: yIdentite, width: cote, height: cote, ...styleHeros(W, N.ivoireCreux, rl.rayon), overflow: "hidden" }}>
            <Silhouette cote={cote - 2 * rl.contourHeros} id="badge-photo" />
          </div>

          {/* Identité : sur-titre (corps), rôle (héros), service (corps). */}
          <div style={{ position: "absolute", left: xTexte, top: yIdentite, width: lTexte, height: cote, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {p.surRole ? <span style={{ ...STYLE_CORPS, fontSize: ty.corps * 1.1, color: N.orange }}>{p.surRole}</span> : null}
            <span style={{ ...STYLE_HEROS, fontSize: tailleRole, textTransform: "uppercase", color: N.encre, lineHeight: 1.0, margin: `${tailleRole * 0.04}px 0 ${tailleRole * 0.12}px` }}>{p.role}</span>
            {p.service ? (
              <span style={{ ...STYLE_CORPS, fontSize: ty.corps, color: N.sableProfond, display: "flex", alignItems: "center", gap: ty.corps * 0.4 }}>
                <span style={{ width: ty.corps * 0.36, height: ty.corps * 0.36, borderRadius: "50%", background: N.orange, boxShadow: `0 0 0 ${ty.corps * 0.16}px ${N.orangeVoile}` }} />
                {p.service}
              </span>
            ) : null}
          </div>

          {/* Zone des tâches : filet pointillé (perforation), lignes réservées en creux. */}
          <div style={{ position: "absolute", left: pad, right: pad, top: yTaches - Math.round(0.016 * W), height: 0, borderTop: `${rl.filet}px dashed ${N.filet}` }} />
          <div style={{ position: "absolute", left: pad, right: pad, top: yTaches, height: hTaches, display: "flex", flexWrap: "wrap", alignContent: "center", alignItems: "center", columnGap: Math.round(0.03 * W), rowGap: Math.round(0.016 * W) }}>
          {taches.map((tache, i) => {
            const posee = p.t >= tache.a + DUREE_TAMPON;
            const encrePleine = p.t >= tache.a + DUREE_TAMPON && p.t < tache.a + DUREE_TAMPON + DUREE_ENCRE;
            const e = p.t < tache.a ? 0 : Math.min(1, (p.t - tache.a) / DUREE_TAMPON);
            const echelle = p.t < tache.a ? 1 : posee ? 1 - 0.03 * claque(p.t, tache.a + DUREE_TAMPON, 0.06) * (1 - claque(p.t, tache.a + DUREE_TAMPON + 0.06, 0.06)) : 1.4 - 0.4 * e * e;
            const rot = [-2.2, 1.4, -1.1][i % 3];
            const dy = [0, 0.004, -0.003][i % 3] * W;
            const taille = tailleTache(tache.texte);
            const attente = p.t < tache.a;
            return (
              <div key={tache.texte} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                {/* Emplacement en attente : trait en creux (le tampon garde sa place, invisible : aucun saut de mise en page). */}
                {attente ? <div style={{ position: "absolute", left: 0, right: "8%", top: "50%", height: 0.012 * W, transform: "translateY(-50%)", borderRadius: 999, background: N.ivoireCreux, boxShadow: ombreInterieure(W) }} /> : null}
                {(
                  <div
                    style={{
                      visibility: attente ? "hidden" : "visible",
                      marginTop: dy,
                      position: "relative",
                      transform: `rotate(${rot}deg) scale(${echelle})`,
                      transformOrigin: "30% 50%",
                      opacity: Math.min(1, fonduEntree(p.t, tache.a) * 1.6),
                      border: `${0.004 * W}px solid ${N.orange}`,
                      borderRadius: 0.01 * W,
                      background: encrePleine || !posee ? N.orange : "transparent",
                      padding: `${taille * 0.14}px ${taille * 0.42}px ${taille * 0.1}px`,
                      display: "flex",
                      alignItems: "center",
                      gap: taille * 0.35,
                      WebkitMaskImage: posee && !encrePleine ? masqueEncre(11 + i * 7) : undefined,
                      WebkitMaskSize: "100% 100%",
                      boxShadow: !posee ? microOmbre(W, 0.18) : undefined,
                    }}
                  >
                    <svg width={taille * 0.78} height={taille * 0.78} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path d="M20 6 9 17l-5-5" fill="none" stroke={encrePleine || !posee ? N.ivoire : N.orange} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: POLICES.titre, fontSize: taille, lineHeight: 1.1, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", color: encrePleine || !posee ? N.ivoire : N.orange }}>{tache.texte}</span>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>

        {/* Attache métallique (sable-profond, reflet) et anneau. */}
        <svg width={0.12 * W} height={0.07 * W} viewBox="0 0 120 70" style={{ position: "absolute", left: attache.x - 0.06 * W, top: attache.y - 0.032 * W, overflow: "visible" }}>
          <defs>
            <linearGradient id="badge-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={N.sable} />
              <stop offset="1" stopColor={N.sableProfond} />
            </linearGradient>
          </defs>
          <rect x="22" y="4" width="76" height="30" rx="9" fill="url(#badge-metal)" stroke={N.encre} strokeWidth="3" />
          <rect x="30" y="8" width="60" height="3" rx="1.5" fill={ivoireA(0.55)} />
          <rect x="44" y="16" width="32" height="9" rx="4.5" fill={N.encreDouce} />
          <path d="M60 34 L60 46" stroke={N.encre} strokeWidth="5" />
          <rect x="40" y="44" width="40" height="22" rx="6" fill="url(#badge-metal)" stroke={N.encre} strokeWidth="3" />
          <rect x="46" y="47" width="28" height="2.4" rx="1.2" fill={ivoireA(0.5)} />
        </svg>
      </div>
    </div>
  );

  if (!p.prise) return badge;
  return (
    <ScenePremium t={p.t} debut={p.debut} fin={p.fin} W={W} H={H} bas={BAS_SCENE_BADGE} prise={p.prise} yeux={p.yeux}>
      {badge}
    </ScenePremium>
  );
}

/** Phrase d'exemple et instants (relatifs à `debut` = 0), calés sur un débit naturel. */
export const PHRASE_BADGE_ROLE = "Votre assistante passe ses matinées à classer des factures, à relancer et à saisir.";

export const EXEMPLE_BADGE_ROLE = {
  debut: 0,
  fin: 5.2,
  surRole: "Votre",
  role: "Assistante",
  service: "Pôle administratif",
  taches: [
    { texte: "Classer les factures", a: 1.75 },
    { texte: "Relancer", a: 2.55 },
    { texte: "Saisir", a: 3.1 },
  ],
} satisfies Omit<BadgeRoleProps, "t" | "largeurImage" | "hauteurImage">;

/** Instant le plus représentatif pour une image fixe (3 tampons posés, balancier en cours). */
export const INSTANT_FIXE_BADGE_ROLE = 4.15;
/** Instant « en construction » (1 tampon posé, le 2ᵉ en vol). */
export const INSTANT_CONSTRUCTION_BADGE_ROLE = 2.59;
