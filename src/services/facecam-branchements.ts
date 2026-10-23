/**
 * RACCORDS DU FACE CAMÉRA (plan facecam v4, lot E « Intégration ») : ce que les services branchent sur la chaîne vidéo
 * du moteur `montage-facecam` (pur, il n'importe jamais un service). Chargé pour son effet par la boucle de fond et la
 * fabrication ; les services lourds sont importés à la demande (pas de cycle avec `fabrication.ts`).
 *   - agent monteur (lot D) : `monteurPourFabrication` une fois les coupes posées ; ses entrées (passages, consignes,
 *     réglages) sont gardées sur la vidéo ; ses cartes partent à l'habillage (lot C) ;
 *   - Décor IA (lot E1) : `passeDecorFacecam`, seulement si l'option était allumée au lancement (coupée par défaut) ;
 *   - relecture Claude des images de contrôle (lot D) : `relireImagesControle` sur la vignette de la vidéo finie.
 * Aucun de ces raccords ne bloque la livraison (règle de panne, v4 n° 24).
 */
import "server-only";
import { brancherServicesFacecam } from "@/moteurs/montage-facecam/dependances";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import type { ImageRvb } from "@/moteurs/montage-facecam/effets-chaine";
import { depots, fournisseur, maintenant } from "./_commun";

/** Début du travail (le plafond du monteur pour cette version court depuis lui) ; inconnu : maintenant. */
async function debutDuTravail(travailId?: string): Promise<string> {
  const t = travailId ? await depots().travaux.obtenir(travailId) : null;
  return t?.creeLe ?? maintenant();
}

/** Lit une image de R2 en base64 (vignette de la vidéo finie) ; absente ou illisible : null. */
async function imageBase64(cle: string): Promise<{ type: "image/jpeg" | "image/png"; base64: string } | null> {
  try {
    const s = await fournisseur("stockage");
    const url = s.urlLectureDuree ? await s.urlLectureDuree(cle, 600) : await s.urlLecture(cle);
    if (!/^https?:\/\//.test(url)) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    return { type: cle.endsWith(".png") ? "image/png" : "image/jpeg", base64: Buffer.from(await r.arrayBuffer()).toString("base64") };
  } catch {
    return null;
  }
}

/** Image de R2 décodée en RVB 270 × 480 par FFmpeg ; FFmpeg absent ou image illisible : null. */
async function imageRvb(cle: string): Promise<ImageRvb | null> {
  try {
    const s = await fournisseur("stockage");
    const url = s.urlLectureDuree ? await s.urlLectureDuree(cle, 600) : await s.urlLecture(cle);
    if (!/^https?:\/\//.test(url)) return null;
    const { execFile } = await import("node:child_process");
    const largeur = 270;
    const hauteur = 480;
    const donnees = await new Promise<Buffer>((ok, ko) =>
      execFile("ffmpeg", ["-v", "error", "-nostdin", "-i", url, "-frames:v", "1", "-vf", `scale=${largeur}:${hauteur}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { encoding: "buffer", maxBuffer: 8 * 1024 * 1024, timeout: 30_000 }, (e, sortie) => (e ? ko(e) : ok(sortie))),
    );
    return donnees.length >= largeur * hauteur * 3 ? { donnees, largeur, hauteur } : null;
  } catch {
    return null;
  }
}

// Mission H : multicaméra du face caméra (même brique et même service que l'avocat, coupée par défaut).
brancherServicesFacecam({
  multicamera: (c, travailId) => async ({ pisteCle, dureeSec, mots, coupesPrefereesSec, consignes }) => {
    const { passeMulticameraFacecam } = await import("./multicamera-facecam");
    const { lireReglageMulticameraFormat } = await import("./multicamera");
    const reglage = await lireReglageMulticameraFormat("facecam");
    // Allumé au lancement (réglage figé dans la commande) ou consigne « Monteur, fais-le en 3 caméras ».
    const actif = (c.entrees as { facecamMulticamera?: unknown } | undefined)?.facecamMulticamera === true;
    const double = c.distribution[0]?.visagesResolus?.face ?? Object.values(c.distribution[0]?.visagesResolus ?? {})[0];
    const reel = reglage.reel === true;
    const { resoudreFournisseur } = await import("@/fournisseurs");
    const { analyseurAnglesStudio } = await import("./analyseur-angles");
    return passeMulticameraFacecam({
      travailId,
      visageId: double?.idExterne ?? double?.visageId ?? c.distribution[0]?.personnageId ?? "inconnu",
      priseCle: pisteCle,
      audioCle: pisteCle,
      dureePriseSec: dureeSec,
      ratio: "9:16",
      mots,
      coupesPrefereesSec,
      consignes,
      reglage: { ...reglage, actif: actif || reglage.actif },
      ...(reel ? { visage: resoudreFournisseur("visage", double?.fournisseur) } : {}),
      ...(reel ? { analyseur: analyseurAnglesStudio({ motsReference: async () => mots }) ?? undefined } : {}),
    });
  },
});

brancherServicesFacecam({
  monteur: (c, travailId) => async ({ entrees, mots, dureePriseSec }) => {
    const { monteurPourFabrication } = await import("./monteur-facecam");
    const video = await depots().videos.obtenir(c.videoId);
    const { entrees: apres, resultat } = await monteurPourFabrication(c.videoId, { entrees, plafondClaudeAtteint: c.plafondClaudeAtteint }, { titre: video?.titre ?? "", mots, dureePriseSec, depuis: await debutDuTravail(travailId) });
    // Ce que le monteur a compris et posé est gardé sur la vidéo (fil, « Annuler une consigne », retouches). Relue au
    // retour de l'appel : supprimée définitivement entre-temps, rien n'est écrit.
    const fraiche = video ? await depots().videos.obtenir(video.id) : null;
    if (fraiche) {
      const actuelles = (fraiche.entrees ?? {}) as Record<string, unknown>;
      await depots().videos.modifier(fraiche.id, { entrees: { ...actuelles, facecam: apres.facecam, facecamMonteur: apres.facecamMonteur } });
    }
    // Lot I : les passages partent aussi à la chaîne (les effets spéciaux en sont tirés). Lot G : les entrées posées
    // par le monteur suivent la chaîne (version finie, retouches suivantes).
    return { cartes: cartesDesPassages(resultat.etat.facecam.passages as PassageMonteur[]), passages: resultat.etat.facecam.passages, entrees: { facecam: apres.facecam, facecamMonteur: apres.facecamMonteur } };
  },

  decor: (c, travailId) => async ({ mots, dureeUtileSec, imageCle, fenetre, priseCle, bandeX }) => {
    const { passeDecorFacecam } = await import("./decor-ia");
    const { passagesDecorAligneur } = await import("./decor-passages");
    // Lot G : extraire / reposer / mesurer un passage par le studio-aligneur (route `/image`). Sans passe image ou sans
    // fenêtre, rien ne part : « Décor non réussi », aucun crédit dépensé.
    const passages =
      imageCle && fenetre && priseCle
        ? passagesDecorAligneur({ videoId: c.videoId, travailId, imageCle, priseCle, fenetre, bandeX: bandeX ?? 0 })
        : { extrairePassage: async () => null, deposerPassage: async () => null, mesurer: async () => null };
    const r = await passeDecorFacecam({
      videoId: c.videoId,
      travailId,
      dureeUtileSec,
      mots,
      lireImageReference: async (cle) => {
        const image = await imageBase64(cle);
        return image ? { nom: cle.split("/").pop() ?? "decor.jpg", type: image.type, octets: new Uint8Array(Buffer.from(image.base64, "base64")) } : null;
      },
      ...passages,
    });
    if (!r) return null;
    return { applique: r.statut === "applique", message: r.message, ...(r.statut === "applique" ? { plan: r.plan as unknown as Record<string, unknown> } : {}) };
  },

  // Lot K : effets réalistes par IA (Higgsfield gardé par la confirmation de la version ; double par défaut).
  effetsRealistes: (c, travailId) => async ({ effets, imageCle, priseCle, fenetre, bandeX, decorApplique }) => {
    const { passeEffetsRealistesFacecam } = await import("./effet-realiste-ia");
    return passeEffetsRealistesFacecam({ videoId: c.videoId, travailId, effets, priseCle, decorApplique, ...(imageCle ? { imageCle } : {}), ...(fenetre ? { fenetre } : {}), ...(bandeX !== undefined ? { bandeX } : {}) });
  },

  // Lot I : vignette de la piste montée décodée en RVB (petite) par FFmpeg s'il est installé ; sinon null (repli
  // `luminanceVisage` : le conteneur de l'application n'embarque pas FFmpeg aujourd'hui).
  lireImageRvb: async (cle) => imageRvb(cle),
  // Lot G : relecture CIBLÉE (images extraites de la vidéo finie), UN appel, 1 correction convertie en entrées.
  relecture: (c, travailId) => async ({ images, entrees }) => {
    if (c.plafondClaudeAtteint) return null;
    const lues = (await Promise.all(images.map(async (i) => {
      const image = await imageBase64(i.cle);
      return image ? { elementId: i.elementId, legende: i.legende, ...image } : null;
    }))).filter((x): x is NonNullable<typeof x> => !!x);
    if (!lues.length) return null;
    const { relireImagesControle, motsDeLaPrise } = await import("./monteur-facecam");
    const { lireEntreesFacecam } = await import("@/domaine/facecam");
    const { lireReglagesMonteur } = await import("@/moteurs/montage-facecam/monteur");
    const { appliquerRelecture } = await import("@/moteurs/montage-facecam/relecture");
    const { nouvelId } = await import("@/lib/ids");
    const sortie = await relireImagesControle(c.videoId, { facecam: lireEntreesFacecam(entrees), reglages: lireReglagesMonteur(entrees) }, lues, { depuis: await debutDuTravail(travailId) });
    const r = appliquerRelecture(entrees, sortie, { ...(await motsDeLaPrise(entrees)), nouvelId });
    if (r.defauts.length) console.warn(`[facecam] relecture de ${c.videoId} : ${r.defauts.map((d) => d.defaut).join(", ")}${r.correction ? ` — ${r.correction}` : ""}`);
    return r;
  },

  relire: async (c, contexte) => {
    if (!contexte?.vignetteCle || c.plafondClaudeAtteint) return;
    const image = await imageBase64(contexte.vignetteCle);
    if (!image) return;
    // Lot I : une image au milieu de chaque effet spécial (le visage ne doit jamais être caché).
    const effets: { elementId: string; legende: string; type: "image/jpeg" | "image/png"; base64: string }[] = [];
    for (const x of contexte.imagesEffets ?? []) {
      const img = await imageBase64(x.cle);
      if (img) effets.push({ elementId: x.elementId, legende: x.legende, ...img });
    }
    const { relireImagesControle } = await import("./monteur-facecam");
    const { lireEntreesFacecam } = await import("@/domaine/facecam");
    const { lireReglagesMonteur } = await import("@/moteurs/montage-facecam/monteur");
    const video = await depots().videos.obtenir(c.videoId);
    const entrees = (video?.entrees ?? c.entrees ?? {}) as Record<string, unknown>;
    const r = await relireImagesControle(c.videoId, { facecam: lireEntreesFacecam(entrees), reglages: lireReglagesMonteur(entrees) }, [{ elementId: null, legende: "Vignette de la vidéo finie", ...image }, ...effets], { depuis: await debutDuTravail(contexte.travailId) });
    if (r && !r.ok && r.defauts.length) console.warn(`[facecam] relecture de ${c.videoId} : ${r.defauts.map((d) => d.defaut).join(", ")}`);
  },
});
