/**
 * KIT DE PUBLICATION, ENVOI (simulé) ET CALENDRIER (B.8 #8, AV2.3-1/11/12/13, AV2.4-2/4).
 */
import "server-only";
import type { Id, IdReseau, KitPublication, LigneCout, ModeEnvoiPublication, Montant, Publication, TexteReseau, Video } from "@/domaine/types";
import { centimesUsd } from "@/fournisseurs/claude/tarifs";
import { DELAI_TOTAL_MS } from "@/fournisseurs/claude/client";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { donneesPublication, entreePublication, ESSAIS_TEXTE_PUBLICATION, EVALUATIONS_PUBLICATION, evaluerPublication, finaliserPublication, libellesDesEchecs, motsDiesePermis, rolePublication } from "@/generateur/roles/publication";
import { choisirDansFamille, estInterdit, famillePour, type FamillesHashtags } from "@/reseaux/hashtags";
import { RAPPEL_VOTRE_MARQUE } from "@/domaine/votre-marque";
import { pireCasRole } from "@/generateur/roles/types";
import { additionner, usdVersEur } from "@/lib/montants";
import { claudeTextesActif, executerRolePourVideo } from "./depense-claude-video";
import { taux } from "./generation-claude";
import { texteScript } from "@/domaine/derivations";
import { casesRequises, mentionIAActive, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { commandeEnEssai } from "@/moteurs";
import { estCleDemo } from "@/domaine/miniatures";
import { cleJour } from "@/lib/dates";
import { dureeDeLaVideo } from "@/domaine/duree-video";
import { lienDeVersion, PAGE_SUIVIE_PAR_DEFAUT } from "@/domaine/mesures";
import { listerReseaux, obtenirReseau, verifierPourReseau } from "@/reseaux";
import { libelleFichierEnvoye, meilleureSortie } from "@/reseaux/sorties";
import { occupeBuffer } from "@/domaine/buffer";
import { libelleComptes, libelleReseaux } from "@/domaine/comptes-envoi";
import { ErreurBuffer, PHRASES_BUFFER, premierCommentaireTransmissible } from "@/fournisseurs/publication/buffer";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import { depots, ErreurStudio, filtreExemples, fournisseur, fournisseurSimule, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { cleEnvoiBuffer, comptesBufferPour, lireModeBuffer, memoriserComptesBuffer, noterErreurBuffer, passerProgrammee, reconcilierEnvoi, versErreurStudio } from "./buffer";
import { exigerSession } from "./auth";
import { urlsFichiers } from "./fichiers";
import { versCarte } from "./presentation";
import { creditsVideo, obtenirVideo } from "./videos";
import { synchroniserEtats, versionDeVideo } from "./generateur";
import { versionsCourantes } from "@/domaine/derivations-generateur";
import type { VueKit, VueKitReseau, VueVideoCarte } from "./vues";
import { lireFamilles } from "./hashtags";
import { listerSeries, serieDeVideo, votreMarqueDeVideo } from "./series";
import { creerNotification } from "./notifications";
import { premierCommentaireDeVideo } from "./premier-commentaire";
import { liensSousTitresParReseau } from "./sous-titres-par-reseau";
import { sousVerrouKit } from "./verrou-kit";
import { construirePasseportDEssai, pagePourYoutube, passeportDeLaVideo } from "./site-videos";
import { descriptionAvecPage, RESEAUX_LIEN_SITE } from "@/domaine/site-videos/youtube";

/*
 * Lot R2 : les textes du kit s'écrivent sous le verrou local du kit (`verrou-kit.ts`, un seul processus studio) : la
 * création du kit (deux affichages simultanés ne créent plus deux kits), une retouche de Will et un texte rendu par
 * Claude ne s'effacent jamais l'un l'autre.
 */

/** Ce que les textes d'une vidéo reprennent : son texte validé, la mention (si activée), les crédits. */
interface SourceTextes {
  video: Video;
  texteValide: string;
  /** La mention n'est ajoutée au texte que si elle est activée (décision de Will du 01/10). */
  mention: string;
  credits: string[];
  /** Équipe 7 : « Vos hashtags » par réseau (les textes du studio y piochent, le code l'applique). */
  familles: FamillesHashtags;
}

async function sourceTextes(video: Video, credits: string[]): Promise<SourceTextes> {
  const script = video.scriptId ? await depots().scripts.obtenir(video.scriptId) : null;
  return { video, texteValide: script ? texteScript(script.blocs) : video.titre, mention: video.mentionIA.dansLegende ? video.mentionIA.texte + "." : "", credits, familles: await lireFamilles() };
}

/** Équipe 7 : mots-dièse d'un texte du studio ramenés à la famille du réseau (sans famille : seulement sans interdit). */
function dansLaFamille(t: TexteReseau, reseau: IdReseau, familles: FamillesHashtags): TexteReseau {
  const motsDiese = choisirDansFamille(t.motsDiese, famillePour(reseau, familles), motsDiesePermis(reseau).valeur);
  return motsDiese.join(" ") === t.motsDiese.join(" ") ? t : { ...t, motsDiese };
}

/** Texte d'essai d'un réseau (rédacteur choisi, dont `ecrire` ne dépense jamais : simulation, ou Claude inscrit). */
async function texteEssai(s: SourceTextes, reseau: IdReseau, redaction?: Awaited<ReturnType<typeof fournisseur<"texte-reseaux">>>): Promise<TexteReseau> {
  const t = await (redaction ?? (await fournisseur("texte-reseaux"))).ecrire({
    reseau,
    titre: s.video.titre,
    sujet: s.video.sujet,
    texteScript: s.texteValide,
    mentionIA: s.mention,
    credits: s.credits,
    formatId: s.video.formatId,
    dureeSec: s.video.dureeCibleSec,
    adresse: s.video.adresse,
  });
  return dansLaFamille(t, reseau, s.familles);
}

/** Même texte (corps, mots-dièse, titre) ? */
function memeTexte(a: TexteReseau | undefined, b: TexteReseau | undefined): boolean {
  return (a?.texte ?? "") === (b?.texte ?? "") && (a?.motsDiese ?? []).join(" ") === (b?.motsDiese ?? []).join(" ") && (a?.titre ?? "") === (b?.titre ?? "");
}

/**
 * Le texte est-il encore le texte d'essai INTACT ? Seul un texte d'essai intact peut être remplacé sans geste de Will :
 * jamais un texte de Claude, d'une version ou retouché à la main — même une retouche ancienne, d'avant le drapeau
 * `modifieAMain` (le texte ne serait plus égal au texte d'essai d'aujourd'hui).
 */
function essaiIntact(t: TexteReseau | undefined, essai: TexteReseau): boolean {
  return !t || (!t.source && !t.modifieAMain && memeTexte(t, essai));
}

/** Crée le kit s'il n'existe pas, avec les textes d'essai (gratuits). Sous le verrou du kit. */
async function kitOuCreation(videoId: string): Promise<KitPublication> {
  return sousVerrouKit(async () => {
    const d = depots();
    const existant = await d.kits.trouver((k) => k.videoId === videoId);
    if (existant) return existant;
    const video = await d.videos.obtenir(videoId);
    if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
    const s = await sourceTextes(video, await creditsVideo(videoId));
    const redaction = await fournisseur("texte-reseaux");
    const textes: KitPublication["textes"] = {};
    for (const r of listerReseaux()) textes[r.id] = await texteEssai(s, r.id, redaction);
    // Vidéos sur le site (lot S1) : le passeport d'essai naît avec le kit (gratuit) ; une vidéo pas prête n'en reçoit pas.
    const passeportWeb = await construirePasseportDEssai(video, s.credits);
    const kit: KitPublication = {
      id: nouvelId("kit"),
      videoId,
      textes,
      credits: s.credits,
      ...(passeportWeb ? { passeportWeb } : {}),
      // E2E-2 parcours n° 7 : « Cochez ce que vous avez vérifié » part de zéro (rien n'est coché à la place de Will).
      avantDePublier: { image: false, son: false, sousTitres: false, mentionIA: false, droits: false },
      ...horodatage(),
    };
    return d.kits.enregistrer(kit);
  });
}

/**
 * Pose un texte rendu par Claude SEULEMENT si le texte du kit n'a pas bougé pendant l'écriture (Will a pu le retoucher
 * entre-temps : sa retouche gagne toujours). Sous le verrou du kit.
 */
async function poserSiInchange(kitId: Id, reseau: IdReseau, avant: TexteReseau | undefined, nouveau: TexteReseau): Promise<boolean> {
  return sousVerrouKit(async () => {
    const kit = await depots().kits.obtenir(kitId);
    if (!kit) return false;
    const actuel = kit.textes[reseau];
    if (!memeTexte(actuel, avant) || !!actuel?.modifieAMain !== !!avant?.modifieAMain || actuel?.source !== avant?.source) return false;
    await depots().kits.modifier(kitId, { textes: { ...kit.textes, [reseau]: nouveau } });
    return true;
  });
}

type IssueClaude = { ok: true; texte: TexteReseau } | { ok: false; message: string; arret: boolean };

/**
 * Un texte écrit par Claude (rôle `publication`), par le chemin de dépense de la vidéo. Une sortie qui échoue à une
 * évaluation CRITIQUE (nombre inventé, faux témoignage, mention écrite, adresse, longueur, lien, tournure interdite) est
 * rejetée : UNE reprise ciblée, puis le texte actuel est gardé. Rien d'inventé n'entre dans le kit.
 */
async function texteParClaude(s: SourceTextes, reseau: IdReseau, options: { parWill?: boolean } = {}): Promise<IssueClaude> {
  const v = s.video;
  const nom = obtenirReseau(reseau).nom;
  const lien = { type: "video" as const, id: v.id };
  let donnees = donneesDe(s, reseau, await depots().reglesDatees.lister());
  for (let tour = 1; tour <= ESSAIS_TEXTE_PUBLICATION; tour++) {
    const r = await executerRolePourVideo(v.id, rolePublication, entreePublication(donnees), { etape: `Texte de publication · ${nom}`, ...(options.parWill ? { parWill: true } : {}) });
    if (!r.ok) return { ok: false, message: r.message, arret: true };
    if (r.marqueur) {
      console.info(`[studio] texte ${reseau} de ${v.id} : marqueur ${r.marqueur}`);
      await journaliser("publication", `Texte ${nom} : Claude n'a pas trouvé de quoi écrire sans rien inventer ; le texte actuel est gardé`, lien);
      return { ok: false, message: `Claude n'a pas trouvé de quoi écrire ce texte sans rien inventer : le texte actuel est gardé.`, arret: false };
    }
    const echecs = r.donnees ? evaluerPublication(r.donnees, donnees, { critiques: true }) : [`sortie illisible (${r.invalide ?? "vide"})`];
    if (r.donnees && !echecs.length) {
      const remarques = evaluerPublication(r.donnees, donnees).filter((e) => !EVALUATIONS_PUBLICATION.find((x) => e.startsWith(`${x.id} :`))?.critique);
      if (remarques.length) {
        console.info(`[studio] texte ${reseau} de ${v.id} corrigé : ${remarques.join(" ; ").slice(0, 500)}`);
        await journaliser("publication", `Texte ${nom} écrit par Claude, retouché par le studio : ${libellesDesEchecs(remarques).join(", ")}`, lien);
      }
      return { ok: true, texte: finaliserPublication(r.donnees, { reseau, titreVideo: v.titre, mention: s.mention, credits: s.credits, famille: famillePour(reseau, s.familles) }) };
    }
    console.info(`[studio] texte ${reseau} de ${v.id} refusé (essai ${tour}) : ${echecs.join(" ; ").slice(0, 500)}`);
    await journaliser("publication", `Texte ${nom} refusé (essai ${tour} sur ${ESSAIS_TEXTE_PUBLICATION}) : ${libellesDesEchecs(echecs).join(", ")}`, lien);
    donnees = { ...donnees, corrections: echecs };
  }
  return { ok: false, message: "Claude n'a pas écrit un texte utilisable : le texte actuel est gardé.", arret: false };
}

/**
 * CORRECTEUR FINAL A (VERIF-E2E-1 n° 3 et 5) : la version choisie de cette vidéo sort-elle du moteur d'essai (vidéo de
 * démonstration) ? Alors Claude n'écrit rien (rien n'est payé, l'écriture automatique reste pour la vraie vidéo) et la
 * vidéo ne part jamais chez Buffer.
 */
export async function videoEnEssai(video: Pick<Video, "versionChoisieId">): Promise<boolean> {
  if (!video.versionChoisieId) return false;
  return commandeEnEssai((await depots().versions.obtenir(video.versionChoisieId))?.commande);
}

/** TEST-UI-REEL U8 : un de ces fichiers est-il une vidéo de démonstration (dossier du studio) ? */
async function fichiersDeDemonstration(ids: (string | undefined)[]): Promise<boolean> {
  const fichiers = await Promise.all([...new Set(ids.filter((x): x is string => !!x))].map((id) => depots().fichiers.obtenir(id)));
  return fichiers.some((f) => estCleDemo(f?.cleStockage));
}

/** Claude écrira-t-il les textes de cette vidéo tout seul à la fin de sa fabrication ? (Aucune dépense ici.) */
async function ecritureAutoPrevue(video: Video): Promise<boolean> {
  if (video.estDemo || video.varianteId || !(await claudeTextesActif())) return false;
  // X11 : un format qui écrit lui-même ses textes de publication (« aucune ») n'a ni la ligne ni l'écriture automatique.
  if (trouverFormat(video.formatId)?.ecranVideo?.publication === "aucune") return false;
  return !(await depots().kits.trouver((k) => k.videoId === video.id))?.ecritureAuto;
}

/**
 * Marque, sous le verrou du kit, que l'écriture automatique de cette vidéo a eu lieu : elle ne part qu'UNE fois par
 * vidéo (deux suites simultanées n'écrivent pas deux fois). `false` : déjà faite.
 */
async function reserverEcritureAuto(kitId: Id): Promise<boolean> {
  return sousVerrouKit(async () => {
    const kit = await depots().kits.obtenir(kitId);
    if (!kit || kit.ecritureAuto) return false;
    await depots().kits.modifier(kitId, { ecritureAuto: { le: maintenant(), nonEcrits: [] } });
    return true;
  });
}

/**
 * Crée le kit d'une vidéo s'il n'existe pas (textes d'essai, gratuits). Lot R2 (C9) : Claude n'écrit QUE si
 * `autoriserDepense` (suite de la PREMIÈRE fabrication), UNE seule fois par vidéo (`ecritureAuto`, même après un échec :
 * les réseaux non écrits y sont notés et ne repartent que par « Réécrire »), seulement pour les réseaux par défaut de
 * Will, seulement un texte d'essai intact, jamais pour une vidéo d'exemple ni pour une vidéo de version (son texte vient
 * déjà du générateur). L'affichage (`obtenirKit`) passe `false` : il ne dépense jamais.
 */
export async function genererKit(videoId: string, options: { autoriserDepense?: boolean } = {}): Promise<KitPublication> {
  const kit = await kitOuCreation(videoId);
  if (!options.autoriserDepense) return kit;
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || (await videoEnEssai(video)) || !(await ecritureAutoPrevue(video)) || !(await reserverEcritureAuto(kit.id))) return kit;
  const s = await sourceTextes(video, kit.credits);
  const redaction = await fournisseur("texte-reseaux");
  const nonEcrits: IdReseau[] = [];
  let arret = false;
  for (const reseau of await reseauxParDefaut()) {
    // Vidéo supprimée définitivement pendant l'écriture (kit effacé avec elle) : plus aucun appel, rien n'est écrit.
    if (!(await d.kits.obtenir(kit.id))) return kit;
    const avant = (await d.kits.obtenir(kit.id))?.textes[reseau];
    if (!essaiIntact(avant, await texteEssai(s, reseau, redaction))) continue;
    // Après un arrêt (plafond, limite, crédit), rien d'autre ne part : les réseaux restants sont notés non écrits.
    const r: IssueClaude = arret ? { ok: false, message: "", arret: true } : await texteParClaude(s, reseau);
    if (!(await d.kits.obtenir(kit.id))) return kit;
    if (r.ok) {
      if (!(await poserSiInchange(kit.id, reseau, avant, r.texte))) await journaliser("publication", `Texte ${obtenirReseau(reseau).nom} : retouché pendant l'écriture, votre version est gardée`, { type: "video", id: videoId });
    } else {
      nonEcrits.push(reseau);
      arret ||= r.arret;
    }
  }
  if (nonEcrits.length) {
    await sousVerrouKit(async () => {
      const k = await d.kits.obtenir(kit.id);
      if (k) await d.kits.modifier(kit.id, { ecritureAuto: { le: k.ecritureAuto?.le ?? maintenant(), nonEcrits } });
    });
    await journaliser("publication", `Textes non écrits par Claude (${nonEcrits.map((r) => obtenirReseau(r).nom).join(", ")}) : le texte d'essai reste, « Réécrire » le fait écrire`, { type: "video", id: videoId });
  }
  return (await d.kits.obtenir(kit.id)) ?? kit;
}

/**
 * Lot R2 (décision du 03/10) : la ligne « Textes des réseaux » de l'estimation d'une fabrication, quand Claude écrira
 * les textes tout seul à la fin (réseaux par défaut). Estimation réaliste ; comptée dans le total annoncé et engagée sur
 * le budget, mais `facultative` : elle ne bloque jamais le lancement (faute de crédit, les textes restent en essai). `null` : rien ne sera écrit par Claude (simulation, exemple, version, déjà écrit).
 */
export async function ligneTextesDesReseaux(videoId: Id, options: { essai?: boolean } = {}): Promise<LigneCout | null> {
  // CORRECTEUR FINAL A : une vidéo d'essai (moteur de simulation) ne fait jamais écrire ni payer Claude.
  if (options.essai) return null;
  const video = await depots().videos.obtenir(videoId);
  if (!video || !(await ecritureAutoPrevue(video))) return null;
  const s = await sourceTextes(video, await creditsVideo(videoId));
  const regles = await depots().reglesDatees.lister();
  const reseaux = await reseauxParDefaut();
  let usd = 0;
  for (const reseau of reseaux) usd += estimationRealisteRole(rolePublication, entreePublication(donneesDe(s, reseau, regles)));
  const total = usdVersEur(centimesUsd(usd), await taux());
  return { etape: "Textes des réseaux", fournisseur: "anthropic", unite: "appel", quantite: reseaux.length, prixUnitaire: { ...total, centimes: Math.ceil(total.centimes / Math.max(1, reseaux.length)) }, total, nature: "estime", facultative: true };
}

/** Ajoute la ligne « Textes des réseaux » à une estimation de fabrication (copie, rien n'est modifié en place). */
export async function avecTextesDesReseaux<E extends { lignes: LigneCout[]; total: Montant }>(videoId: Id, estimation: E, options: { essai?: boolean } = {}): Promise<E & { textesReseaux?: Montant }> {
  const l = await ligneTextesDesReseaux(videoId, options);
  return l ? { ...estimation, lignes: [...estimation.lignes, l], total: additionner(estimation.total, l.total), textesReseaux: l.total } : estimation;
}

function donneesDe(s: SourceTextes, reseau: IdReseau, regles: Awaited<ReturnType<ReturnType<typeof depots>["reglesDatees"]["lister"]>>) {
  const v = s.video;
  return donneesPublication({ reseau, titre: v.titre, texteValide: s.texteValide, formatId: v.formatId, dureeSec: v.dureeCibleSec, adresse: v.adresse, mention: s.mention, credits: s.credits, regles, famille: famillePour(reseau, s.familles) });
}

async function reseauxParDefaut(): Promise<IdReseau[]> {
  return lireParametre<IdReseau[]>("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
}

/**
 * E2E-2 parcours n° 7 : après une retouche (nouvelle image, nouveau son) les cases Image et Son sont décochées ; après
 * des sous-titres corrigés, la case Sous-titres. Will revérifie ce qui a changé. Rien d'autre ne bouge.
 */
export async function decocherApresRetouche(videoId: string, quoi: "retouche" | "sous-titres"): Promise<void> {
  const kit = await depots().kits.trouver((k) => k.videoId === videoId);
  if (!kit) return;
  const cases = quoi === "retouche" ? { image: false, son: false } : { sousTitres: false };
  // Relu sous le verrou du kit : une case cochée entre-temps n'est pas effacée (VERIF-E2E-2, D1).
  await sousVerrouKit(async () => {
    const frais = (await depots().kits.obtenir(kit.id)) ?? kit;
    await depots().kits.modifier(kit.id, { avantDePublier: { ...frais.avantDePublier, ...cases } });
  });
}

/** Kit prêt à afficher : textes, compteurs, avertissements, cases « Avant de publier ». */
export async function obtenirKit(videoId: string): Promise<VueKit | null> {
  const detail = await obtenirVideo(videoId);
  if (!detail || detail.video.statut !== "prete") return null;
  // Lot R2 (C9) : l'affichage ne dépense JAMAIS ; Claude n'écrit qu'aux suites de fabrication ou sur « Réécrire ».
  let kit = await genererKit(videoId, { autoriserDepense: false });
  // Vidéos sur le site (lot S1) : un kit ancien reçoit son passeport d'essai (gratuit, même verrou).
  if (!kit.passeportWeb) await passeportDeLaVideo(videoId);
  const variante = await versionDeVideo(videoId);
  if (variante) kit = await resynchroniserKit(kit, variante, await lireFamilles());
  const parDefaut = await reseauxParDefaut();
  const source = await sourceTextes(detail.video, kit.credits);
  const redaction = await fournisseur("texte-reseaux");
  const parClaude = await claudeTextesActif();
  const t = parClaude ? await taux() : 0;
  const regles = parClaude ? await depots().reglesDatees.lister() : [];
  const origines: Partial<Record<IdReseau, VueKitReseau["origine"]>> = {};
  const prix: Partial<Record<IdReseau, Montant>> = {};
  for (const r of listerReseaux()) {
    origines[r.id] = origineTexte(kit.textes[r.id], await texteEssai(source, r.id, redaction));
    // Prix d'un « Réécrire » (geste de Will), affiché sur le bouton AVANT le geste ; aucun appel. C'est le PIRE cas :
    // tous les essais (la reprise ciblée d'une réponse refusée comprise), chacun au pire cas.
    if (parClaude) prix[r.id] = usdVersEur(centimesUsd(ESSAIS_TEXTE_PUBLICATION * pireCasRole(rolePublication, entreePublication(donneesDe(source, r.id, regles)))), t);
  }
  // Durée RÉELLE de la vidéo montée (version choisie) pour les limites des réseaux, pas l'estimation du script.
  const dureeSec = dureeDeLaVideo(detail.video.dureeCibleSec, detail.sorties.find((s) => s.ratio === detail.video.ratios[0]) ?? detail.sorties[0]).sec;
  // Vidéos sur le site (lot S4) : lien de la page et chapitres dans la description YouTube, réglage éteint par défaut.
  const pageSite = await pagePourYoutube(videoId);
  const reseaux = listerReseaux()
    .sort((a, b) => Number(parDefaut.includes(b.id)) - Number(parDefaut.includes(a.id)))
    // Générateur (G1b) : le réseau de la version s'ouvre en premier.
    .sort((a, b) => Number(b.id === variante?.reseau) - Number(a.id === variante?.reseau))
    .map((r) => {
      const t = kit.textes[r.id] ?? { texte: "", motsDiese: [] };
      // Formats par réseau T4 : le fichier de CE réseau (fait pour lui, sinon son format préféré, jamais une fin au mot
      // là où elle est interdite). Sorties d'avant, sans réseaux ni fin : le format préféré, comme avant.
      const sortie = meilleureSortie(r.id, detail.sorties) ?? undefined;
      return {
        reseau: r.id,
        nom: r.nom,
        monogramme: r.monogramme,
        texte: pageSite && RESEAUX_LIEN_SITE.includes(r.id) ? descriptionAvecPage(t.texte, pageSite) : t.texte,
        motsDiese: t.motsDiese,
        titre: t.titre,
        longueurMax: r.legende.longueurMax,
        // T4 : « Aucun format d'image adapté » lit les fichiers FAITS (le fichier envoyé), plus les formats prévus.
        avertissements: verifierPourReseau(r, { dureeSec, ratios: detail.video.ratios, texte: t.texte, motsDiese: t.motsDiese, sortieEnvoyee: sortie ?? null }),
        etiquetteIA: r.etiquetteIA,
        sortieConseillee: sortie,
        ...(sortie ? { fichierEnvoye: libelleFichierEnvoye(sortie) } : {}),
        origine: origines[r.id],
        prixReecriture: prix[r.id],
      };
    });
  const cases = kit.avantDePublier;
  const format = trouverFormat(detail.video.formatId);
  const mentionActive = format ? mentionIAActive(format, detail.video) : true;
  const serie = await serieDeVideo(detail.video);
  return {
    videoId,
    reseaux,
    // Équipe 7 : série (en-tête de description), séries proposées, « Votre marque ».
    ...(serie ? { serie } : {}),
    series: (await listerSeries()).map((x) => ({ id: x.id, nom: x.nom })),
    votreMarque: await votreMarqueDeVideo(detail.video),
    credits: kit.credits,
    avantDePublier: cases,
    mentionIAActive: mentionActive,
    // 5 cases, ou 4 quand la mention IA est coupée : jamais bloquant pour la mention (B.0 §1).
    publiable: casesRequises(mentionActive).every((c) => cases[c]) && detail.licencesABloquer.length === 0,
    licencesABloquer: detail.licencesABloquer,
    envoiSimule: await fournisseurSimule("publication"),
    // TEST-UI-REEL U8 (CORRECTEUR UI2) : même règle que le refus du serveur (`envoyerVersBuffer`), dite dès la feuille.
    videoEssai: !detail.video.estDemo && ((await videoEnEssai(detail.video)) || (await fichiersDeDemonstration(reseaux.map((r) => r.sortieConseillee?.fichierId)))),
    // G7a (B.5.5) : chaque version porte son lien suivi (calculé s'il n'est pas écrit dans la version).
    variante: variante
      ? {
          id: variante.id,
          code: variante.code,
          reseau: variante.reseau,
          version: variante.version,
          numero: variante.numero,
          titre: variante.titre,
          sujetId: variante.scriptMaitreId,
          champs: { ...variante.publication, lienSuivi: variante.publication.lienSuivi ?? lienDeVersion(await lireParametre<string>("publication.pageSuivie", PAGE_SUIVIE_PAR_DEFAUT), variante) },
        }
      : undefined,
  };
}

/**
 * Générateur (lot G1b, B.6.11) : le texte du réseau de la version est RECOPIÉ de la version (`source: "variante"`) et
 * resynchronisé quand la version change ; un texte retouché à la main dans le kit n'est jamais écrasé.
 */
async function resynchroniserKit(kit: KitPublication, v: NonNullable<Awaited<ReturnType<typeof versionDeVideo>>>, familles: FamillesHashtags): Promise<KitPublication> {
  const actuel = kit.textes[v.reseau];
  if (actuel?.modifieAMain) return kit;
  if (actuel?.source === "variante" && actuel.varianteVersion === v.version) return kit;
  // Équipe 7 : une version écrite avant « Vos hashtags » est ramenée à la famille du réseau.
  const copie = dansLaFamille({ texte: v.publication.texte, motsDiese: v.publication.motsDiese, titre: v.publication.titres?.[0], source: "variante" as const, varianteVersion: v.version, champs: v.publication }, v.reseau, familles);
  // Lot R2 : relu sous le verrou du kit (une retouche ou un texte d'un autre réseau posé entre-temps n'est pas effacé).
  return sousVerrouKit(async () => {
    const frais = (await depots().kits.obtenir(kit.id)) ?? kit;
    if (frais.textes[v.reseau]?.modifieAMain) return frais;
    return depots().kits.modifier(kit.id, { textes: { ...frais.textes, [v.reseau]: copie } });
  });
}

/** D'où vient le texte affiché : « Écrit par Claude », version, retouché par Will, ou texte d'essai intact. */
function origineTexte(t: TexteReseau | undefined, essai: TexteReseau): VueKitReseau["origine"] {
  if (!t) return undefined;
  if (t.modifieAMain) return "main";
  if (t.source === "claude") return "claude";
  if (t.source === "variante") return "version";
  return memeTexte(t, essai) ? "essai" : undefined;
}

export async function modifierTexteKit(videoId: string, reseau: IdReseau, texte: string, motsDiese: string[], titre?: string): Promise<void> {
  await exigerSession();
  // Équipe 7 : un mot-dièse fourre-tout n'aide pas à comprendre le sujet (jamais publié).
  const interdit = motsDiese.find((m) => estInterdit(m));
  if (interdit) throw new ErreurStudio("HASHTAG_REFUSE", `« ${interdit} » n'aide pas à comprendre votre sujet : retirez-le.`);
  const { id } = await genererKit(videoId);
  await sousVerrouKit(async () => {
    const kit = (await depots().kits.obtenir(id))!;
    const avant = kit.textes[reseau];
    // Un texte retouché à la main n'est plus jamais remplacé sans geste de Will (version G1b, Claude R2).
    const suite: TexteReseau = avant?.source === "variante" ? { ...avant, texte, motsDiese, titre, modifieAMain: true } : { texte, motsDiese, titre, modifieAMain: true };
    await depots().kits.modifier(kit.id, { textes: { ...kit.textes, [reseau]: suite } });
  });
}

/**
 * « Réécrire ce texte » : un GESTE de Will. Avec Claude choisi : un appel (prix affiché sur le bouton), par le chemin de
 * dépense de la vidéo (plafond de la vidéo, limite du mois, pré-vol) ; sinon le texte d'essai. Un texte retouché à la
 * main n'est remplacé qu'après confirmation (`remplacerRetouche`).
 */
export async function regenererTexteKit(videoId: string, reseau: IdReseau, options: { remplacerRetouche?: boolean } = {}): Promise<void> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  // Le texte du réseau d'une version vient du générateur et y est recopié : réécrit ici, il serait payé puis effacé.
  if ((await versionDeVideo(videoId))?.reseau === reseau) throw new ErreurStudio("TEXTE_DE_VERSION", "Ce texte vient de la version du sujet : modifiez-le ici, ou réécrivez la version depuis le sujet.");
  const parClaude = await claudeTextesActif();
  if (parClaude && video.estDemo) throw new ErreurStudio("VIDEO_EXEMPLE", "C'est une vidéo d'exemple : son texte ne se réécrit pas.");
  const kit = await genererKit(videoId);
  const avant = kit.textes[reseau];
  if (avant?.modifieAMain && !options.remplacerRetouche) throw new ErreurStudio("CONFIRMATION_REQUISE", "Vous avez retouché ce texte. Le remplacer par un nouveau texte ?");
  const s = await sourceTextes(video, kit.credits);
  let nouveau: TexteReseau;
  if (parClaude) {
    // VERIF-E2E-2 (double toucher) : un seul appel payé par texte à la fois, même depuis deux onglets.
    const jeton = await reserverReecriture(kit.id, reseau);
    try {
      const r = await texteParClaude(s, reseau, { parWill: true });
      if (!r.ok) throw new ErreurStudio("TEXTE_NON_ECRIT", r.message);
      nouveau = r.texte;
    } finally {
      await libererReecriture(kit.id, reseau, jeton);
    }
  } else nouveau = await texteEssai(s, reseau);
  if (!(await poserSiInchange(kit.id, reseau, avant, nouveau))) throw new ErreurStudio("TEXTE_MODIFIE", "Ce texte a changé pendant la réécriture : votre version est gardée.");
}

/**
 * Au-delà de cette durée, une marque « réécriture en cours » est jugée abandonnée (studio arrêté pendant l'écriture).
 * Relecture finale G2 : plus longue que le pire cas d'un texte (2 essais de 300 s), plus 2 minutes de marge.
 */
export const DUREE_MARQUE_REECRITURE_MS = ESSAIS_TEXTE_PUBLICATION * DELAI_TOTAL_MS + 2 * 60_000;

/**
 * Pose, sous le verrou du kit et EN BASE, la marque « réécriture en cours » de ce réseau. Si une réécriture du même texte
 * est déjà en cours (autre onglet, double toucher, page rechargée) : refus clair, AUCUN appel à Claude, rien de payé.
 */
async function reserverReecriture(kitId: Id, reseau: IdReseau): Promise<string> {
  const jeton = nouvelId("reecriture");
  await sousVerrouKit(async () => {
    const kit = await depots().kits.obtenir(kitId);
    if (!kit) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
    const depuis = kit.reecrituresEnCours?.[reseau];
    if (depuis && Date.now() - Date.parse(depuis) < DUREE_MARQUE_REECRITURE_MS) {
      throw new ErreurStudio("REECRITURE_EN_COURS", "Ce texte est déjà en cours de réécriture. Attendez un instant : le nouveau texte va s'afficher.");
    }
    await depots().kits.modifier(kitId, { reecrituresEnCours: { ...kit.reecrituresEnCours, [reseau]: maintenant() }, reecrituresJetons: { ...kit.reecrituresJetons, [reseau]: jeton } });
  });
  return jeton;
}

/**
 * Retire la marque « réécriture en cours » (réussite comme échec). Relecture finale G2 : seulement si elle est encore
 * à nous (jeton) ; la marque d'une autre réécriture, posée après expiration de la nôtre, n'est jamais levée.
 */
async function libererReecriture(kitId: Id, reseau: IdReseau, jeton: string): Promise<void> {
  await sousVerrouKit(async () => {
    const kit = await depots().kits.obtenir(kitId);
    if (!kit?.reecrituresEnCours?.[reseau] || kit.reecrituresJetons?.[reseau] !== jeton) return;
    const reste = { ...kit.reecrituresEnCours };
    delete reste[reseau];
    const jetons = { ...kit.reecrituresJetons };
    delete jetons[reseau];
    await depots().kits.modifier(kitId, { reecrituresEnCours: reste, reecrituresJetons: jetons });
  });
}

export async function cocherAvantDePublier(videoId: string, cle: keyof KitPublication["avantDePublier"], valeur: boolean): Promise<void> {
  await exigerSession();
  const { id } = await genererKit(videoId);
  // VERIF-E2E-2, D1 : relu et réécrit sous le verrou du kit. Deux onglets ne s'écrasent plus : un décochage (« Droits »)
  // n'est jamais annulé en silence par une coche faite ailleurs au même moment.
  await sousVerrouKit(async () => {
    const kit = (await depots().kits.obtenir(id))!;
    await depots().kits.modifier(id, { avantDePublier: { ...kit.avantDePublier, [cle]: valeur } });
  });
}

/* ------------------------------------------------------------------ */
/* Vérifications « Avant de publier » (vérification E2E n° 1, n° 11)    */
/* ------------------------------------------------------------------ */

type CleAvant = keyof KitPublication["avantDePublier"];

/** Les libellés des cases, comme à l'écran « Avant de publier ». */
export const LIBELLES_VERIFICATIONS: Readonly<Record<CleAvant, string>> = { image: "Image", son: "Son", sousTitres: "Sous-titres", mentionIA: "Mention IA", droits: "Droits" };

/** Cases AFFICHÉES et non cochées d'un kit (4 quand la mention est coupée, 5 sinon). */
export function verificationsManquantes(kit: Pick<VueKit, "avantDePublier" | "mentionIAActive">): CleAvant[] {
  return casesRequises(kit.mentionIAActive).filter((c) => !kit.avantDePublier[c]);
}

/** Le message d'un envoi refusé : le BON nombre, et ce qui manque (« Il reste 2 vérifications sur 4 : Image, Droits. »). */
export function phraseVerifications(kit: Pick<VueKit, "avantDePublier" | "mentionIAActive" | "licencesABloquer">): string {
  const total = casesRequises(kit.mentionIAActive).length;
  const manque = verificationsManquantes(kit);
  if (!manque.length && kit.licencesABloquer.length) return "Une licence bloque la publication : voyez « Droits » sur la vidéo.";
  return `Il reste ${manque.length} vérification${manque.length > 1 ? "s" : ""} sur ${total} : ${manque.map((c) => LIBELLES_VERIFICATIONS[c]).join(", ")}.`;
}

export interface VerificationsVersion {
  varianteId: Id;
  code: string;
  reseau: IdReseau;
  videoId: Id;
  /** Cases affichées sur la vidéo (4 ou 5). */
  total: number;
  manquantes: { cle: CleAvant; libelle: string }[];
  /** Une licence bloque (cocher ne suffit pas). */
  licenceBloque: boolean;
  /** La vidéo n'est pas encore prête (rien à cocher). */
  pasPrete: boolean;
}

/**
 * Avant « Programmer les N » : version par version (versions courantes du sujet qui ont une vidéo), ce qui manque
 * encore à cocher. Lecture seule.
 */
export async function verificationsAvantProgrammer(scriptMaitreId: Id): Promise<VerificationsVersion[]> {
  await exigerSession();
  const d = depots();
  const variantes = versionsCourantes(await d.variantes.lister((v) => v.scriptMaitreId === scriptMaitreId && !v.archiveLe)).filter((v) => !!v.videoId);
  const out: VerificationsVersion[] = [];
  for (const v of variantes) {
    const kit = await obtenirKit(v.videoId!);
    if (!kit) {
      out.push({ varianteId: v.id, code: v.code, reseau: v.reseau, videoId: v.videoId!, total: 0, manquantes: [], licenceBloque: false, pasPrete: true });
      continue;
    }
    const manque = verificationsManquantes(kit);
    out.push({ varianteId: v.id, code: v.code, reseau: v.reseau, videoId: v.videoId!, total: casesRequises(kit.mentionIAActive).length, manquantes: manque.map((cle) => ({ cle, libelle: LIBELLES_VERIFICATIONS[cle] })), licenceBloque: kit.licencesABloquer.length > 0, pasPrete: false });
  }
  return out;
}

/**
 * Envoi vers Buffer.
 * - Simulation (défaut, aucune clé ou pas choisi) : `via: "simulation"`, statut « brouillon », jamais affichée comme
 *   programmée ; l'écran dit « Essai : rien n'a été envoyé à Buffer ».
 * - Réel (lot R1) : voir `envoyerVersBufferReel` — brouillon dans Buffer par défaut, une publication par réseau.
 */
export async function envoyerVersBuffer(
  videoId: string,
  reseaux: IdReseau[],
  dateIso: string,
  options: {
    autreReseauConfirme?: boolean;
    /** Lot R1b : comptes Buffer cochés par Will, par réseau (sinon : dernier choix mémorisé, ou le seul compte). */
    comptes?: Partial<Record<IdReseau, string[]>>;
    /** Premier commentaire modifié à l'écran, par réseau (sinon : celui que la vidéo porte déjà). */
    premiersCommentaires?: Partial<Record<IdReseau, string>>;
  } = {},
): Promise<{ simulation: boolean; publications: Publication[]; mode?: ModeEnvoiPublication; problemes?: ProblemeEnvoi[]; commentairesALaMain?: IdReseau[] }> {
  await exigerSession();
  const kitVue = await obtenirKit(videoId);
  if (!kitVue) throw new ErreurStudio("PAS_PRETE", "La vidéo n'est pas prête.");
  // Générateur (G1b, B.5.5) : une vidéo issue d'une version part sur SON réseau ; ailleurs, seulement après confirmation.
  const reseauVersion = kitVue.variante?.reseau;
  if (reseauVersion && !options.autreReseauConfirme && reseaux.some((r) => r !== reseauVersion)) {
    throw new ErreurStudio("RESEAU_DIFFERENT", `Cette vidéo a été écrite pour ${obtenirReseau(reseauVersion).nom}. Confirmez pour l'envoyer ailleurs.`);
  }
  if (!kitVue.publiable) throw new ErreurStudio("AVANT_DE_PUBLIER", phraseVerifications(kitVue));
  const service = await fournisseur("publication");
  if (service.mode !== "simulation") {
    // CORRECTEUR FINAL A (VERIF-E2E-1 n° 5) : rien d'essai ni d'exemple ne part sur les vrais réseaux.
    const video = await depots().videos.obtenir(videoId);
    if (video?.estDemo) throw new ErreurStudio("VIDEO_EXEMPLE", "C'est une vidéo d'exemple : elle ne part pas sur vos réseaux.");
    const sorties = kitVue.reseaux.map((x) => x.sortieConseillee?.id).filter((x): x is string => !!x);
    const fichiers = await Promise.all((await depots().sorties.lister((x) => sorties.includes(x.id))).map((x) => depots().fichiers.obtenir(x.fichierId)));
    if ((video && (await videoEnEssai(video))) || fichiers.some((f) => estCleDemo(f?.cleStockage))) {
      throw new ErreurStudio("VIDEO_ESSAI", "C'est une vidéo d'essai (vidéo de démonstration) : elle ne part pas sur vos réseaux. Fabriquez-la pour de vrai d'abord.");
    }
    return envoyerVersBufferReel(service, kitVue, [...new Set(reseaux)], dateIso, options.comptes ?? {}, options.premiersCommentaires ?? {});
  }
  const d = depots();
  const publications: Publication[] = [];
  const commentairesALaMain: IdReseau[] = [];
  for (const reseau of reseaux) {
    const r = kitVue.reseaux.find((x) => x.reseau === reseau);
    if (!r) continue;
    const texte = texteAEnvoyer(r, kitVue.serie?.entete);
    const marque = reseau === "tiktok" && kitVue.votreMarque.cochee;
    const commentaire = await commentairePour(kitVue, reseau, options.premiersCommentaires?.[reseau]);
    if (commentaire.aLaMain) commentairesALaMain.push(reseau);
    const envoi = await service.envoyer({ reseau, texte, date: dateIso, fichierCle: r.sortieConseillee?.url ?? "", ...(commentaire.texte ? { premierCommentaire: commentaire.texte } : {}), ...(marque ? { votreMarque: true } : {}) });
    const pub: Publication = {
      id: nouvelId("pub"),
      videoId,
      sortieId: r.sortieConseillee?.id,
      reseau,
      statut: envoi.via === "simulation" ? "brouillon" : "programmee",
      via: envoi.via,
      date: dateIso,
      texte,
      idExterne: envoi.idExterne,
      varianteId: kitVue.variante && kitVue.variante.reseau === reseau ? kitVue.variante.id : undefined,
      // G7a (B.5.5) : le lien suivi de la version part avec la publication (G7b relie visites et rendez-vous).
      lienSuivi: kitVue.variante && kitVue.variante.reseau === reseau ? kitVue.variante.champs.lienSuivi : undefined,
      ...(marque ? { votreMarque: true } : {}),
      ...horodatage(),
    };
    publications.push(await d.publications.enregistrer(pub));
  }
  const simulation = publications.some((p) => p.via === "simulation");
  if (publications.some((p) => p.votreMarque)) await rappelerVotreMarque(videoId, simulation);
  if (!simulation) await passerProgrammee(videoId);
  if (kitVue.variante) await synchroniserEtats(kitVue.variante.id);
  await journaliser("publication", simulation ? `Essai d'envoi vers Buffer (${libelleReseaux(reseaux.length)})` : `Programmée sur ${libelleReseaux(reseaux.length)}`, { type: "video", id: videoId });
  return { simulation, publications, ...(commentairesALaMain.length ? { commentairesALaMain } : {}) };
}

/**
 * Premier commentaire d'un réseau : celui de l'écran, sinon celui que la vidéo porte déjà. Seuls Instagram, Facebook et
 * LinkedIn le reçoivent par Buffer ; pour les autres rien n'est envoyé (`aLaMain` : l'écran dit de le poser soi-même).
 */
async function commentairePour(kitVue: VueKit, reseau: IdReseau, surcharge: string | undefined): Promise<{ texte?: string; aLaMain: boolean }> {
  const texte = (surcharge ?? (await premierCommentaireDeVideo(kitVue.videoId, reseau, kitVue.variante)))?.trim();
  if (!texte) return { aLaMain: false };
  return premierCommentaireTransmissible(reseau) ? { texte, aLaMain: false } : { aLaMain: true };
}

/**
 * Texte publié : l'en-tête de série (équipe 7, « Série · ép. 3 »), le texte du kit puis ses mots-dièse. Dernier filet :
 * un mot-dièse fourre-tout (#fyp, #viral, #pourtoi, #foryou) ne part jamais, quelle que soit l'origine du texte.
 */
function texteAEnvoyer(r: { texte: string; motsDiese: string[] }, entete?: string): string {
  const motsDiese = r.motsDiese.filter((m) => !estInterdit(m));
  return [entete ? `${entete}\n${r.texte}` : r.texte, motsDiese.join(" ")].filter(Boolean).join("\n\n");
}

/**
 * Équipe 7 : vidéo « Votre marque » partie vers TikTok. Buffer ne sait pas le déclarer (aucun champ dans `createPost`) :
 * une notification dit le geste exact à faire dans TikTok. Le brouillon reste la règle : rien n'est publié d'ici.
 */
async function rappelerVotreMarque(videoId: Id, essai: boolean): Promise<void> {
  await creerNotification({ type: "publication", titre: essai ? "Essai · vidéo « Votre marque »" : "TikTok : vidéo « Votre marque »", message: `${RAPPEL_VOTRE_MARQUE}, avant de publier le brouillon.`, lien: `/videos/${videoId}` });
}

/** Lot R1 (C10) : Buffer télécharge la vidéo quand il veut, jusqu'à la publication : adresse signée 7 jours. */
export const DUREE_URL_BUFFER_SEC = 604_800;

/** Adresse de la vidéo lisible par Buffer pendant 7 jours (https), ou une erreur claire. */
async function urlVideoPourBuffer(fichierId: Id | undefined): Promise<string> {
  const f = fichierId ? await depots().fichiers.obtenir(fichierId) : null;
  // CORRECTEUR FINAL A : un fichier de démonstration (dossier du studio) n'est jamais signé pour Buffer.
  if (estCleDemo(f?.cleStockage)) throw new ErreurStudio("VIDEO_ESSAI", "C'est une vidéo d'essai (vidéo de démonstration) : elle ne part pas sur vos réseaux. Fabriquez-la pour de vrai d'abord.");
  const stockage = await fournisseur("stockage");
  const url = f?.cleStockage && stockage.urlLectureDuree ? await stockage.urlLectureDuree(f.cleStockage, DUREE_URL_BUFFER_SEC) : "";
  if (!/^https:\/\//.test(url)) throw new ErreurStudio("FICHIER_HORS_LIGNE", "La vidéo n'est pas sur le stockage en ligne : Buffer ne pourrait pas la lire.");
  return url;
}

export interface ProblemeEnvoi {
  reseau: IdReseau;
  /** Lot R1b : le compte visé, quand le réseau en a plusieurs. */
  canalId?: string;
  message: string;
  /** Raison (code d'erreur du studio), pour l'appelant. */
  code: string;
}

/**
 * ENVOI RÉEL (lot R1 ; lot R1b : un envoi par COMPTE coché, deux LinkedIn = deux envois légitimes). Garanties :
 *  1. tout est vérifié AVANT le premier envoi (comptes Buffer du réseau, vidéo en ligne) : rien ne part à moitié ;
 *  2. les envois « à vérifier » de ces réseaux sont relus d'abord (hors verrou), puis UNE réservation sous le verrou
 *     décide pour TOUS les comptes, avant tout appel : même empreinte (vidéo, réseau, date, compte) déjà envoyée → la
 *     même publication ; envoi en
 *     cours, déjà dans Buffer, encore à vérifier ou tout juste déclaré absent → ce réseau ne part pas, la raison est
 *     rendue dans `problemes` (les autres réseaux partent) ; sinon la publication est notée « envoi en cours » ;
 *  3. les appels à Buffer se font HORS verrou (30 s au plus chacun) ;
 *  4. réponse perdue (délai, coupure) → « à vérifier » : on RELIT Buffer (`reconcilierEnvoi`), jamais un renvoi à l'aveugle ;
 *  5. `via: "buffer"` réussi et le statut viennent de ce que Buffer a dit ; un refus → « échec » avec une phrase simple
 *     (le détail, nettoyé, au journal) ;
 *  6. le journal, l'étape de la vidéo et la version sont toujours mis à jour pour ce qui est parti.
 */
async function envoyerVersBufferReel(service: FournisseurPublication, kitVue: VueKit, reseaux: IdReseau[], dateIso: string, choisis: Partial<Record<IdReseau, string[]>>, commentaires: Partial<Record<IdReseau, string>>) {
  const d = depots();
  const videoId = kitVue.videoId;
  const mode = await lireModeBuffer();
  // Programmée directement : Buffer doit pouvoir lire la vidéo jusqu'à la publication (adresse signée 7 jours).
  if (mode === "programmer" && Date.parse(dateIso) > Date.parse(maintenant()) + (DUREE_URL_BUFFER_SEC - 3600) * 1000) {
    throw new ErreurStudio("TROP_LOIN", "Programmez à moins de 7 jours, ou passez par un brouillon dans Buffer.");
  }
  // 1. Préparation complète avant le moindre envoi : un envoi par compte (un seul texte par réseau, pour tous ses comptes).
  const prets: { reseau: IdReseau; nom: string; texte: string; premierCommentaire?: string; titre?: string; url: string; canal: CanalPublication; sortieId?: Id; votreMarque?: boolean }[] = [];
  // Seuls les comptes cochés ET validés (réseau envoyé, compte connu de ce réseau) sont mémorisés.
  const valides: Partial<Record<IdReseau, string[]>> = {};
  const commentairesALaMain: IdReseau[] = [];
  for (const reseau of reseaux) {
    const r = kitVue.reseaux.find((x) => x.reseau === reseau);
    if (!r) continue;
    const comptes = await comptesBufferPour(reseau, choisis[reseau]);
    if (!comptes.ok) throw new ErreurStudio("COMPTE_BUFFER", comptes.message);
    if (comptes.source === "choisi") valides[reseau] = comptes.canaux.map((c) => c.id);
    if (!r.sortieConseillee) throw new ErreurStudio("RESEAU", `Aucun fichier au bon format pour ${r.nom}.`);
    const url = await urlVideoPourBuffer(r.sortieConseillee.fichierId);
    const nomReseau = obtenirReseau(reseau).nom;
    const commentaire = await commentairePour(kitVue, reseau, commentaires[reseau]);
    if (commentaire.aLaMain) commentairesALaMain.push(reseau);
    for (const canal of comptes.canaux) {
      // Compte choisi (réseau à plusieurs comptes) : son nom accompagne celui du réseau dans chaque phrase.
      const nom = comptes.source === "auto" ? nomReseau : `${nomReseau} (${canal.nom})`;
      prets.push({ reseau, nom, texte: texteAEnvoyer(r, kitVue.serie?.entete), ...(commentaire.texte ? { premierCommentaire: commentaire.texte } : {}), titre: r.titre, url, canal, sortieId: r.sortieConseillee.id, ...(reseau === "tiktok" && kitVue.votreMarque.cochee ? { votreMarque: true } : {}) });
    }
  }
  // Le choix de Will est proposé la fois suivante (et sert à « Programmer les N »).
  await memoriserComptesBuffer(valides);
  // Une publication occupe un COMPTE (une publication sans compte, d'avant R1, occupe tout le réseau).
  const occupees = (p: (typeof prets)[number]) => d.publications.lister((x) => x.videoId === videoId && x.reseau === p.reseau && (!x.canalId || x.canalId === p.canal.id) && occupeBuffer(x));
  const cible = (p: (typeof prets)[number]) => `${p.reseau}|${p.canal.id}`;

  // 2 a. Envois à vérifier de ces comptes : relus d'abord (réseau, hors verrou).
  const declaresAbsents = new Set<string>();
  for (const p of prets) {
    for (const av of (await occupees(p)).filter((x) => x.etatEnvoi === "a-verifier")) {
      if ((await reconcilierEnvoi(av.id))?.etatEnvoi === "absent") declaresAbsents.add(cible(p));
    }
  }

  // 2 b. Une seule réservation, sous le verrou, pour tous les réseaux (aucun réseau).
  type Decision = { p: (typeof prets)[number]; cleEnvoi: string } & ({ nouvelle: Publication } | { existante: Publication } | { probleme: ProblemeEnvoi });
  const decisions = await sousVerrou(async (): Promise<Decision[]> => {
    const out: Decision[] = [];
    for (const p of prets) {
      const cleEnvoi = cleEnvoiBuffer(videoId, p.reseau, dateIso, p.canal.id);
      // Empreinte d'avant R1b (sans compte) : une publication existante reste reconnue.
      const cleAvantR1b = cleEnvoiBuffer(videoId, p.reseau, dateIso);
      const refus = (code: string, message: string): Decision => ({ p, cleEnvoi, probleme: { reseau: p.reseau, canalId: p.canal.id, code, message } });
      const deja = await occupees(p);
      const meme = deja.find((x) => (x.cleEnvoi === cleEnvoi || x.cleEnvoi === cleAvantR1b) && x.etatEnvoi === "envoye");
      if (meme) out.push({ p, cleEnvoi, existante: meme });
      else if (deja.some((x) => x.etatEnvoi === "a-verifier")) out.push(refus("ENVOI_A_VERIFIER", `L'envoi précédent vers ${p.nom} est à vérifier : le studio relit Buffer et ne renverra rien sans en être sûr. Regardez dans Buffer, ou réessayez dans 30 minutes.`));
      else if (deja.some((x) => x.etatEnvoi === "en-cours")) out.push(refus("ENVOI_EN_COURS", `Un envoi vers Buffer est déjà en cours pour ${p.nom}.`));
      else if (deja.length) out.push(refus("DEJA_DANS_BUFFER", `Cette vidéo est déjà dans Buffer pour ${p.nom} : changez sa date dans Buffer.`));
      else if (declaresAbsents.has(cible(p))) out.push(refus("ENVOI_ABSENT", `Buffer n'avait rien reçu pour ${p.nom} : vérifiez dans Buffer avant de renvoyer.`));
      else {
        const variante = kitVue.variante && kitVue.variante.reseau === p.reseau ? kitVue.variante : undefined;
        const nouvelle: Publication = {
          id: nouvelId("pub"),
          videoId,
          sortieId: p.sortieId,
          reseau: p.reseau,
          // Jamais « programmée » avant que Buffer ne l'ait dit.
          statut: "brouillon",
          via: "buffer",
          date: dateIso,
          texte: p.texte,
          varianteId: variante?.id,
          lienSuivi: variante?.champs.lienSuivi,
          etatEnvoi: "en-cours",
          canalId: p.canal.id,
          canalNom: p.canal.nom,
          modeBuffer: mode,
          cleEnvoi,
          envoiCommenceLe: maintenant(),
          ...(p.votreMarque ? { votreMarque: true } : {}),
          ...horodatage(),
        };
        out.push({ p, cleEnvoi, nouvelle: await d.publications.enregistrer(nouvelle) });
      }
    }
    return out;
  });

  const publications: Publication[] = [];
  const problemes: ProblemeEnvoi[] = [];
  try {
    for (const dec of decisions) {
      if ("probleme" in dec) {
        problemes.push(dec.probleme);
        continue;
      }
      if ("existante" in dec) {
        publications.push(dec.existante);
        continue;
      }
      const { p, cleEnvoi, nouvelle: pub } = dec;
      // 3. Appel HORS verrou.
      try {
        const envoi = await service.envoyer({ reseau: p.reseau, texte: p.texte, date: dateIso, fichierCle: p.url, mode, canalId: p.canal.id, titre: p.titre, cleEnvoi, ...(p.premierCommentaire ? { premierCommentaire: p.premierCommentaire } : {}), ...(p.votreMarque ? { votreMarque: true } : {}) });
        if (envoi.via !== "buffer") throw new ErreurBuffer("illisible", PHRASES_BUFFER.incomprehensibleEnvoi, true, "réponse sans confirmation");
        publications.push(await sousVerrou(() => d.publications.modifier(pub.id, { etatEnvoi: "envoye", idExterne: envoi.idExterne, statut: envoi.statut ?? "brouillon", etatLuLe: maintenant() })));
      } catch (e) {
        // Toute erreur qui n'est pas un « non » net de Buffer est incertaine : on relira, on ne renverra pas.
        const incertain = !(e instanceof ErreurBuffer) || e.incertain;
        const message = versErreurStudio(e).message;
        await noterErreurBuffer(`envoi sur ${p.nom}`, e, { type: "video", id: videoId });
        const ecrite = await sousVerrou(() => d.publications.modifier(pub.id, incertain ? { etatEnvoi: "a-verifier", erreur: message } : { etatEnvoi: "refuse", statut: "echec", erreur: message }));
        // « À vérifier » reste rendue (elle peut être chez Buffer) ; une publication refusée n'est que dans `problemes`.
        if (incertain) publications.push(ecrite);
        problemes.push(
          incertain
            ? { reseau: p.reseau, canalId: p.canal.id, code: "ENVOI_A_VERIFIER", message: `${p.nom} : la réponse de Buffer s'est perdue, l'envoi est à vérifier (rien ne sera envoyé deux fois).` }
            : { reseau: p.reseau, canalId: p.canal.id, code: "BUFFER_REFUSE", message },
        );
      }
    }
  } finally {
    // 6. Toujours, pour ce qui est parti (même si une écriture a échoué en chemin). Chaque étape est protégée seule :
    //    aucune ne masque l'erreur d'origine, le journal est toujours écrit.
    const reussies = publications.filter((x) => x.etatEnvoi === "envoye");
    const etape = async (nom: string, f: () => Promise<unknown>) => {
      try {
        await f();
      } catch (e) {
        console.error(`[studio] envoi Buffer, ${nom} en échec`, e instanceof Error ? e.name : "erreur");
      }
    };
    if (reussies.some((x) => x.statut === "programmee")) await etape("étape de la vidéo", () => passerProgrammee(videoId));
    if (kitVue.variante) await etape("version", () => synchroniserEtats(kitVue.variante!.id));
    if (reussies.some((x) => x.votreMarque)) await etape("rappel « Votre marque »", () => rappelerVotreMarque(videoId, false));
    await etape("journal", () => journaliser("publication", `${mode === "brouillon" ? "Brouillon dans Buffer" : "Programmée dans Buffer"} : ${libelleComptes(reussies.length)}${problemes.length ? `, ${problemes.length} à revoir` : ""}`, { type: "video", id: videoId }));
  }
  // Rien n'est parti ni en attente : la raison telle quelle, ou, pour plusieurs comptes, toutes les raisons.
  if (!publications.length && problemes.length) throw new ErreurStudio(problemes[0].code, resumeRefus(problemes));
  return { simulation: false, publications, mode, problemes, ...(commentairesALaMain.length ? { commentairesALaMain } : {}) };
}

/** Tous les refus en une phrase : la raison seule, ou « Aucun des 2 comptes n'est parti : … » suivi de chacune. */
export function resumeRefus(problemes: ProblemeEnvoi[]): string {
  if (problemes.length === 1) return problemes[0].message;
  return `Aucun des ${libelleComptes(problemes.length)} n'est parti. ${problemes.map((p) => p.message).join(" ")}`;
}

/** Publication notée à la main (« je l'ai publiée moi-même »). */
export async function noterPublicationManuelle(videoId: string, reseau: IdReseau, dateIso: string, statut: "programmee" | "publiee"): Promise<Publication> {
  await exigerSession();
  // G7a : une vidéo d'une version, publiée à la main sur SON réseau, garde la version et son lien suivi (mesures J+3, J+7).
  const variante = await versionDeVideo(videoId);
  const siennes = variante && variante.reseau === reseau;
  const pub: Publication = {
    id: nouvelId("pub"),
    videoId,
    reseau,
    statut,
    via: "manuel",
    date: dateIso,
    texte: "",
    ...(siennes ? { varianteId: variante.id, lienSuivi: variante.publication.lienSuivi ?? lienDeVersion(await lireParametre<string>("publication.pageSuivie", PAGE_SUIVIE_PAR_DEFAUT), variante) } : {}),
    ...horodatage(),
  };
  await depots().publications.enregistrer(pub);
  await depots().videos.modifier(videoId, { etapeEditoriale: statut });
  if (siennes) await synchroniserEtats(variante.id);
  return pub;
}

export interface JourCalendrier {
  jour: string; // AAAA-MM-JJ
  publications: (Publication & { video: VueVideoCarte | null; reseauNom: string })[];
}

/** Calendrier (AV2.4-2) : publications par jour entre deux dates. */
export async function listerCalendrier(debutIso: string, finIso: string): Promise<JourCalendrier[]> {
  const exemples = await filtreExemples<Publication>();
  const exemplesVideo = await filtreExemples<{ estDemo?: boolean }>();
  // Une publication (même un essai) d'une vidéo d'exemple suit l'interrupteur « Afficher les exemples ».
  // Une vidéo archivée sort du calendrier ; ses publications reviennent si elle est restaurée.
  const videosMasquees = new Set((await depots().videos.lister((v) => !exemplesVideo(v) || v.statut === "archivee")).map((v) => v.id));
  const pubs = await depots().publications.lister((p) => exemples(p) && !videosMasquees.has(p.videoId) && p.date >= debutIso && p.date <= finIso);
  pubs.sort((a, b) => a.date.localeCompare(b.date));
  const parJour = new Map<string, JourCalendrier["publications"]>();
  const cartes = new Map<string, VueVideoCarte | null>();
  for (const p of pubs) {
    if (!cartes.has(p.videoId)) {
      const v = await depots().videos.obtenir(p.videoId);
      cartes.set(p.videoId, v ? await versCarte(v) : null);
    }
    const jour = cleJour(p.date);
    parJour.set(jour, [...(parJour.get(jour) ?? []), { ...p, video: cartes.get(p.videoId) ?? null, reseauNom: obtenirReseau(p.reseau).nom }]);
  }
  return Array.from(parJour, ([jour, publications]) => ({ jour, publications }));
}

/** Nombre de publications programmées (à venir) des vidéos données : prévenir avant d'archiver. */
export async function compterPublicationsProgrammees(videoIds: string[]): Promise<number> {
  const maintenantIso = new Date().toISOString();
  return depots().publications.compter((p) => videoIds.includes(p.videoId) && p.statut === "programmee" && p.date >= maintenantIso);
}

/** « À programmer » : vidéos validées sans publication programmée. */
export async function listerAProgrammer(): Promise<VueVideoCarte[]> {
  const d = depots();
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const videos = await d.videos.lister((v) => exemples(v) && v.statut === "prete" && v.etapeEditoriale === "validee");
  return Promise.all(videos.map(versCarte));
}

/** Onglet « Résultats » d'une vidéo (chiffres de démonstration, AV2.4-8). */
export async function resultatsVideo(videoId: string) {
  const pubs = await depots().publications.lister((p) => p.videoId === videoId && p.statut === "publiee");
  const total = pubs.reduce(
    (t, p) => ({ vues: t.vues + (p.stats?.vues ?? 0), likes: t.likes + (p.stats?.likes ?? 0), commentaires: t.commentaires + (p.stats?.commentaires ?? 0), partages: t.partages + (p.stats?.partages ?? 0) }),
    { vues: 0, likes: 0, commentaires: 0, partages: 0 },
  );
  return { total, parReseau: pubs.map((p) => ({ reseau: p.reseau, nom: obtenirReseau(p.reseau).nom, stats: p.stats, date: p.date, url: p.urlPubliee })) };
}

/** Fichiers à télécharger d'une vidéo (bouton « Télécharger », choix du ratio) + sous-titres. */
export async function telechargementsVideo(videoId: string) {
  const detail = await obtenirVideo(videoId);
  if (!detail) return null;
  const urls = await urlsFichiers(detail.sorties.map((s) => s.fichierId));
  return {
    sorties: detail.sorties.map((s) => ({ ratio: s.ratio, resolution: s.resolution, url: urls[s.fichierId] ?? s.url, taille: s.taille })),
    // E2E-1 n° 6 : sans sous-titres alignés, la route les tire du texte affiché (lien proposé dès qu'il y a un texte).
    // L0d : une vidéo « Cas concret MD » a aussi un .srt / .vtt par réseau (chacun avec SA fin).
    sousTitres: detail.sousTitres || detail.video.scriptId ? { srt: `/api/sous-titres/${videoId}?format=srt`, vtt: `/api/sous-titres/${videoId}?format=vtt`, parReseau: liensSousTitresParReseau(videoId, detail.versionCourante?.projetMontage) } : null,
  };
}
