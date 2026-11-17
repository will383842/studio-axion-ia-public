/**
 * PETITS OBJETS — soulignements (droit, vague, double) et surligneur balayé (C9-08). Pièces pures, NON inscrites (rien ne les importe).
 * Traits par `TraceSvg` ; aucun texte, aucun filtre. Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import type { DefinitionObjet, TonObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { couleurDuTon as couleurTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** Segment en % de la toile : départ (x, y) et largeur. */
export interface ParametresSoulignement {
  x: number;
  y: number;
  largeur: number;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const DECALAGE_DOUBLE_IMAGES = 4;
const ECART_DOUBLE = 16;
const AMPLITUDE_VAGUE = 8;
const POINTS_VAGUE = 48;
const HAUTEUR_SURLIGNEUR = 56;
const OPACITE_SURLIGNEUR = 0.3;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function valider(p: unknown): ParametresSoulignement | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { x, y, largeur } = p as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur)) return null;
    if (x < 0 || y < 0 || y > 100 || largeur <= 0 || x + largeur > 100) return null;
    return { x, y, largeur };
  } catch {
    return null;
  }
}

const f = (n: number): string => n.toFixed(1);
const px = (p: ParametresSoulignement) => ({ x: (p.x * L) / 100, y: (p.y * H) / 100, l: (p.largeur * L) / 100 });

function cheminDroit(p: ParametresSoulignement, dy = 0): string {
  const a = px(p);
  return `M ${f(a.x)} ${f(a.y + dy)} L ${f(a.x + a.l)} ${f(a.y + dy)}`;
}

/** Sinus dont la phase et le nombre d'ondes sortent de la graine ; amplitude bornée par AMPLITUDE_VAGUE. */
function cheminVague(p: ParametresSoulignement, graine: number): string {
  const a = px(p);
  const ondes = 3 + Math.floor(aleaGraine(graine, 0) * 3);
  const phase = aleaGraine(graine, 1) * 2 * Math.PI;
  const pts: string[] = [];
  for (let i = 0; i <= POINTS_VAGUE; i++) {
    const s = i / POINTS_VAGUE;
    pts.push(`${f(a.x + a.l * s)} ${f(a.y + Math.sin(phase + s * ondes * 2 * Math.PI) * AMPLITUDE_VAGUE)}`);
  }
  return `M ${pts.join(" L ")}`;
}

type Variante = "droit" | "vague" | "double" | "surligneur";

function creer(variante: Variante, id: DefinitionObjet<ParametresSoulignement>["id"]): DefinitionObjet<ParametresSoulignement> {
  return {
    id,
    famille: "trait",
    capacite: "objet.trait",
    valider,
    toile: TOILE,
    dureeSec: DUREE,
    donnees: "aucune",
    Rendu(pr): JSX.Element {
      const { image, dureeImages, fond, parametres, graine } = pr;
      const ton: TonObjet = pr.ton ?? (variante === "surligneur" ? "accent" : "neutre");
      const phase = phaseObjet(image, dureeImages);
      let corps: JSX.Element;
      if (variante === "surligneur") {
        const a = px(parametres);
        corps = (
          <rect x={f(a.x)} y={f(a.y - HAUTEUR_SURLIGNEUR / 2)} width={f(a.l * phase.trace)} height={HAUTEUR_SURLIGNEUR} fill={couleurTon(ton, fond)} fillOpacity={OPACITE_SURLIGNEUR} />
        );
      } else if (variante === "double") {
        const t2 = phaseObjet(image - DECALAGE_DOUBLE_IMAGES, dureeImages).trace;
        corps = (
          <>
            <TraceSvg d={cheminDroit(parametres)} t={phase.trace} ton={ton} fond={fond} />
            <TraceSvg d={cheminDroit(parametres, ECART_DOUBLE)} t={t2} ton={ton} fond={fond} />
          </>
        );
      } else {
        corps = <TraceSvg d={variante === "vague" ? cheminVague(parametres, graine) : cheminDroit(parametres)} t={phase.trace} ton={ton} fond={fond} />;
      }
      return (
        <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g opacity={phase.opacite}>{corps}</g>
        </svg>
      );
    },
  };
}

export const OBJET_SOULIGNEMENT_DROIT = creer("droit", "objet-soulignement-droit");
export const OBJET_SOULIGNEMENT_VAGUE = creer("vague", "objet-soulignement-vague");
export const OBJET_SOULIGNEMENT_DOUBLE = creer("double", "objet-soulignement-double");
export const OBJET_SURLIGNEUR = creer("surligneur", "objet-surligneur");

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_SOULIGNEMENTS: readonly ParametresSoulignement[] = [
  { x: 10, y: 50, largeur: 60 },
  { x: 20, y: 70, largeur: 45 },
  { x: 5, y: 30, largeur: 80 },
];
