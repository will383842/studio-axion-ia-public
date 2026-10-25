/**
 * Briques communes des calques de parcours : les fonctions de la maquette qui n'ont pas d'équivalent dans `commun/Primitives.tsx`
 * (`card` posée en absolu, `sc` / `num`, `ttl`, `nd`, dégradés et filtre des SVG, objets « à cheval »). JSX seulement dans des fonctions.
 */
import { useId, type CSSProperties, type ReactNode } from "react";
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Carte, Icone, police, POLICE_SERIF, POLICE_TEXTE, POLICE_TITRE, Texte, Tuile, type VarianteCarte, type VarianteTuile } from "../commun/Primitives";
import type { NomIconeContinu } from "../commun/icones-continu";
import type { PageToile } from "../../../../../src/domaine/visuels/continu/schema-toile";

/** Texte d'un champ de page (chaîne vide si absent). */
export function champ(page: PageToile | undefined, nom: string): string {
  const v = (page as Record<string, unknown> | undefined)?.[nom];
  return typeof v === "string" ? v : "";
}

/** Insécable fine avant « ? ! : ; » (typographie française). */
export function typo(s: string): string {
  return s.replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« ");
}

/** Identifiants des dégradés et du filtre d'un calque (uniques dans la page). */
export function useIdsSvg(): { p: string } {
  return { p: `p${useId().replace(/[^a-zA-Z0-9_-]/g, "")}` };
}

/** `gO`, `gA`, `gSt`, `gGl`, `pO`, `pK`, `fsh` de la maquette, préfixés. */
export function DefsParcours({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}gO`} x1="0" x2="1">
        <stop offset="0" stopColor={C.orangeClair} />
        <stop offset="1" stopColor={C.orange} />
      </linearGradient>
      <linearGradient id={`${p}gA`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.orange} stopOpacity={0.34} />
        <stop offset="1" stopColor={C.orange} stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`${p}gSt`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.brun} />
        <stop offset="1" stopColor={C.encre} />
      </linearGradient>
      <linearGradient id={`${p}gGl`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.blancCarte} stopOpacity={0.75} />
        <stop offset="1" stopColor={C.blancCarte} stopOpacity={0.12} />
      </linearGradient>
      <linearGradient id={`${p}pO`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.orangeLumiere} />
        <stop offset="1" stopColor={C.orange} />
      </linearGradient>
      <filter id={`${p}fsh`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor={C.rouille} floodOpacity={0.34} />
      </filter>
    </defs>
  );
}

/** Calque de tracés de fond : `[data-decor]` (le texte passe dessus par construction, ce n'est pas un obstacle). */
export function CalqueDecor({ largeur, hauteur = 1350, children }: { largeur: number; hauteur?: number; children: ReactNode }) {
  return (
    <svg data-decor="" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
      {children}
    </svg>
  );
}

/** Objet posé en absolu qui chevauche une couture (`[data-a-cheval]`, compté par la mesure). */
export function Cheval({ x, y, rotation, children, style }: { x: number; y: number; rotation?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-a-cheval="" style={{ position: "absolute", left: x, top: y, transform: rotation ? `rotate(${rotation}deg)` : undefined, ...style }}>
      {children}
    </div>
  );
}

const SERIF_ACCENT = (taille: number): CSSProperties => ({ ...police(400, Math.round(taille * 1.1), 0.9, POLICE_SERIF, true), letterSpacing: "-0.015em", color: C.orange, wordSpacing: 0 });

/** `ttl()` : grand titre posé en absolu ; `accent` en serif italique orange, `suite` (ponctuation ou fin de phrase) après lui. */
export function TitreP({ x, y, taille, largeur, titre, accent, suite, sombre = false }: { x: number; y: number; taille: number; largeur: number; titre: string; accent?: string; suite?: string; sombre?: boolean }) {
  const liaison = !suite ? "" : /^[?!:;»]/.test(suite) ? " " : /^[,.…)]/.test(suite) ? "" : " ";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur }}>
      <h1 style={{ ...police(800, taille, 0.94, POLICE_TITRE), letterSpacing: "-0.045em", wordSpacing: "0.08em", margin: 0, textWrap: "balance", color: sombre ? C.creme : C.encre }}>
        {typo(titre)}
        {accent ? (
          <>
            {" "}
            <em style={SERIF_ACCENT(taille)}>{accent}</em>
          </>
        ) : null}
        {suite ? `${liaison}${typo(suite)}` : null}
      </h1>
    </div>
  );
}

/** `txt()` : paragraphe posé en absolu. */
export function TexteP({ x, y, largeur, children, taille, sombre = false }: { x: number; y: number; largeur: number; children: string; taille?: number; sombre?: boolean }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur }}>
      <Texte sombre={sombre} taille={taille}>
        {typo(children)}
      </Texte>
    </div>
  );
}

/** Mot ou phrase en Instrument Serif italique (apartés de la maquette), posé en absolu. */
export function Aparte({ x, y, largeur, taille, interligne = 1, couleur = C.grisTexte, children }: { x: number; y: number; largeur?: number; taille: number; interligne?: number; couleur?: string; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, ...police(400, taille, interligne, POLICE_SERIF, true), color: couleur, whiteSpace: largeur ? undefined : "nowrap" }}>{children}</div>
  );
}

/** `card()` : carte posée en absolu (boîte bordure, padding 30 / 36). */
export function CarteAbs({ x, y, largeur, hauteur, variante = "", couleur, style, children }: { x: number; y: number; largeur: number; hauteur: number; variante?: VarianteCarte; couleur?: string; style?: CSSProperties; children: ReactNode }) {
  const encre = variante === "k" || variante === "glass" ? C.creme : C.encre;
  return (
    <Carte variante={variante} style={{ position: "absolute", left: x, top: y, width: largeur, height: hauteur, padding: "30px 36px", boxSizing: "border-box", color: couleur ?? encre, ...style }}>
      {children}
    </Carte>
  );
}

const bf = (taille: number, interligne = 1): CSSProperties => ({ ...police(800, taille, interligne, POLICE_TITRE), letterSpacing: "-0.04em" });

/** `.sm` : texte secondaire, 29 px dans les rangées d'étape. */
export function Petit({ taille = 29, style, children }: { taille?: number; style?: CSSProperties; children: ReactNode }) {
  return <p style={{ ...police(500, taille, 1.3, POLICE_TEXTE), margin: 0, opacity: 0.78, ...style }}>{children}</p>;
}

/** `sc()` : rangée « icône en relief + titre + sous-titre » d'une carte d'étape. */
export function Rangee({ icone, titre, sous, variante, taille = 120, corps = 52 }: { icone: NomIconeContinu; titre: string; sous: string; variante: VarianteTuile; taille?: number; corps?: number }) {
  return (
    <div style={{ display: "flex", gap: 30, alignItems: "center", height: "100%" }}>
      <Tuile icone={icone} taille={taille} variante={variante} />
      <div>
        <b style={{ ...bf(corps), display: "block" }}>{typo(titre)}</b>
        <Petit style={{ marginTop: 8 }}>
          {typo(sous)}
        </Petit>
      </div>
    </div>
  );
}

/** `num()` : rangée « chiffre orange + titre + sous-titre » d'une étape numérotée (le chiffre est posé par le code). */
export function Numero({ n, titre, sous, couleur }: { n: number; titre: string; sous: string; couleur: string }) {
  return (
    <div style={{ display: "flex", gap: 30, alignItems: "center", height: "100%" }}>
      <span style={{ ...bf(110), color: couleur, width: 70, flex: "none" }}>{n}</span>
      <div>
        <b style={{ ...bf(52), display: "block" }}>{typo(titre)}</b>
        <Petit taille={29} style={{ marginTop: 8 }}>
          {typo(sous)}
        </Petit>
      </div>
    </div>
  );
}

/** Pastille ronde à flèche (bouton de la maquette). */
export function BoutonFleche({ taille = 82 }: { taille?: number }) {
  return (
    <span style={{ display: "grid", placeItems: "center", width: taille, height: taille, borderRadius: "50%", background: `linear-gradient(150deg, ${C.orangeLumiere}, ${C.orange})`, color: C.encre }}>
      <Icone nom="arrow" taille={44} epaisseur={2.2} />
    </span>
  );
}

export { alpha, bf };
