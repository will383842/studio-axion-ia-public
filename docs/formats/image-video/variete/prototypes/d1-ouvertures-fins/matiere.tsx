import React from "react";
/**
 * Axe 9 · Matière (MAT-A à MAT-D) sur le MÊME écran : « Deux chemins » de l'image C (vraie Entete, vrai témoin des
 * sous-titres, carte « Chatbot IA » au style du vrai `Noeud`, deux pastilles 80 % / 20 %). Seule la matière change.
 * Différence avec la galerie : les pastilles sont rentrées dans le cadre (x ≤ 886) et le texte de la pastille 80 %
 * passe en encre (contraste 6,4 au lieu de 3,0).
 */
import { a, ANTON, C, CarteIcone, Ecran, Icone, INTER, SousTitre } from "./objets";

export type Matiere = "A" | "B" | "C" | "D";

/* Géométrie commune (pixels 1080 × 1920). */
const CARTE = { x: 300, y: 630, l: 480, h: 340 };
const P80 = { x: 270, y: 1022, l: 290, h: 118 };
const P20 = { x: 596, y: 1022, l: 290, h: 118 };
const POINT = { x: 540, y: 970 };

/** Petit aléa déterministe (même tremblé à chaque rendu). */
function alea(graine: number) {
  let s = graine;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

/** Contour « au feutre » d'un rectangle : chaque côté dépasse un peu aux coins, léger tremblé. */
function rectMain(x: number, y: number, l: number, h: number, graine: number, amp = 3, depasse = 14) {
  const r = alea(graine);
  const cote = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 70));
    const dx = (x1 - x0) / Math.hypot(x1 - x0, y1 - y0);
    const dy = (y1 - y0) / Math.hypot(x1 - x0, y1 - y0);
    const ax = x0 - dx * depasse * Math.abs(r());
    const ay = y0 - dy * depasse * Math.abs(r());
    const bx = x1 + dx * depasse * Math.abs(r());
    const by = y1 + dy * depasse * Math.abs(r());
    let d = `M${ax + r() * amp} ${ay + r() * amp}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const px = ax + (bx - ax) * t + -dy * r() * amp;
      const py = ay + (by - ay) * t + dx * r() * amp;
      d += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    return d;
  };
  return [cote(x, y, x + l, y), cote(x + l, y, x + l, y + h), cote(x + l, y + h, x, y + h), cote(x, y + h, x, y)].join(" ");
}

/** Courbe tremblée entre deux points (fil au feutre). */
function filMain(pts: [number, number][], graine: number, amp = 3) {
  const r = alea(graine);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L${(pts[i][0] + r() * amp).toFixed(1)} ${(pts[i][1] + r() * amp).toFixed(1)}`;
  return d;
}

function bezier(p0: number[], p1: number[], p2: number[], p3: number[], n = 14): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  });
}

/** Grain de papier : grain fin + nuages très larges (visibles en vignette) + bord assombri, en encre transparente. */
function Papier() {
  // alpha = k × bruit + b : un voile d'encre de 0 à ~10 % (jamais une teinte hors charte).
  const voile = (k: number, b: number) => `0 0 0 0 0.082  0 0 0 0 0.063  0 0 0 0 0.047  ${k} 0 0 0 ${b}`;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={1080} height={1920}>
      <defs>
        <filter id="grainFin" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} />
          <feColorMatrix values={voile(0.3, -0.1)} />
        </filter>
        <filter id="nuages" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={4} seed={11} />
          <feColorMatrix values={`0 0 0 0 0.478  0 0 0 0 0.204  0 0 0 0 0.094  0.09 0 0 0 -0.03`} />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="40%" r="80%">
          <stop offset="50%" stopColor={C.encre} stopOpacity={0} />
          <stop offset="100%" stopColor={C.encre} stopOpacity={0.07} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} filter="url(#nuages)" />
      <rect width={1080} height={1920} filter="url(#grainFin)" />
      <rect width={1080} height={1920} fill="url(#vignette)" />
    </svg>
  );
}

function Pastille({ p, texte, fond, couleur, mat, taille = 96 }: { p: typeof P80; texte: string; fond: string; couleur: string; mat: Matiere; taille?: number }) {
  const tranche = fond === C.orangeVif ? C.orange : C.nuitHaut;
  return (
    <>
      {mat === "D" ? <div style={{ position: "absolute", left: p.x, top: p.y + 16, width: p.l, height: p.h, borderRadius: 999, background: tranche }} /> : null}
      <div
        style={{
          position: "absolute", left: p.x, top: p.y, width: p.l, height: p.h, borderRadius: mat === "C" ? 18 : 999, background: fond,
          display: "flex", alignItems: "center", justifyContent: "center", ...ANTON, fontSize: taille, color: couleur,
          boxShadow: mat === "B" ? `0 26px 50px ${a(C.encre, 0.12)}` : mat === "D" ? `0 40px 60px ${a(C.encre, 0.1)}` : `0 14px 36px ${a(C.encre, 0.08)}`,
        }}
      >
        <span style={{ marginTop: 4 }}>{texte}</span>
      </div>
    </>
  );
}

export function DeuxChemins({ mat, temoin = true }: { mat: Matiere; temoin?: boolean }) {
  const main = mat === "C";
  const profond = mat === "D";
  const papier = mat === "B";
  const fil80 = bezier([POINT.x, POINT.y], [POINT.x, POINT.y + 30], [P80.x + P80.l / 2, P80.y - 34], [P80.x + P80.l / 2, P80.y]);
  const fil20 = bezier([POINT.x, POINT.y], [POINT.x + 20, POINT.y + 40], [P20.x + P20.l / 2, P20.y - 40], [P20.x + P20.l / 2, P20.y]);
  const chemin = (pts: [number, number][]) => pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  return (
    <Ecran fond="ivoire" titre={{ etiquette: "Le chatbot décide", titre: "*Deux* chemins." }}>
      {/* MAT-B : le grain est dans le papier du fond (les cartes restent nettes, posées dessus) */}
      {papier ? <Papier /> : null}
      {/* MAT-D : un plan de fond, plus lointain, décalé (il glisse moins vite que les cartes) */}
      {profond ? (
        <>
          <div style={{ position: "absolute", left: 150, top: 520, width: 820, height: 600, borderRadius: 60, background: C.ivoireHaut, boxShadow: `0 40px 120px ${a(C.encre, 0.1)}`, transform: "translate(-40px, -24px)" }} />
        </>
      ) : null}
      {/* flèche d'arrivée et fils */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        {main ? (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={filMain(bezier([540, 488], [540, 530], [540, 570], [540, 612], 6), 3, 2.5)} stroke={C.orangeVif} strokeWidth={8} />
            <path d="M518 588 L540 618 L563 586" stroke={C.orangeVif} strokeWidth={8} />
            <path d={filMain(fil80, 5, 2.5)} stroke={C.orangeVif} strokeWidth={8} />
            <path d={filMain(fil20, 9, 2.5)} stroke={C.encre} strokeWidth={7} />
          </g>
        ) : (
          <g fill="none">
            <line x1={540} y1={488} x2={540} y2={604} stroke={C.orangeVif} strokeWidth={7} />
            <path d="M520 600 L540 628 L560 600 Z" fill={C.orangeVif} stroke="none" />
            <path d={chemin(fil80)} stroke={C.orangeVif} strokeWidth={7} />
            <path d={chemin(fil20)} stroke={C.encre} strokeWidth={6} />
          </g>
        )}
      </svg>
      {/* hachures « au feutre » en guise d'ombre (MAT-C) */}
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <defs>
            <clipPath id="ombreCarte">
              <path d={`M${CARTE.x + 30} ${CARTE.y + CARTE.h} L${CARTE.x + CARTE.l} ${CARTE.y + CARTE.h} L${CARTE.x + CARTE.l} ${CARTE.y + 34} L${CARTE.x + CARTE.l + 30} ${CARTE.y + 34} L${CARTE.x + CARTE.l + 30} ${CARTE.y + CARTE.h + 30} L${CARTE.x + 30} ${CARTE.y + CARTE.h + 30} Z`} />
            </clipPath>
          </defs>
          <g clipPath="url(#ombreCarte)" stroke={C.encre} strokeWidth={4} opacity={0.5} strokeLinecap="round">
            {Array.from({ length: 60 }, (_, i) => (
              <line key={i} x1={CARTE.x - 300 + i * 18} y1={CARTE.y + CARTE.h + 40} x2={CARTE.x - 300 + i * 18 + 420} y2={CARTE.y + CARTE.h - 380} />
            ))}
          </g>
        </svg>
      ) : null}
      {/* tranche de la carte (MAT-D) */}
      {profond ? <div style={{ position: "absolute", left: CARTE.x, top: CARTE.y + 22, width: CARTE.l, height: CARTE.h, borderRadius: 34, background: C.orange }} /> : null}
      {/* la carte « Chatbot IA » */}
      <div
        style={{
          position: "absolute", left: CARTE.x, top: CARTE.y, width: CARTE.l, height: CARTE.h, boxSizing: "border-box", borderRadius: main ? 10 : 34,
          background: papier ? C.ivoireHaut : C.blanc,
          border: main ? "none" : `6px solid ${C.orangeVif}`,
          boxShadow: papier ? `0 34px 90px ${a(C.encre, 0.12)}, 0 6px 14px ${a(C.encre, 0.06)}` : profond ? `0 60px 80px ${a(C.encre, 0.1)}` : main ? "none" : `0 26px 60px ${a(C.encre, 0.12)}, 0 0 70px ${a(C.orangeVif, 0.3)}`,
        }}
      />
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={rectMain(CARTE.x, CARTE.y, CARTE.l, CARTE.h, 17, 3, 16)} stroke={C.orangeVif} strokeWidth={7} />
          <path d={rectMain(CARTE.x + 5, CARTE.y + 4, CARTE.l - 8, CARTE.h - 6, 29, 2.5, 10)} stroke={C.encre} strokeWidth={3} opacity={0.8} />
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: CARTE.x, top: CARTE.y, width: CARTE.l, height: CARTE.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{ ...ANTON, textTransform: "none", fontSize: 86, color: C.encre }}>Chatbot IA</div>
        <div style={{ ...INTER, fontSize: 64, color: C.encre, lineHeight: 1.1 }}>
          analyse la
          <br />
          demande
        </div>
      </div>
      {/* pastille du robot, à cheval sur le bord gauche */}
      <div style={{ position: "absolute", left: CARTE.x - 62, top: CARTE.y + CARTE.h / 2 - 46, width: 92, height: 92, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: profond ? `0 10px 0 ${C.nuitHaut}` : `0 10px 24px ${a(C.encre, 0.12)}` }}>
        <Icone nom="robot" taille={54} couleur={C.orangeVif} epaisseur={2.6} />
      </div>
      <div style={{ position: "absolute", left: POINT.x - 15, top: POINT.y - 15, width: 30, height: 30, borderRadius: "50%", background: C.orangeVif }} />
      <Pastille p={P80} texte="80 %" fond={C.orangeVif} couleur={C.encre} mat={mat} />
      <Pastille p={P20} texte="20 %" fond={C.encre} couleur={C.blanc} mat={mat} />
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={rectMain(P80.x, P80.y, P80.l, P80.h, 41, 2.5, 12)} stroke={C.encre} strokeWidth={5} />
          <path d={rectMain(P20.x, P20.y, P20.l, P20.h, 53, 2.5, 12)} stroke={C.encre} strokeWidth={5} />
        </svg>
      ) : null}
      {temoin ? <SousTitre texte="Et là, *deux* chemins." fond="ivoire" /> : null}
    </Ecran>
  );
}

/* ───────── v2 (MAT-B, MAT-C, MAT-D, SOU-C) : écran recomposé sur toute la hauteur utile ─────────
 * Carte « Chatbot IA » plus grande, pastilles 80 % / 20 % plus hautes, et la suite des deux branches (vraies icônes du
 * schéma de l'image C : réponse générée → ticket clôturé ; alerte Telegram → humain) dans la zone d'appoint, sous la
 * bande des sous-titres. Titre sans mot orange ; le seul « mot » orange est la pastille 80 %, donc le sous-titre n'a
 * pas de mot orange (la voix ne répète pas le titre : « Il trie chaque demande. »). La matière reste le seul axe qui
 * change entre MAT-B, MAT-C et MAT-D. */
const CARTE2 = { x: 200, y: 540, l: 680, h: 360 };
const P80B = { x: 190, y: 978, l: 320, h: 140 };
const P20B = { x: 566, y: 978, l: 320, h: 140 };
const POINT2 = { x: 540, y: 900 };
const BR = { gauche: P80B.x + P80B.l / 2, droite: P20B.x + P20B.l / 2, y1: 1356, y2: 1480, l: 340, h: 96 }; // v3 : cartes d'appoint agrandies (2 × 340 px)

function CarteBranche({ cx, cy, icone, orange, mat, graine }: { cx: number; cy: number; icone: string; orange: boolean; mat: Matiere; graine: number }) {
  const contour = orange ? C.orangeVif : C.encre;
  const pastille = icone === "coche" ? C.vert : C.encre;
  const couleurIcone = orange ? C.orangeVif : C.blanc;
  const { l, h } = BR;
  if (mat === "C") {
    return (
      <>
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <defs>
            <clipPath id={`hach${graine}`}><rect x={cx - l / 2 + 22} y={cy + h / 2} width={l} height={18} /><rect x={cx + l / 2} y={cy - h / 2 + 18} width={18} height={h} /></clipPath>
          </defs>
          <g clipPath={`url(#hach${graine})`} stroke={C.encre} strokeWidth={3.5} opacity={0.5} strokeLinecap="round">
            {Array.from({ length: 24 }, (_, k) => <line key={k} x1={cx - l / 2 + k * 14} y1={cy + h / 2 + 30} x2={cx - l / 2 + k * 14 + 160} y2={cy - h / 2 - 60} />)}
          </g>
        </svg>
        <CarteIcone cx={cx} cy={cy} l={l} h={h} icone={icone} contour={contour} pastille={pastille} couleurIcone={couleurIcone} epaisseur={0} rayon={8} ombre={0} />
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={rectMain(cx - l / 2, cy - h / 2, l, h, graine, 2.5, 12)} stroke={contour} strokeWidth={6} />
        </svg>
      </>
    );
  }
  return (
    <>
      {mat === "D" ? <div style={{ position: "absolute", left: cx - l / 2, top: cy - h / 2 + 14, width: l, height: h, borderRadius: 28, background: orange ? C.orange : C.nuitHaut }} /> : null}
      <CarteIcone cx={cx} cy={cy} l={l} h={h} icone={icone} contour={contour} pastille={pastille} couleurIcone={couleurIcone} fond={mat === "B" ? C.ivoireHaut : C.blanc} ombre={mat === "B" ? 0.12 : mat === "D" ? 0 : 0.08} />
    </>
  );
}

/** En-tête dessiné localement au style du vrai `Entete` (Anton, centré), sans étiquette : le titre finit à x ≤ 880
 * (l'en-tête réel, à 131 px avec la marge du dernier mot, finissait à 888) et l'écran tient en 6 mots
 * (« Deux chemins. », « Chatbot IA », « 80 % », « 20 % »). Aucun mot orange dans le titre. */
function TitreLocal() {
  return (
    <div style={{ position: "absolute", left: 0, top: TITRE_HAUT, width: 1080, textAlign: "center", ...ANTON, fontSize: 120, color: C.encre, whiteSpace: "nowrap" }}>
      Deux chemins.
    </div>
  );
}
const TITRE_HAUT = 300;

export function DeuxCheminsV2({ mat, temoin = "Il trie chaque demande." }: { mat: Matiere; temoin?: string | null }) {
  const main = mat === "C";
  const profond = mat === "D";
  const papier = mat === "B";
  const fil80 = bezier([POINT2.x, POINT2.y], [POINT2.x, POINT2.y + 34], [BR.gauche, P80B.y - 40], [BR.gauche, P80B.y]);
  const fil20 = bezier([POINT2.x, POINT2.y], [POINT2.x + 20, POINT2.y + 44], [BR.droite, P20B.y - 44], [BR.droite, P20B.y]);
  const chemin = (pts: [number, number][]) => pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  // fils de la zone d'appoint : amorce sous la bande (la branche continue), puis entre les deux cartes
  const filsBas: [number, number, number, string][] = [
    [BR.gauche, 1298, BR.y1 - BR.h / 2, C.orangeVif], [BR.gauche, BR.y1 + BR.h / 2, BR.y2 - BR.h / 2, C.orangeVif],
    [BR.droite, 1298, BR.y1 - BR.h / 2, C.encre], [BR.droite, BR.y1 + BR.h / 2, BR.y2 - BR.h / 2, C.encre],
  ];
  return (
    <Ecran fond="ivoire">
      {papier ? <Papier /> : null}
      <TitreLocal />
      {/* MAT-D : deux plateaux lointains, décalés (ils glissent moins vite que les cartes) */}
      {profond ? (
        <>
          <div style={{ position: "absolute", left: 120, top: 476, width: 840, height: 664, borderRadius: 60, background: C.ivoireHaut, boxShadow: `0 40px 120px ${a(C.encre, 0.1)}`, transform: "translate(-30px, -18px)" }} />
          <div style={{ position: "absolute", left: 100, top: 1290, width: 880, height: 246, borderRadius: 60, background: C.ivoireHaut, boxShadow: `0 30px 90px ${a(C.encre, 0.1)}`, transform: "translate(-30px, 0)" }} />
        </>
      ) : null}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        {main ? (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={filMain(bezier([540, 452], [540, 480], [540, 500], [540, 526], 5), 3, 2.5)} stroke={C.orangeVif} strokeWidth={8} />
            <path d="M518 502 L540 532 L563 500" stroke={C.orangeVif} strokeWidth={8} />
            <path d={filMain(fil80, 5, 2.5)} stroke={C.orangeVif} strokeWidth={8} />
            <path d={filMain(fil20, 9, 2.5)} stroke={C.encre} strokeWidth={7} />
            {filsBas.map(([x, y0, y1, c], k) => <path key={k} d={filMain([[x, y0], [x, (y0 + y1) / 2], [x, y1]], 60 + k, 2.5)} stroke={c} strokeWidth={6} strokeDasharray={k % 2 ? undefined : "3 14"} />)}
          </g>
        ) : (
          <g fill="none">
            <line x1={540} y1={452} x2={540} y2={514} stroke={C.orangeVif} strokeWidth={7} />
            <path d="M520 510 L540 538 L560 510 Z" fill={C.orangeVif} stroke="none" />
            <path d={chemin(fil80)} stroke={C.orangeVif} strokeWidth={7} />
            <path d={chemin(fil20)} stroke={C.encre} strokeWidth={6} />
            {filsBas.map(([x, y0, y1, c], k) => <line key={k} x1={x} y1={y0} x2={x} y2={y1} stroke={c} strokeWidth={6} strokeDasharray={k % 2 ? undefined : "3 14"} strokeLinecap="round" />)}
          </g>
        )}
      </svg>
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <defs>
            <clipPath id="ombreCarte2">
              <path d={`M${CARTE2.x + 30} ${CARTE2.y + CARTE2.h} L${CARTE2.x + CARTE2.l} ${CARTE2.y + CARTE2.h} L${CARTE2.x + CARTE2.l} ${CARTE2.y + 34} L${CARTE2.x + CARTE2.l + 30} ${CARTE2.y + 34} L${CARTE2.x + CARTE2.l + 30} ${CARTE2.y + CARTE2.h + 30} L${CARTE2.x + 30} ${CARTE2.y + CARTE2.h + 30} Z`} />
            </clipPath>
          </defs>
          <g clipPath="url(#ombreCarte2)" stroke={C.encre} strokeWidth={4} opacity={0.5} strokeLinecap="round">
            {Array.from({ length: 80 }, (_, i) => (
              <line key={i} x1={CARTE2.x - 400 + i * 18} y1={CARTE2.y + CARTE2.h + 40} x2={CARTE2.x - 400 + i * 18 + 420} y2={CARTE2.y + CARTE2.h - 380} />
            ))}
          </g>
        </svg>
      ) : null}
      {profond ? <div style={{ position: "absolute", left: CARTE2.x, top: CARTE2.y + 24, width: CARTE2.l, height: CARTE2.h, borderRadius: 34, background: C.orange }} /> : null}
      <div
        style={{
          position: "absolute", left: CARTE2.x, top: CARTE2.y, width: CARTE2.l, height: CARTE2.h, boxSizing: "border-box", borderRadius: main ? 10 : 34,
          background: papier ? C.ivoireHaut : C.blanc,
          border: main ? "none" : `6px solid ${C.orangeVif}`,
          boxShadow: papier ? `0 34px 90px ${a(C.encre, 0.12)}, 0 6px 14px ${a(C.encre, 0.06)}` : profond ? `0 60px 80px ${a(C.encre, 0.1)}` : main ? "none" : `0 26px 60px ${a(C.encre, 0.1)}`,
        }}
      />
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={rectMain(CARTE2.x, CARTE2.y, CARTE2.l, CARTE2.h, 17, 3, 16)} stroke={C.orangeVif} strokeWidth={7} />
          <path d={rectMain(CARTE2.x + 5, CARTE2.y + 4, CARTE2.l - 8, CARTE2.h - 6, 29, 2.5, 10)} stroke={C.encre} strokeWidth={3} opacity={0.8} />
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: CARTE2.x, top: CARTE2.y, width: CARTE2.l, height: CARTE2.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
        <div style={{ ...ANTON, textTransform: "none", fontSize: 132, color: C.encre }}>Chatbot IA</div>
      </div>
      <div style={{ position: "absolute", left: CARTE2.x - 66, top: CARTE2.y + CARTE2.h / 2 - 52, width: 104, height: 104, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: profond ? `0 12px 0 ${C.nuitHaut}` : `0 10px 24px ${a(C.encre, 0.12)}` }}>
        <Icone nom="robot" taille={60} couleur={C.orangeVif} epaisseur={2.6} />
      </div>
      <div style={{ position: "absolute", left: POINT2.x - 16, top: POINT2.y - 16, width: 32, height: 32, borderRadius: "50%", background: C.orangeVif }} />
      <Pastille p={P80B} texte="80 %" fond={C.orangeVif} couleur={C.encre} mat={mat} taille={104} />
      <Pastille p={P20B} texte="20 %" fond={C.encre} couleur={C.blanc} mat={mat} taille={104} />
      {main ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={rectMain(P80B.x, P80B.y, P80B.l, P80B.h, 41, 2.5, 12)} stroke={C.encre} strokeWidth={5} />
          <path d={rectMain(P20B.x, P20B.y, P20B.l, P20B.h, 53, 2.5, 12)} stroke={C.encre} strokeWidth={5} />
        </svg>
      ) : null}
      {/* zone d'appoint : la suite des deux branches (icônes seules, rien qu'on ne comprenne pas déjà au-dessus) */}
      <CarteBranche cx={BR.gauche} cy={BR.y1} icone="etincelles" orange mat={mat} graine={71} />
      <CarteBranche cx={BR.gauche} cy={BR.y2} icone="coche" orange mat={mat} graine={73} />
      <CarteBranche cx={BR.droite} cy={BR.y1} icone="cloche" orange={false} mat={mat} graine={79} />
      <CarteBranche cx={BR.droite} cy={BR.y2} icone="utilisateur" orange={false} mat={mat} graine={83} />
      {temoin ? <SousTitre texte={temoin} fond="ivoire" /> : null}
    </Ecran>
  );
}

export const MatA1 = () => <DeuxChemins mat="A" />;
export const MatB1 = () => <DeuxCheminsV2 mat="B" />;
export const MatC1 = () => <DeuxCheminsV2 mat="C" />;
export const MatD1 = () => <DeuxCheminsV2 mat="D" />;
