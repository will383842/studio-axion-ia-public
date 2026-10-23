import React from "react";
/**
 * K01 · Toile : grande surface (jusqu'à 3 × 3 écrans) où le schéma est posé une fois, disposé par
 * `disposerToile` (pur). Les nœuds sont absents tant que leur mot n'est pas dit, puis grisés à 35 % une fois vus ; les
 * flèches se dessinent sous les cartes. Sa vue d'ensemble est la scène dédiée « Ensemble » (K21, `Ensemble.tsx`).
 *
 * Variété (lot APP-MAT, lue par `useVariete()` ; sans variété, ou en APP-A et MAT-A : rendu de référence inchangé) :
 * APP-B/APP-D posent la place de la carte suivante ; APP-C montre tout le schéma éteint dès le début (cartes et fils
 * pâles) ; MAT-C fait trembler les fils ; MAT-D pose les cartes sur des plateaux en relief.
 */
import type { SchemaEntree } from "../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { Embranchement } from "./Embranchement";
import { FlecheCourbe } from "./FlecheCourbe";
import { Noeud } from "./Noeud";
import { cheminDe, etatFleche, etatNoeud, partsEmbranchement, railSuite, RAYON_PASTILLE, TEMPS_IV, type EtatNoeud, type SceneCalculee } from "./plan";
import { apparitionDe, progresDe, type ApparitionIV } from "./variete/apparition/apparition";
import { FilsEteints, Place } from "./variete/apparition/Place";
import { useVariete } from "./variete/ContexteVariete";
import { Plateaux } from "./variete/matiere/Plateaux";
import { matiereDe } from "./variete/matiere/trait";
import { FiltreTremble, TREMBLE_FILS } from "./variete/matiere/Tremble";

/** Une carte déjà vue avant cette séquence (APP-C) : posée, grisée. */
const ETAT_VU: EtatNoeud = { entree: 1, etat: "vu", coche: 0 };

/** Début d'apparition de chaque nœud dit (son mot, moins l'avance), dans l'ordre. */
function debuts(scene: SceneCalculee): [string, number][] {
  return [...scene.premierMot.entries()].map(([id, t0]) => [id, t0 - TEMPS_IV.avanceNoeud] as [string, number]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

/** APP-B / APP-D : la carte suivante (pas encore apparue) et l'opacité de sa place (après la pose de la précédente). */
function placeSuivante(scene: SceneCalculee, t: number): { id: string; opacite: number } | null {
  const d = debuts(scene);
  const k = d.findIndex(([, t0]) => t0 > t);
  if (k < 0) return null;
  const precedent = k > 0 ? d[k - 1][1] + TEMPS_IV.surgir : 0;
  return { id: d[k][0], opacite: progresDe(t, precedent, 0.3) };
}

export function Toile({ scene, schema, t }: { scene: SceneCalculee; schema: SchemaEntree; t: number }) {
  const variete = useVariete();
  const app: ApparitionIV | null = apparitionDe(variete);
  const mat = matiereDe(variete);
  const { toile, parId } = scene;
  const icones = new Map(schema.noeuds.map((n) => [n.id, n.icone]));
  const etiquettes = new Map(schema.liens.map((l) => [l.id, l.etiquette]));
  const decisions = [...scene.separation.keys()].filter((id) => parId.has(id)).sort();
  const fleches = toile.fleches.map((f) => {
    const chemin = cheminDe(scene, f);
    if (!chemin) return null;
    // Les parts d'un embranchement sont portées par ses pastilles, pas par une étiquette sur la flèche.
    const etiquette = scene.separation.has(f.de) && scene.colonne.get(f.vers) ? undefined : etiquettes.get(f.id);
    return <FlecheCourbe key={f.id} id={f.id} chemin={chemin} couleur={f.couleur} style={f.style} etat={etatFleche(scene, f, t)} etiquette={etiquette} />;
  });
  const place = app && app.code !== "APP-C" ? placeSuivante(scene, t) : null;
  const boitePlace = place ? parId.get(place.id) : undefined;
  // MAT-D : un plateau paraît avec la première carte de sa colonne (fondu le temps qu'elle surgisse).
  const opacitePlateau = (colonne: string) =>
    Math.max(0, ...toile.boites.filter((b) => (b.colonne ?? "") === colonne).map((b) => (app?.code === "APP-C" ? 1 : progresDe(t, (scene.premierMot.get(b.id) ?? Infinity) - TEMPS_IV.avanceNoeud, TEMPS_IV.surgir))));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: toile.largeur, height: toile.hauteur }}>
      {mat === "MAT-D" ? <Plateaux boites={toile.boites} opacite={opacitePlateau} /> : null}
      {mat === "MAT-C" ? <FiltreTremble id={TREMBLE_FILS} echelle={7} frequence={0.03} /> : null}
      <svg width={toile.largeur} height={toile.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {app?.code === "APP-C" ? <FilsEteints chemins={toile.fleches.flatMap((f) => (parId.has(f.de) && parId.has(f.vers) ? [{ id: f.id, d: cheminDe(scene, f)!.d }] : []))} /> : null}
        {mat === "MAT-C" ? <g filter={`url(#${TREMBLE_FILS})`}>{fleches}</g> : fleches}
      </svg>
      {place && boitePlace ? <Place boite={boitePlace} icone={icones.get(place.id)} code={app!.code} opacite={place.opacite} /> : null}
      {toile.boites.map((b) => {
        const t0 = scene.premierMot.get(b.id);
        const vu = app?.code === "APP-C" && t0 === undefined && app.vus.has(b.id);
        return (
          <Noeud
            key={b.id}
            boite={b}
            icone={icones.get(b.id)}
            etat={vu ? ETAT_VU : etatNoeud(scene, b.id, t)}
            ecoule={t0 === undefined ? 99 : t - (t0 - TEMPS_IV.avanceNoeud)}
            fantome={app?.code === "APP-C" && app.fantomes.has(b.id)}
          />
        );
      })}
      {decisions.map((d) => (
        <Embranchement key={d} decision={parId.get(d)!} parts={partsEmbranchement(scene, d, t)} />
      ))}
    </div>
  );
}

/**
 * Lot G · couleurs du schéma muet : une carte éteinte se voit sur le fond (ivoire : beige plus soutenu que la place
 * d'APP-D ; nuit : brun clair, comme la silhouette de CAM-B) ; sa pastille et ses fils sont plus pâles.
 */
export const COULEURS_MUET = Object.freeze({
  ivoire: Object.freeze({ carte: "#D6C7B3", pastille: COULEURS_DUO.grisClair, fil: "#D8CBBA" }),
  sombre: Object.freeze({ carte: "#6E625A", pastille: "#8A7C70", fil: "#4A3E36" }),
});

/**
 * Lot G · le SCHÉMA MUET, sous la toile : le reste du schéma en cartes éteintes, SANS AUCUN TEXTE (rien n'est montré
 * avant d'être dit). `futurs` : les cartes pas encore dites (elles s'effacent quand la vraie carte surgit par-dessus)
 * et les fils qui y mènent ; `dits` : les cartes déjà dites, en silhouette (au-dessus de la toile, sous l'en-tête, où
 * leur texte serait coupé). Pixels de toile, dans la même caméra que la toile.
 */
export function SchemaMuet({ scene, schema, t, fond, mode }: { scene: SceneCalculee; schema: SchemaEntree; t: number; fond: "ivoire" | "sombre"; mode: "futurs" | "dits" }) {
  const { toile, parId } = scene;
  const c = COULEURS_MUET[fond];
  const icones = new Map(schema.noeuds.map((n) => [n.id, n.icone]));
  const visible = (id: string) => (mode === "dits" ? etatNoeud(scene, id, t).entree : 1 - etatNoeud(scene, id, t).entree);
  const fils = toile.fleches.flatMap((f) => {
    const ch = parId.has(f.de) && parId.has(f.vers) ? cheminDe(scene, f) : null;
    const o = visible(f.vers);
    return ch && o > 0 ? [<path key={f.id} d={ch.d} fill="none" stroke={c.fil} strokeWidth={7} strokeLinecap="round" opacity={o} />] : [];
  });
  const r = RAYON_PASTILLE;
  return (
    <div data-schema-muet={mode} style={{ position: "absolute", left: 0, top: 0, width: toile.largeur, height: toile.hauteur }}>
      <svg width={toile.largeur} height={toile.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {fils}
      </svg>
      {toile.boites.map((b) => {
        const o = visible(b.id);
        if (o <= 0) return null;
        return (
          <div key={b.id} style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, opacity: o }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 34, background: c.carte }} />
            {icones.get(b.id) ? <div style={{ position: "absolute", left: -2 * r + 30, top: b.hauteur / 2 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: c.pastille }} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Lot G · RAIL DES CARTES SUIVANTES (zone d'appoint du 9:16, sous les sous-titres ; `railSuite`) : cartes muettes, sans
 * texte. À venir : éteinte (couleurs du schéma muet) ; déjà dite : blanche, pastille sombre. Pixels de l'écran de référence.
 */
export function RailSuite({ scene, schema, t, fond, place, opacite }: { scene: SceneCalculee; schema: SchemaEntree; t: number; fond: "ivoire" | "sombre"; place: { haut: number; hauteur: number }; opacite: number }) {
  if (opacite <= 0) return null;
  const c = COULEURS_MUET[fond];
  const icones = new Map(schema.noeuds.map((n) => [n.id, n.icone]));
  const r = Math.min(RAYON_PASTILLE, place.hauteur / 2 - 14);
  return (
    <div data-rail="" style={{ position: "absolute", left: 0, top: place.haut, width: 1080, height: place.hauteur, overflow: "hidden", opacity: opacite }}>
      {railSuite(scene, { schema }, t).map((k) => {
        const dite = k.etat !== "absent";
        const icone = icones.get(k.id);
        return (
          <div key={k.id} data-carte-rail={k.id} style={{ position: "absolute", left: k.x, top: 0, width: k.largeur, height: place.hauteur, opacity: k.opacite }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 34, background: dite ? COULEURS_DUO.blanc : c.carte, boxShadow: dite ? `0 14px 34px ${teinte(COULEURS_DUO.encre, 0.1)}` : undefined }} />
            <div
              style={{
                position: "absolute",
                left: k.largeur / 2 - r,
                top: place.hauteur / 2 - r,
                width: 2 * r,
                height: 2 * r,
                borderRadius: "50%",
                background: dite ? COULEURS_DUO.encre : c.pastille,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icone ? <Icone nom={icone} taille={r * 1.1} couleur={dite ? COULEURS_DUO.blanc : COULEURS_DUO.ivoire} epaisseur={2.6} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
