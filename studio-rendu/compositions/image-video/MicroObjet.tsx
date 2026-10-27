import React from "react";
/**
 * K11 · MicroObjet (lot L9b) : une petite scène dessinée qui JOUE un bénéfice, choisie dans la banque FERMÉE des 12
 * (`src/briques/schema-motion/micro-objets.ts`). Les 12 dessins sont dans `micro-objets/`, au trait, dans le style des
 * dessins maison ; aucun ne porte de texte.
 *
 * Aussi : `GalerieMicroObjets` (images fixes des images A et B, et la banque entière, pour que Will juge à l'image sans
 * rien payer). NON inscrite dans `Racine.tsx` avant le lot L17 ; `CompositionsMicroObjets` la déclare pour ce moment-là.
 * Aucun JSX ni calcul au niveau module : l'aiguillage nom → dessin est une FONCTION (jamais une table d'éléments).
 */
export * from "./donnees-galerie-micro";
import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import type { Fond as NomFond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { MICRO_OBJETS, microObjet, type NomMicroObjet } from "../../../src/briques/schema-motion/micro-objets";
import { chargerPoliceAnton, chargerPoliceTitre } from "../commune/polices";
import { Fond } from "../cas-concret/socle/Fond";
import { couleursDuFond, doux, famille, graisse, progres, teinte } from "../cas-concret/plans/commun";
import { EnteteVarie } from "./variete/entete/EnteteVarie";
import { TemoinSousTitres } from "./TemoinSousTitres";
import { beneficesGalerie, COMPOSITIONS_MICRO_OBJETS, metaGalerieMicro, planBanqueMicro, planListeMicro, proprietesGalerieMicro, RYTHME_GALERIE_MICRO, type ProprietesGalerieMicro } from "./donnees-galerie-micro";
import type { ProprietesMicroObjet } from "./micro-objets/commun";
import { BoutonDecider } from "./micro-objets/BoutonDecider";
import { Calendrier } from "./micro-objets/Calendrier";
import { Cible } from "./micro-objets/Cible";
import { Course } from "./micro-objets/Course";
import { Engrenages } from "./micro-objets/Engrenages";
import { Escalier } from "./micro-objets/Escalier";
import { GrapheMonte } from "./micro-objets/GrapheMonte";
import { HorlogeEnvers } from "./micro-objets/HorlogeEnvers";
import { Jauge } from "./micro-objets/Jauge";
import { PostIt } from "./micro-objets/PostIt";
import { TachesCochees } from "./micro-objets/TachesCochees";
import { Tirelire } from "./micro-objets/Tirelire";

/** Le dessin d'un micro-objet (une fonction composant). Le `switch` est exhaustif : un nom de plus casse le typage. */
export function dessinMicroObjet(nom: NomMicroObjet): (p: ProprietesMicroObjet) => React.ReactElement {
  switch (nom) {
    case "horloge-envers":
      return HorlogeEnvers;
    case "taches-cochees":
      return TachesCochees;
    case "post-it":
      return PostIt;
    case "jauge":
      return Jauge;
    case "tirelire":
      return Tirelire;
    case "cible":
      return Cible;
    case "graphe-monte":
      return GrapheMonte;
    case "bouton-decider":
      return BoutonDecider;
    case "course":
      return Course;
    case "escalier":
      return Escalier;
    case "calendrier":
      return Calendrier;
    case "engrenages":
      return Engrenages;
  }
}

/** Un micro-objet posé : `t` = secondes depuis son apparition (avant 0 : rien), `taille` en pixels. */
export function MicroObjet({ nom, t, taille, fond }: { nom: NomMicroObjet; t: number; taille: number; fond: NomFond }) {
  microObjet(nom); // nom hors banque : erreur explicite, jamais de dessin par défaut
  if (t < 0) return null;
  // Appel direct (les dessins n'ont aucun crochet) : aucun composant créé pendant le rendu.
  return dessinMicroObjet(nom)({ t, taille, fond });
}

/* ------------------------------------------------------------------ */
/* Galerie (K20, part L9b) : images A et B, et la banque entière        */
/* ------------------------------------------------------------------ */


export function GalerieMicroObjets(p: ProprietesGalerieMicro) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const t = useCurrentFrame() / p.fps;
  const entete =
    p.liste === "banque"
      ? { debut: 0, fin: 99, etiquette: "Les 12 petits dessins", titre: "Ce qui *bouge*" }
      : { debut: 0, fin: 99, etiquette: p.liste === "A" ? "Formation Axion-IA" : "Vous gagnez. Concrètement.", titre: "Ce que vous *gagnez*" };
  return (
    <AbsoluteFill>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ transform: `scale(${p.largeur / 1080})`, transformOrigin: "0 0", width: 1080, height: 1920 }}>
        {p.liste === "banque" ? <GrilleBanque t={t} fond={p.fond} /> : <ListeBenefices liste={p.liste} t={t} fond={p.fond} />}
      </AbsoluteFill>
      <EnteteVarie entete={entete} ecoule={t} sortie={0} fond={p.fond} marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ transform: `scale(${p.largeur / 1080})`, transformOrigin: "0 0", width: 1080, height: 1920 }}>
        <TemoinSousTitres texte={entete.titre} fond={p.fond} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Cinq cartes en colonne (comme l'image A), chacune avec son micro-objet qui joue à son tour. */
function ListeBenefices({ liste, t, fond }: { liste: "A" | "B"; t: number; fond: NomFond }) {
  const c = couleursDuFond(fond);
  const r = RYTHME_GALERIE_MICRO;
  const sombre = fond === "sombre";
  const g = planListeMicro(beneficesGalerie(liste).length);
  return (
    <>
      {beneficesGalerie(liste).map((b, i) => {
        const debut = r.premiere + r.pas * i;
        const x = doux(progres(t, debut, 0.35));
        const actif = t >= debut && t < debut + r.pas;
        const l = g.lignes[i];
        // Avant son tour, la rangée est déjà là en creux (pointillés) : la liste occupe toute la zone dès le début.
        if (x <= 0) return <div key={b.nom} style={{ position: "absolute", left: l.x, top: l.y, width: l.largeur, height: l.hauteur, boxSizing: "border-box", borderRadius: 34, border: `4px dashed ${teinte(c.texte, 0.18)}` }} />;
        return (
          <div
            key={b.nom}
            style={{
              position: "absolute",
              left: l.x,
              top: l.y,
              width: l.largeur,
              height: l.hauteur,
              boxSizing: "border-box",
              borderRadius: 34,
              background: sombre ? teinte(COULEURS_DUO.nuitHaut, 0.9) : COULEURS_DUO.blanc,
              border: `${actif ? 6 : 0}px solid ${c.accent}`,
              boxShadow: `0 18px 44px ${teinte(COULEURS_DUO.encre, sombre ? 0.4 : 0.08)}`,
              opacity: x,
              transform: `translateY(${(1 - x) * 80}px)`,
              display: "flex",
              alignItems: "center",
              gap: 36,
              padding: "0 40px 0 24px",
            }}
          >
            <MicroObjet nom={b.nom} t={t - debut} taille={g.dessin} fond={fond} />
            <div style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: g.taille, lineHeight: 1.05, textTransform: "uppercase", color: c.texte }}>
              <span style={{ color: c.accent, marginRight: "0.3em" }}>{i + 1}</span>
              {b.titre}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** La banque entière : 3 colonnes × 4 rangées qui remplissent la zone utile (ordre de `MICRO_OBJETS`). */
function GrilleBanque({ t, fond }: { t: number; fond: NomFond }) {
  return (
    <>
      {planBanqueMicro().cases.map((k, i) => {
        const m = MICRO_OBJETS[i];
        return (
          <div key={m.nom} style={{ position: "absolute", left: k.x, top: k.y, width: k.largeur, height: k.hauteur, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <MicroObjet nom={m.nom} t={t - 0.4 - 0.12 * i} taille={k.dessin} fond={fond} />
          </div>
        );
      })}
    </>
  );
}


export function CompositionsMicroObjets() {
  return (
    <>
      {(["A", "B", "banque"] as const).map((liste) => {
        const props = proprietesGalerieMicro(liste);
        const meta = metaGalerieMicro({ props });
        return (
          <Composition
            key={liste}
            id={COMPOSITIONS_MICRO_OBJETS[liste]}
            component={GalerieMicroObjets}
            durationInFrames={meta.durationInFrames}
            fps={meta.fps}
            width={meta.width}
            height={meta.height}
            defaultProps={props}
            calculateMetadata={metaGalerieMicro}
          />
        );
      })}
    </>
  );
}
