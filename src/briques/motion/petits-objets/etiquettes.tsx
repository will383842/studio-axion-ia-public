/**
 * PETITS OBJETS — étiquettes (famille etiquette, C9-11) : pastille à icône, étiquette à icône, badge, tampon.
 * Pièces pures, NON inscrites (rien ne l'importe). Textes en LISTE FERMÉE (`TEXTES_ETIQUETTES`), 4 mots au plus ; rôle d'icône par `iconeObjet`.
 * Le ton « valide » (sauge) n'est tenu que pour le texte « Validé » ; ailleurs il est ramené au neutre. Aucun logo, aucune couleur libre.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import { createElement, type JSX } from "react";
import { PILE_CSS, PALETTE } from "../../charte/axion-2026";
import { couleursSur } from "../../jetons-motion";
import { MOTS_MAX, type DefinitionObjet, type ProprietesObjet, type TonObjet } from "./contrat";
import { iconeObjet } from "./icones-objets";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { tremblement } from "./tremblement";
import { TraceSvg } from "./TraceSvg";

/** Tracé de la pièce avec une couleur EXPLICITE (celle de l'habillage) : le contour et l'icône ne se confondent jamais avec le panneau. */
function Trace({ d, t, couleur, epaisseur }: { d: string; t: number; couleur: string; epaisseur: number }): JSX.Element {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

/** Liste fermée : tout autre texte est refusé (`valider` = null). */
export const TEXTES_ETIQUETTES: readonly string[] = Object.freeze([
  "Scénario", "B-roll", "Voix off", "Montage", "Sous-titres", "Validé", "Nouveau", "Abonne-toi", "Lien en description",
]);
const TEXTES_TAMPON: readonly string[] = Object.freeze(["Validé", "Nouveau"]);
const TEXTE_VALIDE = "Validé";

export interface ParametresEtiquette {
  texte: string;
  /** Rôle d'icône de `ICONES_OBJETS` ; inconnu ou sans icône → l'objet n'apparaît pas. */
  role?: string;
}

const TOILE = { largeur: 1000, hauteur: 1000 } as const;
const DUREE = { min: 1, max: 3 } as const;
const f = (n: number) => n.toFixed(1);
/** Opacité d'entrée : absente une fois le tracé fini (l'opacité de sortie est portée par le groupe). */
const entree = (t: number): number | undefined => (t >= 1 ? undefined : t);
const CENTRE = { x: 500, y: 500 };
const ICONE = 64;
const TAILLE_MAX = 56;
const LARGEUR_TEXTE_MAX = 560;
const HAUT = 128;
const ECHELLE_ICONE = ICONE / 24;

/** Texte de la liste (casse et espaces indifférents), sous sa forme canonique ; sinon null. */
function texteDeListe(t: unknown, liste: readonly string[]): string | null {
  if (typeof t !== "string") return null;
  const n = t.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
  if (n === "" || n.split(" ").length > MOTS_MAX) return null;
  return liste.find((x) => x.toLocaleLowerCase("fr") === n) ?? null;
}

function fabrique(roleIcone: "obligatoire" | "facultatif" | "aucun", liste: readonly string[]) {
  return (p: unknown): ParametresEtiquette | null => {
    try {
      if (typeof p !== "object" || p === null) return null;
      const r = p as Record<string, unknown>;
      const texte = texteDeListe(r.texte, liste);
      if (texte === null) return null;
      if (roleIcone === "aucun" || (roleIcone === "facultatif" && r.role === undefined)) return { texte };
      if (typeof r.role !== "string" || iconeObjet(r.role) === null) return null;
      return { texte, role: r.role };
    } catch {
      return null;
    }
  };
}

/** Tons : « valide » seulement pour le texte « Validé ». */
const tonPermis = (ton: TonObjet, texte: string): TonObjet => (ton === "valide" && texte !== TEXTE_VALIDE ? "neutre" : ton);

const BALISES = ["circle", "line", "rect", "ellipse", "polyline", "polygon"];

/** Icône de la bibliothèque, mise à l'échelle ; les tracés (`path`) se dessinent, les autres formes apparaissent. */
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

type Habillage = (texte: string, ton: TonObjet, fond: ProprietesObjet<ParametresEtiquette>["fond"]) => { fond: string; trait: string; encre: string };

/** Pilule centrée : [icône] texte. Le contour se trace ; l'icône et le texte tiennent. */
function pilule(habillage: Habillage, majuscules = false) {
  return function Rendu(pr: ProprietesObjet<ParametresEtiquette>): JSX.Element {
    const { image, dureeImages, fond } = pr;
    const parametres = pr.parametres as ParametresEtiquette | null;
    if (!parametres) return <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true" />;
    const phase = phaseObjet(image, dureeImages);
    const ton = tonPermis(pr.ton ?? "neutre", parametres.texte);
    const h = habillage(parametres.texte, ton, fond);
    const affiche = majuscules ? parametres.texte.toLocaleUpperCase("fr") : parametres.texte;
    const avecIcone = parametres.role !== undefined && iconeObjet(parametres.role) !== null;
    const taille = tailleTexte(affiche);
    const l = largeurTexte(affiche) + 2 * 40 + (avecIcone ? ICONE + 24 : 0);
    const x0 = CENTRE.x - l / 2, y0 = CENTRE.y - HAUT / 2;
    const rayon = HAUT / 2;
    const d = `M ${f(x0 + rayon)} ${f(y0)} L ${f(x0 + l - rayon)} ${f(y0)} A ${rayon} ${rayon} 0 0 1 ${f(x0 + l - rayon)} ${f(y0 + HAUT)} L ${f(x0 + rayon)} ${f(y0 + HAUT)} A ${rayon} ${rayon} 0 0 1 ${f(x0 + rayon)} ${f(y0)}`;
    const xTexte = x0 + 40 + (avecIcone ? ICONE + 24 : 0);
    return (
      <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <path d={d} fill={h.fond} stroke="none" opacity={entree(phase.trace)} />
          <Trace d={d} t={phase.trace} couleur={h.trait} epaisseur={4} />
          {avecIcone && parametres.role ? <Icone role={parametres.role} x={x0 + 40} y={CENTRE.y - ICONE / 2} t={phase.trace} couleur={h.trait} /> : null}
          <text x={xTexte} y={CENTRE.y + taille * 0.35} fontFamily={PILE_CSS} fontWeight={700} fontSize={taille.toFixed(1)} fill={h.encre} opacity={entree(phase.trace)}>
            {affiche}
          </text>
        </g>
      </svg>
    );
  };
}

/** Pastille blanche : fond blanc, texte noir (paire de la charte), icône et contour du ton (lu sur ivoire, jamais blanc). */
const habillagePastille: Habillage = (_t, ton) => ({ fond: PALETTE.blanc, trait: couleurDuTon(ton, "ivoire"), encre: PALETTE.noir });
/** Étiquette : fond de panneau selon le fond de la scène, texte de la scène, trait du ton lu sur ce même fond (jamais la couleur du panneau). */
const habillageEtiquette: Habillage = (_t, ton, fond) => ({ fond: fond === "noir" ? PALETTE.noir : PALETTE.ivoire, trait: couleurDuTon(ton, fond), encre: fond === "noir" ? PALETTE.ivoire : PALETTE.noir });
/** Badge : accent/erreur = fond terracotta, contour, icône et texte blancs ([blanc, terracotta]) ; neutre = fond blanc, tout en noir ;
 * valide = fond blanc, contour et icône sauge, texte noir (le texte blanc sur sauge n'est pas une paire de la charte). */
const habillageBadge: Habillage = (_t, ton) => {
  if (ton === "neutre") return { fond: PALETTE.blanc, trait: PALETTE.noir, encre: PALETTE.noir };
  if (ton === "valide") return { fond: PALETTE.blanc, trait: PALETTE.reussite, encre: PALETTE.noir };
  return { fond: couleurDuTon(ton, "ivoire"), trait: PALETTE.blanc, encre: PALETTE.blanc };
};

function definir(id: DefinitionObjet<ParametresEtiquette>["id"], valider: DefinitionObjet<ParametresEtiquette>["valider"], rendre: DefinitionObjet<ParametresEtiquette>["Rendu"], capacite: DefinitionObjet<ParametresEtiquette>["capacite"]): DefinitionObjet<ParametresEtiquette> {
  return { id, famille: "etiquette", capacite, valider, toile: TOILE, dureeSec: DUREE, donnees: "aucune", Rendu: rendre };
}

export const DEF_PASTILLE_ICONE = definir("objet-pastille-icone", fabrique("obligatoire", TEXTES_ETIQUETTES), pilule(habillagePastille), "objet.etiquette");
export const DEF_ETIQUETTE_ICONE = definir("objet-etiquette-icone", fabrique("facultatif", TEXTES_ETIQUETTES), pilule(habillageEtiquette), "objet.etiquette");
export const DEF_BADGE = definir("objet-badge", fabrique("obligatoire", TEXTES_ETIQUETTES), pilule(habillageBadge), "objet.appel");

/** Tampon : double cadre incliné, texte en majuscules ; « VALIDÉ » prend le ton valide par défaut, « NOUVEAU » l'accent. */
function rendreTampon(pr: ProprietesObjet<ParametresEtiquette>): JSX.Element {
  const { image, fps, dureeImages, fond, graine } = pr;
  const parametres = pr.parametres as ParametresEtiquette | null;
  if (!parametres) return <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true" />;
  const phase = phaseObjet(image, dureeImages);
  const defaut: TonObjet = parametres.texte === TEXTE_VALIDE ? "valide" : "accent";
  const ton = tonPermis(pr.ton ?? defaut, parametres.texte);
  const affiche = parametres.texte.toLocaleUpperCase("fr");
  const taille = tailleTexte(affiche) * 1.2;
  const l = Math.min(760, largeurTexte(affiche) * 1.2 + 120), h = 200;
  const x0 = CENTRE.x - l / 2, y0 = CENTRE.y - h / 2;
  const cadre = (m: number) => `M ${f(x0 + m)} ${f(y0 + m)} L ${f(x0 + l - m)} ${f(y0 + m)} L ${f(x0 + l - m)} ${f(y0 + h - m)} L ${f(x0 + m)} ${f(y0 + h - m)} Z`;
  const t = tremblement(graine, image, fps);
  const angle = -6 + t.angle;
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${angle.toFixed(2)} ${CENTRE.x} ${CENTRE.y})`}>
        <TraceSvg d={cadre(0)} t={phase.trace} ton={ton} fond={fond} epaisseur={8} />
        <TraceSvg d={cadre(16)} t={phase.trace} ton={ton} fond={fond} epaisseur={3} />
        <text x={CENTRE.x} y={CENTRE.y + taille * 0.35} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={800} fontSize={taille.toFixed(1)} fill={couleursSur(fond).texte} opacity={entree(phase.trace)}>
          {affiche}
        </text>
      </g>
    </svg>
  );
}
export const DEF_TAMPON = definir("objet-tampon", fabrique("aucun", TEXTES_TAMPON), rendreTampon, "objet.appel");

/** Données de planche (C9-39/C9-40) : entrées valides. */
export const EXEMPLES_ETIQUETTES = {
  pastille: [{ texte: "Abonne-toi", role: "personne" }, { texte: "Lien en description", role: "lien" }],
  etiquette: [{ texte: "Scénario", role: "lien" }, { texte: "B-roll" }, { texte: "Montage", role: "etoile" }],
  badge: [{ texte: "Validé", role: "coche" }, { texte: "Nouveau", role: "pouce" }],
  tampon: [{ texte: "Validé" }, { texte: "Nouveau" }],
} as const satisfies Record<string, readonly ParametresEtiquette[]>;
