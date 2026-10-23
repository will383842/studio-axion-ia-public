/**
 * MINIATURES (lot R4, 03/10) — après la fabrication, HORS verrou (appels au service de rendu).
 * Règle d'or : JAMAIS une image de démonstration sur une vraie vidéo.
 *   - vidéo de démonstration : les images de démonstration, comme avant ;
 *   - vraie vidéo + miniatures réelles reliées (`studio-rendu`) : 3 miniatures calculées sur la vidéo SANS texte
 *     (sinon la vidéo finale), aux 3 meilleurs instants, titre de couverture écrit dans la zone sûre ;
 *   - sinon (simulation, panne, stockage non relié) : la VIGNETTE RÉELLE de la vidéo, titre à part ; rien si la
 *     vidéo elle-même n'a pas de vraie vignette (fabrication simulée).
 * Changer le titre d'une miniature où il est écrit REFAIT l'image (l'ancienne reste dans les fichiers : rien n'est effacé).
 */
import "server-only";
import type { Fichier, Id, Miniature, Ratio, Video } from "@/domaine/types";
import { couvertureDepuisTitre, dimensionsMiniature, estCleDemo, instantsHorsSousTitres, instantsMiniature, motCleCouverture, titreCommenceParCodeInterne, titreSansCodeInterne } from "@/domaine/miniatures";
import { segmentStockage, VALIDITE_ADRESSES_RENDU_SEC as VALIDITE_ADRESSES_SEC } from "@/fournisseurs/rendu/commun";
import { fournisseurMiniatureSimulation } from "@/fournisseurs/simulation/autres";
import type { CouvertureMiniature, PropositionMiniature, SourceMiniature } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { GABARITS_MINIATURE, rangDeVideo } from "@/domaine/vignettes";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre } from "./_commun";


async function enregistrerImage(cle: string, nom: string, ratio: Ratio): Promise<Id> {
  const d = depots();
  const existant = await d.fichiers.trouver((f) => f.cleStockage === cle);
  if (existant) return existant.id;
  const { largeur, hauteur } = dimensionsMiniature(ratio);
  const f: Fichier = { id: nouvelId("f"), cleStockage: cle, nom, mime: "image/jpeg", taille: 0, largeur, hauteur, origine: "fabrication", statut: "pret", ...horodatage() };
  return (await d.fichiers.enregistrer(f)).id;
}

/** Titre de couverture d'une vidéo : celui écrit par le générateur (version par réseau), sinon tiré du titre. */
async function couvertureDe(video: Video, titre: string): Promise<CouvertureMiniature> {
  const variante = video.varianteId ? await depots().variantes.obtenir(video.varianteId) : null;
  // Le générateur ne borne pas sa couverture : elle passe par la même règle (5 mots au plus, coupée proprement).
  if (variante?.couverture?.texte.trim()) {
    const texte = couvertureDepuisTitre(variante.couverture.texte);
    const motCle = variante.couverture.motCle && texte.toLowerCase().includes(variante.couverture.motCle.toLowerCase()) ? variante.couverture.motCle : motCleCouverture(texte);
    return { texte, motCle };
  }
  // Le titre interne de la vidéo (« 0005-FC-TT-L · sujet — v5 ») ne s'écrit JAMAIS sur une couverture.
  const texte = couvertureDepuisTitre(titreSansCodeInterne(titre));
  return { texte, motCle: motCleCouverture(texte) };
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
  // La vidéo SANS texte d'abord (image propre, sans sous-titres), sinon la vidéo finale.
  const master = (await d.pistes.lister((p) => p.versionId === versionId && p.type === "master-sans-texte" && (p.ratio ?? ratio) === (sortie?.ratio ?? ratio)))[0];
  const candidats = [master?.fichierId, sortie?.fichierId].filter((x): x is Id => !!x);
  let fichier: Fichier | null = null;
  for (const id of candidats) {
    const f = await d.fichiers.obtenir(id);
    if (f && !estCleDemo(f.cleStockage)) {
      fichier = f;
      break;
    }
  }
  if (!fichier) return null;
  const dureeSec = sortie?.dureeSec || fichier.dureeSec || video.dureeCibleSec;
  const plans = await d.plans.lister((p) => p.versionId === versionId);
  const variante = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
  let instantsSec = imposes?.instantsSec ?? instantsMiniature(plans, dureeSec, variante?.publication.instantCouverture, nombre);
  // Faute de vidéo sans texte, l'image vient de la vidéo finale : on choisit des instants SANS sous-titre à l'écran.
  if (!imposes && fichier.id !== master?.fichierId) {
    const st = await d.sousTitres.lister((s) => s.versionId === versionId);
    const courant = st.sort((a, b) => b.version - a.version || b.creeLe.localeCompare(a.creeLe))[0];
    if (courant?.segments.length) instantsSec = instantsHorsSousTitres(instantsSec, courant.segments, dureeSec);
  }
  const env = segmentStockage();
  const marque = Date.now().toString(36);
  const depotsSignes: SourceMiniature["depots"] = [];
  for (let i = 0; i < instantsSec.length; i++) {
    const cle = `studio/${env}/videos/${video.id}/miniatures/miniature-${i + 1}-${marque}.jpg`;
    depotsSignes.push({ cle, urlDepot: await stockage.urlDepotDuree(cle, VALIDITE_ADRESSES_SEC, "image/jpeg") });
  }
  return {
    url: await stockage.urlLectureDuree(fichier.cleStockage, VALIDITE_ADRESSES_SEC),
    dureeSec,
    ratio: sortie?.ratio ?? ratio,
    instantsSec,
    ...(imposes ? { variantes: imposes.variantes } : {}),
    // Vignettes v2 : seulement si le réglage est allumé (éteint par défaut : `r4`).
    ...((await lireParametre<string>("miniature.gabarit", "r4")) === GABARITS_MINIATURE[1] ? { gabarit: GABARITS_MINIATURE[1], formatId: video.formatId, rangVideo: rangDeVideo(video) } : {}),
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
  const couverture = await couvertureDe(video, titre);
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
export async function retitrerMiniature(m: Miniature, titre: string): Promise<Id | null> {
  if (!m.incrustee) return null;
  const d = depots();
  const video = await d.videos.obtenir(m.videoId);
  const outil = await fournisseur("miniature");
  if (!video) return null;
  // Jamais un titre enregistré qui diffère de celui écrit sur l'image.
  if (outil.mode !== "reel") throw new ErreurStudio("MINIATURE", "Ce titre est écrit sur l'image : il ne peut être changé que lorsque le calcul des miniatures sur le serveur est relié.");
  const source = await preparerSource(video, 1, { instantsSec: [m.instantSec ?? video.dureeCibleSec / 2], variantes: [m.variante ?? 0] });
  if (!source) throw new ErreurStudio("MINIATURE", "La vidéo n'est pas lisible pour l'instant : le titre n'a pas pu être posé sur l'image.");
  const avant = await couvertureDe(video, video.titre);
  const motCle = avant.motCle && titre.toLowerCase().includes(avant.motCle.toLowerCase()) ? avant.motCle : motCleCouverture(titre);
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
