import React from "react";
/**
 * Scènes du lot 1 : un extrait par élément (3-4 s) et l'enchaînement de 15 s, tous sur la prise de Will (vidéo + sa voix), sous-titres v4 et barre de progression.
 * La prise ne subit QUE la translation verticale (descente D1 = 0,06 H au premier objet « tête », remontée quand le dernier est parti).
 * Palette B (orange) seule. Les extraits sont rognés : le 1ᵉʳ objet entre à i9 (0,3 s), la queue dure 12 i (0,4 s). Chaque objet reçoit des gestes de vie
 * (pulsation CLAQUE) pour qu'aucun écart entre deux événements ne dépasse 12 i.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { mediaV4 } from "../communs/medias-v4";
import type { ReactNode } from "react";
import { BarreProgression, DESCENTE, FondPrise, Polices, SousTitresV4, Vie, descenteA, FPS, gestesVie } from "./commun-lot1";
import type { CleDescente, FondTest, Mot, Palette } from "./commun-lot1";
import { MOTS, MOTS_ENCHAINEMENT } from "./mots-demo";
import { EtiquetteTete, evenements as evEtiquette } from "./EtiquetteTete";
import { Interjection, evenements as evInterj } from "./Interjection";
import { BadgeCompteur, evenements as evCompteur } from "./BadgeCompteur";
import { BadgeProfil, evenements as evProfil } from "./BadgeProfil";
import { LogoOutil, evenements as evLogo } from "./LogoOutil";
import { RangeePastilles, evenements as evRangee } from "./RangeePastilles";
import { Equation, evenements as evEquation } from "./Equation";
import { MotSaute, evenements as evMot } from "./MotSaute";

const F = (t: number): number => Math.round(t * FPS);

/** Une occurrence d'élément posée dans la scène : image de départ (`at`), durée, rendu, événements (images locales, gestes de vie compris). */
export type Instance = { at: number; duree: number; evts: number[]; gestes: number[]; node: ReactNode };
export type DefScene = { id: string; total: number; debutVideo: number; mots: Mot[]; cles: CleDescente[]; instances: Instance[] };

const inst = (at: number, duree: number, evts: number[], node: ReactNode): Instance => {
  const gestes = gestesVie(evts);
  return { at, duree, evts: [...evts, ...gestes].sort((a, b) => a - b), gestes, node };
};

export function Scene({ def, fondTest = "prise" }: { def: DefScene & { palette: Palette }; fondTest?: FondTest }) {
  const frame = useCurrentFrame();
  const d = descenteA(frame, def.cles);
  return (
    <Polices>
      <AbsoluteFill>
        <FondPrise d={d} source={mediaV4("prise-15s.mp4")} debutVideo={def.debutVideo} fondTest={fondTest} />
        <SousTitresV4 mots={def.mots} palette={def.palette} d={d} />
        {def.instances.map((x, k) => (
          <Sequence key={k} from={x.at} durationInFrames={x.duree}><Vie gestes={x.gestes}>{x.node}</Vie></Sequence>
        ))}
        <BarreProgression palette={def.palette} total={def.total} />
      </AbsoluteFill>
    </Polices>
  );
}

/* ------------------------------------------------------------------ Extraits ------------------------------------------------------------------ */

export const ENTREE = 9;      // 0,3 s de prise seule au plus
export const QUEUE = 12;      // 0,4 s après la sortie du dernier objet

const masquer = (mots: Mot[], depuis: Record<number, number>): Mot[] => mots.map((m, k) => (depuis[k] !== undefined ? { ...m, masqueDepuis: depuis[k] } : m));

/** Rogne le début : le 1ᵉʳ objet entre à `ENTREE`, les mots et la vidéo suivent ; le total s'arrête `QUEUE` images après la sortie du dernier objet. */
function def(id: string, debutVideo: number, mots: Mot[], instances: Instance[], descendDes?: number): DefScene {
  const premier = Math.min(...instances.map((x) => x.at));
  const decal = premier - ENTREE;
  const dec = (m: Mot): Mot => ({ ...m, debut: m.debut - decal / FPS, fin: m.fin - decal / FPS, masqueDepuis: m.masqueDepuis !== undefined ? m.masqueDepuis - decal : undefined });
  const inst2 = instances.map((x) => ({ ...x, at: x.at - decal }));
  const fin = Math.max(...inst2.map((x) => x.at + x.duree));
  const cles: CleDescente[] = [{ i: descendDes ?? ENTREE, d: DESCENTE.D1 }, { i: fin + 1, d: 0, type: "remonte" }];
  return { id, total: fin + QUEUE, debutVideo: debutVideo + decal, mots: mots.map(dec), cles, instances: inst2 };
}

export function definitions(p: Palette = "B"): Record<string, DefScene> {
  /* EtiquetteTete : étiquette 1 (rouleau « SANS ME VANTER » → « MES DEVIS »), étiquette 2 (une plaque, 2 lignes + sur-étiquette) */
  const e1 = { lignes: ["SANS ME VANTER"], changement: { lignes: ["MES DEVIS"], a: F(1.0) - 9 }, sortie: 33 };
  const e2 = { lignes: ["UNE ÉQUIPE", "D'AGENTS IA"], surEtiquette: "CLAUDE M'A CRÉÉ", instants: [0, 14], sortie: 36 };
  const etiquette = [
    inst(9, 36, evEtiquette({ ...e1 }), <EtiquetteTete palette={p} fond="ACCENT" inclinaison={-3} {...e1} />),
    inst(45, 40, evEtiquette({ ...e2 }), <EtiquetteTete palette={p} fond="BLANC" inclinaison={2} {...e2} />),
  ];
  const interj = [
    inst(23, 27, evInterj({ sortie: 24 }), <Interjection palette={p} texte="REGARDEZ." sortie={24} />),
    inst(51, 27, evInterj({ sortie: 24 }), <Interjection palette={p} texte="ATTENTION." sortie={24} decalage={-0.03} />),
  ];
  const cpt = { titre: "RELANCES", pictos: ["courriel", "bulle", "telephone", "agenda"] as const, valeur: 1200, debutCompteur: 6, inversion: { a: F(1.8) - 15, valeur: 0 }, sortie: 56 };
  const compteur = [inst(15, 59, evCompteur({ ...cpt, pictos: [...cpt.pictos] }), <BadgeCompteur palette={p} {...cpt} pictos={[...cpt.pictos]} />)];
  const profils = [{ nom: "CLAIRE", metier: "RELANCES", rang: "AGENT 1/3" }, { nom: "HUGO", metier: "DEVIS", rang: "AGENT 2/3" }, { nom: "LÉO", metier: "RENDEZ-VOUS", rang: "AGENT 3/3" }];
  const profil = [inst(9, 90, evProfil({ profils }), <BadgeProfil palette={p} profils={profils} />)];
  const l1 = { nom: "CLAUDE", role: "LE RÉDACTEUR", rang: "OUTIL 1/2", picto: "claude" as const, instantRole: 8, sortie: 30 };
  const l2 = { nom: "AGENDA", role: "LE PLANNING", rang: "OUTIL 2/2", picto: "agenda" as const, pictoRole: "agenda" as const, instantRole: 8, sortie: 30 };
  const logo = [
    inst(25, 33, evLogo(l1), <LogoOutil palette={p} {...l1} />),
    inst(60, 33, evLogo(l2), <LogoOutil palette={p} {...l2} />),
  ];
  const rg = { titre: "LES 6 ÉTAPES", nb: 6, actives: [F(1.5) - 17, F(2.0) - 17, F(2.45) - 17], sortie: 65 };
  const rangee = [inst(17, 70, evRangee(rg), <RangeePastilles palette={p} {...rg} />)];
  const eq = { termes: ["SAVOIR-FAIRE", "L'IA"] as [string, string], resultat: "TEMPS GAGNÉ", instants: { plus: F(0.85) - 6, egal: F(1.45) - 6 }, sortie: 62 };
  const equation = [inst(6, 67, evEquation(eq), <Equation palette={p} {...eq} />)];
  const m1 = { mot: "TEMPS", surEtiquette: "TOUT ÇA", sortie: 36 };
  const m2 = { mot: "DEVIS", surEtiquette: "PLUS DE", sortie: 36 };
  const saute = [
    inst(30, 39, evMot(m1), <MotSaute palette={p} {...m1} />),
    inst(72, 39, evMot(m2), <MotSaute palette={p} {...m2} />),
  ];
  return {
    EtiquetteTete: def("EtiquetteTete", 20, MOTS.EtiquetteTete, etiquette),
    Interjection: def("Interjection", 60, MOTS.Interjection, interj),
    BadgeCompteur: def("BadgeCompteur", 100, MOTS.BadgeCompteur, compteur),
    BadgeProfil: def("BadgeProfil", 140, MOTS.BadgeProfil, profil),
    LogoOutil: def("LogoOutil", 180, MOTS.LogoOutil, logo),
    RangeePastilles: def("RangeePastilles", 220, MOTS.RangeePastilles, rangee),
    Equation: def("Equation", 260, MOTS.Equation, equation),
    MotSaute: def("MotSaute", 300, masquer(MOTS.MotSaute, { 4: 30, 8: 72 }), saute, 0),
  };
}
export const IDS_ELEMENTS = ["EtiquetteTete", "Interjection", "BadgeCompteur", "BadgeProfil", "LogoOutil", "RangeePastilles", "Equation", "MotSaute"] as const;
export const DUREES_EXTRAITS: Record<string, number> = Object.fromEntries(IDS_ELEMENTS.map((id) => [id, definitions("B")[id].total]));

/* ------------------------------------------------------------------ Enchaînement de 15 s ------------------------------------------------------------------ */

export const TOTAL_ENCHAINEMENT = 450;
export function enchainement(p: Palette = "B"): DefScene {
  const e1 = { lignes: ["SANS ME VANTER"], changement: { lignes: ["MES DEVIS"], a: F(0.65) }, sortie: 33 };
  const ij1 = { texte: "REGARDEZ.", sortie: 24 };
  const cpt = { titre: "RELANCES", pictos: ["courriel", "bulle", "telephone", "agenda"] as ("courriel" | "bulle" | "telephone" | "agenda")[], valeur: 1200, debutCompteur: F(2.3) - 63, inversion: { a: F(3.43) - 63, valeur: 0 }, sortie: 56 };
  const profils = [{ nom: "CLAIRE", metier: "RELANCES", rang: "AGENT 1/3" }, { nom: "HUGO", metier: "DEVIS", rang: "AGENT 2/3" }, { nom: "LÉO", metier: "RENDEZ-VOUS", rang: "AGENT 3/3" }];
  const lg = { nom: "CLAUDE", role: "LE RÉDACTEUR", picto: "claude" as const, instantRole: 8, sortie: 30 };
  const rg = { titre: "LES 6 ÉTAPES", nb: 6, actives: [F(9.55) - 252, F(9.95) - 252, F(10.3) - 252], sortie: 54 };
  const eq = { termes: ["SAVOIR-FAIRE", "L'IA"] as [string, string], resultat: "TEMPS GAGNÉ", instants: { plus: F(11.1) - 315, egal: F(11.8) - 315 }, sortie: 62 };
  const ms = { mot: "SEUL", surEtiquette: "TOUT ÇA", sortie: 36 };
  const ij2 = { texte: "ET VOILÀ.", sortie: 999 };
  const instances: Instance[] = [
    inst(0, 36, evEtiquette(e1), <EtiquetteTete palette={p} fond="ACCENT" inclinaison={-3} muet {...e1} />),
    inst(36, 27, evInterj(ij1), <Interjection palette={p} {...ij1} />),
    inst(63, 59, evCompteur(cpt), <BadgeCompteur palette={p} {...cpt} />),
    inst(123, 90, evProfil({ profils }), <BadgeProfil palette={p} profils={profils} />),
    inst(213, 33, evLogo(lg), <LogoOutil palette={p} {...lg} />),
    inst(252, 63, evRangee(rg), <RangeePastilles palette={p} {...rg} />),
    inst(315, 67, evEquation(eq), <Equation palette={p} {...eq} />),
    inst(382, 39, evMot(ms), <MotSaute palette={p} {...ms} />),
    inst(427, 23, [0, 6, 12, 18], <Interjection palette={p} {...ij2} />),
  ];
  const mots = MOTS_ENCHAINEMENT.map((m) => (m.mot === "SEUL" && m.seul ? { ...m, masqueDepuis: 382 } : m));
  return { id: "enchainement", total: TOTAL_ENCHAINEMENT, debutVideo: 0, mots, cles: [{ i: 0, d: DESCENTE.D1 }], instances };
}
