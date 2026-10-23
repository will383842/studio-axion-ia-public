/**
 * GALERIE du style « interface claire » (lot B) : TOUS les composants, chacun joué sur une vraie phrase de Will (prise
 * IMG_7747, 3 passages sans les reprises, ≈ 91 s). Sert à la VALIDATION par Will avant le réalisateur Opus (lot C) :
 * une pastille en bas à gauche nomme chaque composant (« 5/17 · Grille de vignettes ») pour qu'il puisse commenter.
 * La mise en scène est écrite ici à la main ; au lot C, c'est le réalisateur qui produira ces mêmes données.
 */
import React from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../commune/polices";
import { Carte } from "./Carte";
import { COULEURS, GEOMETRIE, POLICES, TEMPS } from "./charte";
import { BarreProgression, Etiquette, EtiquetteGlisse, styleBoite } from "./elements";
import { EtiquetteCompteur, RangeeLogos, ticsCompteur } from "./etiquettes-plus";
import { Fenetre } from "./Fenetre";
import { Fin, pousseeFin } from "./Fin";
import { dans, rebond, sortie } from "./mouvement";
import { SousTitres } from "./SousTitres";
import { GROUPES_GALERIE } from "./donnees-galerie-mots";
import { Calendrier, hauteurCalendrier } from "./cartes/Calendrier";
import { GrilleVignettes, hauteurGrilleVignettes } from "./cartes/GrilleVignettes";
import { PileLogos, hauteurPileLogos } from "./cartes/PileLogos";
import { Statuts, hauteurStatuts } from "./cartes/Statuts";
import { ChatTape, hauteurChatTape } from "./cartes/ChatTape";
import { ListeCochee, hauteurListeCochee } from "./cartes/ListeCochee";
import { Graphique, hauteurGraphique } from "./cartes/Graphique";
import { Calcul, hauteurCalcul } from "./cartes/Calcul";
import { Commentaire, hauteurCommentaire } from "./cartes/Commentaire";

export const GALERIE = Object.freeze({ duree: 93, finPrise: 91.1, finEcran: 90.45 });

/** Une carte de la galerie : son contenu est rendu en temps ABSOLU (les instants `a` sont ceux des mots). */
type CarteGalerie = {
  debut: number;
  fin: number;
  titre: string;
  icone: string;
  nom: string;
  entree: "chute" | "glisse" | "surgit";
  /** Hauteur du contenu (px), pour dimensionner la carte et placer les sous-titres dessous. */
  contenu: (W: number, H: number) => number;
  rendu: (t: number, W: number, H: number) => ReactNode;
  /** Instants des sous-éléments (un « pop » chacun). */
  pops: number[];
};

const largeurUtile = (W: number, H: number) => GEOMETRIE.carteL * W - GEOMETRIE.enteteH * H - 10;

const CARTES: CarteGalerie[] = [
  {
    debut: 9.45, fin: 15.5, titre: "Votre semaine", icone: "calendrier", nom: "Carte calendrier", entree: "chute",
    contenu: (_W, H) => hauteurCalendrier(H * 0.05, 2, true),
    rendu: (t, W, H) => (
      <Calendrier t={t} largeurImage={W} hauteurLigne={H * 0.05} jours={["Lun", "Mar", "Mer", "Jeu", "Ven"]} rangees={2}
        pastilles={[
          { jour: 0, rangee: 0, icone: "horloge", a: 9.98 },
          { jour: 1, rangee: 0, icone: "document", a: 10.52 },
          { jour: 2, rangee: 0, icone: "mail", a: 11.12 },
          { jour: 2, rangee: 1, icone: "crayon", a: 11.68 },
          { jour: 3, rangee: 0, icone: "graphique", a: 12.14 },
          { jour: 4, rangee: 1, icone: "horloge", a: 12.98, accent: true },
        ]}
        rangee={[{ icone: "document", a: 14.12 }, { icone: "mail", a: 14.3 }, { icone: "telephone", a: 14.58 }, { icone: "tableur", a: 14.9 }]} />
    ),
    pops: [9.98, 10.52, 11.12, 11.68, 12.14, 12.98, 14.12, 14.3, 14.58, 14.9],
  },
  {
    debut: 19.15, fin: 27.3, titre: "Axion-IA · ce qu'on fait", icone: "etincelles", nom: "Grille de vignettes (3 niveaux)", entree: "surgit",
    contenu: (_W, H) => hauteurGrilleVignettes(H * 0.1, 4, 2),
    rendu: (t, W, H) => (
      <GrilleVignettes t={t} largeurImage={W} hauteurVignette={H * 0.1} colonnes={2}
        vignettes={[
          { a: 20.22, legende: "Former", contenu: { type: "fiche", lignes: 3, icone: "former", iconeA: 20.9 } },
          { a: 21.8, legende: "Accompagner", contenu: { type: "texte", titre: "1:1", pastille: "Dirigeant" } },
          { a: 23.92, legende: "Auditer", contenu: { type: "ecran", barres: 3 } },
          { a: 25.3, legende: "Automatiser", contenu: { type: "image" } },
        ]} />
    ),
    pops: [20.22, 20.9, 21.8, 23.92, 25.3],
  },
  {
    debut: 33.75, fin: 38.25, titre: "Le réflexe", icone: "plus", nom: "Pile de logos + compteur", entree: "glisse",
    contenu: (W) => hauteurPileLogos(W * 0.11, 5, 5),
    rendu: (t, W, H) => (
      <PileLogos t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={W * 0.11} colonnes={5}
        compteur={[{ valeur: 3, legende: "outils", a: 33.8 }, { valeur: 4, legende: "outils", a: 33.96 }, { valeur: 5, legende: "avec l'embauche", a: 35.18 }]}
        tuiles={[{ icone: "mail", a: 33.8 }, { icone: "tableur", a: 33.85 }, { icone: "calendrier", a: 33.9 }, { icone: "robot", a: 33.96 }, { icone: "utilisateur", a: 35.18 }]}
        cadenas={{ a: 37.2, texte: "Et la fuite ?" }} />
    ),
    pops: [33.8, 33.85, 33.9, 33.96, 35.18, 37.42],
  },
  {
    debut: 39.85, fin: 50.75, titre: "Un dirigeant", icone: "utilisateur", nom: "Liste de statuts qui basculent", entree: "chute",
    contenu: (_W, H) => hauteurStatuts(H * 0.055, 4),
    rendu: (t, W, H) => (
      <Statuts t={t} largeurImage={W} hauteurLigne={H * 0.055} lignesVisibles={4} avant={{ texte: "À faire" }} apres={{ texte: "Fait", icone: "coche" }}
        lignes={[
          { nom: "Recruter", detail: "pour l'administratif", a: 41.32, bascule: 46.42, apres: { texte: "Inutile" } },
          { nom: "Où part le temps", detail: "regardé d'abord", a: 44.08, bascule: 44.92, apres: { texte: "Trouvé", icone: "loupe" } },
          { nom: "Les équipes", detail: "leur après-midi", a: 48.0, bascule: 48.62, apres: { texte: "Retrouvé", icone: "coche" } },
          { nom: "Le dirigeant", detail: "son week-end", a: 49.46, bascule: 49.94, apres: { texte: "Retrouvé", icone: "coche" } },
        ]} />
    ),
    pops: [41.32, 44.08, 44.92, 46.42, 48.0, 48.62, 49.46, 49.94],
  },
  {
    debut: 55.25, fin: 59.6, titre: "Le diagnostic fuite", icone: "message", nom: "Chat qui se tape", entree: "surgit",
    contenu: (_W, H) => hauteurChatTape(H * 0.05, 2),
    rendu: (t, W, H) => (
      <ChatTape t={t} largeurImage={W} hauteurLigne={H * 0.05} indication="Votre question…"
        message={{ texte: "Un premier diagnostic ?", a: 55.4, vitesse: 30 }} reponse={{ a: 56.2, lignes: 2, icone: "etincelles" }}
        puces={[{ texte: "Gratuit", icone: "etoile", a: 56.24 }, { texte: "45 min", icone: "horloge", a: 57.36 }, { texte: "En visio", icone: "video", a: 58.0 }]} />
    ),
    pops: [55.4, 56.24, 57.36, 58.0],
  },
  {
    debut: 59.7, fin: 67.3, titre: "En 45 minutes", icone: "loupe", nom: "Liste cochée en cascade + badge", entree: "chute",
    contenu: (_W, H) => hauteurListeCochee(H * 0.05, 3),
    rendu: (t, W, H) => (
      <ListeCochee t={t} largeurImage={W} hauteurLigne={H * 0.05} entete={{ texte: "Trois questions", icone: "loupe", a: 59.75 }}
        lignes={[
          { texte: "Où part votre temps", icone: "horloge", a: 59.96 },
          { texte: "Ce qui change en premier", icone: "eclair", a: 62.72 },
          { texte: "Ce qu'il vous faut", icone: "boussole", a: 65.58 },
        ]}
        cocheA={66.3} badge={{ texte: "Vos priorités", icone: "etoile", a: 66.75 }} />
    ),
    pops: [59.96, 62.72, 65.58, 66.3, 66.38, 66.46, 66.75],
  },
  {
    debut: 73.35, fin: 76.05, titre: "Vos priorités", icone: "graphique", nom: "Graphique : barres + pastilles", entree: "glisse",
    contenu: (_W, H) => hauteurGraphique(H * 0.05, H * 0.15, true, true),
    rendu: (t, W, H) => (
      <Graphique t={t} largeurImage={W} hauteurLigne={H * 0.05} hauteurGraphique={H * 0.15} baseA={73.45} mention="Illustration"
        barres={[{ hauteur: 0.9, a: 73.9, libelle: "N° 1", accent: true }, { hauteur: 0.62, a: 74.1, libelle: "N° 2" }, { hauteur: 0.38, a: 74.3, libelle: "N° 3" }]}
        pastilles={[{ texte: "Claires", icone: "coche", a: 74.74 }, { texte: "Classées", icone: "graphique", a: 75.14 }]} />
    ),
    pops: [73.9, 74.1, 74.3, 74.74, 75.14],
  },
  {
    debut: 76.15, fin: 81.7, titre: "Le calcul (exemple)", icone: "euro", nom: "Calcul avant / après", entree: "chute",
    contenu: (_W, H) => hauteurCalcul(H * 0.04, 2),
    rendu: (t, W, H) => (
      <Calcul t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={H * 0.04} unite="h"
        avant={{ titre: "Mauvaise cible", a: 76.3, lignes: [{ libelle: "Outil au hasard", valeur: 10, a: 76.9 }, { libelle: "Essais", valeur: 10, a: 77.68 }], libelleTotal: "Temps perdu", totalA: 78.3, barreA: 78.6 }}
        apres={{ titre: "Bonne fuite", a: 79.2, lignes: [{ libelle: "Tâche ciblée", valeur: 2, a: 79.58 }, { libelle: "Gain", valeur: 2, a: 80.0 }], libelleTotal: "Temps passé", totalA: 80.2, barreA: 80.4 }}
        barreTotalAvantA={80.8} badge={{ texte: "Exemple", a: 81.0 }} />
    ),
    pops: [76.9, 77.68, 78.3, 79.58, 80.0, 80.2, 81.0],
  },
  {
    debut: 81.85, fin: 88.0, titre: "Commentaires", icone: "message", nom: "Commentaire tapé + notification", entree: "surgit",
    contenu: (_W, H) => hauteurCommentaire(H * 0.045, true),
    rendu: (t, W, H) => (
      <Commentaire t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={H * 0.045}
        publication={{ auteur: "Axion-IA", texte: "Du temps vous échappe ? Le diagnostic fuite, gratuit.", a: 81.95 }}
        champ={{ indication: "Votre commentaire…", a: 82.3 }} saisie={{ texte: "DIAGNOSTIC", debut: 82.9, fin: 83.9 }}
        bouton={{ texte: "Publier", a: 84.3 }} commentaire={{ auteur: "Vous", a: 84.5, jaimeA: 85.2 }}
        notification={{ titre: "Nouveau message", texte: "Votre lien de réservation", a: 86.0 }} />
    ),
    pops: [82.3, 84.3, 84.5, 85.2, 86.0],
  },
];

type FenetreGalerie = { debut: number; fin: number; image: string; nom: string; etiquette?: { texte: string; a: number }; noirEtBlancA?: number; capture?: boolean; entree?: "droite" | "bas" | "zoom" };

const FENETRES: FenetreGalerie[] = [
  { debut: 15.75, fin: 19.05, image: "horloge", nom: "Fenêtre qui passe en noir et blanc", noirEtBlancA: 17.2, etiquette: { texte: "Sans bruit", a: 18.0 } },
  { debut: 30.0, fin: 31.85, image: "equipe", nom: "Fenêtre qui entre en grossissant", entree: "zoom", etiquette: { texte: "Partout", a: 30.1 } },
  { debut: 67.75, fin: 70.95, image: "robot", nom: "Capture d'écran qui monte du bas", entree: "bas", capture: true, etiquette: { texte: "Audit complet", a: 69.34 } },
];

/** Étiquettes et rangées posées sur l'image (hors cartes). */
type Calque = { debut: number; fin: number; nom: string; rendu: (t: number, W: number, H: number) => ReactNode; pops: number[]; tics?: number[] };

const CALQUES: Calque[] = [
  { debut: 4.3, fin: 6.0, nom: "Étiquette barrée", pops: [4.3], rendu: (t, W, H) => <Etiquette t={t} debut={4.3} fin={6.0} x={W / 2} y={H * 0.11} largeurImage={W} texte="Problème de travail" taille={W * 0.055} barreA={5.42} rotation={3} /> },
  { debut: 5.95, fin: 8.9, nom: "Étiquette à icônes", pops: [5.95, 6.1, 6.3], rendu: (t, W, H) => <Etiquette t={t} debut={5.95} fin={8.9} x={W / 2} y={H * 0.11} largeurImage={W} texte="Une fuite" fond="orange" taille={W * 0.06} icones={[{ nom: "horloge", a: 6.1 }, { nom: "euro", a: 6.3 }]} /> },
  { debut: 7.5, fin: 9.3, nom: "Étiquette qui glisse", pops: [7.5], rendu: (t, W, H) => <EtiquetteGlisse t={t} debut={7.5} fin={9.3} y={H * 0.22} largeurImage={W} texte="Pour vous" icone="utilisateur" /> },
  { debut: 27.45, fin: 30.0, nom: "Étiquette à icônes (tailles)", pops: [27.45, 27.5, 28.5, 29.62], rendu: (t, W, H) => <Etiquette t={t} debut={27.45} fin={30.0} x={W / 2} y={H * 0.11} largeurImage={W} texte="Toutes les tailles" taille={W * 0.05} icones={[{ nom: "utilisateur", a: 27.5 }, { nom: "utilisateurs", a: 28.5 }, { nom: "batiment", a: 29.62 }]} /> },
  { debut: 32.1, fin: 33.7, nom: "Étiquette barrée (colmater)", pops: [32.16], rendu: (t, W, H) => <Etiquette t={t} debut={32.1} fin={33.7} x={W / 2} y={H * 0.11} largeurImage={W} texte="Colmater" fond="orange" taille={W * 0.065} barreA={33.0} rotation={-3} /> },
  { debut: 38.3, fin: 39.85, nom: "Étiquette qui glisse (loupe)", pops: [38.3], rendu: (t, W, H) => <EtiquetteGlisse t={t} debut={38.3} fin={39.85} y={H * 0.1} largeurImage={W} texte="Trouver la fuite" icone="loupe" /> },
  { debut: 53.75, fin: 55.25, nom: "Étiquette mot fort", pops: [53.78, 54.26], rendu: (t, W, H) => <Etiquette t={t} debut={53.75} fin={55.25} x={W / 2} y={H * 0.11} largeurImage={W} texte="Diagnostic fuite" fond="orange" taille={W * 0.06} icones={[{ nom: "loupe", a: 54.26 }]} /> },
  { debut: 56.94, fin: 59.6, nom: "Étiquette compteur", pops: [], tics: ticsCompteur(56.94, 0, 45, 1.3), rendu: (t, W, H) => <EtiquetteCompteur t={t} debut={56.94} fin={59.6} x={W * 0.74} y={H * 0.6} largeurImage={W} de={0} a={45} dureeDefilement={1.3} suffixe=" min" legende="gratuit" taille={W * 0.075} fond="orange" /> },
  { debut: 71.4, fin: 73.3, nom: "Étiquette compteur (rappel)", pops: [], tics: ticsCompteur(71.4, 0, 45, 1.0), rendu: (t, W, H) => <EtiquetteCompteur t={t} debut={71.4} fin={73.3} x={W / 2} y={H * 0.12} largeurImage={W} de={0} a={45} dureeDefilement={1.0} suffixe=" minutes" taille={W * 0.08} /> },
  { debut: 88.1, fin: 90.45, nom: "Rangée de logos", pops: [88.1, 89.02, 89.34, 90.16], rendu: (t, W, H) => <RangeeLogos t={t} debut={88.1} fin={90.45} x={W / 2} y={H * 0.12} largeurImage={W} logos={[{ icone: "calendrier", a: 88.1 }, { icone: "telephone", a: 89.02 }, { icone: "loupe", a: 89.34 }, { icone: "etoile", a: 90.16 }]} /> },
];

/** Zooms coupés : [début, fin, échelle]. */
const ZOOMS: [number, number, number][] = [[3.82, 5.4, 1.12], [5.42, 6.9, 1.22], [6.96, 9.4, 1.08], [27.45, 30.0, 1.12], [50.9, 53.7, 1.15], [53.72, 55.25, 1.25], [70.95, 73.3, 1.12], [88.1, 90.45, 1.15]];

/** Bruitages dérivés des événements (préfigure le lot E) : whoosh aux entrées, pop par élément, tic du compteur. */
export function bruitagesGalerie(): [number, string, number][] {
  const s: [number, string, number][] = [];
  for (const c of CARTES) {
    s.push([c.debut - 0.02, "whoosh-in", 0.25], [c.fin - 0.12, "whoosh-out", 0.18]);
    c.pops.forEach((a, i) => s.push([a, i % 3 === 0 ? "drop_002" : i % 3 === 1 ? "drop_003" : "drop_001", 0.04]));
  }
  for (const f of FENETRES) {
    s.push([f.debut - 0.02, "whoosh-in", 0.25]);
    if (f.etiquette) s.push([f.etiquette.a, "drop_004", 0.04]);
    if (f.noirEtBlancA) s.push([f.noirEtBlancA, "minimize_004", 0.06]);
  }
  for (const c of CALQUES) {
    c.pops.forEach((a, i) => s.push([a, i === 0 ? "maximize_004" : "drop_003", i === 0 ? 0.07 : 0.04]));
    c.tics?.forEach((a) => s.push([a, "tick_001", 0.05]));
  }
  for (const [a] of ZOOMS) s.push([a, "click_002", 0.05]);
  s.push([GALERIE.finEcran - 0.02, "whoosh-in", 0.3], [GALERIE.finEcran + 0.25, "drop_004", 0.05], [GALERIE.finEcran + 0.45, "tick_001", 0.05], [GALERIE.finEcran + 0.54, "tick_001", 0.05], [GALERIE.finEcran + 0.63, "tick_001", 0.05], [GALERIE.finEcran + 0.72, "tick_001", 0.05], [GALERIE.finEcran + 0.95, "confirmation_002", 0.06]);
  return s.sort((a, b) => a[0] - b[0]);
}

/** Nom du composant affiché à l'instant `t` (pastille de validation pour Will). */
function composantEnCours(t: number): { n: number; nom: string } | null {
  const tous = [...CARTES.map((c) => ({ d: c.debut, f: c.fin, nom: c.nom })), ...FENETRES.map((f) => ({ d: f.debut, f: f.fin, nom: f.nom })), ...CALQUES.map((c) => ({ d: c.debut, f: c.fin, nom: c.nom })), { d: GALERIE.finEcran, f: GALERIE.duree, nom: "Écran de fin (par réseau)" }].sort((a, b) => a.d - b.d);
  const i = tous.findIndex((x) => dans(t, x.d, x.f));
  return i < 0 ? null : { n: i + 1, nom: `${tous[i].nom} · ${tous.length} composants` };
}

const hauteurCarte = (c: CarteGalerie, W: number, H: number) => GEOMETRIE.enteteH * H * 1.9 + c.contenu(W, H) + 12;

export function GalerieInterfaceClaire() {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;

  const pousse = Math.max(0, ...CARTES.map((c) => rebond(t, c.debut, TEMPS.entreeCarte, 1.2) * (1 - sortie(t, c.fin, TEMPS.retourImage))));
  const zoom = ZOOMS.find(([a, b]) => dans(t, a, b))?.[2] ?? 1;
  const carte = CARTES.find((c) => dans(t, c.debut, c.fin + 0.05));
  const yST = carte
    ? Math.min(0.84, (GEOMETRIE.carteY * H + hauteurCarte(carte, W, H) + H * 0.065) / H)
    : FENETRES.some((f) => dans(t, f.debut, f.fin))
      ? GEOMETRIE.sousTitresFenetre
      : GEOMETRIE.sousTitresHors;
  const monteFin = pousseeFin(t, GALERIE.finEcran);
  const enCours = composantEnCours(t);

  return (
    <AbsoluteFill style={{ background: COULEURS.encre }}>
      <AbsoluteFill style={{ transform: `translateY(${-monteFin * H}px)` }}>
        <AbsoluteFill style={{ transform: `translateY(${pousse * GEOMETRIE.pousseeH * H}px) scale(${zoom})`, transformOrigin: "50% 32%" }}>
          <Sequence durationInFrames={Math.round(GALERIE.finPrise * fps)} layout="none">
            <OffthreadVideo src={staticFile("prise.mp4")} style={{ width: W, height: H, objectFit: "cover" }} />
          </Sequence>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: GEOMETRIE.bandeH * H, background: COULEURS.ivoire, transform: `translateY(${-(1 - pousse) * GEOMETRIE.bandeH * H}px)` }} />

        {CARTES.map((c, i) => (
          <Carte key={c.debut} t={t} debut={c.debut} fin={c.fin} largeurImage={W} hauteurImage={H} titre={c.titre} numero={`${i + 1}/${CARTES.length}`} iconeTitre={c.icone} hauteur={hauteurCarte(c, W, H)} entree={c.entree} enfants={c.rendu(t, W, H)} />
        ))}
        {FENETRES.map((f) => (
          <Fenetre key={f.debut} t={t} debut={f.debut} fin={f.fin} src={staticFile(`images/${f.image}.jpg`)} largeurImage={W} hauteurImage={H} etiquette={f.etiquette} noirEtBlancA={f.noirEtBlancA} capture={f.capture} entree={f.entree} />
        ))}
        {CALQUES.filter((c) => dans(t, c.debut, c.fin)).map((c) => (
          <div key={c.debut}>{c.rendu(t, W, H)}</div>
        ))}

        <SousTitres t={t} groupes={GROUPES_GALERIE} y={yST * H} largeurImage={W} />
        <BarreProgression t={t} duree={GALERIE.duree} largeur={W} />
      </AbsoluteFill>
      <Fin t={t} debut={GALERIE.finEcran} largeurImage={W} hauteurImage={H} marque="Axion-IA" adresse="axion-ia.com" motCle="DIAGNOSTIC" tuiles={["former", "boussole", "loupe", "eclair"]} appel="Le lien en commentaire" />

      {/* Pastille de validation (galerie seulement) : quel composant est à l'écran. */}
      {enCours ? (
        <div style={{ position: "absolute", left: W * 0.03, bottom: H * 0.025, ...styleBoite(W, COULEURS.encre, 10), padding: `4px ${W * 0.015}px`, fontFamily: POLICES.titre, fontSize: W * 0.022, color: COULEURS.ivoire, opacity: 0.92 }}>
          {enCours.n} · {enCours.nom}
        </div>
      ) : null}

      {bruitagesGalerie().map(([a, son, volume], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(a * fps))} durationInFrames={Math.round(1.5 * fps)} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
