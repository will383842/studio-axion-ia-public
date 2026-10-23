/**
 * RENDU UNIVERSEL du face caméra animé : une vidéo entière à partir d'un PLAN DE MISE EN SCÈNE
 * (`plan-facecam-animee/1`, `src/domaine/facecam-animee/plan.ts`), écrit par le réalisateur (Opus ou règles fixes).
 * Aucune donnée en dur : tout vient du plan (props Remotion). La galerie de validation est un plan comme un autre.
 */
import React, { useMemo } from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CalquePlan, CartePlan, ContenuCarte, PlanFacecamAnimee } from "../../../src/domaine/facecam-animee/plan";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../commune/polices";
import { Carte, contenuAvance, Frise, sansBandeVide } from "./Carte";
import { FIN_SUR_VISAGE, grossissementContenu, hauteurBande, hauteurCarteFraction, hauteurContenu, positionSousTitres, scene, transformPrise } from "./cadrage";
import type { MesureCalque } from "./cadrage";
import { COULEURS, GEOMETRIE, POLICES } from "./charte";
import { BarreProgression, Etiquette, EtiquetteGlisse, styleBoite, TuileLogo } from "./elements";
import { EtiquetteCompteur, RangeeLogos } from "./etiquettes-plus";
import { Fenetre } from "./Fenetre";
import { FinSurVisage } from "./Fin";
import { dans } from "./mouvement";
import { SousTitres } from "./SousTitres";
import { Calendrier } from "./cartes/Calendrier";
import { GrilleVignettes } from "./cartes/GrilleVignettes";
import { PileLogos } from "./cartes/PileLogos";
import { Statuts } from "./cartes/Statuts";
import { ChatTape } from "./cartes/ChatTape";
import { ListeCochee } from "./cartes/ListeCochee";
import { Graphique } from "./cartes/Graphique";
import { Calcul } from "./cartes/Calcul";
import { Commentaire } from "./cartes/Commentaire";
import type { ContenuMotion, FamilleMotion, MotionPlan } from "../../../src/domaine/facecam-animee/plan";
import type { GroupeSousTitre } from "./SousTitres";
import { descentePriseV3, enCoursV3, rendreElementV3, sousTitresYV3 } from "./motion-v3/registre-v3";
import { MotGeant } from "./motion/MotGeant";
import { DESSINS_PARTAGE, EcranPartage } from "./motion/EcranPartage";
import type { DessinDit, DessinPartage } from "./motion/EcranPartage";
import { Telephone } from "./motion/Telephone";
import type { EvenementTelephone } from "./motion/Telephone";
import { CarteFrance } from "./motion/CarteFrance";
import { PileNotifications, pileNotificationsDepuisPlan } from "./motion/PileNotifications";
import { ChiffreEclate, chiffreEclateDepuisPlan, ecrireNombre, visageDepuisPrise } from "./motion/ChiffreEclate";
import { TraitDessine, traitsDessinesDepuisPlan } from "./motion/TraitDessine";
import { VoletChapitre, voletDepuisPlan } from "./motion/VoletChapitre";
import { Ruban } from "./motion/Ruban";
import { Horloge } from "./motion/Horloge";
import { Jauge } from "./motion/Jauge";
import { Bulles } from "./motion/Bulles";

/** Noms lisibles des composants (pastille de validation). */
const NOMS_CARTES: Record<ContenuCarte["type"], string> = {
  frise: "Carte frise qui s'allume",
  chat: "Carte chat qui se tape",
  grille: "Carte grille de vignettes",
  liste: "Carte liste cochée",
  calendrier: "Carte calendrier",
  graphique: "Carte graphique",
  statuts: "Carte statuts qui basculent",
  calcul: "Carte calcul avant / après",
  logos: "Carte pile de logos",
  commentaire: "Carte commentaire",
};
const NOMS_CALQUES: Record<CalquePlan["type"], string> = { etiquette: "Étiquette", glisse: "Étiquette qui glisse", compteur: "Étiquette compteur", logos: "Rangée de logos", tuile: "Tuile logo" };

const hLigne = (H: number) => H * 0.05;

/** Hauteur d'une carte (px) : mise en page commune (`cadrage.ts`), gardée ici pour les appelants existants. */
export const hauteurCartePlan = (c: CartePlan, W: number, H: number, yeux?: number) => hauteurCarteFraction(c, W, H, yeux) * H;
export { hauteurContenu };

/**
 * Contenu d'une carte. `g` (≥ 1, `grossissementContenu`) AGRANDIT les hauteurs du contenu pour remplir la carte : toutes
 * les hauteurs partent de `Hc = H × g`, les largeurs restent celles de la carte.
 */
function contenuCarte(c: ContenuCarte, t: number, W: number, H0: number, g = 1): ReactNode {
  const H = H0 * g;
  const largeurUtile = (L: number, _h: number) => GEOMETRIE.carteL * L - GEOMETRIE.enteteH * H0 - 10;
  switch (c.type) {
    case "frise":
      return <Frise t={t} etapes={c.etapes} largeurImage={W} hauteurLigne={H * 0.056} badge={c.badge} puces={c.puces} cocheA={c.cocheA} />;
    case "chat":
      return <ChatTape t={t} largeurImage={W} hauteurLigne={hLigne(H)} indication={c.indication} message={c.message} reponse={c.reponse} puces={c.puces} />;
    case "grille":
      return <GrilleVignettes t={t} largeurImage={W} hauteurVignette={H * 0.1} colonnes={c.colonnes ?? 2} vignettes={c.vignettes} />;
    case "liste":
      return <ListeCochee t={t} largeurImage={W} hauteurLigne={hLigne(H)} entete={c.entete} lignes={c.lignes} cocheA={c.cocheA} badge={c.badge} />;
    case "calendrier":
      return <Calendrier t={t} largeurImage={W} hauteurLigne={hLigne(H)} jours={c.jours} rangees={c.rangees} pastilles={c.pastilles} rangee={c.rangee} />;
    case "graphique":
      return <Graphique t={t} largeurImage={W} hauteurLigne={hLigne(H)} hauteurGraphique={H * 0.15} baseA={c.baseA} barres={c.barres} pastilles={c.pastilles} mention={c.mention} />;
    case "statuts":
      return <Statuts t={t} largeurImage={W} hauteurLigne={H * 0.055} lignesVisibles={Math.min(4, c.lignes.length)} avant={c.avant} apres={c.apres} lignes={c.lignes} />;
    case "calcul":
      return <Calcul t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={H * 0.04} unite={c.unite} avant={c.avant} apres={c.apres} barreTotalAvantA={c.barreTotalAvantA} badge={c.badge} />;
    case "logos":
      return <PileLogos t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={W * 0.11 * g} colonnes={5} compteur={c.compteur} tuiles={c.tuiles} cadenas={c.cadenas} />;
    case "commentaire":
      return <Commentaire t={t} largeurImage={W} largeur={largeurUtile(W, H)} taille={H * 0.045} publication={c.publication} champ={c.champ} saisie={c.saisie} bouton={c.bouton} commentaire={c.commentaire} notification={c.notification} />;
  }
}

function calque(c: CalquePlan, m: MesureCalque, t: number, W: number): ReactNode {
  switch (c.type) {
    case "etiquette":
      return <Etiquette t={t} debut={c.debut} fin={c.fin} x={m.x} y={m.y} largeurImage={W} texte={c.texte} sousTexte={c.sousTexte} fond={c.fond} taille={m.taille} icones={c.icones} barreA={c.barreA} rotation={c.barreA !== undefined ? 3 : -3} />;
    case "glisse":
      return <EtiquetteGlisse t={t} debut={c.debut} fin={c.fin} y={m.y} largeurImage={W} texte={c.texte} icone={c.icone} taille={m.taille} />;
    case "compteur":
      return <EtiquetteCompteur t={t} debut={c.debut} fin={c.fin} x={m.x} y={m.y} largeurImage={W} de={c.de} a={c.a} dureeDefilement={c.dureeDefilement} prefixe={c.prefixe} suffixe={c.suffixe} legende={c.legende} taille={m.taille} fond={c.fond} />;
    case "logos":
      return <RangeeLogos t={t} debut={c.debut} fin={c.fin} x={m.x} y={m.y} largeurImage={W} logos={c.logos} cote={m.taille} />;
    case "tuile":
      return <TuileLogo t={t} debut={c.debut} fin={c.fin} x={m.x} y={m.y} largeurImage={W} icone={c.icone} legende={c.legende} tailleLegende={m.tailleLegende} />;
  }
}

/* ---------------- Motions (retour de Will du 15/10 : plus de variété) — composants de `motion/` ---------------- */

const NOMS_MOTIONS: Record<FamilleMotion, string> = {
  "mot-geant": "Mot géant",
  "ecran-partage": "Écran partagé",
  telephone: "Téléphone",
  "carte-france": "Carte de France",
  "pile-notifications": "Pile de notifications",
  "chiffre-eclate": "Chiffre qui éclate",
  "trait-dessine": "Trait dessiné",
  volet: "Volet de chapitre",
  ruban: "Ruban de mots-clés",
  horloge: "Horloge",
  jauge: "Jauge",
  bulles: "Bulles de questions",
};

/** Contenu typé d'une motion (déjà validé par `schemaMotion` contre le schéma de sa famille). */
const contenuDe = <F extends FamilleMotion>(m: MotionPlan, _f: F) => m.contenu as unknown as ContenuMotion<F> & Record<string, unknown>;

/** Dessin d'écran partagé : l'icône du plan si c'est un dessin de la famille, sinon un dessin par défaut du côté. */
const DESSINS_DEFAUT: Record<"gauche" | "droite", DessinPartage[]> = { gauche: ["pile-papiers", "sablier"], droite: ["soleil", "coche"] };
const dessinPartage = (icone: string | undefined, cote: "gauche" | "droite", rang: number): DessinPartage =>
  icone && (DESSINS_PARTAGE as readonly string[]).includes(icone) ? (icone as DessinPartage) : DESSINS_DEFAUT[cote][Math.min(rang, 1)];

/** Libellé d'en-tête du téléphone selon l'application (nom d'écran, pas un texte prononcé). */
const TITRES_APPLI: Record<ContenuMotion<"telephone">["appli"], string> = { mail: "Mail", message: "Messages", agenda: "Agenda", visio: "Visio", notification: "Axion-IA", lien: "Lien" };

/** Les sous-titres sont masqués pendant ces familles : leurs objets portent déjà les mots (fiches des designers). */
const MASQUENT_SOUS_TITRES: ReadonlySet<FamilleMotion> = new Set(["pile-notifications", "chiffre-eclate", "mot-geant", "volet"]);
/** Sous-titres en haut pendant le téléphone (fiche : « haut-gauche » ; `SousTitres` ne sait que centrer → en haut, centrés). */
const Y_SOUS_TITRES_HAUT = 0.075;

/** Effet d'une motion sur les sous-titres à l'instant `t` : masqués, en haut (téléphone) ou inchangés. */
export function sousTitresPendantMotions(motions: readonly MotionPlan[] | undefined, t: number): "masques" | "haut" | null {
  let r: "masques" | "haut" | null = null;
  for (const m of motions ?? []) {
    if (!dans(t, m.debut, m.fin)) continue;
    if (MASQUENT_SOUS_TITRES.has(m.famille)) return "masques";
    if (m.famille === "telephone") r = "haut";
  }
  return r;
}

export type ContexteMotion = { t: number; W: number; H: number; groupes: GroupeSousTitre[]; ySousTitres: number; prise: PlanFacecamAnimee["prise"] };

/** Une motion du plan → son composant (`motion/`). Le rendu reste la seule source : aucun texte ajouté. */
export function rendreMotion(m: MotionPlan, x: ContexteMotion): ReactNode {
  const { t, W, H } = x;
  const base = { t, largeurImage: W, hauteurImage: H };
  switch (m.famille) {
    case "mot-geant": {
      const c = contenuDe(m, "mot-geant");
      return <MotGeant {...base} donnees={{ a: c.mots[0].a, fin: m.fin, mot: c.mots.map((w) => w.texte).join(" "), fond: c.fond === "orange" ? "orange" : "encre" }} />;
    }
    case "ecran-partage": {
      const c = contenuDe(m, "ecran-partage");
      const cote = (k: "gauche" | "droite"): DessinDit[] => {
        const els = (c.elements ?? []).filter((e) => e.cote === k).slice(0, 2);
        return els.length ? els.map((e, i) => ({ dessin: dessinPartage(e.icone, k, i), texte: e.texte, a: e.a })) : [{ dessin: dessinPartage(c[k].icone, k, 0), texte: c[k].titre, a: c[k].a }];
      };
      return <EcranPartage {...base} donnees={{ debut: m.debut, fin: m.fin, titreAvant: c.gauche.titre, titreApres: c.droite.titre, avant: cote("gauche"), apres: cote("droite") }} />;
    }
    case "telephone": {
      const c = contenuDe(m, "telephone");
      const titre = typeof c.titre === "string" ? c.titre : TITRES_APPLI[c.appli];
      const saisie = c.appli === "mail" || c.appli === "message" || c.appli === "lien";
      const evenements: EvenementTelephone[] = c.lignes.map((l, i): EvenementTelephone => {
        if (i === 0 && saisie) return { genre: "frappe", texte: l.texte, a: l.a };
        if (i > 0 && i === c.lignes.length - 1) return { genre: "coche", texte: l.texte, a: l.a };
        return { genre: "notification", titre, texte: l.texte, a: l.a, icone: l.icone };
      });
      return <Telephone {...base} donnees={{ debut: m.debut, fin: m.fin, titre, evenements }} />;
    }
    case "carte-france": {
      const c = contenuDe(m, "carte-france");
      const a = c.points.map((p) => p.a);
      // 1 à 3 vagues : premier, milieu et dernier point dits.
      const vagues = a.length <= 3 ? a : [a[0], a[Math.floor(a.length / 2)], a[a.length - 1]];
      return <CarteFrance {...base} donnees={{ debut: m.debut, fin: m.fin, vagues }} />;
    }
    case "pile-notifications":
      return <PileNotifications {...base} donnees={pileNotificationsDepuisPlan(contenuDe(m, "pile-notifications"), m.debut, m.fin)} />;
    case "chiffre-eclate": {
      const p = x.prise;
      const visage = visageDepuisPrise({ yeux: p.yeux ?? 0.34, centreX: p.centreX ?? 0.5, largeurVisage: p.largeurVisage ?? 0.38 });
      return <ChiffreEclate {...base} donnees={chiffreEclateDepuisPlan(contenuDe(m, "chiffre-eclate"), m.debut, m.fin, visage)} />;
    }
    case "trait-dessine":
      return (
        <>
          {traitsDessinesDepuisPlan(contenuDe(m, "trait-dessine"), x.groupes, x.ySousTitres, W, H).map((d, i) => (
            <TraitDessine key={i} {...base} donnees={{ ...d, fin: Math.min(d.fin ?? m.fin, m.fin + 0.3) }} />
          ))}
        </>
      );
    case "volet":
      return <VoletChapitre {...base} donnees={voletDepuisPlan(contenuDe(m, "volet"), m.debut, m.fin)} />;
    case "ruban":
      return <Ruban {...base} debut={m.debut} fin={m.fin} motsCles={contenuDe(m, "ruban").mots} />;
    case "horloge": {
      const c = contenuDe(m, "horloge");
      // Durée affichée : la valeur DITE (`duree`), sinon la légende dite en mots (« tous les soirs »), posée sur le dernier repère.
      const aTexte = c.reperes?.length ? c.reperes[c.reperes.length - 1].a : c.a;
      const duree = c.duree ? { texte: `${ecrireNombre(c.duree.valeur)} ${c.duree.unite}`, a: c.a } : c.legende ? { texte: c.legende, a: aTexte } : undefined;
      return <Horloge {...base} debut={m.debut} fin={m.fin} mode={c.mode === "minuteur" ? "minuteur" : "emballe"} duree={duree} />;
    }
    case "jauge": {
      const c = contenuDe(m, "jauge");
      const n = c.niveaux;
      const dernier = n[n.length - 1];
      const de = n.length >= 2 ? n[0].niveau : 0.12;
      return <Jauge {...base} debut={m.debut} fin={m.fin} de={de} vers={dernier.niveau} aMonte={Math.max(m.debut + 0.45, dernier.a)} etat={{ texte: c.legende, a: Math.max(m.debut + 0.45, dernier.a) }} />;
    }
    case "bulles": {
      const c = contenuDe(m, "bulles");
      return <Bulles {...base} debut={m.debut} fin={m.fin} bulles={c.questions} reponseA={typeof c.reponseA === "number" ? c.reponseA : undefined} />;
    }
  }
}

/** Composant à l'écran à l'instant `t` (pastille de validation). */
function composantEnCours(plan: PlanFacecamAnimee, t: number): string | null {
  const tous = [
    ...plan.cartes.map((c) => ({ d: c.debut, f: c.fin, nom: NOMS_CARTES[c.contenu.type] })),
    ...plan.fenetres.map((f) => ({ d: f.debut, f: f.fin, nom: f.noirEtBlancA !== undefined ? "Fenêtre qui passe en noir et blanc" : f.capture ? "Fenêtre capture d'écran" : f.video ? "Fenêtre vidéo" : "Fenêtre photo" })),
    ...plan.calques.map((c) => ({ d: c.debut, f: c.fin, nom: c.type === "etiquette" && c.barreA !== undefined ? "Étiquette barrée" : c.type === "etiquette" && c.icones?.length ? "Étiquette à icônes" : NOMS_CALQUES[c.type] })),
    ...(plan.motions ?? []).map((m) => ({ d: m.debut, f: m.fin, nom: `Motion · ${NOMS_MOTIONS[m.famille]}` })),
    ...(plan.elementsV3 ?? []).map((e) => ({ d: e.debut, f: e.fin, nom: `Élément v3 · ${e.id}` })),
    { d: plan.fin.debut, f: plan.duree, nom: "Écran de fin" },
  ].sort((a, b) => a.d - b.d);
  const i = tous.findIndex((x) => dans(t, x.d, x.f));
  return i < 0 ? null : `${i + 1}/${tous.length} · ${tous[i].nom}`;
}

export function VideoAnimee(planBrut: PlanFacecamAnimee) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  // Bande jamais vide (revue passe 2 du 15/10) : un objet suivi d'un autre à 0,3 s ou moins reste jusqu'à son entrée.
  const plan = useMemo(() => sansBandeVide(planBrut), [planBrut]);

  // MISE EN PAGE (cadrage.ts, fonctions pures testées) : ce composant ne fait qu'appliquer ses résultats.
  const sc = useMemo(() => scene(plan), [plan]);
  const { echelle, tx, ty } = transformPrise(sc, t);
  const bande = hauteurBande(sc, t);
  const yST = positionSousTitres(sc, t);
  // Fin sur le visage (revue finale du 14/10) : la prise ne finit jamais sur un écran vide — après sa dernière image, elle
  // reste figée sur celle-ci, sous le panneau de fin qui, lui, reste animé.
  const derniereImagePrise = Math.max(0, Math.round(plan.prise.finSec * fps) - 1);
  const enCours = plan.pastilles ? composantEnCours(plan, t) : null;
  const stMotions = sousTitresPendantMotions(plan.motions, t);
  // Éléments v3 : la descente de la prise sous `carte-verre` (permise par Will) et la place des sous-titres (jamais sur les yeux).
  const descenteV3 = descentePriseV3(plan.elementsV3, t);
  const stV3 = sousTitresYV3(plan.elementsV3, t);

  return (
    <AbsoluteFill style={{ background: COULEURS.encre }}>
      <AbsoluteFill>
        {/* Zoom centré sur le VISAGE, recentrage borné, descente : origine en haut à gauche (voir cadrage.ts). */}
        <AbsoluteFill style={{ transform: `translate(${tx * W}px, ${(ty + descenteV3) * H}px) scale(${echelle})`, transformOrigin: "0 0" }}>
          <Freeze frame={derniereImagePrise} active={(f) => f >= derniereImagePrise}>
            <OffthreadVideo src={staticFile(plan.prise.src)} muted={frame >= derniereImagePrise} style={{ width: W, height: H, objectFit: "cover" }} />
          </Freeze>
        </AbsoluteFill>
        {descenteV3 > 0 && bande <= 0 ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: descenteV3 * H, background: COULEURS.ivoire }} /> : null}
        {bande > 0 ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: bande * H, background: COULEURS.ivoire }} /> : null}

        {plan.cartes.map((c, i) => {
          const hCarte = sc.cartes[i].rect.y1 - sc.cartes[i].rect.y0;
          const g = grossissementContenu(c.contenu, W, H, hCarte);
          return <Carte key={`c${c.debut}`} t={t} debut={c.debut} fin={c.fin} largeurImage={W} hauteurImage={H} titre={c.titre} numero={`${i + 1}/${plan.cartes.length}`} iconeTitre={c.icone} hauteur={hCarte * H} hauteurContenu={hauteurContenu(c.contenu, W, H, g)} entree={c.entree} enfants={dans(t, c.debut, c.fin) ? contenuCarte(contenuAvance(c.contenu, c.debut), t, W, H, g) : null} />;
        })}
        {plan.fenetres.map((f, i) => (
          <Fenetre key={`f${f.debut}`} t={t} debut={f.debut} fin={f.fin} src={staticFile(f.media)} largeurImage={W} hauteurImage={H} etiquette={f.etiquette} noirEtBlancA={f.noirEtBlancA} capture={f.capture} entree={f.entree} video={f.video ? { depuisSec: f.depuisSec ?? 0 } : undefined} rect={sc.fenetres[i].rect} />
        ))}
        {plan.calques.map((c, i) =>
          dans(t, c.debut, c.fin) ? <div key={`k${c.debut}-${i}`}>{calque(c, sc.mesuresCalques[i], t, W)}</div> : null,
        )}

        {(plan.motions ?? []).map((m, i) =>
          t >= m.debut - 0.05 && t < m.fin + 0.35 ? <React.Fragment key={`m${m.debut}-${i}`}>{rendreMotion(m, { t, W, H, groupes: plan.groupes, ySousTitres: yST, prise: plan.prise })}</React.Fragment> : null,
        )}

        {(plan.elementsV3 ?? []).map((e, i) =>
          enCoursV3(e, t) ? <React.Fragment key={`v3-${e.id}-${e.debut}-${i}`}>{rendreElementV3(e, { t, W, H, prise: plan.prise })}</React.Fragment> : null,
        )}

        <FinSurVisage t={t} debut={plan.fin.debut} largeurImage={W} hauteurImage={H} marque={plan.fin.marque} adresse={plan.fin.adresse} motCle={plan.fin.motCle} tuiles={plan.fin.tuiles} appel={plan.fin.appel} rect={FIN_SUR_VISAGE} />
        {stMotions === "masques" || stV3 === null ? null : <SousTitres t={t} groupes={plan.groupes} y={(stV3 !== undefined ? stV3 : stMotions === "haut" ? Y_SOUS_TITRES_HAUT : yST) * H} largeurImage={W} />}
        <BarreProgression t={t} duree={plan.duree} largeur={W} />
      </AbsoluteFill>

      {enCours ? (
        <div style={{ position: "absolute", left: W * 0.03, bottom: H * 0.025, ...styleBoite(W, COULEURS.encre, 10), padding: `4px ${W * 0.015}px`, fontFamily: POLICES.titre, fontSize: W * 0.022, color: COULEURS.ivoire, opacity: 0.92 }}>{enCours}</div>
      ) : null}

      {plan.sons.map(([a, son, volume], i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round(a * fps))} durationInFrames={Math.round(1.5 * fps)} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Durée et dimensions lues dans le plan (une vidéo = un plan passé en props). */
export function metaVideoAnimee({ props }: { props: PlanFacecamAnimee }) {
  return { durationInFrames: Math.round(props.duree * props.fps), fps: props.fps, width: props.largeur, height: props.hauteur };
}
