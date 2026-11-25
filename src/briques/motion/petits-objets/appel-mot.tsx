/**
 * PETITS OBJETS — appel à l'action « Tape MOT » / « Commente MOT » (famille etiquette, C9-12b) : pastille portant le mot-clé DIT.
 * Pièce pure, NON inscrite (rien ne l'importe). Verbe en liste fermée (`VERBES_APPEL_MOT`), un seul mot (lettres et chiffres),
 * 4 mots au plus en tout ; `donnees: "mots-dits"` : la garde C9-04 vérifie que le mot affiché a été prononcé.
 * Aucun logo de réseau, aucune adresse ni lien, aucune flèche vers un bouton ; rien n'est écrit en dehors du verbe et du mot reçu.
 * Ton jamais couleur libre. Imports relatifs seulement (dossier lu par le rendu).
 */
import { createElement, type JSX } from "react";
import { PILE_CSS, PALETTE } from "../../charte/axion-2026";
import { type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { iconeObjet } from "./icones-objets";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

/** Liste fermée : tout autre verbe est refusé (`valider` = null). */
export const VERBES_APPEL_MOT: readonly string[] = Object.freeze(["Tape", "Commente"]);

export interface ParametresAppelMot {
  verbe: string;
  mot: string;
  /** Rôle d'icône de `ICONES_OBJETS` ; facultatif. */
  role?: string;
}

const TOILE = { largeur: 1000, hauteur: 1000 } as const;
const f = (n: number) => n.toFixed(1);
const CENTRE = { x: 500, y: 500 };
const ICONE = 64;
const ECHELLE_ICONE = ICONE / 24;
const HAUT = 128;
const TAILLE_MAX = 56;
const LARGEUR_TEXTE_MAX = 430;
const BALISES = ["circle", "line", "rect", "ellipse", "polyline", "polygon"];

/** Un seul mot : lettres (accents compris) et chiffres, 2 à 16 caractères. */
const MOT_VALIDE = /^[\p{L}\p{N}]{2,16}$/u;
/** Noms de réseaux refusés (assemblés par morceaux : le source n'écrit aucun nom de réseau). */
const RESEAUX: readonly string[] = ["tik" + "tok", "insta" + "gram", "you" + "tube", "linked" + "in", "face" + "book", "x", "twit" + "ter", "thre" + "ads", "snap" + "chat"];

/** Opacité d'entrée : absente une fois le tracé fini (la sortie est portée par le groupe). */
const entree = (t: number): number | undefined => (t >= 1 ? undefined : t);

/** Verbe de la liste (casse et espaces indifférents), sous sa forme canonique ; sinon null. */
function verbeDeListe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().toLocaleLowerCase("fr");
  return VERBES_APPEL_MOT.find((x) => x.toLocaleLowerCase("fr") === n) ?? null;
}

/** Mot-clé : un seul mot sans ponctuation, adresse ni nom de réseau ; rendu en capitales ; sinon null. */
function motCle(m: unknown): string | null {
  if (typeof m !== "string") return null;
  const t = m.trim();
  if (!MOT_VALIDE.test(t)) return null;
  if (RESEAUX.includes(t.toLocaleLowerCase("fr"))) return null;
  return t.toLocaleUpperCase("fr");
}

function valider(p: unknown): ParametresAppelMot | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const verbe = verbeDeListe(r.verbe);
    const mot = motCle(r.mot);
    if (verbe === null || mot === null) return null;
    if (r.role === undefined) return { verbe, mot };
    if (typeof r.role !== "string" || iconeObjet(r.role) === null) return null;
    return { verbe, mot, role: r.role };
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

const nbCaracteres = (p: ParametresAppelMot) => p.verbe.length + 1 + p.mot.length;
const tailleTexte = (p: ParametresAppelMot) => Math.min(TAILLE_MAX, LARGEUR_TEXTE_MAX / (nbCaracteres(p) * 0.62));
const largeurTexte = (p: ParametresAppelMot) => nbCaracteres(p) * tailleTexte(p) * 0.62;

/** Pilule centrée [icône] Verbe MOT : fond blanc, texte noir (paire de la charte), contour et icône du ton lu sur ivoire. */
function Rendu(pr: ProprietesObjet<ParametresAppelMot>): JSX.Element {
  const { image, dureeImages } = pr;
  const parametres = pr.parametres as ParametresAppelMot | null;
  if (!parametres) return <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true" />;
  const phase = phaseObjet(image, dureeImages);
  const trait = couleurDuTon(pr.ton ?? "neutre", "ivoire");
  const avecIcone = parametres.role !== undefined && iconeObjet(parametres.role) !== null;
  const taille = tailleTexte(parametres);
  const l = largeurTexte(parametres) + 80 + (avecIcone ? ICONE + 24 : 0);
  const x0 = CENTRE.x - l / 2, y0 = CENTRE.y - HAUT / 2, r = HAUT / 2;
  const d = `M ${f(x0 + r)} ${f(y0)} L ${f(x0 + l - r)} ${f(y0)} A ${r} ${r} 0 0 1 ${f(x0 + l - r)} ${f(y0 + HAUT)} L ${f(x0 + r)} ${f(y0 + HAUT)} A ${r} ${r} 0 0 1 ${f(x0 + r)} ${f(y0)}`;
  const xTexte = x0 + 40 + (avecIcone ? ICONE + 24 : 0);
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>
        <path d={d} fill={PALETTE.blanc} stroke="none" opacity={entree(phase.trace)} />
        <Trace d={d} t={phase.trace} couleur={trait} epaisseur={4} />
        {avecIcone && parametres.role ? <Icone role={parametres.role} x={x0 + 40} y={CENTRE.y - ICONE / 2} t={phase.trace} couleur={trait} /> : null}
        <text x={xTexte} y={CENTRE.y + taille * 0.35} fontFamily={PILE_CSS} fontSize={taille.toFixed(1)} fill={PALETTE.noir} opacity={entree(phase.trace)}>
          <tspan fontWeight={500}>{parametres.verbe}</tspan>
          {" "}
          <tspan fontWeight={800}>{parametres.mot}</tspan>
        </text>
      </g>
    </svg>
  );
}

export const DEF_APPEL_MOT: DefinitionObjet<ParametresAppelMot> = {
  id: "objet-appel-mot",
  famille: "etiquette",
  capacite: "objet.appel",
  valider,
  toile: TOILE,
  dureeSec: { min: 1, max: 3 },
  donnees: "mots-dits",
  Rendu,
};

/** Données de planche (future) : entrées valides. */
export const EXEMPLES_APPEL_MOT = [{ verbe: "Commente", mot: "guide" }, { verbe: "Tape", mot: "IA", role: "pouce" }, { verbe: "Commente", mot: "Devis" }] as const satisfies readonly ParametresAppelMot[];
