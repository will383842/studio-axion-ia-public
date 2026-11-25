/**
 * PETITS OBJETS — bulles (C9-26) : parole (queue), pensée (petits ronds), notification (pastille neutre, sans nom d'application ni logo, sans heure).
 * Pièces pures, NON inscrites (rien ne les importe). Contour tracé par `TraceSvg` ; le texte (Manrope, ≤ 4 mots dits) apparaît après le contour.
 * Imports relatifs seulement (dossier lu par le rendu). Le placement hors visage et hors sous-titres est vérifié par l'appelant (`zones.ts`).
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import { couleursSur } from "../../jetons-motion";
import { MOTS_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { tremblement } from "./tremblement";
import { TraceSvg } from "./TraceSvg";

/** Côté de la queue : -1 gauche, 0 bas, 1 droite (nombre, pour que la garde « mots dits » ne le lise pas comme un texte). */
export type QueueBulle = -1 | 0 | 1;
export interface ParametresBulle {
  /** 1 à 4 mots, qui doivent être des mots dits (garde C9-04, côté Studio). */
  texte: string;
  /** Facultatif (ignoré) pour la notification ; requis pour parole et pensée. */
  queue?: QueueBulle;
}

const QUEUES: readonly QueueBulle[] = [-1, 0, 1];
const L = 1000;
const H = 560;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const CHAR_MAX = 48;
const CORPS = { x0: 100, y0: 60, x1: 900, y1: 360 } as const;

function valider(p: unknown, queueRequise: boolean): ParametresBulle | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    if (typeof r.texte !== "string") return null;
    const queue = r.queue;
    const queueOk = typeof queue === "number" && (QUEUES as readonly number[]).includes(queue);
    if (queueRequise ? !queueOk : queue !== undefined && !queueOk) return null;
    const mots = r.texte.split(/\s+/).filter(Boolean);
    const texte = mots.join(" ");
    if (mots.length < 1 || mots.length > MOTS_MAX || texte.length > CHAR_MAX) return null;
    return queueOk ? { texte, queue: queue as QueueBulle } : { texte };
  } catch {
    return null;
  }
}

const f = (n: number): string => n.toFixed(1);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Rectangle arrondi (rayon `r`), tracé dans le sens horaire ; `queue` ouvre le bord bas et y insère la pointe. */
function cheminBulle(r: number, queue: QueueBulle | null): string {
  const { x0, y0, x1, y1 } = CORPS;
  const bas = queue === null ? `H ${f(x0 + r)}` : (() => {
    const bx = queue === -1 ? 0.25 : queue === 1 ? 0.75 : 0.5;
    const cx = x0 + (x1 - x0) * bx;
    const pointe = cx + (queue === -1 ? -50 : queue === 1 ? 50 : 0);
    return `H ${f(cx + 55)} L ${f(pointe)} ${f(y1 + 120)} L ${f(cx - 55)} ${f(y1)} H ${f(x0 + r)}`;
  })();
  return `M ${f(x0 + r)} ${f(y0)} H ${f(x1 - r)} A ${r} ${r} 0 0 1 ${f(x1)} ${f(y0 + r)} V ${f(y1 - r)} A ${r} ${r} 0 0 1 ${f(x1 - r)} ${f(y1)} ${bas} A ${r} ${r} 0 0 1 ${f(x0)} ${f(y1 - r)} V ${f(y0 + r)} A ${r} ${r} 0 0 1 ${f(x0 + r)} ${f(y0)}`;
}

function cheminRond(cx: number, cy: number, r: number): string {
  return `M ${f(cx - r)} ${f(cy)} A ${r} ${r} 0 1 1 ${f(cx + r)} ${f(cy)} A ${r} ${r} 0 1 1 ${f(cx - r)} ${f(cy)}`;
}

/** Trois ronds de plus en plus petits qui descendent du côté de la queue. */
function rondsPensee(queue: QueueBulle): { cx: number; cy: number; r: number }[] {
  const dir = queue;
  const cx0 = (CORPS.x0 + CORPS.x1) / 2 + dir * 200;
  return [
    { cx: cx0 + dir * 10, cy: CORPS.y1 + 38, r: 26 },
    { cx: cx0 + dir * 30, cy: CORPS.y1 + 95, r: 18 },
    { cx: cx0 + dir * 50, cy: CORPS.y1 + 140, r: 11 },
  ];
}

type Variante = "parole" | "pensee" | "notification";

function Texte({ texte, fond, k, cx, cy, largeur }: { texte: string; fond: ProprietesObjet<ParametresBulle>["fond"]; k: number; cx: number; cy: number; largeur: number }): JSX.Element {
  const taille = Math.min(84, largeur / (Math.max(texte.length, 1) * 0.58));
  return (
    <text x={f(cx)} y={f(cy)} textAnchor="middle" dominantBaseline="central" fontFamily={PILE_CSS} fontWeight={700} fontSize={f(taille)} fill={couleursSur(fond).texte} opacity={k}>
      {texte}
    </text>
  );
}

function creer(variante: Variante, id: DefinitionObjet<ParametresBulle>["id"]): DefinitionObjet<ParametresBulle> {
  return {
    id,
    famille: "etiquette",
    capacite: "objet.etiquette",
    valider: (p: unknown) => valider(p, variante !== "notification"),
    toile: TOILE,
    dureeSec: DUREE,
    donnees: "mots-dits",
    Rendu(pr): JSX.Element {
      const { image, fps, dureeImages, fond, parametres, graine } = pr;
      const ton = pr.ton ?? "neutre";
      const phase = phaseObjet(image, dureeImages);
      const t = phase.trace;
      const tr = tremblement(graine, image, fps);
      const transform = `translate(${tr.dx.toFixed(2)} ${tr.dy.toFixed(2)}) rotate(${tr.angle.toFixed(2)} ${L / 2} ${H / 2})`;
      const corps = t / 0.7;
      const reste = borne01((t - 0.7) / 0.3);
      const texteK = reste;
      const cx = (CORPS.x0 + CORPS.x1) / 2;
      const cy = (CORPS.y0 + CORPS.y1) / 2;
      let contour: JSX.Element;
      let texte: JSX.Element;
      if (variante === "parole") {
        contour = <TraceSvg d={cheminBulle(70, parametres.queue ?? 0)} t={borne01(corps)} ton={ton} fond={fond} />;
        texte = <Texte texte={parametres.texte} fond={fond} k={texteK} cx={cx} cy={cy} largeur={640} />;
      } else if (variante === "pensee") {
        contour = (
          <>
            <TraceSvg d={cheminBulle(150, null)} t={borne01(corps)} ton={ton} fond={fond} />
            {rondsPensee(parametres.queue ?? 0).map((o, i) => (
              <TraceSvg key={i} d={cheminRond(o.cx, o.cy, o.r)} t={borne01((t - 0.55 - i * 0.12) / 0.2)} ton={ton} fond={fond} epaisseur={5} />
            ))}
          </>
        );
        texte = <Texte texte={parametres.texte} fond={fond} k={texteK} cx={cx} cy={cy} largeur={560} />;
      } else {
        contour = (
          <>
            <TraceSvg d={cheminBulle(60, null)} t={borne01(corps)} ton={ton} fond={fond} />
            <TraceSvg d={cheminRond(CORPS.x0 + 80, cy, 22)} t={borne01((t - 0.5) / 0.3)} ton={ton} fond={fond} epaisseur={5} />
          </>
        );
        texte = <Texte texte={parametres.texte} fond={fond} k={texteK} cx={cx + 50} cy={cy} largeur={540} />;
      }
      return (
        <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g opacity={phase.opacite} transform={transform}>
            {contour}
            {texte}
          </g>
        </svg>
      );
    },
  };
}

export const OBJET_BULLE_PAROLE = creer("parole", "objet-bulle-parole");
export const OBJET_BULLE_PENSEE = creer("pensee", "objet-bulle-pensee");
export const OBJET_BULLE_NOTIFICATION = creer("notification", "objet-bulle-notification");

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_BULLES: readonly ParametresBulle[] = [
  { texte: "Pas besoin", queue: -1 },
  { texte: "Et si", queue: 0 },
  { texte: "Nouveau message", queue: 1 },
];
