import React from "react";
/**
 * CHI-B · Anneau (maquettes CHI-B-1, CHI-B-2, R45-CHI-B-1) : l'anneau se remplit jusqu'au pourcentage, en orange ; le
 * complément déjà dit (« 20 % ») prend sa part en encre, avec sa légende. Appoint : la file des demandes (bulles), puis
 * la pastille de la sortie où part le reste.
 */
import { largeurTexte } from "../../../../../src/briques/ecrans-motion/mesure";
import type { DonneesEcranChiffresRendu } from "./donnees";
import { a, arc, Appoint, Bulle, C, ChiffreAnton, contreEchelle, doux, INTER, Pastille, Points, progres, type CadreChiffres } from "./outils";
import { echelleVariante } from "./pile";

const ECART = 4;

/** Géométrie de l'anneau : 9:16, rayon 340 (le « 80 % » de 330 px tient dedans, le reste finit au-dessus des
 *  sous-titres) ; 4:5, cy 540, rayon 330 (R45-CHI-B-1 : 320). */
export function geometrieAnneau(cadre: CadreChiffres) {
  return cadre.appoint ? { cx: 540, cy: 655, r: 340, ep: 70, taille: 330 } : { cx: 540, cy: 540, r: 330, ep: 72, taille: 330 };
}

export type GeometrieAnneau = ReturnType<typeof geometrieAnneau>;
export interface PlanLegendeAnneau {
  /** « dedans » : sous le chiffre, dans l'anneau (légende courte) ; « dessous » : sous l'anneau, centrée sur la page. */
  place: "dedans" | "dessous";
  /** Géométrie à dessiner (celle de `geometrieAnneau`, ou plus petite en mode « dessous » : le haut de l'anneau ne bouge pas). */
  g: GeometrieAnneau;
  taillePx: number;
  lignes: string[];
  /** Haut de la légende (repère de la variante, avant l'échelle). */
  top: number;
}

const INTERLIGNE_LEGENDE = 1.15;
const LEGENDE_PX = 62;
const LEGENDE_PX_MIN = 58;
const RAYON_MIN = 300;
/** Taille la plus basse du chiffre « reste » quand la légende le pousse vers le bas. */
const RESTE_PX_MIN = 72;
const dejaDit = new Set<string>();

/** Coupe `texte` en lignes de `largeur` au plus (mots entiers, coupe gloutonne). */
function lignesDe(texte: string, taillePx: number, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (courante && largeurTexte(essai, "inter-gras", taillePx) > largeur) {
      lignes.push(courante);
      courante = mot;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/**
 * D1 (compositions-iv/11) : où poser la légende du chiffre focal. Dedans, sous le chiffre, tant que CHAQUE ligne tient dans
 * la corde intérieure de l'anneau (moins 16 px), à l'échelle 1 ET à l'échelle minimale `echelleMin` (la variante rapetisse
 * quand la pile s'ouvre, la légende garde ses 62 px à l'écran). Sinon dessous : une ligne centrée sous l'anneau, qui laisse
 * la place à la pile ; l'anneau garde son haut et perd au plus 30 px de rayon (plancher 300) si la pile l'exige.
 * Dernier recours (rien ne tient) : l'ancienne disposition, avec un avertissement. Fonction PURE.
 */
export function planLegendeAnneau(d: DonneesEcranChiffresRendu, cadre: CadreChiffres, echelleMin: number): PlanLegendeAnneau {
  const g0 = geometrieAnneau(cadre);
  const legende = d.chiffres[d.focal]?.legende ?? "";
  const haut = cadre.haut;
  const dedansTop = g0.cy + g0.taille * 0.3 + 14;
  const dedans: PlanLegendeAnneau = { place: "dedans", g: g0, taillePx: LEGENDE_PX, lignes: lignesDe(legende, LEGENDE_PX, 2 * g0.r - g0.ep), top: dedansTop };
  const echelles = [1, Math.min(1, echelleMin)];
  const tientDedans = (e: number) => {
    const cy = haut + (g0.cy - haut) * e;
    const ri = (g0.r - g0.ep / 2) * e;
    const h = LEGENDE_PX * INTERLIGNE_LEGENDE;
    const t0 = haut + (dedansTop - haut) * e;
    return dedans.lignes.every((l, k) => {
      const dy = Math.max(Math.abs(t0 + k * h - cy), Math.abs(t0 + (k + 1) * h - cy));
      return dy < ri && largeurTexte(l, "inter-gras", LEGENDE_PX) <= 2 * Math.sqrt(ri * ri - dy * dy) - 16;
    });
  };
  if (!legende || echelles.every(tientDedans)) return dedans;
  // Le « reste » (« 20 % Limite atteinte ») passe sous la légende : on cherche d'abord un anneau assez petit pour qu'il finisse
  // au-dessus des sous-titres (72 px au plus bas), puis, à défaut, sans lui.
  const passes = d.anneau?.reste ? [true, false] : [false];
  for (const avecReste of passes) {
    for (const taillePx of [LEGENDE_PX, LEGENDE_PX_MIN]) {
      const lignes = largeurTexte(legende, "inter-gras", taillePx) <= 960 ? [legende] : lignesDe(legende, taillePx, 960);
      for (let r = g0.r; r >= RAYON_MIN; r -= 4) {
        const g = { ...g0, r, cy: g0.cy - (g0.r - r) };
        const top = g.cy + g.r + g.ep / 2 + 16;
        const hauteurLegende = lignes.length * taillePx * INTERLIGNE_LEGENDE;
        const ok =
          echelles.every((e) => haut + (top - haut) * e + hauteurLegende <= haut + (cadre.bas - haut) * e + 16) &&
          top + hauteurLegende <= cadre.sousTitres - 10 &&
          (!avecReste || top + hauteurLegende + 12 + RESTE_PX_MIN <= cadre.sousTitres - 10);
        if (ok) return { place: "dessous", g, taillePx, lignes, top };
      }
    }
  }
  const cle = `${cadre.hauteur}|${legende}`;
  if (!dejaDit.has(cle)) {
    dejaDit.add(cle);
    console.warn(`[anneau] légende « ${legende} » : ni dedans ni dessous ne tient, ancienne disposition sur deux lignes`);
  }
  return dedans;
}

export function Anneau({ d, t, t0, cadre, discret = 0, echelle = 1 }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres; discret?: number; echelle?: number }) {
  const focal = d.chiffres[d.focal];
  const nbRangees = d.chiffres.length - 1;
  const plan = planLegendeAnneau(d, cadre, echelleVariante(d, cadre, nbRangees, geometrieAnneau(cadre).taille));
  const g = plan.g;
  const dessous = plan.place === "dessous";
  const valeur = d.anneau?.valeur ?? 0;
  const reste = d.anneau?.reste;
  // Le segment du reste est en bas, centré à 180° ; l'orange part de sa fin et tourne dans le sens horaire.
  const partReste = 360 * (1 - valeur / 100);
  const debutReste = 180 - partReste / 2 + ECART;
  const finReste = 180 + partReste / 2 - ECART;
  const debut = 180 + partReste / 2 + ECART;
  const remplissage = doux(progres(t, t0, 1));
  const finOrange = debut + (360 * (valeur / 100) - 2 * ECART) * remplissage;
  const vingt = reste ? doux(progres(t, t0 + 1, 0.45)) : 0;
  // Le reste passe sous la légende quand elle est posée sous l'anneau ; sa taille se réduit (72 px au plus bas) pour finir au-dessus des sous-titres.
  const resteTop = dessous ? plan.top + plan.lignes.length * plan.taillePx * INTERLIGNE_LEGENDE + 12 : g.cy + g.r + g.ep / 2 + 18;
  const resteTaille = dessous ? Math.max(RESTE_PX_MIN, Math.min(100, cadre.sousTitres - 10 - resteTop)) : 100;
  return (
    <>
      <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={a(C.encre, 0.14)} strokeWidth={g.ep} />
        {remplissage > 0 ? <path d={arc(g.cx, g.cy, g.r, debut, finOrange)} fill="none" stroke={C.orange} strokeWidth={g.ep} style={{ filter: `drop-shadow(0 10px 24px ${a(C.orange, 0.12)})` }} /> : null}
        {remplissage < 1 ? [0, 1, 2].map((k) => <path key={k} d={arc(g.cx, g.cy, g.r, finOrange + 2 + k * 5, finOrange + 5 + k * 5)} fill="none" stroke={a(C.orange, 0.3 - k * 0.09)} strokeWidth={g.ep} />) : null}
        {vingt > 0 ? <path d={arc(g.cx, g.cy, g.r, debutReste, debutReste + (finReste - debutReste) * vingt)} fill="none" stroke={C.encre} strokeWidth={g.ep} /> : null}
      </svg>
      <div style={{ position: "absolute", opacity: t >= t0 - 0.05 ? 1 : 0, left: g.cx - g.r + g.ep / 2, top: g.cy - g.taille * 0.7, width: 2 * g.r - g.ep, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ChiffreAnton texte={focal.texte} taille={g.taille} couleur={C.orange} />
        {focal.legende && !dessous ? <div style={{ ...INTER, fontSize: 62, color: C.encre, marginTop: 14, opacity: doux(progres(t, t0 + 0.2, 0.4)), ...contreEchelle(echelle, "50% 0%") }}>{focal.legende}</div> : null}
      </div>
      {focal.legende && dessous ? (
        <div style={{ position: "absolute", left: 60, width: 960, top: plan.top, textAlign: "center", ...INTER, fontSize: plan.taillePx, color: C.encre, whiteSpace: plan.lignes.length === 1 ? "nowrap" : undefined, opacity: t >= t0 - 0.05 ? doux(progres(t, t0 + 0.2, 0.4)) : 0, ...contreEchelle(echelle, "50% 0%") }}>
          {focal.legende}
        </div>
      ) : null}
      {/* La demande suivante entre dans l'anneau par le bas, puis le reste (déjà dit) prend sa place. */}
      {vingt < 1 && !dessous ? (
        <div style={{ opacity: (1 - vingt) * (1 - discret) }}>
          <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d={`M540 ${g.cy + g.r + 40}V${g.cy + g.r + 10}`} stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
          </svg>
          <Bulle x={400} y={g.cy + g.r + 46} l={280} h={92} contour={C.encre} ombre={false}>
            <Points taille={16} />
          </Bulle>
        </div>
      ) : null}
      {reste ? (
        <div style={{ position: "absolute", left: 60, width: 960, top: resteTop, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 26, opacity: vingt * (1 - discret) }}>
          <ChiffreAnton texte={reste.texte} taille={resteTaille} couleur={C.encre} />
          {reste.legende ? <div style={{ ...INTER, fontSize: 60, color: C.encre, whiteSpace: "nowrap" }}>{reste.legende}</div> : null}
        </div>
      ) : null}
      {!cadre.appoint && reste && !dessous ? <Pastille x={858} y={g.cy + 340} d={140} icone={d.icones.sortie} /> : null}
    </>
  );
}

/** Appoint de l'anneau : la file des demandes ; une fois le reste posé, les demandes partent vers la sortie. */
export function AppointAnneau({ d, t, t0, cadre }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres }) {
  const parti = d.anneau?.reste ? progres(t, t0 + 1, 0.45) >= 0.5 : false;
  if (!parti)
    return (
      <Appoint cadre={cadre}>
        <Bulle x={380} y={1312} l={320} h={124} contour={C.encre} ombre={false}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={60} y={1372} l={300} h={124} contour={C.encre} ombre={false} rotation={-5}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
        <Bulle x={720} y={1384} l={300} h={124} contour={C.encre} ombre={false} rotation={6}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
      </Appoint>
    );
  return (
    <>
      <Appoint cadre={cadre}>
        <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M560 1420 C 610 1430, 640 1426, 680 1416" fill="none" stroke={a(C.encre, 0.45)} strokeWidth={7} strokeDasharray="2 16" strokeLinecap="round" />
        </svg>
        <Bulle x={80} y={1318} l={300} h={120} contour={C.encre} ombre={false} rotation={-6}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={300} y={1392} l={260} h={110} contour={C.encre} ombre={false} rotation={5}>
          <Points taille={18} />
        </Bulle>
      </Appoint>
      {cadre.appoint ? <Pastille x={700} y={1310} d={224} icone={d.icones.sortie} /> : null}
    </>
  );
}
