import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import type { ElementV4Plan } from "../../../../src/domaine/facecam-animee/plan";
import { descenteA, DESCENTE } from "./communs/briques-v4";
import { placerDansZoneSure, X_ST_MIN, Y_ST_MAX, Y_ST_MIN } from "./communs/zone-sure-v4";
import type { ChangementD } from "./communs/briques-v4";
import { Vie, gestesVie } from "./lot1/commun-lot1";
import { EtiquetteTete, evenements as evEtiquette } from "./lot1/EtiquetteTete";
import { Interjection, evenements as evInterjection } from "./lot1/Interjection";
import { BadgeCompteur, evenements as evCompteur } from "./lot1/BadgeCompteur";
import { BadgeProfil, evenements as evProfil } from "./lot1/BadgeProfil";
import { RangeePastilles, evenements as evRangee } from "./lot1/RangeePastilles";
import { MotSaute, evenements as evMotSaute } from "./lot1/MotSaute";
import { CarteChecklist } from "./lot2/CarteChecklist";
import { CarteCommande } from "./lot2/CarteCommande";
import { CarteCommentaire } from "./lot2/CarteCommentaire";
import { CarteStatuts } from "./lot2/CarteStatuts";
import type { NomIcone } from "./lot2/commun-lot2";
import { GraphiqueBarres } from "./lot2/GraphiqueBarres";
import { CarteCalendrier } from "./lot2/CarteCalendrier";
import { CarteComparaison } from "./lot2/CarteComparaison";
import { Chrono } from "./lot3/Chrono";
import { EclatChiffre } from "./lot3/EclatChiffre";
import { CarrouselFeuillete } from "./lot3/CarrouselFeuillete";
import { JaugePourcentage } from "./lot3/JaugePourcentage";
import { PileNotifications } from "./lot3/PileNotifications";
import { FenetreTelephone } from "./lot4/FenetreTelephone";
import { FenetreDouble } from "./lot4/FenetreDouble";
import { MosaiqueVideos } from "./lot4/MosaiqueVideos";
import { AvantApres } from "./lot4/AvantApres";
import { DalleClaquee } from "./lot5/DalleClaquee";
import { RafaleTroisMots } from "./lot5/RafaleTroisMots";
import { DuelVideo } from "./lot5/DuelVideo";
import { ElementBarre } from "./lot5/ElementBarre";

/**
 * REGISTRE DES PLAQUETTES v4 pour le rendu final (`VideoAnimeeV4`) : associe l'id d'une fiche du catalogue du réalisateur
 * (`src/moteurs/montage-facecam-animee/realisateur/catalogue-v4.ts`, 26 plaquettes actives) au composant Remotion, et traduit un
 * `ElementV4Plan` (secondes, mots DITS, clés de vidéos) en props du composant (images à 30 i/s depuis le début de la plaquette).
 * Les 26 ids y sont. Chaque plaquette est posée dans une `Sequence` : tous les composants lisent donc des images LOCALES (0 = début).
 *
 * - Les BRUITAGES sont joués par les composants eux-mêmes (aucune musique) ; `plan.sons` reste vide pour un plan v4.
 * - `medias` : chemins dans le dossier public du rendu ; on retire le préfixe `broll/` (les composants lisent `broll/<nom>`).
 * - La descente de la prise et la place des sous-titres sont recopiées de la fiche du catalogue (`GEOMETRIE_V4`, test d'égalité :
 *   `tests/facecam-animee/catalogue-v4.test.ts`) pour que le conteneur de rendu n'importe rien du dossier `src/` à l'exécution.
 */

export const FPS_V4 = 30;
export const PALETTE_V4 = "B" as const;

/** Descente de la prise et sous-titres par plaquette : recopie de `catalogue-v4.ts` (gabarit, descente D, centre des sous-titres). */
export type SousTitresV4 = number | "base" | "carte" | null;
export const GEOMETRIE_V4: Readonly<Record<string, { slot: string; descente: number; sousTitres: SousTitresV4; couvre: boolean }>> = Object.freeze({
  EtiquetteTete: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  Interjection: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  BadgeCompteur: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  BadgeProfil: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  RangeePastilles: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  MotSaute: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  Chrono: { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  "element-barre": { slot: "tete", descente: DESCENTE.D1, sousTitres: "base", couvre: false },
  CarteChecklist: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  CarteCommande: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  CarteCommentaire: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  CarteStatuts: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  GraphiqueBarres: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  CarteCalendrier: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  CarteComparaison: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  JaugePourcentage: { slot: "carte", descente: DESCENTE.D2, sousTitres: "carte", couvre: false },
  PileNotifications: { slot: "bas", descente: DESCENTE.D0, sousTitres: Y_ST_MIN, couvre: false },
  FenetreTelephone: { slot: "fenetre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  FenetreDouble: { slot: "fenetre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  AvantApres: { slot: "fenetre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  CarrouselFeuillete: { slot: "fenetre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  MosaiqueVideos: { slot: "plein-cadre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  "dalle-claquee": { slot: "plein-cadre", descente: DESCENTE.D0, sousTitres: null, couvre: true },
  "rafale-trois-mots": { slot: "plein-cadre", descente: DESCENTE.D0, sousTitres: null, couvre: true },
  "duel-video": { slot: "plein-cadre", descente: DESCENTE.D0, sousTitres: Y_ST_MAX, couvre: true },
  EclatChiffre: { slot: "plein-cadre", descente: DESCENTE.D0, sousTitres: null, couvre: true },
});

export interface ContexteV4 {
  /** Rang de la plaquette dans le plan (alternance des fonds des étiquettes). */
  rang: number;
}
type Rendu = (e: ElementV4Plan, c: ContexteV4, duree: number) => React.ReactNode;

/** Images (locales, depuis le début de la plaquette) d'un instant dit. */
const im = (e: ElementV4Plan, t: number): number => Math.max(0, Math.round((t - e.debut) * FPS_V4));
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const mot = (e: ElementV4Plan, k = 0): string => e.mots?.[k] ?? "";
/**
 * Nom de fichier dans `broll/` : la clé du plan sans son dossier. JAMAIS vide en silence (vidéo v-60359dd080b1 : `broll/` sans nom de
 * fichier, 404 à 99 % du rendu) et jamais la vidéo d'une autre case reprise à la place : sans la vidéo `k`, le rendu s'arrête net avec une phrase claire.
 */
const broll = (e: ElementV4Plan, k = 0): string => {
  const cle = e.medias?.[k];
  if (typeof cle !== "string" || !cle.trim()) throw new Error(`La plaquette « ${e.id} » à ${e.debut} s n'a pas sa vidéo d'illustration n° ${k + 1} : le montage est refusé.`);
  return cle.replace(/^broll\//, "");
};
const dureeImages = (e: ElementV4Plan) => Math.max(1, Math.round((e.fin - e.debut) * FPS_V4));

/** Lot 1 : le composant gagne une pulsation (geste de vie) à chaque trou de plus de 12 images entre deux événements (comme les extraits du lot). */
function AvecVie({ evts, children }: { evts: number[]; children: React.ReactNode }) {
  return <Vie gestes={gestesVie(evts)}>{children}</Vie>;
}

/** Composants à images locales passées en `f` (lots 4) ou en `frame` + `debut` (lot 5). */
function AvecImage({ rendu }: { rendu: (f: number) => React.ReactNode }) {
  return <>{rendu(useCurrentFrame())}</>;
}

/**
 * GESTE DE VIE VISIBLE (critique de Will du 17/10 : « pas des pulsations de quelques % ») : toutes les 13 images (≈ 0,43 s) la plaquette fait un saut franc de 6 images
 * puis se repose 7 images (un événement net, séparé du suivant par un vrai calme : c'est ce que compte la mesure du rendu). Objets au-dessus de la tête et pile du bas :
 * elle se lève de 22 px, s'incline de 2,2° (alternativement à gauche et à droite) et grossit de 6 % ; carte : 14 px, 1,5°, 3,5 % ; fenêtre : 12 px, 1,2°, 3 %.
 * Plein cadre : seulement le grossissement de 4 % (aucun coin ne doit laisser voir la prise). Le premier geste part à l'image 8, le dernier finit 5 images avant la fin
 * (la sortie de la plaquette reste propre). Le centre de rotation est le pied de la plaquette (tête : 14 % de H ; carte : 22 % ; bas : 88 % ; fenêtre : 50 %).
 */
export const PAS_GESTE_V4 = 13;
export const DUREE_GESTE_V4 = 6;
export const DEBUT_GESTE_V4 = 8;
const ORIGINE_GESTE: Record<string, string> = { tete: "50% 14%", carte: "50% 22%", bas: "50% 88%", fenetre: "50% 50%", "plein-cadre": "50% 50%" };
/** Amplitude du saut par emplacement : [px, degrés, grossissement]. */
const AMPLITUDE_GESTE: Record<string, [number, number, number]> = { tete: [22, 2.2, 0.06], bas: [22, 2.2, 0.06], carte: [14, 1.5, 0.035], fenetre: [12, 1.2, 0.03], "plein-cadre": [0, 0, 0.04] };
/** Valeur du geste (0 → 1 → 0) à l'image locale `i` d'une plaquette de `duree` images, et rang du geste (0, 1, 2…) ; `null` entre deux gestes. */
export function geste(i: number, duree: number): { w: number; rang: number } | null {
  if (i < DEBUT_GESTE_V4) return null;
  const rang = Math.floor((i - DEBUT_GESTE_V4) / PAS_GESTE_V4);
  const k = i - (DEBUT_GESTE_V4 + rang * PAS_GESTE_V4);
  if (k >= DUREE_GESTE_V4 || DEBUT_GESTE_V4 + rang * PAS_GESTE_V4 + DUREE_GESTE_V4 > duree - 5) return null;
  return { w: Math.sin((Math.PI * (k + 0.5)) / DUREE_GESTE_V4), rang };
}
function GesteVisible({ slot, duree, children }: { slot: string; duree: number; children: React.ReactNode }) {
  const i = useCurrentFrame();
  const g = geste(i, duree);
  const [px, deg, gr] = AMPLITUDE_GESTE[slot] ?? AMPLITUDE_GESTE.tete;
  const transform = g
    ? slot === "plein-cadre"
      ? `scale(${(1 + gr * g.w).toFixed(4)})`
      : `translateY(${(-px * g.w).toFixed(2)}px) rotate(${((g.rang % 2 ? -deg : deg) * g.w).toFixed(3)}deg) scale(${(1 + gr * g.w).toFixed(4)})`
    : undefined;
  return <div style={{ position: "absolute", inset: 0, transform, transformOrigin: ORIGINE_GESTE[slot] ?? "50% 50%" }}>{children}</div>;
}

const ICONES_STATUTS: NomIcone[] = ["filtre", "stylo", "avion", "bulle"];
const ICONES_BULLES = ["avion", "bulle", "coche"] as const;
const PICTOS_COMPTEUR = ["courriel", "bulle", "telephone", "agenda"] as const;

export const RENDUS_V4: Readonly<Record<string, Rendu>> = Object.freeze({
  /* Lot 1 : au-dessus de la tête (M1) */
  EtiquetteTete: (e, c, D) => {
    const p = {
      palette: PALETTE_V4, lignes: (e.mots ?? []).slice(0, 2), surEtiquette: e.lignes?.[0]?.texte, fond: (c.rang % 2 === 0 ? "ACCENT" : "BLANC") as "ACCENT" | "BLANC",
      inclinaison: c.rang % 2 === 0 ? -3 : 2, instants: [0, e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 12], sortie: Math.max(14, D - 6),
    };
    return <AvecVie evts={evEtiquette(p)}><EtiquetteTete {...p} /></AvecVie>;
  },
  Interjection: (e, _c, D) => {
    const sortie = Math.max(12, D - 3);
    return <AvecVie evts={evInterjection({ sortie })}><Interjection palette={PALETTE_V4} texte={mot(e)} sortie={sortie} /></AvecVie>;
  },
  BadgeCompteur: (e, _c, D) => {
    const p = { palette: PALETTE_V4, titre: mot(e), pictos: [...PICTOS_COMPTEUR], valeur: e.nombre ?? 0, debutCompteur: e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 6, sortie: Math.max(20, D - 6) };
    return <AvecVie evts={evCompteur(p)}><BadgeCompteur {...p} /></AvecVie>;
  },
  BadgeProfil: (e, _c, D) => {
    const lignes = e.lignes ?? [];
    const profils = lignes.map((l, k) => ({ nom: l.texte, metier: mot(e, k) || mot(e, 0), rang: "" }));
    const pas = borne(Math.floor((D - 12) / Math.max(1, profils.length)), 18, 66);
    return <AvecVie evts={evProfil({ profils, pas })}><BadgeProfil palette={PALETTE_V4} profils={profils} pas={pas} /></AvecVie>;
  },
  RangeePastilles: (e, _c, D) => {
    const lignes = e.lignes ?? [];
    const actives = lignes.map((l) => im(e, l.a));
    const sortie = Math.max(Math.max(...actives, 0) + 6, D - 12);
    const p = { palette: PALETTE_V4, titre: mot(e), contenus: lignes.map((l) => l.texte), nb: lignes.length, actives, sortie };
    return <AvecVie evts={evRangee(p)}><RangeePastilles {...p} /></AvecVie>;
  },
  MotSaute: (e, _c, D) => {
    const sortie = Math.max(24, D - 6);
    return <AvecVie evts={evMotSaute({ arrivee: 8, sortie })}><MotSaute palette={PALETTE_V4} mot={mot(e)} surEtiquette={e.mots?.[1]} sortie={sortie} /></AvecVie>;
  },
  Chrono: (e, _c, D) => (
    <Chrono palette={PALETTE_V4} secondes={e.nombre ?? 0} libelle={mot(e)} mode="gagne" duree={D} mots={[0, e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 10, e.instants?.[1] !== undefined ? im(e, e.instants[1]) : 20]} ding={false} />
  ),
  "element-barre": (e, _c, D) => {
    const textes = e.mots ?? [];
    const res = e.lignes?.[0];
    return <AvecImage rendu={(f) => <ElementBarre frame={f} debut={0} palette={PALETTE_V4} variante="etiquette" textes={textes} iApparitions={textes.map((_, k) => k * 8)} iBarre={e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 24} resultat={res ? { texte: res.texte, i: im(e, res.a) } : undefined} duree={D} />} />;
  },

  /* Lot 2 : cartes hautes (M2) */
  CarteChecklist: (e, _c, D) => <CarteChecklist palette={PALETTE_V4} duree={D} decl={(e.lignes ?? []).map((l) => Math.max(3, im(e, l.a)))} titre={mot(e)} lignes={(e.lignes ?? []).map((l) => l.texte)} pastilles="picto" />,
  CarteCommande: (e, _c, D) => (
    <CarteCommande palette={PALETTE_V4} duree={D} decl={(e.instants ?? []).map((t) => Math.max(3, im(e, t)))} commande={mot(e, 0)} etiquette={mot(e, 1)} reponse={mot(e, 2)} commandes={(e.mots ?? []).slice(3)} />
  ),
  CarteCommentaire: (e, _c, D) => <CarteCommentaire palette={PALETTE_V4} duree={D} decl={(e.instants ?? []).map((t) => Math.max(3, im(e, t)))} motCle={mot(e, 0)} notification={e.mots?.[1]} />,
  CarteStatuts: (e, _c, D) => {
    const lignes = e.lignes ?? [];
    const roles = lignes.map((l, k) => ({ agent: l.texte, action: mot(e, k), icone: ((l.icone as NomIcone | undefined) ?? ICONES_STATUTS[k % ICONES_STATUTS.length]) as NomIcone }));
    return <CarteStatuts palette={PALETTE_V4} duree={D} decl={lignes.map((l) => Math.max(3, im(e, l.a)))} fin={e.instants?.[0] !== undefined ? im(e, e.instants[0]) : undefined} roles={roles} titre={mot(e, lignes.length)} pastille={e.mots?.[lignes.length + 1] ?? ""} puces="pictos" />;
  },
  GraphiqueBarres: (e, _c, D) => {
    const decl = (e.instants ?? []).map((t) => Math.max(3, im(e, t)));
    // Sans mot pour la puce (« deux fois » pas dit) : son instant est repoussé après la sortie, elle ne s'affiche jamais.
    while (decl.length < 3) decl.push(D + 60);
    return <GraphiqueBarres palette={PALETTE_V4} duree={D} decl={decl} titre={mot(e, 0)} puce={e.mots?.[1] ?? ""} pastille="" />;
  },
  CarteCalendrier: (e, _c, D) => <CarteCalendrier palette={PALETTE_V4} duree={D} decl={(e.instants ?? []).map((t) => Math.max(3, im(e, t)))} titre={mot(e)} pastille="" jours="points" />,
  CarteComparaison: (e, _c, D) => (
    <CarteComparaison palette={PALETTE_V4} duree={D} decl={(e.instants ?? []).map((t) => Math.max(3, im(e, t)))} gauche={mot(e, 0)} droite={mot(e, 1)} resultat={mot(e, 2)} lignes={(e.lignes ?? []).map((l) => l.texte)} titre={mot(e, 3)} pastille="" />
  ),

  /* Lot 3 : chiffres, preuves, carrousel */
  JaugePourcentage: (e, _c, D) => {
    const n = e.nombre ?? 100;
    return <JaugePourcentage palette={PALETTE_V4} titre={mot(e)} valeurs={[Math.round(n * 0.12), Math.round(n * 0.38), Math.round(n * 0.69), n]} duree={D} mots={(e.instants ?? []).map((t) => im(e, t))} ding />;
  },
  PileNotifications: (e, _c, D) => {
    const lignes = e.lignes ?? [];
    return <PileNotifications palette={PALETTE_V4} bulles={lignes.map((l, k) => ({ titre: l.texte, sous: e.mots?.[k], icone: ICONES_BULLES[k % ICONES_BULLES.length] }))} mots={lignes.map((l) => im(e, l.a))} duree={D} ding={false} />;
  },
  CarrouselFeuillete: (e, _c, D) => <CarrouselFeuillete palette={PALETTE_V4} etiquettes={e.mots} pages={8} duree={D} mots={[0, ...(e.instants ?? []).map((t) => im(e, t))]} />,
  EclatChiffre: (e, _c, D) => (
    <EclatChiffre palette={PALETTE_V4} valeur={e.nombre ?? 0} unite={mot(e, 0)} precision={e.mots?.[1]} duree={D} mots={[0, e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 20, e.instants?.[1] !== undefined ? im(e, e.instants[1]) : 30]} />
  ),

  /* Lot 4 : fenêtres sur le visage (M4) et mosaïque (M5) */
  FenetreTelephone: (e, _c, D) => <AvecImage rendu={(f) => <FenetreTelephone f={f} duree={D} palette={PALETTE_V4} etiquette={mot(e, 0)} etiquette2={mot(e, 1)} bouton={mot(e, 2)} textesEcran={["", "", ""]} iEtiq={e.instants?.[0] !== undefined ? im(e, e.instants[0]) : undefined} />} />,
  FenetreDouble: (e, _c, D) => {
    const iEnvoi = e.instants?.[0] !== undefined ? borne(im(e, e.instants[0]), 10, 22) : undefined;
    const iB = e.instants?.[1] !== undefined ? borne(im(e, e.instants[1]), Math.max(24, (iEnvoi ?? 12) + 10), 40) : undefined;
    const iTampon = e.instants?.[2] !== undefined ? borne(im(e, e.instants[2]), Math.max(36, (iB ?? 28) + 8), Math.max(36, D - 16)) : undefined;
    return <AvecImage rendu={(f) => <FenetreDouble f={f} duree={D} palette={PALETTE_V4} etiquetteA={mot(e, 0)} etiquetteA2={mot(e, 1)} etiquetteB0={mot(e, 2)} etiquetteB={mot(e, 3)} iEnvoi={iEnvoi} iB={iB} iTampon={iTampon} />} />;
  },
  AvantApres: (e, _c, D) => {
    const iBalaie = borne(e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 18, 14, 28);
    return <AvecImage rendu={(f) => <AvantApres f={f} duree={D} palette={PALETTE_V4} srcAvant={broll(e, 0)} depuisAvant={e.depuisSec ?? 0.6} iBalaie={iBalaie} etiqAvant={mot(e, 0)} etiqApres={mot(e, 1)} etiqAuto={mot(e, 2)} iAuto={e.instants?.[1] !== undefined ? im(e, e.instants[1]) : undefined} />} />;
  },
  MosaiqueVideos: (e, _c, D) => {
    if (!(e.medias ?? []).length) throw new Error(`La plaquette « ${e.id} » à ${e.debut} s n'a aucune vidéo d'illustration : le montage est refusé.`);
    const sources = (e.medias ?? []).map((_, k) => broll(e, k));
    return <AvecImage rendu={(f) => <MosaiqueVideos f={f} duree={D} palette={PALETTE_V4} sources={sources} iHeros={borne(e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 30, 24, Math.max(24, D - 20))} motFort={mot(e)} />} />;
  },

  /* Lot 5 : coups de poing, typographie */
  "dalle-claquee": (e, _c, D) => <AvecImage rendu={(f) => <DalleClaquee frame={f} debut={0} palette={PALETTE_V4} mot={mot(e, 0)} suite={e.mots?.[1]} duree={D} />} />,
  "rafale-trois-mots": (e, _c, D) => {
    const e1 = borne(e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 12, 6, 20);
    const e2 = borne(e.instants?.[1] !== undefined ? im(e, e.instants[1]) : 25, e1 + 4, 26);
    return <AvecImage rendu={(f) => <RafaleTroisMots frame={f} debut={0} palette={PALETTE_V4} mots={[mot(e, 0), mot(e, 1), mot(e, 2)]} ecarts={[e1, e2]} duree={D} />} />;
  },
  "duel-video": (e, _c, D) => (
    <AvecImage rendu={(f) => <DuelVideo frame={f} debut={0} palette={PALETTE_V4} motA={mot(e, 0)} motB={mot(e, 1)} videoA={broll(e, 0)} videoB={broll(e, 1)} iMotB={e.instants?.[0] !== undefined ? im(e, e.instants[0]) : 14} verdict={e.verdict ? { gagnant: e.verdict.gagnant, i: im(e, e.verdict.a) } : undefined} duree={D} />} />
  ),
});

/** Une plaquette posée sur la ligne de temps de la vidéo : `Sequence` aux images du plan, composant aux images locales. */
export function rendreElementV4(e: ElementV4Plan, c: ContexteV4): React.ReactNode {
  const rendu = RENDUS_V4[e.id];
  if (!rendu) return null;
  const D = dureeImages(e);
  return (
    <Sequence key={`${e.id}-${e.debut}`} from={Math.round(e.debut * FPS_V4)} durationInFrames={D}>
      <GesteVisible slot={GEOMETRIE_V4[e.id]?.slot ?? "tete"} duree={D}>{rendu(e, c, D)}</GesteVisible>
    </Sequence>
  );
}

/* ------------------------------------------------------------------ Descente de la prise et sous-titres ------------------------------------------------------------------ */

const geometrie = (e: ElementV4Plan) => GEOMETRIE_V4[e.id];

/**
 * Clés de descente de la prise (standard § D.4) : D à l'entrée de chaque plaquette quand elle change ; les plaquettes qui COUVRENT le
 * visage changent D sous elles, dans la même image que leur entrée ; la prise remonte 1 image après la sortie de la dernière plaquette
 * si plus rien ne la tient. Jamais d'échelle : seulement `translateY`.
 */
export function clesDescenteV4(elements: readonly ElementV4Plan[]): ChangementD[] {
  const tries = [...elements].filter((e) => geometrie(e)).sort((a, b) => a.debut - b.debut);
  const cles: ChangementD[] = [];
  let courant = 0;
  for (const e of tries) {
    const g = geometrie(e);
    const i0 = Math.round(e.debut * FPS_V4); // la prise bouge EN MÊME TEMPS que la plaquette entre (17/10 : mesuré sur le rendu, jamais plus de 2 images de visage à moitié couvert)
    if (Math.abs(g.descente - courant) > 1e-9) {
      cles.push({ i: i0, D: g.descente });
      courant = g.descente;
    }
  }
  const dernier = tries[tries.length - 1];
  if (dernier && courant > 0) cles.push({ i: Math.round(dernier.fin * FPS_V4) + 1, D: 0 });
  return cles;
}

/** Descente réelle de la prise (fraction de H) à l'image `f`. */
export const descenteReelleV4 = (f: number, cles: ChangementD[]): number => descenteA(f, cles);

/** Plaquette à l'écran à l'image `f` (début inclus, fin exclue). */
export function elementEnCoursV4(elements: readonly ElementV4Plan[], f: number): ElementV4Plan | undefined {
  const t = f / FPS_V4;
  return elements.find((e) => t >= e.debut - 1e-6 && t < e.fin - 1e-6);
}

/**
 * Centre vertical (fraction de H) des sous-titres à l'image `f`, ou `null` (masqués) : calculé À CHAQUE IMAGE depuis la descente RÉELLE
 * de la prise D(f) — 0,66 + D(f) hors carte, 0,375 + (D − 0,26) sous une carte haute (une fois D ≥ 0,2), position fixe sous une
 * fenêtre ou sur le plein cadre, le tout BORNÉ dans la zone sûre 9:16 (bas de la boîte ≤ 0,70 H, haut ≥ 0,14 H). Jamais sur la bande des yeux [0,27 + D ; 0,36 + D].
 */
export function positionSousTitresV4(elements: readonly ElementV4Plan[], cles: ChangementD[], f: number): number | null {
  const d = descenteA(f, cles);
  const actif = elementEnCoursV4(elements, f);
  const g = actif ? geometrie(actif) : undefined;
  const s: SousTitresV4 = g ? g.sousTitres : "base"; // `null` : masqués (plein cadre qui porte déjà le mot)
  if (s === null) return null;
  // Même calcul que `ySousTitresV4` du studio : borné dans la zone sûre TikTok / Reels / Shorts, jamais sur les yeux (`communs/zone-sure-v4.ts`).
  const voulu = s === "base" ? 0.66 + d : s === "carte" ? (d >= 0.2 ? 0.375 + (d - DESCENTE.D2) : 0.66 + d) : s;
  return placerDansZoneSure(voulu, d);
}

/**
 * Bande horizontale [x min, x max] (fractions de L) imposée aux sous-titres, ou `null` (largeur habituelle). Sous `FenetreDouble`, toute sa durée :
 * la carte DEVIS (B) occupe la moitié droite, les sous-titres restent à gauche de 0,44 L et ne la traversent plus.
 */
export function bandeSousTitresV4(elements: readonly ElementV4Plan[], f: number): readonly [number, number] | null {
  return elementEnCoursV4(elements, f)?.id === "FenetreDouble" ? [X_ST_MIN, 0.44] : null;
}

const jetons = (t: string) => t.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^A-Z0-9]+/).filter((x) => x.length >= 3 || /^\d+$/.test(x));
/** Vrai si un mot du groupe de sous-titres est déjà affiché par la plaquette en cours : le groupe est alors masqué (jamais un mot en double à l'écran). */
export function groupeDoubleV4(elements: readonly ElementV4Plan[], f: number, motsGroupe: readonly string[]): boolean {
  const actif = elementEnCoursV4(elements, f);
  if (!actif) return false;
  const posés = new Set([...(actif.mots ?? []), ...(actif.lignes ?? []).map((l) => l.texte)].flatMap(jetons));
  if (actif.nombre !== undefined) posés.add(String(actif.nombre));
  return motsGroupe.flatMap(jetons).some((j) => posés.has(j));
}
