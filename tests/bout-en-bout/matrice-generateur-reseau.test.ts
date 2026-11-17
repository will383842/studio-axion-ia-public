/**
 * ESSAI-BOUT-EN-BOUT-PAR-GENERATEUR · chaque format « actif » du registre × LinkedIn, Instagram, Facebook, TikTok.
 * YouTube est éteint : hors matrice. Les formats sont LUS dans `src/formats` (jamais recopiés) : un format passé
 * « actif » entre de lui-même dans la matrice.
 *
 * Une case « <format> × <réseau> » enchaîne, avec les doublures du dépôt (script simulé, rédacteur de textes simulé,
 * fichiers candidats construits depuis le registre des réseaux, corps Zernio construit sans appel) :
 *   1. texte tiré du script ;  2. hashtags ;  3. premier commentaire là où le réseau l'accepte ;
 *   4. fichier choisi par `meilleureSortie` ;  5. aucun avertissement bloquant de `verifierPourReseau` ;
 *   6. corps Zernio construit sans erreur.
 * Les écarts connus vivent dans `ecarts-connus.ts` ; un écart non listé, ou listé mais corrigé, fait échouer la case.
 * Aucun appel réel, aucune clé, aucun fichier de src/ ou de tests/zernio modifié.
 */
import { describe, expect, it } from "vitest";
import { texteScript } from "@/domaine/derivations";
import { modePremierCommentaire, composerPremierCommentaire } from "@/domaine/ecriture-post/commentaire";
import type { IdReseau, Ratio } from "@/domaine/types";
import { corpsPostZernio, premierCommentaireTransmissibleZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { fournisseurTexteReseauxSimulation } from "@/fournisseurs/simulation/autres";
import { scriptSimuleSync } from "@/fournisseurs/simulation/script";
import { evaluerPremierCommentaire } from "@/generateur/roles/premier-commentaire";
import { formatGenerateur, listerFormats } from "@/formats";
import { obtenirReseau, verifierPourReseau } from "@/reseaux";
import { estInterdit } from "@/reseaux/hashtags";
import { PLACEMENT_PAR_DEFAUT, placerHashtags, type ReseauPlacement } from "@/reseaux/placement-hashtags";
import { formatsVoulus, meilleureSortie, sortiesVoulues, type SortieCandidate } from "@/reseaux/sorties";
import { ECARTS_CONNUS, type ControleMatrice, type EcartConnu } from "./ecarts-connus";

/** YouTube est éteint : la matrice ne le couvre pas. */
const RESEAUX_MATRICE: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok"];
/** Les formats « actifs », lus dans le registre (jamais recopiés). */
const FORMATS_ACTIFS = listerFormats({ inclureReservesAWill: true }).filter((f) => f.statut === "actif");

const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const DATE = "2026-11-05T10:00:00Z";
const CIBLES: Record<string, string> = { linkedin: "compte-1:li:123456", instagram: "compte-1", facebook: "compte-1:fb:page-1", tiktok: "compte-1" };
const CREATEUR = { privacyLevels: ["SELF_ONLY"], allowComment: false, allowDuet: false, allowStitch: false };

interface Constat {
  controle: ControleMatrice;
  detail: string;
}

/** Joue la chaîne complète pour un format et un réseau ; renvoie les constats d'écart (vide : tout va bien). */
async function jouerCase(formatId: string, reseauId: IdReseau): Promise<Constat[]> {
  const constats: Constat[] = [];
  const noter = (controle: ControleMatrice, detail: string) => constats.push({ controle, detail });
  const format = formatGenerateur(formatId);
  const reseau = obtenirReseau(reseauId);
  const dureeSec = format.durees.mode === "depuis-script" ? format.durees.cibleParDefautSec : format.durees.parDefautSec;

  // 1. Script du générateur (simulé), puis texte du réseau tiré de ce script (comme le kit : le titre n'est demandé que sans script).
  const script = scriptSimuleSync(format.recette, "Relire son contrat avant de signer", 0, dureeSec);
  const brut = texteScript(script.blocs);
  const premierePhrase = (brut.split(/(?<=[.?!])\s/)[0] ?? "").trim();
  const ecrit = await fournisseurTexteReseauxSimulation.ecrire({ reseau: reseauId, titre: "", sujet: "Relire son contrat avant de signer", texteScript: brut, mentionIA: "", credits: [], formatId, dureeSec, adresse: "vous" });
  if (!brut.trim() || !ecrit.texte.trim()) noter("texte-du-script", "script ou texte vide");
  else if (!ecrit.texte.includes(premierePhrase.slice(0, 40))) noter("texte-du-script", "le texte du réseau ne reprend pas le début du script");

  // Règle d'envoi du kit : `placerHashtags` (bornes sourcées du réseau, fourre-tout écartés, placement texte ou premier commentaire).
  const commentaire = composerPremierCommentaire({ reseau: reseauId });
  const transmissible = premierCommentaireTransmissibleZernio(reseauId);
  const mots = ecrit.motsDiese;
  const place = placerHashtags({ reseau: reseauId as ReseauPlacement, outil: "zernio", placement: PLACEMENT_PAR_DEFAUT[reseauId as ReseauPlacement], texte: ecrit.texte, motsDiese: mots, ...(transmissible ? { commentaire } : {}) });

  // 2. Hashtags : présents, dans la limite du réseau, jamais fourre-tout.
  if (!mots.length) noter("hashtags", "aucun mot-dièse");
  else if (mots.some((m) => !m.startsWith("#") || estInterdit(m))) noter("hashtags", "mot-dièse mal formé ou fourre-tout");
  else if (place.message) noter("hashtags", place.message);

  // 3. Premier commentaire : il part là où le réseau l'accepte, se copie à la main ailleurs ; les deux règles du dépôt concordent.
  const face = modePremierCommentaire(reseauId);
  if (evaluerPremierCommentaire({ texte: commentaire }, { reseau: reseauId }).length) noter("premier-commentaire", "texte refusé par l'évaluateur");
  else if (face.transmettre !== transmissible) noter("premier-commentaire", `la règle du commentaire (${face.transmettre}) et celle de Zernio (${transmissible}) divergent`);

  // 4. Fichiers faits (formats voulus des quatre réseaux, dans les capacités du format), puis choix par `meilleureSortie`.
  const voulus = formatsVoulus(format.ratios, RESEAUX_MATRICE, format.ratios, format.ratioMaitre);
  const candidats: SortieCandidate[] = sortiesVoulues(RESEAUX_MATRICE).filter((s) => voulus.includes(s.ratio)).map((s) => ({ ratio: s.ratio, appelAuMot: s.appelAuMot, reseaux: s.reseaux }));
  for (const r of voulus) if (!candidats.some((c) => c.ratio === r)) candidats.push({ ratio: r, appelAuMot: false, reseaux: [] });
  const choisi = meilleureSortie(reseauId, candidats);
  if (!choisi) noter("fichier-choisi", `aucun fichier au bon format parmi ${voulus.join(", ") || "aucun"}`);
  else if (!choisi.reseaux?.includes(reseauId) && choisi.ratio !== reseau.ratioPrefere) noter("fichier-choisi", `fichier ${choisi.ratio} ni fait pour ce réseau ni à son format préféré (${reseau.ratioPrefere})`);

  // 5. Aucun avertissement bloquant (durée, format, longueur, mots-dièse).
  const avertissements = verifierPourReseau(reseau, { dureeSec, ratios: format.ratios as Ratio[], texte: ecrit.texte, motsDiese: mots, sortieEnvoyee: choisi ?? null });
  if (avertissements.length) noter("avertissement-bloquant", avertissements.map((a) => a.code).join(", "));

  // 6. Corps Zernio construit sans erreur, premier commentaire à sa place.
  try {
    const demande: DemandeZernio = {
      reseau: reseauId,
      texte: place.texte,
      date: DATE,
      fichierCle: "https://exemple-r2.test/video.mp4",
      cible: CIBLES[reseauId],
      cleEnvoi: `essai-${formatId}-${reseauId}`,
      format: choisi?.ratio ?? format.ratios[0],
      dureeSec,
      ...(place.premierCommentaire && transmissible ? { premierCommentaire: place.premierCommentaire } : {}),
      ...(reseauId === "tiktok" ? { consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" } : {}),
    };
    const corps = corpsPostZernio(demande, { maintenant: MAINTENANT, createurTiktok: CREATEUR, profilLinkedinProuve: true });
    const specifique = corps.platforms[0].platformSpecificData as Record<string, unknown> | undefined;
    if (corps.platforms[0].platform !== reseauId) noter("corps-zernio", `plateforme ${corps.platforms[0].platform}`);
    else if (corps.content !== demande.texte || corps.mediaItems?.[0]?.type !== "video" || corps.isDraft !== true) noter("corps-zernio", "contenu, média ou brouillon inattendu");
    else if (transmissible ? !place.premierCommentaire?.trim() || specifique?.firstComment !== place.premierCommentaire : specifique?.firstComment !== undefined) noter("corps-zernio", "premier commentaire mal placé dans le corps");
    else if (mots.some((m) => !(corps.content ?? "").includes(m) && !String(specifique?.firstComment ?? "").includes(m))) noter("corps-zernio", "un mot-dièse n'arrive ni dans le texte ni dans le premier commentaire");
  } catch (e) {
    noter("corps-zernio", e instanceof Error ? e.message : String(e));
  }
  return constats;
}

describe("matrice générateur × réseau : le registre alimente la matrice", () => {
  it("lit les formats actifs dans src/formats et couvre LinkedIn, Instagram, Facebook, TikTok (pas YouTube)", () => {
    expect(FORMATS_ACTIFS.length).toBeGreaterThan(0);
    expect(RESEAUX_MATRICE).not.toContain("youtube");
    expect(RESEAUX_MATRICE).not.toContain("youtube-shorts");
  });

  it("chaque écart connu désigne un format actif et un réseau de la matrice, avec sa fiche", () => {
    for (const e of ECARTS_CONNUS) {
      expect(FORMATS_ACTIFS.map((f) => f.id), `générateur inconnu ou plus actif : ${e.generateur}`).toContain(e.generateur);
      expect(RESEAUX_MATRICE, `réseau hors matrice : ${e.reseau}`).toContain(e.reseau);
      expect(e.fiche.trim().length, `écart ${e.generateur} × ${e.reseau} sans fiche`).toBeGreaterThan(0);
      expect(e.nature.trim().length).toBeGreaterThan(0);
    }
  });
});

/** Règle de comparaison : constats observés contre écarts listés. Renvoie les messages d'échec (vide : la case passe). */
export function comparerAvecEcarts(formatId: string, reseauId: IdReseau, observes: readonly Constat[], ecarts: readonly EcartConnu[]): string[] {
  const nom = obtenirReseau(reseauId).nom;
  const listes = ecarts.filter((e) => e.generateur === formatId && e.reseau === reseauId);
  const echecs: string[] = [];
  const couvre = (l: EcartConnu, c: Constat): boolean => l.controle === c.controle && c.detail.includes(l.motif);
  for (const o of observes.filter((c) => !listes.some((l) => couvre(l, c)))) {
    echecs.push(`Écart NON listé pour ${formatId} × ${nom} (${o.controle} : ${o.detail}) : à corriger ou à inscrire dans ecarts-connus.ts`);
  }
  for (const l of listes.filter((e) => !observes.some((c) => couvre(e, c)))) {
    echecs.push(`Écart listé mais corrigé pour ${formatId} × ${nom} (${l.controle}) : retirer la ligne de ecarts-connus.ts`);
  }
  return echecs;
}

const CASES = FORMATS_ACTIFS.flatMap((f) => RESEAUX_MATRICE.map((r) => ({ nom: `${f.id} × ${obtenirReseau(r).nom}`, formatId: f.id, reseauId: r })));

describe("matrice générateur × réseau", () => {
  it("compte une case par format actif et par réseau de la matrice", () => {
    expect(CASES).toHaveLength(FORMATS_ACTIFS.length * RESEAUX_MATRICE.length);
  });

  it.each(CASES)("$nom", async ({ formatId, reseauId }) => {
    expect(comparerAvecEcarts(formatId, reseauId, await jouerCase(formatId, reseauId), ECARTS_CONNUS)).toEqual([]);
  });
});

describe("règle de comparaison des écarts (écarts fabriqués)", () => {
  const ecart: EcartConnu = { generateur: "facecam", reseau: "tiktok", controle: "hashtags", motif: "aucun mot", nature: "écart fabriqué", fiche: "fiche fabriquée" };
  const constat: Constat = { controle: "hashtags", detail: "aucun mot-dièse" };

  it("un écart observé et non listé échoue en nommant le générateur et le réseau", () => {
    const echecs = comparerAvecEcarts("facecam", "tiktok", [constat], []);
    expect(echecs).toHaveLength(1);
    expect(echecs[0]).toContain("facecam × TikTok");
    expect(echecs[0]).toContain("NON listé");
  });

  it("un écart listé mais plus observé (corrigé) échoue", () => {
    const echecs = comparerAvecEcarts("facecam", "tiktok", [], [ecart]);
    expect(echecs).toHaveLength(1);
    expect(echecs[0]).toContain("facecam × TikTok");
    expect(echecs[0]).toContain("corrigé");
  });

  it("même contrôle mais autre constat : l'écart listé ne le couvre pas (NON listé, et listé « corrigé »)", () => {
    const autre: Constat = { controle: "hashtags", detail: "mot-dièse mal formé ou fourre-tout" };
    const echecs = comparerAvecEcarts("facecam", "tiktok", [autre], [ecart]);
    expect(echecs).toHaveLength(2);
    expect(echecs[0]).toContain("NON listé");
    expect(echecs[0]).toContain("facecam × TikTok");
  });

  it("un écart listé et observé passe ; un écart d'un autre réseau ne le couvre pas", () => {
    expect(comparerAvecEcarts("facecam", "tiktok", [constat], [ecart])).toEqual([]);
    expect(comparerAvecEcarts("facecam", "instagram", [constat], [ecart])).toHaveLength(1);
  });
});
