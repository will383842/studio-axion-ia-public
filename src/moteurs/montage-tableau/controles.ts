/**
 * CONTRÔLES PROPRES AU TABLEAU ANIMÉ (tâche TB-22, plan `02-FORMAT-TABLEAU-ANIME.md` § 12) : UN rapport qui assemble,
 * sans rien recopier, les contrôles existants.
 *
 *  - la fiche : `validerFicheTableau` (règles 1 à 17) ;
 *  - la variété : `src/briques/variete` (historique injecté, refus levable par un motif) ;
 *  - le « déjà-vu » : case cochée par Will, avec sa date (bloquant) ;
 *  - la mise en page et la première image : `src/briques/controle-image` sur `boitesDeControle(mettreEnPage(fiche))` ;
 *  - les mesures du fichier exporté : `src/briques/controle-image`, quand elles sont fournies ;
 *  - la relecture de 6 images clés par Claude : INJECTÉE et INDICATIVE (absente ou en erreur : « non fait »).
 *
 * Tout ce qui vient de l'extérieur est injecté (aucun appel, aucune base, aucune date lue ici). Les phrases sont en
 * français, sans sigle. N'importe AUCUN autre moteur.
 */
import { controlerImageFinale, controlerMiseEnPage, SEUILS_CONTROLE_IMAGE, zoneSureDe, type MesuresExport, type SeuilsControleImage } from "@/briques/controle-image";
import { contraste, contrasteExige } from "@/briques/tableau-scene/v2/charte";
import { cadresVidesV2, controleRemplissageV2, etiquettesIncoherentesV2, pictogrammesFautifsV2, textesCoupesV2, textesEnDoubleV2 } from "@/briques/tableau-scene/v2/remplissage";
import { resumeVisuelDepuisFiche, verifierVarieteVisuelle, type LeveeVariete, type ResumeVisuel, type SeuilsVariete } from "@/briques/variete";
import { validerFiche } from "@/briques/fiche-scenes";
import { mots } from "@/domaine/controles-script/texte";
import { blocsTropLongsReference, chevauchementsReference, couleursHorsStyleReference, dessinsParIdeeReference, horsZoneReference, pagesTropVidesReference, pagesVidesReference, seuilsImageReference, textesEnDoubleReference, type FauteReference } from "./controles-reference";
import { DESCRIPTIONS_STRUCTURES, STRUCTURES_TABLEAU, estPageEcrite, estStyleBlocs2, estStyleReference2, estStyleReference3, extensionTableau, validerFicheTableau, type FicheTableau } from "./fiche";
import { blocsTropLongsGabarit, couleursHorsGabarit, numerosAbsentsGabarit, pagesTropVidesGabarit, taillesTropPetitesGabarit, titresAbsentsGabarit } from "./controles-gabarit";
import { etiquettesAbsentes3, pagesChargees3, pagesProbleme3, pagesVides3, taillesTropPetites3, visuelsNonDessines3, visuelsPeps3 } from "./controles-v3";
import { controlerMiseEnPageTableau } from "./controles-tableau";
import { sansAppelAuMot } from "./formats-sortie";
import { ErreurMiseEnPage, boitesDeControle, boitesZoneHaute, mettreEnPage, miseEnPageBrique, reseauxVerticaux, seuilsImageBlocs2, zoneSureDeLaMise, type MiseEnPageTableau, type OptionsMiseEnPage } from "./mise-en-page";
import { REGLES_TABLEAU, textesEcrits, textesEcransScene, type ContexteTableau } from "./regles";
import { parleDuCommentaire } from "./variantes-fin";

/** Nombre d'images clés relues (plan § 12). */
export const IMAGES_CLES_RELUES = 6;

export type FamilleControle = "fiche" | "variete" | "deja-vu" | "mise-en-page" | "fichier" | "relecture";
export type EtatLigne = "reussi" | "echoue" | "non-fait";

/** Une ligne du rapport. `bloquant` : un échec empêche la livraison ; sinon il est seulement signalé. */
export interface LigneControleTableau {
  famille: FamilleControle;
  libelle: string;
  bloquant: boolean;
  etat: EtatLigne;
  /** Phrase en français, sans sigle. */
  raison: string;
  /** Scènes en cause (mise en page), quand on sait les nommer. */
  scenes?: string[];
  /** Sorties en cause (libellés), quand plusieurs sorties sont relues. */
  sorties?: string[];
}

/**
 * Une sortie dont la mise en page est relue (relecture d'avant la fabrication : CHAQUE fichier qui sera produit). Sa
 * fiche (la variante de fin d'une sortie qui a sa propre fin), et les options de sa mise en page (format, écran d'appel,
 * bulles de preuve) : exactement celles que la fabrication passera à `mettreEnPage`.
 */
export interface SortieRelue {
  id: string;
  /** Nom lisible (« Vertical 9:16 · Reels et stories »). */
  libelle: string;
  /** Fiche de cette sortie ; absente : la fiche contrôlée. */
  fiche?: FicheTableau;
  options?: OptionsMiseEnPage;
}

/** Case « Ce conseil n'est pas en première page d'une recherche », cochée par Will (pas de recherche automatique). */
export interface CaseDejaVu {
  coche: boolean;
  /** Date de la case, AAAA-MM-JJ. */
  le?: string;
}

/** Une remarque de la relecture des images clés. */
export interface RemarqueRelecture {
  /** Rang de l'image clé (1 à 6). */
  image: number;
  raison: string;
}

/** Résultat de la relecture des images clés par Claude (rendu par l'outil injecté). */
export interface RelectureImagesCles {
  /** Nombre d'images réellement relues. */
  imagesLues: number;
  remarques: readonly RemarqueRelecture[];
}

export interface EntreeControleTableau {
  /** Fiche brute (JSON lu) : validée ici. */
  fiche: unknown;
  /** Contexte des règles de la fiche (script, sources, preuves, matières, date du jour…). */
  contexte: ContexteTableau;
  /** Résumés visuels des dernières vidéos du compte, les plus récentes d'abord. */
  historique: readonly ResumeVisuel[];
  /** Structures proposables ; par défaut toutes celles du format. */
  structuresPossibles?: readonly string[];
  seuilsVariete?: Partial<SeuilsVariete>;
  /** Geste motivé de Will qui lève les refus de variété. */
  leveeVariete?: LeveeVariete;
  dejaVu?: CaseDejaVu;
  /** Mesures du fichier exporté ; absentes : ces contrôles sont « non faits ». */
  mesures?: MesuresExport;
  seuilsImage?: SeuilsControleImage;
  /** Sorties dont la mise en page est relue ; absentes : la mise en page verticale par défaut (comportement d'avant). */
  sorties?: readonly SortieRelue[];
  /** Sorties qui n'ont pas pu être préparées (fiche propre impossible à construire) : un échec bloquant chacune. */
  sortiesImpossibles?: readonly string[];
}

export interface OutilsControleTableau {
  /** Relecture de 6 images clés par Claude ; absente ou en erreur : « non fait », jamais bloquant. */
  relireImagesCles?: (fiche: FicheTableau, miseEnPage: MiseEnPageTableau) => Promise<RelectureImagesCles> | RelectureImagesCles;
}

export interface RapportControleTableau {
  /** Tout ce qui a été contrôlé, dans l'ordre du § 12. */
  lignes: LigneControleTableau[];
  /** Échecs qui empêchent la livraison. */
  bloquants: LigneControleTableau[];
  /** Échecs qui ne bloquent pas (relecture, refus de variété levé). */
  indicatifs: LigneControleTableau[];
  nonFaits: LigneControleTableau[];
  verdict: "livrable" | "bloque";
  /** Phrase courte : « Livrable », « Livrable — 1 élément non fait », « Bloqué : 2 contrôles échoués ». */
  resume: string;
  /** Une phrase par bloquant, indicatif et non-fait, en français sans sigle. */
  phrases: string[];
}

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

const ligne = (famille: FamilleControle, libelle: string, bloquant: boolean, etat: EtatLigne, raison: string): LigneControleTableau => ({ famille, libelle, bloquant, etat, raison });

/** Les contrôles de la brique commune gardent leur libellé ; leur famille dépend de leur identifiant. */
const FAMILLE_BRIQUE: Record<string, FamilleControle> = {
  "zone-sure": "mise-en-page",
  "bande-sous-titres": "mise-en-page",
  "taille-texte": "mise-en-page",
  contraste: "mise-en-page",
  "premiere-image": "mise-en-page",
};

/** Boîtes de la mise en page pour la brique commune : `miseEnPageBrique` (une seule conversion, dans `mise-en-page.ts`). */
export { miseEnPageBrique };

/* ------------------------------------------------------------------ */
/* Contrôles                                                             */
/* ------------------------------------------------------------------ */

function controlerDejaVu(c: CaseDejaVu | undefined, aujourdhui: string): LigneControleTableau {
  const libelle = "Conseil absent de la première page d'une recherche";
  if (!c?.coche) return ligne("deja-vu", libelle, true, "echoue", "La case « Ce conseil n'est pas en première page d'une recherche » n'est pas cochée : vérifiez d'abord, puis cochez-la.");
  if (!c.le || !DATE_JOUR.test(c.le)) return ligne("deja-vu", libelle, true, "echoue", "La case est cochée sans date : la date de la vérification est obligatoire.");
  if (c.le > aujourdhui) return ligne("deja-vu", libelle, true, "echoue", `La case est datée du ${c.le}, après aujourd'hui (${aujourdhui}) : corrigez la date.`);
  return ligne("deja-vu", libelle, true, "reussi", `Case cochée le ${c.le}.`);
}

function controlerVariete(fiche: FicheTableau, e: EntreeControleTableau): LigneControleTableau[] {
  const noms = Object.fromEntries(Object.entries(DESCRIPTIONS_STRUCTURES).map(([k, v]) => [k, v.nom]));
  const r = verifierVarieteVisuelle(resumeVisuelDepuisFiche(fiche), e.historique, {
    structuresPossibles: e.structuresPossibles ?? STRUCTURES_TABLEAU,
    nomsLisibles: noms,
    ...(e.seuilsVariete ? { seuils: e.seuilsVariete } : {}),
    ...(e.leveeVariete ? { levee: e.leveeVariete } : {}),
  });
  if (r.refus.length === 0) return [ligne("variete", "Variété", true, "reussi", "Structure, dessins et accroche différents des dernières vidéos du compte.")];
  if (r.leve) {
    return r.refus.map((f) => ligne("variete", "Variété", false, "echoue", `${f.message} Refus levé, motif : « ${r.motifLevee} ».`));
  }
  const conseil = r.proposition ? ` Structure conseillée : « ${noms[r.proposition] ?? r.proposition} ».` : "";
  return r.refus.map((f, i) => ligne("variete", "Variété", true, "echoue", i === 0 ? `${f.message}${conseil}` : f.message));
}

async function relire(fiche: FicheTableau, mise: MiseEnPageTableau, outils: OutilsControleTableau): Promise<LigneControleTableau[]> {
  const libelle = "Relecture des images clés";
  if (!outils.relireImagesCles) return [ligne("relecture", libelle, false, "non-fait", `Relecture des ${IMAGES_CLES_RELUES} images clés non faite : aucun relecteur fourni.`)];
  try {
    const r = await outils.relireImagesCles(fiche, mise);
    if (r.remarques.length === 0) return [ligne("relecture", libelle, false, "reussi", `${r.imagesLues} image${r.imagesLues > 1 ? "s" : ""} clé${r.imagesLues > 1 ? "s" : ""} relue${r.imagesLues > 1 ? "s" : ""}, rien à signaler.`)];
    return r.remarques.map((m) => ligne("relecture", libelle, false, "echoue", `Image clé n° ${m.image} : ${m.raison}`));
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    return [ligne("relecture", libelle, false, "non-fait", `Relecture des images clés non faite : erreur pendant la relecture${detail}.`)];
  }
}

/** Seuils du style « blocs/2 » (`seuilsImageBlocs2`), avec les seuils injectés. */
function seuilsBlocs2(mise: MiseEnPageTableau, e: EntreeControleTableau): SeuilsControleImage {
  return seuilsImageBlocs2(mise, e.seuilsImage);
}

/** Contraste de chaque texte « blocs/2 » au seuil de sa taille (3:1 en grand, 4,5:1 sinon). */
function contrasteBlocs2(mise: MiseEnPageTableau): string[] {
  const k = mise.styleV2?.geometrie.k ?? 1;
  return boitesDeControle(mise).flatMap((b) => {
    const r = contraste(b.couleurTexte, b.couleurFond);
    const min = contrasteExige(b.taillePx, k);
    return r + 1e-9 < min ? [`« ${b.texte} » (${r.toFixed(1).replace(".", ",")} pour 1, il faut ${String(min).replace(".", ",")} pour 1)`] : [];
  });
}

const zoneDeLaMise = zoneSureDeLaMise;

/** La même mise en page, réduite aux éléments d'une scène (pour nommer la scène en cause, avec les mêmes contrôles). */
function miseDeLaScene(mise: MiseEnPageTableau, sceneId: string): MiseEnPageTableau {
  return { ...mise, pages: mise.pages.map((p) => ({ ...p, elements: p.elements.filter((e) => e.sceneId === sceneId) })) };
}

/** Contrôles calculés de la brique dont on peut nommer la scène (la première image est celle de la scène 1). */
const PAR_SCENE = new Set(["zone-sure", "bande-sous-titres", "taille-texte", "contraste"]);

/** Contrôles de la brique commune sur la mise en page et sur les mesures du fichier. */
function controlerImage(fiche: FicheTableau, mise: MiseEnPageTableau, e: EntreeControleTableau): LigneControleTableau[] {
  const blocs2 = estStyleBlocs2(fiche);
  const ref = estPageEcrite(fiche) && !!mise.styleReference;
  // Hors du vertical, la zone sûre et la bande des sous-titres sont celles du format de la mise en page.
  const autreFormat = !!mise.format && mise.format !== "vertical";
  const seuils = ref ? seuilsImageReference(mise, e.seuilsImage) : blocs2 ? seuilsBlocs2(mise, e) : autreFormat ? { ...SEUILS_CONTROLE_IMAGE, ...e.seuilsImage, bandeSousTitres: mise.bandeSousTitres.px.hauteur / mise.hauteurPx } : e.seuilsImage;
  // « blocs/2 » : la zone sûre de sa mise en page (bas du vertical à 20 %, `ZONE_VERTICAL_BLOCS_2` ; titres du haut plus larges).
  const zone = blocs2 || ref || autreFormat ? zoneDeLaMise(mise) : zoneSureDe("9:16", reseauxVerticaux());
  const boitesDe = (m: MiseEnPageTableau) => {
    const b = miseEnPageBrique(fiche, m);
    return blocs2 && zone ? boitesZoneHaute(b, m, zone) : b;
  };
  const rapport = controlerImageFinale({
    ...(e.mesures ? { mesures: e.mesures } : {}),
    miseEnPage: boitesDe(mise),
    zone,
    ...(seuils ? { seuils } : {}),
  });
  // Scènes en cause : les MÊMES contrôles, rejoués sur les éléments de chaque scène.
  const echoues = new Set(rapport.controles.filter((c) => c.etat === "echoue" && PAR_SCENE.has(c.id)).map((c) => c.id));
  const scenesDe = new Map<string, string[]>();
  if (echoues.size) {
    for (const s of fiche.scenes) {
      for (const c of controlerMiseEnPage(boitesDe(miseDeLaScene(mise, s.id)), zone, seuils ?? SEUILS_CONTROLE_IMAGE)) {
        if (echoues.has(c.id) && c.etat === "echoue") scenesDe.set(c.id, [...(scenesDe.get(c.id) ?? []), s.id]);
      }
    }
  }
  const lignes = rapport.controles.map((c) => {
    const l = ligne(FAMILLE_BRIQUE[c.id] ?? "fichier", c.libelle, c.bloquant, c.etat, c.raison);
    const scenes = c.id === "premiere-image" && c.etat === "echoue" && fiche.scenes[0] ? [fiche.scenes[0].id] : scenesDe.get(c.id);
    return scenes?.length ? { ...l, scenes } : l;
  });
  if (ref) return [...lignes, ...(estStyleReference2(fiche) ? lignesGabarit(fiche, mise) : estStyleReference3(fiche) ? (mise.styleReference?.tableau ? lignesTableau3(fiche, mise) : lignesGabarit3(fiche, mise)) : lignesReference(mise))];
  if (!blocs2) return lignes;
  // Contraste au seuil de chaque texte : s'ajoute à celui de la brique (qui a reçu le seuil le plus bas, 3 pour 1).
  const fautifs = contrasteBlocs2(mise);
  const scenesContraste = fautifs.length ? fiche.scenes.filter((s) => contrasteBlocs2(miseDeLaScene(mise, s.id)).length).map((s) => s.id) : [];
  lignes.push(
    fautifs.length
      ? { ...ligne("mise-en-page", "Contraste selon la taille", true, "echoue", `Texte peu lisible : ${fautifs.join(", ")}.`), ...(scenesContraste.length ? { scenes: scenesContraste } : {}) }
      : ligne("mise-en-page", "Contraste selon la taille", true, "reussi", "Contraste suffisant : 3 pour 1 pour le texte gras d'au moins 52 px, 4,5 pour 1 sinon."),
  );
  // Remplissage et texte écrit une seule fois, écran par écran (relecture du 12/10/2026, première vidéo fabriquée).
  const v2 = mise.styleV2;
  if (v2) {
    const vides = v2.ecrans.flatMap((x) => {
      const m = controleRemplissageV2(x, v2.geometrie);
      return m ? [{ scene: x.sceneId, m }] : [];
    });
    const doubles = v2.ecrans.flatMap((x) => textesEnDoubleV2(x).map((t) => ({ scene: x.sceneId, t })));
    const scenesDe_ = (xs: { scene: string }[]) => ({ scenes: [...new Set(xs.map((x) => x.scene))] });
    lignes.push(
      vides.length
        ? { ...ligne("mise-en-page", "Écran rempli", true, "echoue", `Écran presque vide : ${vides.map((x) => x.m).join(" ")} Ajoutez un dessin ou une ligne à cette scène.`), ...scenesDe_(vides) }
        : ligne("mise-en-page", "Écran rempli", true, "reussi", "Chaque écran remplit au moins les deux tiers de sa place utile."),
      doubles.length
        ? { ...ligne("mise-en-page", "Texte écrit une fois", true, "echoue", `Texte écrit deux fois sur le même écran : ${doubles.map((x) => `« ${x.t} »`).join(", ")}.`), ...scenesDe_(doubles) }
        : ligne("mise-en-page", "Texte écrit une fois", true, "reussi", "Aucune ligne n'est écrite deux fois sur le même écran."),
    );
    // Relecture des quatre vidéos fabriquées le 12/10/2026 : cadres vides, pictogrammes ajoutés pour combler ou ronds
    // vides, texte coupé ou recouvert, étiquette « AVANT » / « APRÈS » sur une ligne qui ne le dit pas.
    const dessinsDe = new Map(fiche.scenes.map((sc) => [sc.id, new Set(sc.elements.flatMap((x) => (x.type === "dessin" ? [x.dessinId] : [])))]));
    const ecransV2 = v2.ecrans;
    const parEcran = (f: (x: (typeof ecransV2)[number]) => string[]) => ecransV2.flatMap((x) => f(x).map((m) => ({ scene: x.sceneId, m: `${x.id} : ${m}` })));
    const verifier = (libelle: string, fautes: { scene: string; m: string }[], debut: string, conseil: string, ok: string) =>
      fautes.length ? { ...ligne("mise-en-page", libelle, true, "echoue", `${debut} : ${fautes.map((x) => x.m).join(" ; ")}. ${conseil}`), ...scenesDe_(fautes) } : ligne("mise-en-page", libelle, true, "reussi", ok);
    lignes.push(
      verifier("Cadre rempli", parEcran((x) => cadresVidesV2(x, v2.geometrie)), "Grand cadre vide", "Ajoutez un dessin ou une ligne à cette scène.", "Aucun cadre n'est vide à plus de 60 %."),
      verifier("Pictogrammes de la fiche", parEcran((x) => pictogrammesFautifsV2(x, dessinsDe.get(x.sceneId) ?? new Set())), "Pictogramme hors fiche ou rond vide", "Seuls les dessins de la fiche sont montrés.", "Chaque pictogramme vient de la fiche, aucun rond vide."),
      verifier("Texte entier", parEcran((x) => textesCoupesV2(x, v2.geometrie)), "Texte coupé ou recouvert", "Raccourcissez cette ligne.", "Aucun texte coupé, hors cadre ou recouvert."),
      verifier("Avant / après", parEcran((x) => etiquettesIncoherentesV2(x)), "Étiquette incohérente", "Commencez la ligne par « Avant : » ou « Après : ».", "Les étiquettes « AVANT » et « APRÈS » suivent les lignes de la fiche."),
    );
  }
  return lignes;
}

/**
 * Contrôles propres au style « reference/1 » (page blanche écrite au crayon) : rien ne dépasse, aucun chevauchement,
 * un dessin par idée, couleurs du style, texte écrit une fois, blocs courts, page non vide. Tous bloquants.
 */
function lignesReference(mise: MiseEnPageTableau): LigneControleTableau[] {
  const verifier = (libelle: string, fautes: FauteReference[], conseil: string, ok: string): LigneControleTableau => {
    if (!fautes.length) return ligne("mise-en-page", libelle, true, "reussi", ok);
    const scenes = [...new Set(fautes.map((f) => f.sceneId).filter(Boolean))];
    return { ...ligne("mise-en-page", libelle, true, "echoue", `${fautes.map((f) => f.message).join(" ; ")}. ${conseil}`), ...(scenes.length ? { scenes } : {}) };
  };
  return [
    verifier("Rien ne dépasse", horsZoneReference(mise), "Raccourcissez la ligne en cause.", "Chaque bloc, chaque dessin et chaque trait du crayon restent dans la zone sûre."),
    verifier("Aucun chevauchement", chevauchementsReference(mise), "Mettez une scène sur une page de plus.", "Aucun bloc ni dessin n'en touche un autre."),
    verifier("Un dessin par idée", dessinsParIdeeReference(mise), "Retirez un dessin de cette scène.", "Chaque dessin est à côté de son idée, un seul par idée."),
    verifier("Couleurs du style", couleursHorsStyleReference(mise), "Gardez l'encre, le terracotta et le vert sauge.", "Texte en encre, terracotta ou vert sauge ; dessins dans leur palette."),
    verifier("Texte écrit une fois", textesEnDoubleReference(mise), "Retirez la ligne en double.", "Aucun texte n'est écrit deux fois sur la même page."),
    verifier("Blocs courts", blocsTropLongsReference(mise), "Raccourcissez la ligne en cause.", "Chaque bloc tient en 1 à 3 lignes."),
    verifier("Page non vide", pagesVidesReference(mise), "Ajoutez une ligne à cette page, ou réunissez-la avec la page voisine.", "Chaque page porte au moins un bloc écrit."),
    verifier("Page remplie", pagesTropVidesReference(mise), "Réunissez cette page avec la page voisine.", "Chaque page de 2 blocs ou plus remplit au moins 80 % de sa hauteur, à partir du haut."),
  ];
}

/**
 * Une ligne de contrôle de la page écrite : réussie, ou les fautes, le conseil et les scènes en cause. Bloquante, sauf
 * `bloquant: false` (seulement signalée : la livraison n'est pas arrêtée).
 */
function verifierPage(libelle: string, fautes: FauteReference[], conseil: string, ok: string, bloquant = true): LigneControleTableau {
  if (!fautes.length) return ligne("mise-en-page", libelle, bloquant, "reussi", ok);
  const scenes = [...new Set(fautes.map((f) => f.sceneId).filter(Boolean))];
  return { ...ligne("mise-en-page", libelle, bloquant, "echoue", `${fautes.map((f) => f.message).join(" ; ")}. ${conseil}`), ...(scenes.length ? { scenes } : {}) };
}

/**
 * Contrôles propres au style « reference/2 » (gabarit de page clair) : ceux de la page écrite (rien ne dépasse, aucun
 * chevauchement, texte écrit une fois, page non vide), puis titre présent, numéros dits écrits, tailles minimales,
 * couleurs du gabarit, blocs courts, page remplie à 75 %. Tous bloquants.
 */
function lignesGabarit(fiche: FicheTableau, mise: MiseEnPageTableau): LigneControleTableau[] {
  return [
    verifierPage("Rien ne dépasse", horsZoneReference(mise), "Raccourcissez la ligne en cause.", "Chaque bloc, chaque dessin, chaque forme et chaque trait du crayon restent dans la zone sûre."),
    verifierPage("Aucun chevauchement", chevauchementsReference(mise), "Mettez une scène sur une page de plus.", "Aucun bloc, aucune forme ni aucun dessin n'en touche un autre."),
    verifierPage("Titre présent", titresAbsentsGabarit(mise), "Ajoutez une ligne « bloc » « titre » de 1 à 3 mots à cette page.", "Chaque page porte son titre."),
    verifierPage("Numéros écrits", numerosAbsentsGabarit(fiche, mise), "Posez « numero » dans le gabarit de la scène qui dit le numéro.", "Chaque numéro d'étape dit par la voix est écrit dans sa pastille."),
    verifierPage("Tailles minimales", taillesTropPetitesGabarit(mise), "Raccourcissez la page, ou mettez une scène sur une page de plus.", "Titre, phrase clé et détails restent à leur taille minimale ou plus (70, 56 et 44 px de référence)."),
    verifierPage("Couleurs du style", couleursHorsGabarit(mise), "Gardez l'encre, le terracotta et le vert sauge.", "Texte en encre, terracotta ou vert sauge ; en clair seulement sur une pastille, une étiquette ou le cadre de l'appel."),
    verifierPage("Texte écrit une fois", textesEnDoubleReference(mise), "Retirez la ligne en double.", "Aucun texte n'est écrit deux fois sur la même page."),
    verifierPage("Blocs courts", blocsTropLongsGabarit(mise), "Raccourcissez la ligne en cause.", "Un titre tient en 2 rangées, tout autre bloc en 4 au plus."),
    verifierPage("Page non vide", pagesVidesReference(mise), "Ajoutez une ligne à cette page, ou réunissez-la avec la page voisine.", "Chaque page porte au moins un bloc écrit."),
    verifierPage("Page remplie", pagesTropVidesGabarit(mise), "Ajoutez un détail à cette page, ou réunissez-la avec la page voisine.", "Chaque page remplit au moins 75 % de sa hauteur, à partir du haut."),
  ];
}

/**
 * Contrôles propres au style « reference/3 » (gabarit par parties) : ceux de la page écrite (rien ne dépasse, aucun
 * chevauchement, texte écrit une fois), puis aucune page « problème », étiquette de partie, 3 blocs au plus, numéros
 * dits écrits, tailles minimales : tous bloquants. Page remplie à 60 % : SIGNALÉE seulement (15/10, gabarit cadré : une
 * page courte, « À retenir » en une phrase, est agrandie par la mise en page ; jamais un refus qui fait ajouter du texte
 * au script, comme « en quatre étapes » ajouté à la main le 15/10). Les contrôles de l'animation (accroche pleine à
 * 0 s, blocs écrits à l'heure, aucune page vide, appel lisible) passent à la fabrication, sur les heures de la voix.
 */
function lignesGabarit3(fiche: FicheTableau, mise: MiseEnPageTableau): LigneControleTableau[] {
  return [
    verifierPage("Rien ne dépasse", horsZoneReference(mise), "Raccourcissez la ligne en cause.", "Chaque bloc, chaque dessin, chaque forme et chaque trait du crayon restent dans la zone sûre."),
    verifierPage("Aucun chevauchement", chevauchementsReference(mise), "Mettez une scène sur une page de plus.", "Aucun bloc, aucune forme ni aucun dessin n'en touche un autre."),
    verifierPage("Aucune page « problème »", pagesProbleme3(mise), "Donnez à la page la partie « douleur ».", "Aucune étiquette ni aucun titre « problème » : la vidéo dit la douleur, puis la solution."),
    verifierPage("Chapitre nommé", etiquettesAbsentes3(mise), "Donnez à la scène son « gabarit » (sa partie).", "Chaque page est rattachée à un chapitre nommé de la barre."),
    verifierPage("Trois blocs au plus", pagesChargees3(mise), "Mettez la dernière scène sur une page de plus.", "Chaque page montre 3 blocs au plus."),
    verifierPage("Numéros écrits", numerosAbsentsGabarit(fiche, mise), "Posez « numero » dans le gabarit de la scène qui dit le numéro.", "Chaque numéro d'étape dit par la voix est écrit dans sa pastille."),
    verifierPage("Tailles minimales", taillesTropPetites3(mise), "Raccourcissez la page, ou mettez une scène sur une page de plus.", "Accroche, titre, phrase clé et détails restent à leur taille minimale ou plus (en vertical : 80, 76, 72 et 52 px)."),
    verifierPage("Texte écrit une fois", textesEnDoubleReference(mise), "Retirez la ligne en double.", "Aucun texte n'est écrit deux fois sur la même page."),
    verifierPage("Visuels et bloc orange", visuelsPeps3(mise), "Retirez le visuel ou le bloc orange en trop, ou mettez la scène sur une page de plus.", "Un visuel de la banque et un bloc orange au plus par page ; le visuel occupe 35 à 45 % de la largeur, à 12 px au moins de tout texte, hors de la bande des sous-titres ; ni vert, ni bleu."),
    verifierPage("Visuel dessiné", visuelsNonDessines3(fiche, mise), "Rien à réécrire : la page est trop pleine pour son visuel ; retirez-le, ou mettez une scène sur une page de plus.", "Chaque visuel choisi par la fiche est dessiné sur sa page.", false),
    verifierPage(
      "Page remplie",
      pagesVides3(mise),
      "Rien à réécrire : la mise en page agrandit déjà le texte de la page ; si elle reste trop vide, réunissez-la avec sa voisine.",
      "Le contenu de chaque page couvre au moins 60 % de la hauteur utile, centré dans la zone sûre (à 12 % près).",
      false,
    ),
  ];
}

/**
 * Contrôles des TROIS STYLES du tableau (tableau blanc, ardoise, paperboard ; maquettes validées, PR #280) : ceux de la
 * page écrite qui valent pour tout style (rien ne dépasse, chapitre nommé, numéros écrits, texte écrit une fois, aucune
 * page « problème »), puis ceux du style (`controles-tableau.ts`) : contraste ≥ 4,5:1 et ≥ 3:1, charte, bande des
 * sous-titres libre, texte non coupé, remplissage 85 à 95 %, aucun doublon. Tous bloquants. Les tailles, les « 3 blocs »
 * et les chevauchements de la page ivoire n'y sont pas : la page manuscrite pose ses dessins, cases et étiquettes
 * autour du texte, et ses planchers propres.
 */
function lignesTableau3(fiche: FicheTableau, mise: MiseEnPageTableau): LigneControleTableau[] {
  const pbs = controlerMiseEnPageTableau(mise);
  const sceneDe = (n?: number) => mise.pages.find((p) => p.page === n)?.elements[0]?.sceneId ?? fiche.scenes[0]?.id ?? "";
  const de = (c: string) => pbs.filter((p) => p.controle === c).map((p) => ({ sceneId: sceneDe(p.page), message: `${p.page ? `page ${p.page} : ` : ""}${p.detail}` }));
  return [
    verifierPage("Rien ne dépasse", horsZoneReference(mise), "Raccourcissez la ligne en cause.", "Chaque bloc, chaque dessin, chaque forme et chaque trait du crayon restent dans la zone sûre."),
    verifierPage("Aucune page « problème »", pagesProbleme3(mise), "Donnez à la page la partie « douleur ».", "Aucune étiquette ni aucun titre « problème » : la vidéo dit la douleur, puis la solution."),
    verifierPage("Chapitre nommé", etiquettesAbsentes3(mise), "Donnez à la scène son « gabarit » (sa partie).", "Chaque page est rattachée à un chapitre nommé de la barre."),
    verifierPage("Numéros écrits", numerosAbsentsGabarit(fiche, mise), "Posez « numero » dans le gabarit de la scène qui dit le numéro.", "Chaque numéro d'étape dit par la voix est écrit dans sa pastille."),
    verifierPage("Texte écrit une fois", textesEnDoubleReference(mise), "Retirez la ligne en double.", "Aucun texte n'est écrit deux fois sur la même page."),
    verifierPage("Contrastes du style", de("contraste"), "Écrivez à l'encre du style.", "Chaque texte se lit à 4,5:1 au moins, chaque trait plein à 3:1 au moins, à chaque image."),
    verifierPage("Couleurs de la charte", de("charte"), "Gardez les couleurs du style.", "Aucun vert, aucun bleu : l'encre, le terracotta, l'ivoire et le sable."),
    verifierPage("Bande des sous-titres libre", de("bande"), "Mettez une scène sur une page de plus.", "Ni texte, ni trait, ni objet dans la bande des sous-titres."),
    verifierPage("Texte entier", de("coupe"), "Raccourcissez la ligne en cause.", "Chaque ligne tient entière dans la zone sûre."),
    // Signalé seulement (comme la page ivoire) : jamais un refus qui ferait ajouter du texte au script.
    verifierPage("Page remplie", de("remplissage"), "Rien à réécrire : la mise en page agrandit déjà les dessins ; si la page reste trop pleine, mettez une scène sur une page de plus.", "Le contenu de chaque page couvre 85 à 95 % de la hauteur utile.", false),
    verifierPage("Aucun doublon", de("doublon"), "Retirez le mot répété.", "La phrase ne reprend pas le titre ; « Avant » et « Maintenant » ne se répètent pas."),
  ];
}

/** Scène nommée par un message de la mise en page (« Page 6 · scène s07 · … »). */
const sceneDuMessage = (m: string) => /scène ([A-Za-z0-9_-]+)/.exec(m)?.[1];

/**
 * Mise en page et contrôles de l'image d'UNE sortie. Une mise en page impossible est un échec bloquant (le message dit
 * quoi raccourcir), jamais une exception.
 */
function controlerSortieRelue(fiche: FicheTableau, sortie: SortieRelue | null, e: EntreeControleTableau): { mise: MiseEnPageTableau | null; ficheSortie: FicheTableau; lignes: LigneControleTableau[] } {
  const ficheSortie = sortie?.fiche ?? fiche;
  // Fiche propre à la sortie (fin propre à TikTok et Shorts) : repassée aux règles de forme AVANT la voix, comme au calage.
  if (sortie?.fiche && sortie.fiche !== fiche) {
    const refus = controlerFormeSortie(sortie.fiche, e.contexte, { sansCommentaire: sansAppelAuMot(sortie.id) });
    if (refus.length) return { mise: null, ficheSortie, lignes: [...refus, aucun("mise-en-page", "Mise en page", "Mise en page non faite : la fiche de cette sortie est refusée.")] };
  }
  try {
    const mise = mettreEnPage(ficheSortie, sortie?.options ?? {});
    return { mise, ficheSortie, lignes: controlerImage(ficheSortie, mise, e) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erreur inconnue";
    const scene = err instanceof ErreurMiseEnPage ? sceneDuMessage(detail) : undefined;
    const l =
      err instanceof ErreurMiseEnPage
        ? ligne("mise-en-page", "Mise en page", true, "echoue", detail)
        : aucun("mise-en-page", "Mise en page", `Mise en page non faite : ${detail}.`);
    return { mise: null, ficheSortie, lignes: [scene ? { ...l, scenes: [scene] } : l, ...(e.mesures ? controlerMesuresSeules(e) : [])] };
  }
}

/** Règles de FORME (numéros du plan) repassées sur la fiche propre d'une sortie : références internes et écrans. */
const REGLES_FORME_SORTIE = new Set([1]);

/**
 * Règles de FORME de la fiche propre d'une sortie (fin propre à TikTok et Shorts), sans les règles estimées au débit
 * (rythme, durée, douleur en tête : elles refusaient à tort une fiche que le calage accepte) : schéma commun (nombre
 * d'éléments, textes), références internes et écrans (ancres dans le texte dit : le même contrôle que le calage), aucune
 * scène sans mot ; `sansCommentaire` : aucun texte dit ou écrit qui parle encore de commentaire ni de mot à commenter.
 * Chaque refus nomme sa scène (« Scène s10 · … »). Rend les seuls échecs (vide : la fiche passe).
 */
export function controlerFormeSortie(fiche: FicheTableau, contexte: ContexteTableau, options: { sansCommentaire?: boolean } = {}): LigneControleTableau[] {
  const ext = extensionTableau(contexte);
  const regles = [
    ...REGLES_TABLEAU.filter((r) => REGLES_FORME_SORTIE.has(r.numero)).map((r) => ({ nom: r.nom, verifier: (f: unknown) => r.verifier(f as FicheTableau, contexte) })),
    { nom: "scène sans mot", verifier: (f: unknown) => (f as FicheTableau).scenes.filter((x) => !mots(x.texteDit).length).map((x) => ({ sceneId: x.id, detail: "la scène ne dit plus aucun mot : elle garde un écran et des éléments ancrés sur des mots qui n'existent pas." })) },
    ...(options.sansCommentaire
      ? [
          {
            nom: "fin sans commentaire",
            verifier: (f: unknown) =>
              (f as FicheTableau).scenes.flatMap((x) => {
                // Texte dit de Will (`texteDeWill`) : pris à l'identique, la voix n'est pas contrôlée (comme `regleSansAppel`).
                const textes = [...(contexte.texteDeWill ? [] : [x.texteDit]), ...textesScene(x)];
                const mot = (x.ecrans ?? []).find((c) => c.motCommentaire);
                return mot || textes.some((t) => parleDuCommentaire(t)) ? [{ sceneId: x.id, detail: "la vidéo de TikTok et Shorts parle encore de commentaire (« Écrivez … en commentaire », « Je vous l'envoie » ou le mot à commenter)." }] : [];
              }),
          },
        ]
      : []),
  ];
  const r = validerFiche(fiche, { ...ext, regles: regles as typeof ext.regles });
  return r.ok ? [] : r.problemes.map((p) => ({ ...ligne("fiche", `Règle « ${p.regle} »`, true, "echoue", p.message), ...(p.sceneId ? { scenes: [p.sceneId] } : {}) }));
}

/** Textes écrits d'une scène : éléments, puis éléments de liste de ses écrans. */
const textesScene = (x: FicheTableau["scenes"][number]) => [...x.elements.flatMap(textesEcrits), ...textesEcransScene(x)];

/**
 * Contrôles de l'image d'UNE sortie d'une fiche déjà validée (mise en page comprise), sans les autres familles :
 * exactement ceux que la relecture passe pour cette sortie. Sert aux tests des gabarits.
 */
export function controlerImageSortie(fiche: FicheTableau, sortie: SortieRelue, e: Partial<EntreeControleTableau> = {}): LigneControleTableau[] {
  return controlerSortieRelue(fiche, sortie, { fiche, contexte: undefined as never, historique: [], ...e }).lignes;
}

/**
 * Lignes des sorties réunies : une ligne identique dans plusieurs sorties n'est dite qu'une fois. Un échec propre à
 * certaines sorties (plusieurs relues) dit lesquelles.
 */
function reunirSorties(parSortie: { libelle: string; lignes: LigneControleTableau[] }[]): LigneControleTableau[] {
  const plusieurs = parSortie.length > 1;
  const vues = new Map<string, LigneControleTableau>();
  for (const { libelle, lignes } of parSortie) {
    for (const l of lignes) {
      const cle = `${l.famille}|${l.libelle}|${l.etat}|${l.raison}`;
      const deja = vues.get(cle);
      if (deja) {
        if (plusieurs && libelle && !deja.sorties?.includes(libelle)) deja.sorties = [...(deja.sorties ?? []), libelle];
        deja.scenes = [...new Set([...(deja.scenes ?? []), ...(l.scenes ?? [])])];
        if (!deja.scenes.length) delete deja.scenes;
      } else vues.set(cle, { ...l, ...(plusieurs && libelle ? { sorties: [libelle] } : {}) });
    }
  }
  return [...vues.values()].map((l) => (plusieurs && l.etat === "echoue" && l.sorties?.length && l.sorties.length < parSortie.length ? { ...l, raison: `${l.sorties.join(" et ")} : ${l.raison}` } : l));
}

/* ------------------------------------------------------------------ */
/* Rapport unique                                                        */
/* ------------------------------------------------------------------ */

const aucun = (famille: FamilleControle, libelle: string, raison: string): LigneControleTableau => ligne(famille, libelle, true, "non-fait", raison);

function assembler(lignes: LigneControleTableau[]): RapportControleTableau {
  const bloquants = lignes.filter((l) => l.etat === "echoue" && l.bloquant);
  const indicatifs = lignes.filter((l) => l.etat === "echoue" && !l.bloquant);
  const nonFaits = lignes.filter((l) => l.etat === "non-fait");
  const s = (n: number) => (n > 1 ? "s" : "");
  const suffixe = nonFaits.length ? ` — ${nonFaits.length} élément${s(nonFaits.length)} non fait${s(nonFaits.length)}` : "";
  const verdict = bloquants.length ? "bloque" : "livrable";
  const resume = bloquants.length ? `Bloqué : ${bloquants.length} contrôle${s(bloquants.length)} échoué${s(bloquants.length)}${suffixe}` : `Livrable${suffixe}`;
  const phrases = [
    ...bloquants.map((l) => `Bloquant · ${l.libelle} : ${l.raison}`),
    ...indicatifs.map((l) => `À noter · ${l.libelle} : ${l.raison}`),
    ...nonFaits.map((l) => `Non fait · ${l.libelle} : ${l.raison}`),
  ];
  return { lignes, bloquants, indicatifs, nonFaits, verdict, resume, phrases };
}

/**
 * Contrôle d'une vidéo « tableau animé » : fiche, variété, déjà-vu, mise en page, première image, fichier exporté puis
 * relecture indicative. Ne lève jamais : une pièce qui ne peut pas tourner devient « non faite » (ou un refus, si c'est
 * la fiche elle-même qui est refusée).
 */
export async function controlerVideoTableau(entree: EntreeControleTableau, outils: OutilsControleTableau = {}): Promise<RapportControleTableau> {
  const lignes: LigneControleTableau[] = [];
  const resultat = validerFicheTableau(entree.fiche, entree.contexte);
  const dejaVu = controlerDejaVu(entree.dejaVu, entree.contexte.aujourdhui);

  if (!resultat.ok) {
    lignes.push(...resultat.problemes.map((p) => ligne("fiche", `Règle « ${p.regle} »`, true, "echoue", p.message)));
    const raison = "La fiche est refusée : corrigez-la d'abord.";
    lignes.push(aucun("variete", "Variété", raison), dejaVu, aucun("mise-en-page", "Mise en page", raison));
    lignes.push(...(entree.mesures ? controlerMesuresSeules(entree) : []));
    lignes.push(ligne("relecture", "Relecture des images clés", false, "non-fait", `Relecture non faite : ${raison.toLowerCase()}`));
    return assembler(lignes);
  }

  const fiche = resultat.fiche;
  lignes.push(ligne("fiche", "Règles de la fiche", true, "reussi", "Les 17 règles de la fiche sont respectées."));
  lignes.push(...controlerVariete(fiche, entree), dejaVu);

  // Mise en page et image de CHAQUE sortie relue (par défaut : la verticale, comme avant).
  const sorties: (SortieRelue | null)[] = entree.sorties?.length ? [...entree.sorties] : [null];
  const faites = sorties.map((s) => ({ libelle: s?.libelle ?? "", ...controlerSortieRelue(fiche, s, entree) }));
  lignes.push(...reunirSorties(faites));
  for (const raison of entree.sortiesImpossibles ?? []) lignes.push(ligne("fiche", "Fiche de chaque sortie", true, "echoue", raison));

  const premiere = faites.find((f) => f.mise);
  if (premiere?.mise) lignes.push(...(await relire(premiere.ficheSortie, premiere.mise, outils)));
  else lignes.push(ligne("relecture", "Relecture des images clés", false, "non-fait", "Relecture non faite : pas de mise en page."));
  return assembler(lignes);
}

/** Mesures du fichier seules (fiche ou mise en page indisponible) : réutilise la brique sans mise en page. */
function controlerMesuresSeules(e: EntreeControleTableau): LigneControleTableau[] {
  const rapport = controlerImageFinale({ ...(e.mesures ? { mesures: e.mesures } : {}), zone: null, ...(e.seuilsImage ? { seuils: e.seuilsImage } : {}) });
  return rapport.controles.filter((c) => !(c.id in FAMILLE_BRIQUE)).map((c) => ligne("fichier", c.libelle, c.bloquant, c.etat, c.raison));
}
