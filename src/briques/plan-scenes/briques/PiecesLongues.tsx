/**
 * VL-10 · Rendu des 3 pièces 16:9 d'une vidéo longue (intercalaire de chapitre, schéma de flux ramifié, cadre de capture).
 * Composants PURS (aucun hook, aucun Remotion, aucun Zod) : l'image courante arrive en propriété. Imports relatifs seulement.
 * Couleurs de la charte seulement (ivoire, noir, terracotta, gris), Manrope ; ni bleu ni jaune ; aucune coche.
 */
import type { ReactNode } from "react";
import type { z } from "zod";
import { adoucir, avecOpacite, decelerer, entre, progression } from "../../jetons-motion";
import { BOITE_FLUX, CAPTURE_16_9, TOILES_LONGUES, disposerFluxLarge, type BoiteFlux, type schemaCadreCapture, type schemaFluxRamifie, type schemaIntercalaireChapitre } from "../pieces-longues";
import { BOITE_INCLUSE, apparition, ombre, palette, RACINE, round, type ProprietesBrique } from "./communs";

/** Image d'arrivée de l'élément `rang` sur `total` : l'instant du mot si connu, sinon répartition sur la 1re moitié. */
function imageArrivee(aMs: number | undefined, rang: number, total: number, fps: number, dureeImages: number): number {
  if (aMs !== undefined) return Math.round((aMs * fps) / 1000);
  return Math.round((dureeImages / 2) * (rang / Math.max(1, total)));
}

/** Intercalaire de chapitre : le numéro en grand (accent), le titre à côté ; le tout arrive au mot où le chapitre est annoncé. */
export function IntercalaireChapitre({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<z.infer<typeof schemaIntercalaireChapitre>>) {
  const c = palette(fond, accent);
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  const t = progression(image, debut, 18, decelerer);
  const { largeur, hauteur } = TOILES_LONGUES["intercalaire-chapitre"];
  return (
    <div style={{ ...RACINE, opacity: progression(image, 0, 8, decelerer) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: largeur, height: hauteur, display: "flex", alignItems: "center", gap: 72, padding: "0 120px", ...BOITE_INCLUSE }}>
        <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: t, transform: `translateX(${round(entre(-40, 0, t))}px)` }}>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: c.texteDoux }}>Chapitre</span>
          <span style={{ fontSize: 340, fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", color: c.accent }}>{p.numero}</span>
        </div>
        <div style={{ width: 6, alignSelf: "stretch", margin: "200px 0", borderRadius: 3, background: c.accent, opacity: t, transform: `scaleY(${round(t)})`, transformOrigin: "50% 0%" }} />
        <div style={{ flex: 1, fontSize: 104, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em", color: c.texte, ...apparition(image, debut + 4, 16, 28) }}>{p.titre}</div>
      </div>
    </div>
  );
}

type PFlux = z.infer<typeof schemaFluxRamifie>;
const DUREE_TRACE = 8;

/** Départ et arrivée d'une flèche : milieux des bords qui se font face (toujours de gauche à droite). */
function segment(a: BoiteFlux, b: BoiteFlux): [{ x: number; y: number }, { x: number; y: number }] {
  return [{ x: a.x + a.largeur, y: a.y + a.hauteur / 2 }, { x: b.x, y: b.y + b.hauteur / 2 }];
}

/** Schéma de flux ramifié : chaque étape surgit au mot où elle est dite, la flèche qui y mène se trace juste avant. */
export function FluxRamifie({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<PFlux>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES_LONGUES["flux-ramifie"];
  const boites = disposerFluxLarge(p.noeuds, p.liens);
  const parId = new Map(boites.map((b) => [b.id, b]));
  const arrivees = new Map(p.noeuds.map((n, i) => [n.id, imageArrivee(n.aMs, i, p.noeuds.length, fps, dureeImages)] as const));
  // Étape en cours : la dernière dont l'image d'arrivée est atteinte.
  const courant = [...p.noeuds].reverse().find((n) => (arrivees.get(n.id) ?? 0) <= image)?.id ?? null;
  const noir = c.texte;

  const fleches = p.liens.map((l, i) => {
    const a = parId.get(l.de);
    const b = parId.get(l.vers);
    const finImage = arrivees.get(l.vers);
    if (!a || !b || finImage === undefined) return null;
    const pr = progression(image, finImage - DUREE_TRACE, DUREE_TRACE, adoucir);
    if (pr <= 0) return null;
    const [d, e] = segment(a, b);
    const x = d.x + (e.x - d.x) * pr;
    const y = d.y + (e.y - d.y) * pr;
    const angle = Math.atan2(e.y - d.y, e.x - d.x);
    const pointe = 22;
    const tete = [
      [e.x, e.y],
      [e.x - pointe * Math.cos(angle - 0.45), e.y - pointe * Math.sin(angle - 0.45)],
      [e.x - pointe * Math.cos(angle + 0.45), e.y - pointe * Math.sin(angle + 0.45)],
    ]
      .map((q) => q.map(round).join(","))
      .join(" ");
    return (
      <g key={`${l.de}-${l.vers}-${i}`}>
        <line x1={d.x} y1={d.y} x2={round(x)} y2={round(y)} stroke={noir} strokeWidth={6} strokeLinecap="round" strokeDasharray={l.pointille ? "16 14" : undefined} />
        {pr >= 0.98 ? <polygon points={tete} fill={noir} /> : null}
      </g>
    );
  });

  const blocs = p.noeuds.map((n) => {
    const b = parId.get(n.id);
    const entree = progression(image, (arrivees.get(n.id) ?? 0) - 4, 10, decelerer);
    if (!b || entree <= 0) return null;
    const actif = courant === n.id;
    const fondBloc = n.humain ? c.texte : c.fond;
    const texte = n.humain ? c.fond : c.texte;
    const bordure = actif ? c.accent : n.humain ? c.texte : avecOpacite(c.texte, 0.35);
    return (
      <div
        key={n.id}
        data-bloc={n.id}
        style={{ position: "absolute", left: b.x, top: b.y, width: BOITE_FLUX.largeur, height: BOITE_FLUX.hauteur, ...BOITE_INCLUSE, borderRadius: 28, border: `${actif ? 8 : 5}px solid ${bordure}`, background: fondBloc, color: texte, fontWeight: 700, fontSize: 34, lineHeight: 1.15, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, overflow: "hidden", opacity: entree, transform: `scale(${round(0.94 + 0.06 * entree)})`, boxShadow: ombre(fond) }}
      >
        {n.texte}
      </div>
    );
  });

  return (
    <div style={RACINE}>
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {fleches}
      </svg>
      {blocs}
    </div>
  );
}

/** Cadre de capture : fenêtre sobre dont la zone d'image est en 16:9 ; `enfants` (la capture) se dessinent dedans. */
export function CadreCapture({ image, fps, dureeImages, fond, accent, parametres: p, enfants }: ProprietesBrique<z.infer<typeof schemaCadreCapture>> & { enfants?: ReactNode }) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES_LONGUES["cadre-capture"];
  const { largeur: lz, hauteur: hz, barre, marge } = CAPTURE_16_9;
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  const t = progression(image, debut, 14, adoucir);
  const coin = (haut: boolean, gauche: boolean) => (
    <span key={`${haut}${gauche}`} style={{ position: "absolute", [haut ? "top" : "bottom"]: -8, [gauche ? "left" : "right"]: -8, width: 44, height: 44, ...BOITE_INCLUSE, [haut ? "borderTop" : "borderBottom"]: `6px solid ${c.accent}`, [gauche ? "borderLeft" : "borderRight"]: `6px solid ${c.accent}`, opacity: t }} />
  );
  return (
    <div style={RACINE}>
      <div style={{ position: "absolute", left: marge, top: marge, width: lz, height: barre + hz, borderRadius: 28, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 2px ${c.filet}`, overflow: "hidden", opacity: t, transform: `scale(${round(entre(0.97, 1, t))})`, transformOrigin: `${largeur / 2}px ${hauteur / 2}px` }}>
        <div style={{ height: barre, display: "flex", alignItems: "center", gap: 14, padding: "0 28px", background: c.panneauRelief }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: avecOpacite(c.texte, 0.18) }} />
          ))}
          <span style={{ marginLeft: 18, fontSize: 28, fontWeight: 700, color: c.texte }}>{p.titre}</span>
        </div>
        <div data-zone-capture="16:9" style={{ position: "relative", width: lz, height: hz, background: c.fond }}>
          {enfants}
        </div>
      </div>
      <div style={{ position: "absolute", left: marge, top: marge + barre, width: lz, height: hz, pointerEvents: "none" }}>
        {coin(true, true)}
        {coin(true, false)}
        {coin(false, true)}
        {coin(false, false)}
      </div>
    </div>
  );
}
