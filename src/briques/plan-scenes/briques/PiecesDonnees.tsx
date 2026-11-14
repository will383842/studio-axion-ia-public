/**
 * Pièces « de données » du plan de scènes (GV2-45) : compteur, jauge, avant / après, barres, étapes, liste au mot,
 * citation, repère. Composants PURS (aucun hook, aucun Remotion, aucun Zod) : l'image courante arrive en propriété.
 * Chaque élément apparaît à l'image `aMs × fps / 1000` ; sans `aMs`, les éléments sont répartis à égalité sur la
 * première moitié de la scène. Aucune valeur affichée qui ne soit dans les paramètres.
 */
import type { CSSProperties, ReactNode } from "react";
import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { decelerer, entre, progression } from "../../jetons-motion";
import { BOITE_INCLUSE, apparition, nombreFr, ombre, palette, RACINE, round, type ProprietesBrique } from "./communs";

/** Image d'arrivée de l'élément `rang` sur `total` : l'instant du mot si connu, sinon répartition sur la 1re moitié. */
function imageArrivee(aMs: number | undefined, rang: number, total: number, fps: number, dureeImages: number): number {
  if (aMs !== undefined) return Math.round((aMs * fps) / 1000);
  return Math.round((dureeImages / 2) * (rang / Math.max(1, total)));
}

function decimalesDe(v: number): number {
  const t = String(Math.abs(v));
  const i = t.indexOf(".");
  return i < 0 || t.includes("e") ? 0 : Math.min(2, t.length - i - 1);
}

const DUREE_MONTEE = 18;

function Panneau({ image, fond, accent, largeur, hauteur, enfants, justifier = "center" }: { image: number; fond: ProprietesBrique<unknown>["fond"]; accent?: ProprietesBrique<unknown>["accent"]; largeur: number; hauteur: number; enfants: ReactNode; justifier?: CSSProperties["justifyContent"] }) {
  const c = palette(fond, accent);
  return (
    <div style={{ ...RACINE, ...apparition(image, 0, 10, 24) }}>
      <div style={{ position: "absolute", left: 20, top: 20, width: largeur - 40, height: hauteur - 40, borderRadius: 32, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 2px ${c.filet}`, padding: "36px 48px", ...BOITE_INCLUSE, display: "flex", flexDirection: "column", justifyContent: justifier, gap: 18 }}>
        {enfants}
      </div>
    </div>
  );
}

/** Nombre dit avec son unité : monte en une fois vers la valeur, à l'instant du mot. */
export function Compteur({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"compteur">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.compteur;
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  const t = progression(image, debut, DUREE_MONTEE, decelerer);
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} justifier="space-between" enfants={
      <>
        <div style={{ fontSize: 34, fontWeight: 600, color: c.texteDoux, minHeight: 40 }}>{p.libelle ?? ""}</div>
        <div style={{ fontSize: 170, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", color: c.texte }}>
          {nombreFr(p.valeur * t, decimalesDe(p.valeur))}
          {p.unite && <span style={{ color: c.accent, fontSize: 90, marginLeft: 12 }}>{p.unite}</span>}
        </div>
      </>
    } />
  );
}

/** Part de 0 à 100 dite dans la voix : la jauge se remplit en une fois. */
export function Jauge({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"jauge">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.jauge;
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  const t = progression(image, debut, DUREE_MONTEE, decelerer);
  const pleine = largeur - 40 - 96;
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} justifier="space-between" enfants={
      <>
        <div style={{ fontSize: 34, fontWeight: 600, color: c.texteDoux, minHeight: 40 }}>{p.libelle ?? ""}</div>
        <div style={{ fontSize: 130, fontWeight: 800, lineHeight: 1, color: c.texte }}>
          {nombreFr(p.valeur * t, decimalesDe(p.valeur))}
          <span style={{ color: c.accent, fontSize: 70, marginLeft: 8 }}>%</span>
        </div>
        <div style={{ width: pleine, height: 30, borderRadius: 15, background: c.filet, ...BOITE_INCLUSE }}>
          <div style={{ width: round((pleine * p.valeur * t) / 100), height: 30, borderRadius: 15, background: c.accent }} />
        </div>
      </>
    } />
  );
}

/** Deux valeurs opposées, chacune montrée au mot où elle est dite. */
export function AvantApres({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"avant-apres">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES["avant-apres"];
  const cote = (v: typeof p.avant, nom: string, rang: number, fort: boolean) => {
    const debut = imageArrivee(v.aMs, rang, 2, fps, dureeImages);
    return (
      <div key={nom} style={{ ...apparition(image, debut, 12, 28), flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: c.texteDoux }}>{nom}</div>
        <div style={{ fontSize: 130, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: fort ? c.accent : c.texte }}>
          {nombreFr(v.valeur, decimalesDe(v.valeur))}
          {v.unite && <span style={{ fontSize: 56, marginLeft: 8 }}>{v.unite}</span>}
        </div>
      </div>
    );
  };
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} enfants={
      <>
        {p.titre && <div style={{ fontSize: 36, fontWeight: 700, color: c.texte, textAlign: "center" }}>{p.titre}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {cote(p.avant, "Avant", 0, false)}
          <div style={{ width: 4, alignSelf: "stretch", background: c.filet, borderRadius: 2 }} />
          {cote(p.apres, "Après", 1, true)}
        </div>
      </>
    } />
  );
}

/** 2 à 4 barres comparées, chacune poussant au mot où sa valeur est dite. */
export function Barres({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"barres">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.barres;
  const max = Math.max(...p.barres.map((b) => b.valeur), 1);
  const zone = hauteur - 40 - 72 - 140;
  const dernier = p.barres.length - 1;
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} justifier="flex-end" enfants={
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 28, height: zone + 140 }}>
        {p.barres.map((b, i) => {
          const debut = imageArrivee(b.aMs, i, p.barres.length, fps, dureeImages);
          const t = progression(image, debut, DUREE_MONTEE, decelerer);
          return (
            <div key={`${b.libelle}-${i}`} style={{ flex: 1, textAlign: "center", opacity: progression(image, debut, 8, decelerer) }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: c.texte, minHeight: 56 }}>
                {nombreFr(b.valeur * t, decimalesDe(b.valeur))}
                {p.unite && <span style={{ fontSize: 28, marginLeft: 6, color: c.texteDoux }}>{p.unite}</span>}
              </div>
              <div style={{ margin: "8px auto 0", width: "70%", height: round(zone * (b.valeur / max) * t), borderRadius: 16, background: i === dernier ? c.accent : c.texteDoux }} />
              <div style={{ marginTop: 14, fontSize: 30, fontWeight: 600, color: c.texteDoux }}>{b.libelle}</div>
            </div>
          );
        })}
      </div>
    } />
  );
}

/** Étapes numérotées, chacune apparaissant quand elle est nommée. */
export function Etapes({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"etapes">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.etapes;
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} enfants={
      <>
        {p.elements.map((e, i) => {
          const debut = imageArrivee(e.aMs, i, p.elements.length, fps, dureeImages);
          return (
            <div key={`${e.texte}-${i}`} style={{ ...apparition(image, debut, 12, 28), display: "flex", alignItems: "center", gap: 28 }}>
              <div style={{ width: 76, height: 76, borderRadius: 38, background: c.accent, color: c.fond, fontSize: 40, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 46, fontWeight: 700, color: c.texte, lineHeight: 1.15 }}>{e.texte}</div>
            </div>
          );
        })}
      </>
    } />
  );
}

/** Liste annoncée qui se remplit : une ligne par mot dit. */
export function ListeAuMot({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"liste-au-mot">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES["liste-au-mot"];
  return (
    <Panneau image={image} fond={fond} accent={accent} largeur={largeur} hauteur={hauteur} enfants={
      <>
        {p.titre && <div style={{ fontSize: 40, fontWeight: 800, color: c.texte, marginBottom: 6 }}>{p.titre}</div>}
        {p.elements.map((e, i) => {
          const debut = imageArrivee(e.aMs, i, p.elements.length, fps, dureeImages);
          return (
            <div key={`${e.texte}-${i}`} style={{ ...apparition(image, debut, 12, 28), display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: c.accent, flexShrink: 0 }} />
              <div style={{ fontSize: 44, fontWeight: 600, color: c.texte, lineHeight: 1.15 }}>{e.texte}</div>
            </div>
          );
        })}
      </>
    } />
  );
}

/** Phrase rapportée, avec son auteur. */
export function Citation({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"citation">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.citation;
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  const t = progression(image, debut, 14, decelerer);
  return (
    <div style={{ ...RACINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: t, transform: `translateY(${round(entre(24, 0, t))}px)`, width: largeur - 80, maxHeight: hauteur - 40, ...BOITE_INCLUSE, borderLeft: `10px solid ${c.accent}`, paddingLeft: 40 }}>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em", color: c.texte }}>« {p.texte} »</div>
        {p.auteur && <div style={{ marginTop: 22, fontSize: 32, fontWeight: 600, color: c.texteDoux }}>{p.auteur}</div>}
      </div>
    </div>
  );
}

const GENRES: Record<ParametresPiece<"repere">["genre"], string> = { lieu: "Lieu", date: "Date", duree: "Durée" };

/** Lieu, date ou durée : repère court posé au moment où il est dit. */
export function Repere({ image, fps, dureeImages, fond, accent, parametres: p }: ProprietesBrique<ParametresPiece<"repere">>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.repere;
  const debut = imageArrivee(p.aMs, 0, 1, fps, dureeImages);
  return (
    <div style={{ ...RACINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...apparition(image, debut, 12, 24), maxWidth: largeur - 40, maxHeight: hauteur - 20, ...BOITE_INCLUSE, padding: "22px 44px", borderRadius: 999, background: c.panneau, boxShadow: `0 0 0 2px ${c.filet}`, display: "flex", alignItems: "center", gap: 22 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: c.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>{GENRES[p.genre]}</span>
        <span style={{ fontSize: 64, fontWeight: 800, color: c.texte, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{p.texte}</span>
      </div>
    </div>
  );
}
