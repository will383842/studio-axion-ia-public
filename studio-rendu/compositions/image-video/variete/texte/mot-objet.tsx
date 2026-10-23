import React from "react";
/**
 * TYP-D · Le mot devient l'objet (maquettes TYP-D-1 et TYP-D-2) : le mot arrive à l'heure de son mot dit, le contour
 * de l'objet se trace autour de lui, puis l'objet se remplit et vit (la cloche sonne, l'enveloppe se ferme, l'horloge
 * marque l'heure). Les autres mots de l'écran glissent dessous (TYP-C). Aucun JSX ni calcul au niveau module.
 */
import { accentDe, C, encreDe } from "./commun";
import { rangeesTexte, type DonneesTexte } from "./donnees";
import { RangeesGlissantes } from "./lignes";
import { Cloche, Enveloppe, Horloge, type ProprietesObjet } from "./objets";

/** Durées (s) : contour qui se trace, remplissage. */
const TRACE = 0.6;
const PLEIN = 0.35;

export function MotObjet({ d, t, haut, bas }: { d: DonneesTexte; t: number; haut: number; bas: number }) {
  const o = d.objet!;
  const motObjet = d.lignes[o.ligne].mots[o.mot];
  // Les autres mots de l'écran, sans le mot devenu objet.
  const autres = d.lignes.map((l, k) => ({ ...l, mots: l.mots.filter((_, i) => !(k === o.ligne && i === o.mot)) })).filter((l) => l.mots.length);
  const hObjet = Math.round((bas - haut) * (autres.length ? 0.56 : 0.92));
  const hautLignes = haut + hObjet + 40;
  const rangees = autres.length ? rangeesTexte(autres, hautLignes, bas, 920, 190) : [];
  const deja = motObjet.t <= 1e-3;
  const ecoule = t - motObjet.t;
  const trace = deja ? 1 : Math.max(0, Math.min(1, ecoule / TRACE));
  const plein = deja ? 1 : Math.max(0, Math.min(1, (ecoule - TRACE) / PLEIN));
  const fond = d.fond;
  const remplissage = motObjet.orange ? C.orangeVif : fond === "sombre" ? C.ivoire : C.encre;
  const p: ProprietesObjet = {
    x: 60,
    y: haut,
    l: 960,
    h: hObjet,
    mot: motObjet.mot,
    trace,
    plein,
    trait: motObjet.orange ? accentDe(fond) : encreDe(fond),
    remplissage,
    motSurPlein: remplissage === C.encre ? C.ivoire : C.encre,
    depuis: deja ? 2 : Math.max(0, ecoule - TRACE),
    ...(o.heure ? { heure: o.heure } : {}),
  };
  const visible = ecoule >= 0 || deja;
  return (
    <>
      {visible ? (o.nom === "cloche" ? <Cloche {...p} /> : o.nom === "enveloppe" ? <Enveloppe {...p} /> : <Horloge {...p} />) : null}
      <RangeesGlissantes lignes={autres} rangees={rangees} fond={fond} t={t} haut={hautLignes} bas={bas} />
    </>
  );
}
