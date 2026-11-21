/**
 * PETITS OBJETS — appel à l'action neutre (famille etiquette, C9-12a) : pastille « Abonne-toi » / « Lien en bio ».
 * Pièce pure, NON inscrite (rien ne l'importe). Textes en LISTE FERMÉE (`TEXTES_APPEL_ACTION`), 4 mots au plus ;
 * icône facultative prise dans `iconeObjet`. Aucun logo de réseau, aucune adresse ni lien écrit ; la variante « Tape … » est hors fiche (C9-12b).
 * Ton jamais couleur libre. Imports relatifs seulement (dossier lu par le rendu).
 */
import { createElement, type JSX } from "react";
import { PILE_CSS, PALETTE } from "../../charte/axion-2026";
import { MOTS_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { iconeObjet } from "./icones-objets";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

/** Liste fermée : tout autre texte est refusé (`valider` = null). */
export const TEXTES_APPEL_ACTION: readonly string[] = Object.freeze(["Abonne-toi", "Lien en bio"]);

export interface ParametresAppelAction {
  texte: string;
  /** Rôle d'icône de `ICONES_OBJETS` (cloche, personne, lien…) ; facultatif. */
  role?: string;
}

const TOILE = { largeur: 1000, hauteur: 1000 } as const;
const f = (n: number) => n.toFixed(1);
const CENTRE = { x: 500, y: 500 };
const ICONE = 64;
const ECHELLE_ICONE = ICONE / 24;
const HAUT = 128;
const TAILLE_MAX = 56;
const LARGEUR_TEXTE_MAX = 560;
const BALISES = ["circle", "line", "rect", "ellipse", "polyline", "polygon"];

/** Opacité d'entrée : absente une fois le tracé fini (la sortie est portée par le groupe). */
const entree = (t: number): number | undefined => (t >= 1 ? undefined : t);

/** Texte de la liste (casse et espaces indifférents), sous sa forme canonique ; sinon null. */
function texteDeListe(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const n = t.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
  if (n === "" || n.split(" ").length > MOTS_MAX) return null;
  return TEXTES_APPEL_ACTION.find((x) => x.toLocaleLowerCase("fr") === n) ?? null;
}

function valider(p: unknown): ParametresAppelAction | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const texte = texteDeListe(r.texte);
    if (texte === null) return null;
    if (r.role === undefined) return { texte };
    if (typeof r.role !== "string" || iconeObjet(r.role) === null) return null;
    return { texte, role: r.role };
  } catch {
    return null;
  }
}

function Trace({ d, t, couleur, epaisseur }: { d: string; t: number; couleur: string; epaisseur: number }): JSX.Element {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Icone({ role, x, y, t, couleur }: { role: string; x: number; y: number; t: number; couleur: string }): JSX.Element | null {
  const ic = iconeObjet(role);
  if (!ic) return null;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${ECHELLE_ICONE})`}>
      {ic.noeuds.map(([balise, attrs], i) => {
        if (balise === "path") return <Trace key={i} d={String((attrs as Record<string, unknown>).d)} t={t} couleur={couleur} epaisseur={2} />;
        if (!BALISES.includes(balise)) return null;
        return createElement(balise, { key: i, ...(attrs as object), fill: "none", stroke: couleur, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", opacity: entree(t) === undefined ? undefined : 0 });
      })}
    </g>
  );
}

const tailleTexte = (texte: string) => Math.min(TAILLE_MAX, LARGEUR_TEXTE_MAX / (texte.length * 0.62));
const largeurTexte = (texte: string) => texte.length * tailleTexte(texte) * 0.62;

/** Pilule centrée [icône] texte : fond blanc, texte noir (paire de la charte), contour et icône du ton lu sur ivoire. */
function Rendu(pr: ProprietesObjet<ParametresAppelAction>): JSX.Element {
  const { image, dureeImages } = pr;
  const parametres = pr.parametres as ParametresAppelAction | null;
  if (!parametres) return <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true" />;
  const phase = phaseObjet(image, dureeImages);
  const trait = couleurDuTon(pr.ton ?? "neutre", "ivoire");
  const avecIcone = parametres.role !== undefined && iconeObjet(parametres.role) !== null;
  const taille = tailleTexte(parametres.texte);
  const l = largeurTexte(parametres.texte) + 80 + (avecIcone ? ICONE + 24 : 0);
  const x0 = CENTRE.x - l / 2, y0 = CENTRE.y - HAUT / 2, r = HAUT / 2;
  const d = `M ${f(x0 + r)} ${f(y0)} L ${f(x0 + l - r)} ${f(y0)} A ${r} ${r} 0 0 1 ${f(x0 + l - r)} ${f(y0 + HAUT)} L ${f(x0 + r)} ${f(y0 + HAUT)} A ${r} ${r} 0 0 1 ${f(x0 + r)} ${f(y0)}`;
  const xTexte = x0 + 40 + (avecIcone ? ICONE + 24 : 0);
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>
        <path d={d} fill={PALETTE.blanc} stroke="none" opacity={entree(phase.trace)} />
        <Trace d={d} t={phase.trace} couleur={trait} epaisseur={4} />
        {avecIcone && parametres.role ? <Icone role={parametres.role} x={x0 + 40} y={CENTRE.y - ICONE / 2} t={phase.trace} couleur={trait} /> : null}
        <text x={xTexte} y={CENTRE.y + taille * 0.35} fontFamily={PILE_CSS} fontWeight={700} fontSize={taille.toFixed(1)} fill={PALETTE.noir} opacity={entree(phase.trace)}>
          {parametres.texte}
        </text>
      </g>
    </svg>
  );
}

export const DEF_APPEL_ACTION: DefinitionObjet<ParametresAppelAction> = {
  id: "objet-appel-action",
  famille: "etiquette",
  capacite: "objet.appel",
  valider,
  toile: TOILE,
  dureeSec: { min: 1, max: 3 },
  donnees: "aucune",
  Rendu,
};

/** Données de planche (future) : entrées valides. */
export const EXEMPLES_APPEL_ACTION = [{ texte: "Abonne-toi", role: "cloche" }, { texte: "Abonne-toi", role: "personne" }, { texte: "Lien en bio", role: "lien" }, { texte: "Lien en bio" }] as const satisfies readonly ParametresAppelAction[];
