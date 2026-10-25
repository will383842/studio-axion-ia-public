/**
 * Primitives de la maquette v3, portées en fonctions React : `ic()` → `Icone`, `tile()` → `Tuile`, `sph()` → `Sphere`, `spk()` → `Etincelle`,
 * `.card` et variantes → `Carte`, `.pill` → `Pastille`, `.bub` → `Bulle`, `.tg` → `Interrupteur`, `.tagx` → `Etiquette`, `T()`/`P()` → `Titre`/`Texte`.
 * Couleurs : jetons de `CHARTE_CONTINU` seulement (les `rgba` de la maquette deviennent `alpha(jeton, a)`).
 */
import { useId, type CSSProperties, type ReactNode } from "react";
import { alpha, CHARTE_CONTINU as C, DEGRADES_CONTINU as D } from "../../../../../src/briques/visuels/charte-carrousel";
import { ATTRIBUT_DESSIN } from "../../commun/zones";
import { FAMILLE_BRICOLAGE, FAMILLE_INSTRUMENT, TAILLES_CONTINU } from "../constantes-continu";
import { FAMILLE_INTER } from "../polices-continu";
import { ICONES_CONTINU, type NomIconeContinu } from "./icones-continu";

/** Ombre portée chaude de la maquette (brun 70, 30, 8) : rouille assombrie d'encre. */
export function ombre(a: number): string {
  return alpha(`color-mix(in srgb, ${C.rouille} 50%, ${C.encre})`, a);
}

export const POLICE_TITRE = `"${FAMILLE_BRICOLAGE}", sans-serif`;
export const POLICE_SERIF = `"${FAMILLE_INSTRUMENT}", serif`;
export const POLICE_TEXTE = `"${FAMILLE_INTER}", sans-serif`;

/** Police d'un texte, en propriétés séparées (graisse, corps en px, interligne, famille, italique). */
export function police(poids: number, taille: number, interligne: number, famille: string, italique = false): CSSProperties {
  return { fontWeight: poids, fontSize: taille, lineHeight: interligne, fontFamily: famille, fontStyle: italique ? "italic" : "normal" };
}

/** `ic(n, s, c, w)` : icône duotone, traits à `epaisseur`, forme pleine teintée à 24 %. */
export function Icone({ nom, taille, couleur = "currentColor", epaisseur = 1.8 }: { nom: NomIconeContinu; taille: number; couleur?: string; epaisseur?: number }) {
  const d = ICONES_CONTINU[nom];
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }} aria-hidden>
      {d.f ? <path d={d.f} fill={couleur} fillOpacity={0.24} /> : null}
      {d.s ? <path d={d.s} /> : null}
    </svg>
  );
}

export type VarianteTuile = keyof typeof D.tuile;
const ENCRE_TUILE: Record<VarianteTuile, string> = { o: C.ecume, k: C.orangeLumiere, w: C.orange, p: C.orangeBrule, g: C.creme };

/** `tile(n, sz, v)` : tuile en relief (rayon 30 %, biseau bas, ombre portée), icône à 54 %. */
export function Tuile({ icone, taille, variante = "o", style }: { icone: NomIconeContinu; taille: number; variante?: VarianteTuile; style?: CSSProperties }) {
  const r = Math.round(taille * 0.3);
  const biseau = Math.round(taille * 0.05);
  const ombres = [
    `inset 0 2px 0 ${alpha(C.blancCarte, variante === "k" ? 0.18 : 0.6)}`,
    `inset 0 -${biseau}px 0 ${alpha(C.encre, 0.13)}`,
    ...(variante === "g" ? [`inset 0 0 0 1.5px ${alpha(C.creme, 0.22)}`] : []),
    `0 ${Math.round(taille * 0.22)}px ${Math.round(taille * 0.3)}px -${Math.round(taille * 0.12)}px ${ombre(0.5)}`,
  ];
  return (
    <span {...{ [ATTRIBUT_DESSIN]: "" }} style={{ display: "grid", placeItems: "center", flex: "none", width: taille, height: taille, borderRadius: r, background: D.tuile[variante], color: ENCRE_TUILE[variante], boxShadow: ombres.join(","), ...style }}>
      <Icone nom={icone} taille={Math.round(taille * 0.54)} epaisseur={1.7} />
    </span>
  );
}

/** `sph(r, dark)` : sphère en dégradé radial, reflet elliptique, ombre portée (dégradés et filtre propres à chaque sphère). */
export function Sphere({ rayon, sombre = false }: { rayon: number; sombre?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const d = rayon * 2;
  const arrets = sombre
    ? [[0, C.brunPierre], [0.5, C.encreDouce], [1, C.nuit]]
    : [[0, C.abricot], [0.38, C.orangeClair], [0.78, C.cuivre], [1, C.rouille]];
  return (
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ display: "block", overflow: "visible" }} aria-hidden>
      <defs>
        <radialGradient id={`s${id}`} cx="34%" cy="28%" r="78%">
          {arrets.map(([o, c]) => <stop key={String(o)} offset={o} stopColor={String(c)} />)}
        </radialGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.blancCarte} stopOpacity={0.75} />
          <stop offset="1" stopColor={C.blancCarte} stopOpacity={0.12} />
        </linearGradient>
        <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy={rayon * 0.12} stdDeviation={rayon * 0.1} floodColor={C.rouille} floodOpacity={0.34} />
        </filter>
      </defs>
      <circle cx={rayon} cy={rayon} r={rayon * 0.98} fill={`url(#s${id})`} filter={`url(#f${id})`} />
      <ellipse cx={rayon * 0.62} cy={rayon * 0.46} rx={rayon * 0.34} ry={rayon * 0.2} fill={`url(#g${id})`} transform={`rotate(-28 ${rayon * 0.62} ${rayon * 0.46})`} />
    </svg>
  );
}

/** `spk(x, y, s, c)` : étincelle à quatre branches (sans position : le parent la place). */
export function Etincelle({ taille, couleur = C.orange }: { taille: number; couleur?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12 6.5-.6 11.4-5.5 12-12z" fill={couleur} />
    </svg>
  );
}

/** `ab(st, h)` : élément posé en absolu. */
export function Pose({ x, y, rotation, children, style }: { x: number; y: number; rotation?: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: x, top: y, transform: rotation ? `rotate(${rotation}deg)` : undefined, ...style }}>{children}</div>;
}

export type VarianteCarte = "" | "k" | "o" | "pl" | "c" | "glass";

function styleCarte(v: VarianteCarte): CSSProperties {
  switch (v) {
    case "k":
      return { background: D.carte.k, color: C.creme, boxShadow: `inset 0 2px 0 ${alpha(C.blancCarte, 0.12)}, 0 44px 60px -34px ${alpha(C.nuit, 0.7)}` };
    case "o":
      return { background: D.carte.o, color: C.encre, boxShadow: `inset 0 2px 0 ${alpha(C.blancCarte, 0.4)}, 0 44px 60px -34px ${ombre(0.6)}` };
    case "pl":
      return { background: D.carte.pl, boxShadow: `0 0 0 1.5px ${alpha(C.encre, 0.06)}, 0 44px 60px -34px ${ombre(0.42)}` };
    case "c":
      return { background: C.creme2, boxShadow: "none" };
    case "glass":
      return { background: `linear-gradient(160deg, ${alpha(C.blancCarte, 0.14)}, ${alpha(C.blancCarte, 0.04)})`, color: C.creme, boxShadow: `inset 0 0 0 1.5px ${alpha(C.creme, 0.18)}, inset 0 2px 0 ${alpha(C.blancCarte, 0.2)}` };
    default:
      return { background: C.blancCarte, boxShadow: `0 0 0 1.5px ${alpha(C.encre, 0.06)}, inset 0 2px 0 ${alpha(C.blancCarte, 0.9)}, 0 44px 60px -34px ${ombre(0.42)}` };
  }
}

/** `.card` : carte arrondie (44 px), fond blanc chaud ; variantes `k` (sombre), `o` (orange), `pl` (pêche), `c` (crème), `glass`. */
export function Carte({ variante = "", style, children }: { variante?: VarianteCarte; style?: CSSProperties; children: ReactNode }) {
  return <div style={{ borderRadius: 44, padding: 40, position: "relative", ...styleCarte(variante), ...style }}>{children}</div>;
}

/** `.pill` : pastille blanche, icône à gauche. */
export function Pastille({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", gap: 14, alignItems: "center", borderRadius: 999, padding: "16px 26px 16px 18px", ...police(700, TAILLES_CONTINU.pill, 1, POLICE_TEXTE), background: C.blancCarte, boxShadow: `0 0 0 1.5px ${alpha(C.encre, 0.06)}, 0 20px 30px -18px ${ombre(0.45)}`, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

/** `.bub` : bulle de conversation, `l` (reçue), `r` (envoyée, sombre), `ro` (envoyée, orange). */
export function Bulle({ cote, children }: { cote: "l" | "r" | "ro"; children: ReactNode }) {
  const base: CSSProperties = { borderRadius: 34, padding: "26px 32px", ...police(500, TAILLES_CONTINU.bub, 1.3, POLICE_TEXTE), maxWidth: 760 };
  const variantes: Record<typeof cote, CSSProperties> = {
    l: { background: C.blancCarte, borderBottomLeftRadius: 10, boxShadow: `0 0 0 1.5px ${alpha(C.encre, 0.06)}, 0 20px 30px -20px ${ombre(0.4)}` },
    r: { background: C.encre, color: C.creme, borderBottomRightRadius: 10, alignSelf: "flex-end" },
    ro: { background: D.bouton, color: C.encre, borderBottomRightRadius: 10, alignSelf: "flex-end" },
  };
  return <div style={{ ...base, ...variantes[cote] }}>{children}</div>;
}

/** `.tg` : interrupteur (104 × 60), allumé en dégradé orange. */
export function Interrupteur({ allume }: { allume: boolean }) {
  return (
    <span style={{ width: 104, height: 60, borderRadius: 30, background: allume ? D.bouton : C.lin, position: "relative", flex: "none", display: "block", boxShadow: `inset 0 3px 6px ${alpha(C.encre, 0.18)}` }}>
      <span style={{ position: "absolute", left: allume ? 50 : 6, top: 6, width: 48, height: 48, borderRadius: "50%", background: C.blancCarte, boxShadow: `0 4px 10px ${alpha(C.encre, 0.25)}` }} />
    </span>
  );
}

/** `.tagx` : étiquette pêche en capitales (26 px au lieu de 22 : plancher mesuré). */
export function Etiquette({ children }: { children: ReactNode }) {
  return <span style={{ display: "inline-flex", alignSelf: "flex-start", ...police(700, TAILLES_CONTINU.tagx, 1, POLICE_TEXTE), letterSpacing: "0.07em", textTransform: "uppercase", padding: "12px 18px", borderRadius: 12, background: C.peche, color: C.encre }}>{children}</span>;
}

/** `.t` : grand titre Bricolage 800 ; `accent` en Instrument Serif italique orange (grands titres seulement, ≥ 64 px). */
export function Titre({ taille, texte, accent, sombre = false, style }: { taille: number; texte: string; accent?: string; sombre?: boolean; style?: CSSProperties }) {
  return (
    <h1 style={{ ...police(800, taille, 0.94, POLICE_TITRE), letterSpacing: "-0.045em", wordSpacing: "0.08em", margin: 0, textWrap: "balance", color: sombre ? C.creme : C.encre, ...style }}>
      {texte}
      {accent ? (
        <>
          {" "}
          <em style={{ ...police(400, Math.round(taille * 1.1), 0.9, POLICE_SERIF, true), letterSpacing: "-0.015em", color: C.orange, wordSpacing: 0 }}>{accent}</em>
        </>
      ) : null}
    </h1>
  );
}

/** `.p` : texte courant Inter 500, 38 px. */
export function Texte({ children, sombre = false, taille = TAILLES_CONTINU.p, style }: { children: ReactNode; sombre?: boolean; taille?: number; style?: CSSProperties }) {
  return <p style={{ ...police(500, taille, 1.32, POLICE_TEXTE), color: sombre ? C.sableSombre : C.grisTexte, margin: 0, ...style }}>{children}</p>;
}

/** `.lb` : libellé en capitales (26 px au lieu de 24). */
export function Libelle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...police(700, TAILLES_CONTINU.lb, 1, POLICE_TEXTE), letterSpacing: "0.1em", textTransform: "uppercase", ...style }}>{children}</span>;
}

/** Coupe un titre avant son dernier mot : le dernier mot (avec sa ponctuation) devient l'accent en serif. PUR. */
export function separerAccent(titre: string): { texte: string; accent?: string } {
  const i = titre.trimEnd().search(/\s+\S+(?:\s*[?!:;.…]+)?$/);
  if (i <= 0) return { texte: titre };
  return { texte: titre.slice(0, i), accent: titre.slice(i).trim() };
}
