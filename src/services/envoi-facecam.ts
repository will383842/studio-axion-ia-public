/**
 * RÉCEPTION D'UNE VIDÉO FACE CAMÉRA ENVOYÉE DEPUIS L'IPHONE (plan facecam v4, § C.3 et B.13 ; lot D). Serveur seulement.
 *
 * L'iPhone a déjà déposé le fichier par l'envoi multipart existant (`lib/envoi-multipart.ts`, reprise comprise).
 * Ici, d'un seul geste :
 *  1. la prise est rangée sous sa version (séance de la version, créée si besoin) dans `entrees.prises` : pas de
 *     `rushId` ni d'étape propre au format ;
 *  2. la demande facultative (« Une demande pour le monteur ? ») devient une consigne écrite ;
 *  3. le montage part tout seul (`monterJeLis`, accord donné d'office : format sans prix). S'il ne peut pas partir
 *     (montage pas encore prêt, outil éteint), la vidéo reste bien reçue et la raison est dite simplement.
 */
import "server-only";
import { assemblerBlocs, codeVariante, empreinte, empreinteCorps, texteDesBlocs } from "@/domaine/derivations-generateur";
import { lireEntreesFacecam, type ConsigneFacecam } from "@/domaine/facecam";
import type { BlocScript, Id, ReseauDeclinaison, Script, VarianteReseau } from "@/domaine/types";
import { formatGenerateur } from "@/formats";
import { miseEnFormePrompteur } from "@/generateur/chaine";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { attribuerNumero, creerSujet, validerVariante } from "./generateur";
import { ID_FORMAT_FACECAM } from "./monteur-facecam";
import { creerSeance, enregistrerPrise } from "./tournage";

export interface VueEnvoi {
  varianteId: Id;
  code: string;
  titre: string;
  /** La version a déjà une vidéo : un nouvel envoi ajoute une prise. */
  dejaRecue: boolean;
  videoId?: Id;
}

export async function vueEnvoiFacecam(varianteId: Id): Promise<VueEnvoi | null> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || v.archiveLe || v.formatId !== ID_FORMAT_FACECAM) return null;
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  return { varianteId: v.id, code: v.code, titre: m?.angle?.titre ?? m?.brief.idee ?? v.code, dejaRecue: !!v.videoId, ...(v.videoId ? { videoId: v.videoId } : {}) };
}

/** Titre d'une vidéo déjà filmée sans texte ni titre (Will le renomme ensuite). */
const TITRE_SANS_TEXTE = "Vidéo face caméra";

/** Longueur maximale du texte collé (« J'ai déjà filmé ma vidéo »). */
export const TEXTE_DEJA_FILME_MAX = 20_000;

/** Découpe le texte dit en phrases (une par segment, comme la chaîne pour le téléprompteur), sans réécrire un seul mot. */
export function phrasesDuTexteDit(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * « J'AI DÉJÀ FILMÉ MA VIDÉO » (retour prod du 09/10) : Will a déjà filmé sa vidéo face caméra et colle le texte qu'il a
 * dit. Crée, SANS aucun appel Claude, un sujet numéroté, son texte (un seul bloc « corps », une phrase par segment) et
 * une version facecam « je lis » VALIDÉE dont le téléprompteur est mis en forme par le code (`miseEnFormePrompteur`,
 * comme la chaîne). Les mots sont ceux de Will, tels quels : les sous-titres « je lis » en viennent.
 * Ensuite : `/envoyer/<varianteId>` (`vueEnvoiFacecam`, `recevoirVideoFacecam`, `monterJeLis`).
 */
export async function creerVersionFacecamDepuisTexte(texte?: string, titre?: string): Promise<{ varianteId: Id }> {
  await exigerSession();
  // Script facultatif (18/10) : sans texte, la version est créée quand même (les sous-titres viennent de la transcription).
  const phrases = phrasesDuTexteDit(texte ?? "");
  if ((texte ?? "").length > TEXTE_DEJA_FILME_MAX) throw new ErreurStudio("TEXTE_TROP_LONG", "Ce texte est trop long pour une vidéo face caméra.");
  const d = depots();
  const format = formatGenerateur(ID_FORMAT_FACECAM);
  const recette = format.recette;
  const mode = "teleprompteur" as const;
  const adresse = "vous" as const;
  // Format à un seul réseau (`declinaison: "aucune"`) : un code, une version.
  const reseau: ReseauDeclinaison = "tiktok";
  const idee = titre?.replace(/\s+/g, " ").trim().slice(0, 140) || phrases[0]?.split(" ").slice(0, 10).join(" ") || TITRE_SANS_TEXTE;

  // Lot L5 : un fichier filmé par Will n'a pas d'écran pour choisir « autre sujet / refaire » ici : aucun contrôle de sujet (à confirmer).
  const m = await creerSujet({ idee, reseaux: [reseau], formatId: format.id, adresse, mode }, { sansControle: true });
  const numero = await attribuerNumero(m.id, { episode: false });

  const scriptId = nouvelId("script");
  const blocs: BlocScript[] = [{ id: `${scriptId}-corps`, blocRecette: "corps", segments: phrases.map((p, i) => ({ id: `${scriptId}-s${i + 1}`, texte: p })) }];
  const script: Script = {
    id: scriptId,
    formatId: format.id,
    versionFormat: format.version,
    sujet: idee,
    adresse,
    version: 1,
    blocs,
    favori: false,
    reference: false,
    statutEditorial: "valide",
    marqueId: m.marqueId,
    scriptMaitreId: m.id,
    mode,
    versionRecette: recette.version,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  const v: VarianteReseau = {
    id: nouvelId("var"),
    code: codeVariante({ numero, codeFormat: format.codeClassement, reseau, mode, adresse }),
    scriptMaitreId: m.id,
    scriptId,
    formatId: format.id,
    reseau,
    version: 1,
    versionRecette: recette.version,
    ouverture: [],
    fin: [],
    accrocheId: "",
    appel: { type: "sauvegarde", texte: "", selonObjectif: false },
    boucle: false,
    segmentFacultatifRetenu: false,
    dureeEstimeeSec: 0,
    ratios: [format.ratioMaitre, ...format.ratios.filter((r) => r !== format.ratioMaitre)],
    encadre: { texte: idee },
    publication: { texte: "", motsDiese: [], premiereLigne: "", sources: [], rappels: {}, etiquetteIAPlateforme: false, justifications: [] },
    prompteur: miseEnFormePrompteur(blocs),
    empreinteCorps: empreinteCorps(blocs),
    empreinteTexte: "",
    note: { globale: 0, criteres: {}, commentaire: "Texte déjà filmé par Will : aucune écriture, aucune note." },
    controles: { passe: true, violations: [], versionControles: 0, le: maintenant() },
    etat: "a-relire",
    estDemo: m.estDemo,
    // Texte de Will, jamais contrôlé : jamais de voyant rouge à confirmer (`domaine/voyant-rouge`).
    ...({ origine: "will" } as object),
    ...horodatage(),
  };
  const dit = texteDesBlocs(assemblerBlocs(script, v));
  v.empreinteTexte = empreinte(dit);
  v.dureeEstimeeSec = Math.max(1, Math.round(dit.split(/\s+/).filter(Boolean).length / recette.debitParMode[mode]));

  // Unicité (code, version) contrôlée sous verrou avec l'écriture, comme l'écriture d'un sujet.
  await sousVerrou(async () => {
    const existantes = await d.variantes.lister((x) => x.code === v.code);
    if (existantes.some((x) => !x.archiveLe)) throw new ErreurStudio("DEJA_ECRIT", `Cette version existe déjà (${v.code}).`);
    v.version = Math.max(0, ...existantes.map((x) => x.version)) + 1;
    await d.scripts.enregistrer(script);
    await d.variantes.enregistrer(v);
  });
  await d.scriptsMaitres.modifier(m.id, { etat: undefined, manque: undefined });
  await validerVariante(v.id);
  await journaliser("sujet", `n° ${numero} : vidéo face caméra déjà filmée, texte de Will gardé tel quel (aucune écriture)`, { type: "sujet", id: m.id });
  return { varianteId: v.id };
}

export interface ResultatReception {
  videoId: Id;
  travailId?: Id;
  /** Le montage n'a pas pu partir : pourquoi, en mots simples (la vidéo est bien reçue). */
  enAttente?: string;
}

export async function recevoirVideoFacecam(varianteId: Id, fichierId: Id, dureeSec: number, demande?: string): Promise<ResultatReception> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.formatId !== ID_FORMAT_FACECAM) throw new ErreurStudio("FORMAT", "Cet envoi est réservé aux vidéos face caméra.");

  // Séance de la version (la plus récente), sinon une séance d'une seule version.
  const seances = (await d.sessionsTournage.lister((s) => !s.archiveLe && s.varianteIds.includes(varianteId))).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const seance = seances[0] ?? (await creerSeance([varianteId]));
  const { videoId } = await enregistrerPrise({ seanceId: seance.id, varianteId, fichierId, dureeSec });

  const texte = demande?.trim().slice(0, 1000);
  if (texte) {
    const video = await d.videos.obtenir(videoId);
    const entrees = (video?.entrees ?? {}) as Record<string, unknown>;
    const facecam = lireEntreesFacecam(entrees);
    const consigne: ConsigneFacecam = { id: nouvelId("csg"), origine: "ecrite", texte, etat: "comprise", le: maintenant() };
    await d.videos.modifier(videoId, { entrees: { ...entrees, facecam: { ...facecam, consignes: [...facecam.consignes, consigne] } } });
  }
  await journaliser("tournage", "Vidéo face caméra reçue depuis l'iPhone", { type: "video", id: videoId });

  try {
    const { monterJeLis } = await import("./fabrication-reseaux");
    // Format sans prix : l'accord est donné d'office côté serveur (`accordDuFormat`), aucun accord écrit en dur ici.
    const r = await monterJeLis(varianteId, { confirme: false });
    return { videoId: r.videoId, travailId: r.travailId };
  } catch (e) {
    if (e instanceof ErreurStudio) return { videoId, enAttente: e.message };
    throw e;
  }
}

/** Vidéos face caméra validées et pas encore reçues : « Envoyer ma vidéo de : … » sur l'accueil (la plus récente d'abord). */
export async function versionsFacecamAEnvoyer(limite = 3): Promise<{ varianteId: Id; titre: string }[]> {
  await exigerSession();
  const { listerVersionsATourner } = await import("./tournage");
  return (await listerVersionsATourner())
    .filter((v) => v.formatId === ID_FORMAT_FACECAM)
    .slice(0, limite)
    .map((v) => ({ varianteId: v.id, titre: v.titre ?? v.code }));
}
