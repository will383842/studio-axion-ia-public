/**
 * MINIATURES (lot R4, 03/10) — après la fabrication, HORS verrou (appels au service de rendu).
 * Règle d'or : JAMAIS une image de démonstration sur une vraie vidéo.
 *   - vidéo de démonstration : les images de démonstration, comme avant ;
 *   - vraie vidéo + miniatures réelles reliées (`studio-rendu`) : par défaut UNE image tirée de la vidéo FINALE au tout
 *     début (première image bonne), SANS titre ajouté ; un titre n'est écrit que si Williams en a saisi un (09/11).
 *     Réglages de secours « axion-v2 » (carte-titre) et « r4 » : 3 miniatures sur la vidéo SANS texte ;
 *   - sinon (simulation, panne, stockage non relié) : la VIGNETTE RÉELLE de la vidéo, titre à part ; rien si la
 *     vidéo elle-même n'a pas de vraie vignette (fabrication simulée).
 * Changer le titre d'une miniature où il est écrit REFAIT l'image (l'ancienne reste dans les fichiers : rien n'est effacé).
 */
import "server-only";
import type { Fichier, Id, Miniature, Ratio, Video } from "@/domaine/types";
import { couvertureDepuisTitre, dimensionsMiniature, estCleDemo, instantsMiniature, motCleCouverture, titreCommenceParCodeInterne, titreSansCodeInterne } from "@/domaine/miniatures";
import { segmentStockage, VALIDITE_ADRESSES_RENDU_SEC as VALIDITE_ADRESSES_SEC } from "@/fournisseurs/rendu/commun";
import { fournisseurMiniatureSimulation } from "@/fournisseurs/simulation/autres";
import type { CouvertureMiniature, PropositionMiniature, SourceMiniature } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { proposerCouverture } from "@/domaine/couverture-vignette";
import { GABARIT_IMAGE_VIDEO, GABARITS_MINIATURE, INSTANT_PREMIERE_IMAGE_SEC, rangDeVideo } from "@/domaine/vignettes";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre } from "./_commun";


async function enregistrerImage(cle: string, nom: string, ratio: Ratio): Promise<Id> {
  const d = depots();
  const existant = await d.fichiers.trouver((f) => f.cleStockage === cle);
  if (existant) return existant.id;
  const { largeur, hauteur } = dimensionsMiniature(ratio);
  const f: Fichier = { id: nouvelId("f"), cleStockage: cle, nom, mime: "image/jpeg", taille: 0, largeur, hauteur, origine: "fabrication", statut: "pret", ...horodatage() };
  return (await d.fichiers.enregistrer(f)).id;
}

/** Accroche du script de la vidéo (version par réseau d'abord, sinon bloc « accroche » du script, sinon son premier texte). */
async function accrocheDe(video: Video): Promise<string> {
  const d = depots();
  const variante = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
  const dansVariante = variante?.ouverture?.flatMap((b) => b.segments).find((x) => x.texte?.trim())?.texte;
  if (dansVariante) return dansVariante;
  const script = video.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  const blocs = script?.blocs ?? [];
  const bloc = blocs.find((b) => b.blocRecette === "accroche" && b.segments.some((x) => x.texte?.trim())) ?? blocs.find((b) => b.segments.some((x) => x.texte?.trim()));
  return bloc?.segments.find((x) => x.texte?.trim())?.texte ?? "";
}

/** Gabarit voulu : « r4 » et « axion-v2 » par réglage explicite de secours ; sinon l'image de la vidéo (défaut). */
async function choisirGabarit(): Promise<"r4" | "axion-v2" | typeof GABARIT_IMAGE_VIDEO> {
  const reglage = await lireParametre<string>("miniature.gabarit", GABARIT_IMAGE_VIDEO);
  return reglage === GABARITS_MINIATURE[0] ? "r4" : reglage === GABARITS_MINIATURE[1] ? "axion-v2" : GABARIT_IMAGE_VIDEO;
}

/**
 * Titre de couverture d'une vidéo, par ordre : celui FIXÉ (ou déjà proposé) de la fiche, celui du générateur, un titre
 * PROPOSÉ depuis l'accroche du script, et en dernier recours le titre de la vidéo (sans code interne). `aGarder` : la
 * proposition à enregistrer sur la fiche (Williams la voit et la change quand il veut).
 */
async function resoudreCouverture(video: Video, titre: string): Promise<{ couverture: CouvertureMiniature; aGarder?: { texte: string; motCle: string; fixee: false } }> {
  const fiche = video.couvertureVignette;
  if (fiche?.texte.trim()) return { couverture: { texte: fiche.texte.trim(), motCle: fiche.motCle.trim() || motCleCouverture(fiche.texte) } };
  // Image de la vidéo (défaut) : le titre est OPTIONNEL, vide tant que Williams n'en saisit pas. Rien n'est proposé ni écrit.
  if ((await choisirGabarit()) === GABARIT_IMAGE_VIDEO) return { couverture: { texte: "", motCle: "" } };
  const variante = video.varianteId ? await depots().variantes.obtenir(video.varianteId) : null;
  // Le générateur ne borne pas sa couverture : elle passe par la même règle (5 mots au plus, coupée proprement).
  if (variante?.couverture?.texte.trim()) {
    const texte = couvertureDepuisTitre(variante.couverture.texte);
    const motCle = variante.couverture.motCle && texte.toLowerCase().includes(variante.couverture.motCle.toLowerCase()) ? variante.couverture.motCle : motCleCouverture(texte);
    return { couverture: { texte, motCle } };
  }
  const accroche = await accrocheDe(video);
  if (accroche.trim()) {
    const p = proposerCouverture(accroche, titre);
    if (p.texte) return { couverture: p, aGarder: { ...p, fixee: false } };
  }
  // Le titre interne de la vidéo (« 0005-FC-TT-L · sujet — v5 ») ne s'écrit JAMAIS sur une couverture.
  const texte = couvertureDepuisTitre(titreSansCodeInterne(titre));
  return { couverture: { texte, motCle: motCleCouverture(texte) } };
}

async function couvertureDe(video: Video, titre: string): Promise<CouvertureMiniature> {
  return (await resoudreCouverture(video, titre)).couverture;
}

/**
 * La vidéo d'où tirer les miniatures, avec ses adresses signées. null : rien de réel à lire (vidéo simulée, stockage
 * d'essai, pas de version prête).
 */
async function preparerSource(video: Video, nombre: number, imposes?: { instantsSec: number[]; variantes: number[] }): Promise<SourceMiniature | null> {
  const d = depots();
  const stockage = await fournisseur("stockage");
  if (stockage.mode === "simulation" || !stockage.urlLectureDuree || !stockage.urlDepotDuree) return null;
  const versionId = video.versionChoisieId;
  if (!versionId) return null;
  const ratio: Ratio = video.ratios[0] ?? "9:16";
  const sorties = await d.sorties.lister((s) => s.versionId === versionId);
  const sortie = sorties.find((s) => s.ratio === ratio) ?? sorties[0];
  const gabarit = await choisirGabarit();
  const v3 = gabarit === GABARIT_IMAGE_VIDEO;
  // Image de la vidéo (défaut) : on lit la vidéo FINALE du ratio principal (c'est elle que les réseaux montrent au lancement).
  // Gabarits de secours : la vidéo SANS texte seule ; sans elle, fond propre de la charte.
  const finale = v3 && sortie?.fichierId ? await d.fichiers.obtenir(sortie.fichierId) : null;
  const master = v3 ? undefined : (await d.pistes.lister((p) => p.versionId === versionId && p.type === "master-sans-texte" && (p.ratio ?? ratio) === (sortie?.ratio ?? ratio)))[0];
  const fichierMaster = master?.fichierId ? await d.fichiers.obtenir(master.fichierId) : null;
  const candidat = v3 ? finale : fichierMaster;
  const fichier = candidat && !estCleDemo(candidat.cleStockage) ? candidat : null;
  const dureeSec = sortie?.dureeSec || fichier?.dureeSec || video.dureeCibleSec;
  const plans = await d.plans.lister((p) => p.versionId === versionId);
  const variante = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
  const instantsSec = v3 ? [INSTANT_PREMIERE_IMAGE_SEC] : (imposes?.instantsSec ?? instantsMiniature(plans, dureeSec, variante?.publication.instantCouverture, nombre));
  const env = segmentStockage();
  const marque = Date.now().toString(36);
  const depotsSignes: SourceMiniature["depots"] = [];
  for (let i = 0; i < instantsSec.length; i++) {
    const cle = `studio/${env}/videos/${video.id}/miniatures/miniature-${i + 1}-${marque}.jpg`;
    depotsSignes.push({ cle, urlDepot: await stockage.urlDepotDuree(cle, VALIDITE_ADRESSES_SEC, "image/jpeg") });
  }
  return {
    url: fichier ? await stockage.urlLectureDuree(fichier.cleStockage, VALIDITE_ADRESSES_SEC) : "",
    ...(fichier ? {} : { fondPropre: true }),
    dureeSec,
    ratio: sortie?.ratio ?? ratio,
    instantsSec,
    ...(imposes ? { variantes: imposes.variantes } : {}),
    // Défaut : image de la vidéo (« image-video-v3 ») ; « axion-v2 » (carte-titre) et « r4 » en réglage explicite de secours.
    ...(gabarit !== "r4" ? { gabarit, formatId: video.formatId, rangVideo: rangDeVideo(video) } : {}),
    depots: depotsSignes,
  };
}

/** Vignette RÉELLE de la vidéo (image de la vidéo fabriquée), jamais une image de démonstration. */
async function vignetteReelle(video: Video): Promise<Id | null> {
  const d = depots();
  if (!video.versionChoisieId) return null;
  const sorties = await d.sorties.lister((s) => s.versionId === video.versionChoisieId);
  for (const s of [...sorties.filter((x) => x.ratio === video.ratios[0]), ...sorties]) {
    const f = s.vignetteFichierId ? await d.fichiers.obtenir(s.vignetteFichierId) : null;
    if (f && !estCleDemo(f.cleStockage)) return f.id;
  }
  return null;
}

/** Crée les miniatures d'une vidéo terminée si elle n'en a aucune. Hors verrou. */
export async function creerMiniaturesSiAbsentes(videoId: Id, titre: string, ratio: Ratio): Promise<void> {
  const d = depots();
  if (await d.miniatures.compter((m) => m.videoId === videoId)) return;
  const video = await d.videos.obtenir(videoId);
  if (!video) return;
  const outil = await fournisseur("miniature");

  let propositions: PropositionMiniature[] = [];
  let origine: Miniature["origine"] = "rendu";
  const { couverture, aGarder } = await resoudreCouverture(video, titre);
  if (aGarder) await d.videos.modifier(videoId, { couvertureVignette: aGarder });
  if (video.estDemo) {
    // Vidéo de démonstration : images de démonstration (comportement d'avant le lot R4).
    propositions = await fournisseurMiniatureSimulation.proposer({ videoId, titre, nombre: 3 });
    origine = "demo";
  } else if (outil.mode === "reel") {
    const source = await preparerSource(video, 3);
    if (source) {
      try {
        propositions = await outil.proposer({ videoId, titre, nombre: 3, source, couverture });
      } catch (e) {
        console.error("[studio] miniatures réelles en échec", e instanceof Error ? e.name : "erreur");
      }
    }
  }
  // Vidéo supprimée définitivement pendant l'appel : rien n'est écrit (aucune miniature ni fichier pour un id disparu).
  if (!(await d.videos.obtenir(videoId))) return;
  // Garde-fou : une vraie vidéo ne reçoit JAMAIS une image de démonstration, quel que soit le fournisseur.
  if (!video.estDemo) propositions = propositions.filter((p) => !estCleDemo(p.fichierCle));

  if (!propositions.length && !video.estDemo) {
    const vignette = await vignetteReelle(video);
    if (!vignette) return; // fabrication simulée : rien de réel à montrer, plutôt aucune miniature qu'une fausse
    const id = nouvelId("mini");
    await d.miniatures.enregistrer({ id, videoId, fichierId: vignette, titre: couverture.texte || titre, choisie: true, ratio, origine: "vignette", ...horodatage() });
    await d.videos.modifier(videoId, { miniatureChoisieId: id });
    return;
  }
  for (const [i, p] of propositions.entries()) {
    const fichierId = await enregistrerImage(p.fichierCle, `miniature-${i + 1}.jpg`, ratio);
    const id = nouvelId("mini");
    await d.miniatures.enregistrer({
      id,
      videoId,
      fichierId,
      titre: p.titre,
      choisie: i === 0,
      ratio,
      origine,
      ...(p.incrustee ? { incrustee: true } : {}),
      ...(p.instantSec !== undefined ? { instantSec: p.instantSec } : {}),
      ...(p.variante !== undefined ? { variante: p.variante } : {}),
      ...(p.gabarit ? { gabarit: p.gabarit } : p.ambiance ? { gabarit: "axion-v2" as const } : {}),
      ...horodatage(),
    });
    // La première proposition devient LA miniature de la vidéo : cartes, calendrier et lien privé la montrent.
    if (i === 0) await d.videos.modifier(videoId, { miniatureChoisieId: id });
  }
  if (origine === "rendu" && propositions.length) await journaliser("fabrication", `${propositions.length} miniature${propositions.length > 1 ? "s" : ""} tirée${propositions.length > 1 ? "s" : ""} de la vidéo : « ${video.titre} »`, { type: "video", id: videoId });
}

/**
 * Nouveau titre sur une miniature où il est ÉCRIT : l'image est refaite au même instant, même mise en page.
 * Renvoie le nouveau fichier (l'ancien reste) ; null si le titre n'est pas écrit sur l'image (rien à refaire).
 */
export async function retitrerMiniature(m: Miniature, titre: string, motCleVoulu?: string): Promise<Id | null> {
  // Une image de la vidéo (v3) se refait en entier par « Refaire les vignettes » : jamais de titre reposé ici.
  if (!m.incrustee || m.gabarit === "image-video-v3") return null;
  const d = depots();
  const video = await d.videos.obtenir(m.videoId);
  const outil = await fournisseur("miniature");
  if (!video) return null;
  // Jamais un titre enregistré qui diffère de celui écrit sur l'image.
  if (outil.mode !== "reel") throw new ErreurStudio("MINIATURE", "Ce titre est écrit sur l'image : il ne peut être changé que lorsque le calcul des miniatures sur le serveur est relié.");
  const source = await preparerSource(video, 1, { instantsSec: [m.instantSec ?? video.dureeCibleSec / 2], variantes: [m.variante ?? 0] });
  if (!source) throw new ErreurStudio("MINIATURE", "La vidéo n'est pas lisible pour l'instant : le titre n'a pas pu être posé sur l'image.");
  const avant = await couvertureDe(video, video.titre);
  const motCle = motCleVoulu?.trim() && titre.toLowerCase().includes(motCleVoulu.trim().toLowerCase()) ? motCleVoulu.trim() : avant.motCle && titre.toLowerCase().includes(avant.motCle.toLowerCase()) ? avant.motCle : motCleCouverture(titre);
  const [p] = await outil.proposer({ videoId: video.id, titre, nombre: 1, source, couverture: { texte: titre, motCle } }).catch(() => []);
  if (!p || estCleDemo(p.fichierCle)) throw new ErreurStudio("MINIATURE", "Le nouveau titre n'a pas pu être posé sur l'image. Réessayez dans un instant.");
  return enregistrerImage(p.fichierCle, "miniature-retitree.jpg", m.ratio);
}

/**
 * Rattrapage (11/10) : les miniatures dont le titre commence par un code interne (« 0005-FC-TT-L · … ») sont refaites
 * avec le titre nettoyé. Idempotent (une fois refaites, plus de code) ; l'ancien fichier est gardé ; une miniature dont
 * Will a déjà changé le titre n'est jamais touchée. Sans `videoId` : toutes les vidéos. Renvoie le nombre refait.
 */
export async function refaireMiniaturesTitreInterne(videoId?: Id): Promise<number> {
  const d = depots();
  const minis = await d.miniatures.lister((m) => (!videoId || m.videoId === videoId) && titreCommenceParCodeInterne(m.titre));
  let faites = 0;
  for (const m of minis) {
    const titre = couvertureDepuisTitre(m.titre);
    if (!titre || titre === m.titre) continue;
    let fichierId: Id | null = null;
    try {
      fichierId = m.incrustee ? await retitrerMiniature(m, titre) : null;
    } catch (e) {
      if (videoId) throw e; // une vidéo demandée : Will voit pourquoi ; en lot, on passe à la suivante.
      continue;
    }
    await d.miniatures.modifier(m.id, { titre, ...(fichierId ? { fichierId } : {}) });
    faites++;
  }
  return faites;
}

/**
 * « Refaire les vignettes » d'UNE vidéo : une nouvelle vignette (la vraie image du début de la vidéo ; titre de la fiche seulement s'il y en a un). Rien
 * n'est effacé : les anciennes restent (images et fiches), la première nouvelle devient la miniature choisie.
 * Renvoie le nombre de miniatures ajoutées ; lève une erreur lisible si le calcul n'est pas possible.
 */
export async function refaireVignettes(videoId: Id): Promise<number> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || video.estDemo) throw new ErreurStudio("MINIATURE", "Cette vidéo n'a pas de vraie vignette à refaire.");
  const outil = await fournisseur("miniature");
  if (outil.mode !== "reel") throw new ErreurStudio("MINIATURE", "Le calcul des vignettes sur le serveur n'est pas relié : rien n'a été refait.");
  const ratio: Ratio = video.ratios[0] ?? "9:16";
  const { couverture, aGarder } = await resoudreCouverture(video, video.titre);
  const source = await preparerSource(video, 3);
  if (!source) throw new ErreurStudio("MINIATURE", "La vidéo n'est pas lisible pour l'instant : réessayez dans un moment.");
  const propositions = (await outil.proposer({ videoId, titre: video.titre, nombre: 3, source, couverture }).catch(() => [])).filter((p) => !estCleDemo(p.fichierCle));
  if (!propositions.length) throw new ErreurStudio("MINIATURE", "Les vignettes n'ont pas pu être refaites. Les anciennes sont gardées.");
  if (!(await d.videos.obtenir(videoId))) return 0;
  for (const m of await d.miniatures.lister((x) => x.videoId === videoId && x.choisie)) await d.miniatures.modifier(m.id, { choisie: false });
  let premiere: Id | null = null;
  for (const [i, p] of propositions.entries()) {
    const fichierId = await enregistrerImage(p.fichierCle, `vignette-${i + 1}.jpg`, ratio);
    const id = nouvelId("mini");
    await d.miniatures.enregistrer({
      id, videoId, fichierId, titre: p.titre, choisie: i === 0, ratio, origine: "rendu",
      ...(p.incrustee ? { incrustee: true } : {}),
      ...(p.instantSec !== undefined ? { instantSec: p.instantSec } : {}),
      ...(p.variante !== undefined ? { variante: p.variante } : {}),
      ...(p.gabarit ? { gabarit: p.gabarit } : p.ambiance ? { gabarit: "axion-v2" as const } : {}),
      ...horodatage(),
    });
    premiere ??= id;
  }
  await d.videos.modifier(videoId, { miniatureChoisieId: premiere!, ...(aGarder ? { couvertureVignette: aGarder } : {}) });
  await journaliser("fabrication", `${propositions.length} vignettes refaites (les anciennes sont gardées) : « ${video.titre} »`, { type: "video", id: videoId });
  return propositions.length;
}

/** Vignettes à refaire : vraie vidéo prête, hors corbeille, dont la miniature choisie n'est pas déjà l'image de la vidéo (« image-video-v3 »), cartes-titre comprises. */
export async function videosAVignettesAnciennes(): Promise<Video[]> {
  const d = depots();
  const videos = await d.videos.lister((v) => !v.estDemo && v.statut === "prete" && !!v.versionChoisieId && !v.corbeilleLe);
  const aRefaire: Video[] = [];
  for (const v of videos) {
    const choisie = v.miniatureChoisieId ? await d.miniatures.obtenir(v.miniatureChoisieId) : null;
    if (choisie?.gabarit !== GABARIT_IMAGE_VIDEO) aRefaire.push(v);
  }
  return aRefaire;
}

/**
 * « Refaire les vignettes » de TOUTES les vidéos qui n'ont pas encore la vignette Axion (cartes-titre et plus anciennes), par lot de `max` (20) : on relance jusqu'à `restantes` = 0. Une vidéo en échec ne bloque pas les autres.
 * Rien n'est effacé.
 */
export async function refaireToutesLesVignettes(max = 20): Promise<{ videos: number; erreurs: number; restantes: number }> {
  const aRefaire = await videosAVignettesAnciennes();
  let faites = 0;
  let erreurs = 0;
  for (const v of aRefaire.slice(0, max)) {
    try {
      if ((await refaireVignettes(v.id)) > 0) faites++;
      else erreurs++;
    } catch (e) {
      erreurs++;
      console.error("[studio] vignettes à refaire en échec", e instanceof Error ? e.name : "erreur");
    }
  }
  return { videos: faites, erreurs, restantes: Math.max(0, aRefaire.length - faites - erreurs) };
}
