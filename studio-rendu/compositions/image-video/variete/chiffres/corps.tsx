import React from "react";
/**
 * Corps de l'écran « chiffres » (lot CHI) : fond de la charte ; la variante montre le chiffre focal sur son mot ; quand
 * le chiffre suivant du bandeau arrive, elle rapetisse vers le haut et les autres chiffres claquent dessous, sur leur
 * mot (pile) ; objets d'appoint sous les sous-titres (9:16) ; marque. Rendu par `ecran.tsx` (bloc de variété) et par
 * `calque.tsx` (bandeau d'un bloc à plusieurs moments).
 */
import { AbsoluteFill } from "remotion";
import { Fond } from "../../../cas-concret/socle/Fond";
import { Entete } from "../../Entete";
import { Anneau, AppointAnneau, geometrieAnneau } from "./anneau";
import type { DonneesEcranChiffresRendu } from "./donnees";
import { AppointDuel, Duel, planDuel } from "./duel";
import { AppointGeant, Geant, planGeant } from "./geant";
import { AppointObjets, Objets, TAILLE_OBJETS } from "./objets";
import { c01, cadreChiffres, Etiquette } from "./outils";
import { echelleVariante, Pile, rangeesOuvertes } from "./pile";

/** Taille du chiffre focal à l'échelle 1, selon la variante. */
function tailleFocale(d: DonneesEcranChiffresRendu, cadre: ReturnType<typeof cadreChiffres>): number {
  switch (d.code) {
    case "CHI-B":
      return geometrieAnneau(cadre).taille;
    case "CHI-C":
      return planDuel(d, cadre).finale;
    case "CHI-D":
      return planGeant(d, cadre).taille;
    case "CHI-E":
      return TAILLE_OBJETS;
  }
}

export function CorpsChiffres({ d, t, hauteur, marque }: { d: DonneesEcranChiffresRendu; t: number; hauteur: number; marque: "axion-ia.com" }) {
  const cadre = cadreChiffres(hauteur);
  const t0 = Math.max(d.debut, d.chiffres[d.focal]?.t ?? d.debut);
  const k = rangeesOuvertes(d, t);
  const focale = tailleFocale(d, cadre);
  const echelle = echelleVariante(d, cadre, k, focale);
  // Variante rangée : ses petits textes (légendes, chiffre du reste) s'effacent, ils passeraient sous 58 px.
  const discret = c01(k);
  // Le géant n'a pas d'étiquette (il monte jusqu'à la limite haute), les autres la gardent.
  const avecEtiquette = !!d.etiquette && d.code !== "CHI-D";
  return (
    <AbsoluteFill style={{ width: 1080, height: hauteur, overflow: "hidden" }}>
      <Fond fond={d.fond} largeur={1080} hauteur={hauteur} />
      {avecEtiquette ? <Etiquette t={d.etiquette!} fond={d.fond} y={cadre.etiquetteY} /> : null}
      <AbsoluteFill style={{ transform: `scale(${echelle})`, transformOrigin: `540px ${cadre.haut}px` }}>
        {d.code === "CHI-B" ? <Anneau d={d} t={t} t0={t0} cadre={cadre} discret={discret} /> : null}
        {d.code === "CHI-C" ? <Duel d={d} t={t} t0={t0} cadre={cadre} discret={discret} echelle={echelle} /> : null}
        {d.code === "CHI-D" ? <Geant d={d} t={t} t0={t0} cadre={cadre} discret={discret} /> : null}
        {d.code === "CHI-E" ? <Objets d={d} t={t} t0={t0} cadre={cadre} discret={discret} /> : null}
      </AbsoluteFill>
      <Pile d={d} t={t} cadre={cadre} tailleFocale={focale} />
      {d.code === "CHI-B" ? <AppointAnneau d={d} t={t} t0={t0} cadre={cadre} /> : null}
      {d.code === "CHI-C" ? <AppointDuel cadre={cadre} /> : null}
      {d.code === "CHI-D" ? <AppointGeant t={t} t0={t0} cadre={cadre} /> : null}
      {d.code === "CHI-E" ? <AppointObjets d={d} cadre={cadre} /> : null}
      <Entete entete={null} ecoule={0} sortie={0} fond={d.fond} marque={marque} largeur={1080} hauteur={hauteur} />
    </AbsoluteFill>
  );
}
