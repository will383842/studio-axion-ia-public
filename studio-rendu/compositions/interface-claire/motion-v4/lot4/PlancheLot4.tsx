import React from "react";
/**
 * PLANCHE DE CONTRÔLE du lot 4 « Fenêtres vidéo » (standard v4, § I) : un extrait par élément (540×960 via `scale: 0.5`, 30 i/s, voix de la prise + bruitages,
 * sous-titres v4, barre de progression) et un enchaînement de 15 s du lot entier, en palette A et B. Aucun rôle en production : le fichier
 * `entree-lot4.tsx` n'est pas branché à la racine. Les mots affichés sont PLAUSIBLES (aucune transcription de la prise) et calés sur la parole détectée.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AvantApres, mesuresAvantApres, sousTitresAvantApres } from "./AvantApres";
import { BandeVideo, mesuresBandeVideo, sousTitresBandeVideo } from "./BandeVideo";
import { CercleEpaule, mesuresCercleEpaule, sousTitresCercleEpaule } from "./CercleEpaule";
import { FenetreDouble, mesuresFenetreDouble, sousTitresFenetreDouble } from "./FenetreDouble";
import { DUREE_PLEIN_CADRE, FenetrePleinCadre, mesuresFenetrePleinCadre, sousTitresFenetrePleinCadre } from "./FenetrePleinCadre";
import { FenetreTelephone, mesuresFenetreTelephone, sousTitresFenetreTelephone } from "./FenetreTelephone";
import { MosaiqueVideos, mesuresMosaiqueVideos, sousTitresMosaique } from "./MosaiqueVideos";
import { BarreProgression, Clip, chargerMontserratBlack, FPS, Prise, SousTitresV4, motsSurVoix } from "./commun-lot4";
import type { MesuresElement, MotBrut, MotDemo, Palette, PositionSousTitres } from "./commun-lot4";

export type IdElementLot4 = "fenetre-plein-cadre" | "fenetre-telephone" | "fenetre-double" | "bande-video" | "cercle-epaule" | "mosaique-videos" | "avant-apres";
export const ELEMENTS_LOT_4: IdElementLot4[] = ["fenetre-plein-cadre", "fenetre-telephone", "fenetre-double", "bande-video", "cercle-epaule", "mosaique-videos", "avant-apres"];
export const NOMS_FICHIERS: Record<IdElementLot4, string> = {
  "fenetre-plein-cadre": "FenetrePleinCadre",
  "fenetre-telephone": "FenetreTelephone",
  "fenetre-double": "FenetreDouble",
  "bande-video": "BandeVideo",
  "cercle-epaule": "CercleEpaule",
  "mosaique-videos": "MosaiqueVideos",
  "avant-apres": "AvantApres",
};

/** B-roll : tous les fichiers sont dans `broll/` du dossier public. */
export const SOURCES = {
  chantier: "chantier-reparation-mur-vertical.mp4",
  devisEcran: "broll-devis-signature-1080.mp4",
  clavier: "broll-clavier-frappe-1080.mp4",
  signature: "broll-signature-main-1080.mp4",
  paysage: "chantier-beton-paysage.mp4",
  telephone: "broll-telephone-main-defile.mp4",
  papier: "broll-ecriture-papier-1080.mp4",
  bureau: "broll-bureau-ordinateur.mp4",
  mosaique: ["lotE-m4.mp4", "lotE-m1.mp4", "lotE-m5.mp4", "lotE-devis.mp4", "lotE-m3.mp4", "lotE-bureau.mp4"],
} as const;

const mot = (m: string, fort = false): MotBrut => ({ mot: m, fort });
export const PHRASES: Record<IdElementLot4, MotBrut[]> = {
  "fenetre-plein-cadre": [mot("PENDANT"), mot("QUE"), mot("VOUS"), mot("ÊTES"), mot("SUR"), mot("LE"), mot("CHANTIER", true), mot("ÇA"), mot("TOURNE", true), mot("TOUT"), mot("SEUL", true)],
  "fenetre-telephone": [mot("LE"), mot("CLIENT"), mot("VALIDE", true), mot("DEPUIS"), mot("SON"), mot("TÉLÉPHONE", true)],
  "fenetre-double": [mot("LE"), mot("DEVIS", true), mot("PART"), mot("ET"), mot("IL"), mot("REVIENT", true), mot("SIGNÉ", true), mot("TOUT"), mot("SEUL")],
  "bande-video": [mot("LES"), mot("DEMANDES", true), mot("ARRIVENT"), mot("TOUTE"), mot("LA"), mot("JOURNÉE", true)],
  "cercle-epaule": [mot("UN"), mot("COUP"), mot("DE"), mot("FIL", true), mot("DE"), mot("MOINS", true)],
  "mosaique-videos": [mot("DES"), mot("DIZAINES"), mot("DE"), mot("DEVIS"), mot("DE"), mot("CHANTIERS", true), mot("DE"), mot("CLIENTS", true)],
  "avant-apres": [mot("AVANT"), mot("TOUT"), mot("À"), mot("LA"), mot("MAIN", true), mot("MAINTENANT"), mot("C'EST"), mot("AUTOMATIQUE", true)],
};

/** Image (locale à l'élément) du mot `m` dans une liste de mots (secondes → images relatives à i0). */
export const imageDuMot = (mots: MotDemo[], m: string, i0: number, parDefaut: number): number => {
  const w = mots.find((x) => x.mot === m);
  return w ? Math.max(0, Math.round(w.debut * FPS) - i0) : parDefaut;
};

type Extrait = { duree: number; prise: number; total: number };
export const EXTRAITS: Record<IdElementLot4, Extrait> = {
  "fenetre-plein-cadre": { duree: DUREE_PLEIN_CADRE, prise: 5.65, total: 9 + DUREE_PLEIN_CADRE + 12 },
  "fenetre-telephone": { duree: 72, prise: 1.1, total: 93 },
  "fenetre-double": { duree: 96, prise: 4.25, total: 117 },
  "bande-video": { duree: 66, prise: 9.17, total: 87 },
  "cercle-epaule": { duree: 66, prise: 10.29, total: 87 },
  "mosaique-videos": { duree: 66, prise: 1.1, total: 87 },
  "avant-apres": { duree: 90, prise: 5.65, total: 111 },
};
const LEAD = 9;
const OUVRE_PC = 20;
/** Images locales (relatives à l'élément) où le groupe de sous-titres est caché : le plein cadre balaie sa place (≤ 6 i). */
export const masqueSousTitres = (id: IdElementLot4, f: number): boolean => id === "fenetre-plein-cadre" && f >= 16 && f < 22;
/** Mots forts déjà affichés par une étiquette posée : ils ne sont pas répétés en plaque dans le sous-titre (tour 2, défaut commun n° 2). */
export const MOTS_ETIQUETTES: Record<IdElementLot4, string[]> = {
  "fenetre-plein-cadre": ["CHANTIER", "TOURNE", "SEUL"],
  "fenetre-telephone": [],
  "fenetre-double": ["DEVIS", "REVIENT", "SIGNÉ"],
  "bande-video": ["DEMANDES", "JOURNÉE"],
  "cercle-epaule": ["FIL"],
  "mosaique-videos": ["CHANTIERS"],
  "avant-apres": ["AUTOMATIQUE"],
};
export const exclureMotsEtiquettes = (liste: string[]) => (m: MotDemo, _f: number): boolean => !!m.fort && liste.includes(m.mot);

/** Rend l'élément à l'image locale `f` (i0 = 0). `mots` : les mots de démonstration (secondes locales à l'extrait). */
export function RendreElement({ id, f, duree, palette, mots, i0 }: { id: IdElementLot4; f: number; duree: number; palette: Palette; mots: MotDemo[]; i0: number }) {
  switch (id) {
    case "fenetre-plein-cadre":
      return <FenetrePleinCadre f={f} duree={duree} palette={palette} src={SOURCES.chantier} etiquette="LE CHANTIER" etiquette2="ÇA TOURNE" etiquette3="TOUT SEUL" iEtiq2={Math.min(24, Math.max(OUVRE_PC, imageDuMot(mots, "TOURNE", i0, 24)))} iEtiq3={Math.min(38, Math.max(34, imageDuMot(mots, "SEUL", i0, 36)))} />;
    case "fenetre-telephone":
      return <FenetreTelephone f={f} duree={duree} palette={palette} etiquette="LE CLIENT" etiquette2="DEVIS SIGNÉ" />;
    case "fenetre-double":
      return <FenetreDouble f={f} duree={duree} palette={palette} iEnvoi={Math.min(22, Math.max(12, imageDuMot(mots, "PART", i0, 14)))} iB={Math.min(40, Math.max(30, imageDuMot(mots, "REVIENT", i0, 34)))} iTampon={Math.min(58, imageDuMot(mots, "SIGNÉ", i0, 48))} />;
    case "bande-video":
      return <BandeVideo f={f} duree={duree} palette={palette} etiquette="LES DEMANDES" etiquette2="TOUTE LA JOURNÉE" />;
    case "cercle-epaule":
      return <CercleEpaule f={f} duree={duree} palette={palette} etiquette="COUP DE FIL" iBarre={Math.max(30, imageDuMot(mots, "MOINS", i0, 34))} />;
    case "mosaique-videos":
      return <MosaiqueVideos f={f} duree={duree} palette={palette} sources={SOURCES.mosaique} iHeros={Math.max(24, imageDuMot(mots, "CHANTIERS", i0, 30))} motFort="CHANTIERS" />;
    case "avant-apres":
      return <AvantApres f={f} duree={duree} palette={palette} srcAvant={SOURCES.papier} iBalaie={Math.min(28, Math.max(14, imageDuMot(mots, "MAINTENANT", i0, 30)))} />;
  }
}

/** Centre vertical des sous-titres selon l'élément et l'image locale (§ C.3). */
export function positionSousTitres(id: IdElementLot4, f: number): PositionSousTitres {
  switch (id) {
    case "fenetre-plein-cadre":
      return { y: sousTitresFenetrePleinCadre(f) };
    case "fenetre-telephone":
      return { y: sousTitresFenetreTelephone() };
    case "fenetre-double":
      return { y: sousTitresFenetreDouble() };
    case "bande-video":
      return { y: sousTitresBandeVideo() };
    case "cercle-epaule":
      return { y: sousTitresCercleEpaule() };
    case "mosaique-videos":
      return { y: sousTitresMosaique() };
    case "avant-apres":
      return { y: sousTitresAvantApres() };
  }
}

export const mesuresDe = (id: IdElementLot4, mots: MotDemo[], i0: number): MesuresElement => {
  switch (id) {
    case "fenetre-plein-cadre":
      return mesuresFenetrePleinCadre();
    case "fenetre-telephone":
      return mesuresFenetreTelephone;
    case "fenetre-double":
      return mesuresFenetreDouble;
    case "bande-video":
      return mesuresBandeVideo;
    case "cercle-epaule":
      return mesuresCercleEpaule;
    case "mosaique-videos":
      return mesuresMosaiqueVideos(Math.max(24, imageDuMot(mots, "CHANTIERS", i0, 30)));
    case "avant-apres":
      return mesuresAvantApres(Math.min(28, Math.max(14, imageDuMot(mots, "MAINTENANT", i0, 30))));
  }
};

export function motsExtrait(id: IdElementLot4): MotDemo[] {
  const e = EXTRAITS[id];
  return motsSurVoix(PHRASES[id], e.prise, e.total / FPS);
}

/* ------------------------------------------------------------------ Extrait ------------------------------------------------------------------ */
export type Fond = "prise" | "blanc" | "noir" | "broll";
export function ExtraitLot4({ element, palette, fond = "prise" }: { element: IdElementLot4; palette: Palette; fond?: Fond }) {
  chargerMontserratBlack();
  const f = useCurrentFrame();
  const e = EXTRAITS[element];
  const mots = React.useMemo(() => motsExtrait(element), [element]);
  return (
    <AbsoluteFill style={{ background: "#E9DCC8" }}>
      {fond === "prise" ? <Prise debutSec={e.prise} descente={0} /> : null}
      {fond === "blanc" ? <AbsoluteFill style={{ background: "#FFFFFF" }} /> : null}
      {fond === "noir" ? <AbsoluteFill style={{ background: "#111111" }} /> : null}
      {fond === "broll" ? <AbsoluteFill><Clip nom="lotE-m5.mp4" depuisSec={1} /></AbsoluteFill> : null}
      <Sequence from={LEAD} durationInFrames={e.duree + 2}>
        <ElementDansSequence id={element} palette={palette} mots={mots} duree={e.duree} />
      </Sequence>
      <SousTitresV4 f={f} mots={mots} palette={palette} position={(ff) => positionSousTitres(element, ff - LEAD)} exclure={exclureMotsEtiquettes(MOTS_ETIQUETTES[element])} masque={(ff) => masqueSousTitres(element, ff - LEAD)} />
      <BarreProgression f={f} total={e.total} palette={palette} />
    </AbsoluteFill>
  );
}

function ElementDansSequence({ id, palette, mots, duree }: { id: IdElementLot4; palette: Palette; mots: MotDemo[]; duree: number }) {
  const f = useCurrentFrame();
  return <RendreElement id={id} f={f} duree={duree} palette={palette} mots={mots} i0={LEAD} />;
}
