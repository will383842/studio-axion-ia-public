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
import { finPermise, formatsVoulus, meilleureSortie, sortiesVoulues, type SortieCandidate } from "@/reseaux/sorties";
import { ECARTS_CONNUS, type ControleMatrice } from "./ecarts-connus";

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

  // 2. Hashtags : présents, dans la limite du réseau, jamais fourre-tout.
  const mots = ecrit.motsDiese;
  if (!mots.length) noter("hashtags", "aucun mot-dièse");
  else if (mots.length > reseau.legende.motsDieseMax) noter("hashtags", `${mots.length} mots-dièse pour ${reseau.legende.motsDieseMax} au plus`);
  else if (mots.some((m) => !m.startsWith("#") || estInterdit(m))) noter("hashtags", "mot-dièse mal formé ou fourre-tout");

  // 3. Premier commentaire : il part là où le réseau l'accepte, se copie à la main ailleurs ; les deux règles du dépôt concordent.
  const commentaire = composerPremierCommentaire({ reseau: reseauId });
  const face = modePremierCommentaire(reseauId);
  const transmissible = premierCommentaireTransmissibleZernio(reseauId);
  if (evaluerPremierCommentaire({ texte: commentaire }, { reseau: reseauId }).length) noter("premier-commentaire", "texte refusé par l'évaluateur");
  else if (face.transmettre !== transmissible) noter("premier-commentaire", `la règle du commentaire (${face.transmettre}) et celle de Zernio (${transmissible}) divergent`);

  // 4. Fichiers faits (formats voulus des quatre réseaux, dans les capacités du format), puis choix par `meilleureSortie`.
  const voulus = formatsVoulus(format.ratios, RESEAUX_MATRICE, format.ratios, format.ratioMaitre);
  const candidats: SortieCandidate[] = sortiesVoulues(RESEAUX_MATRICE).filter((s) => voulus.includes(s.ratio)).map((s) => ({ ratio: s.ratio, appelAuMot: s.appelAuMot, reseaux: s.reseaux }));
  for (const r of voulus) if (!candidats.some((c) => c.ratio === r)) candidats.push({ ratio: r, appelAuMot: false, reseaux: [] });
  const choisi = meilleureSortie(reseauId, candidats);
  if (!choisi) noter("fichier-choisi", `aucun fichier au bon format parmi ${voulus.join(", ") || "aucun"}`);
  else if (!reseau.ratios.includes(choisi.ratio) || !finPermise(reseauId, choisi)) noter("fichier-choisi", `fichier ${choisi.ratio} refusé par le réseau`);

  // 5. Aucun avertissement bloquant (durée, format, longueur, mots-dièse).
  const avertissements = verifierPourReseau(reseau, { dureeSec, ratios: format.ratios as Ratio[], texte: ecrit.texte, motsDiese: mots, sortieEnvoyee: choisi ?? null });
  if (avertissements.length) noter("avertissement-bloquant", avertissements.map((a) => a.code).join(", "));

  // 6. Corps Zernio construit sans erreur, premier commentaire à sa place.
  try {
    const demande: DemandeZernio = {
      reseau: reseauId,
      texte: mots.length ? `${ecrit.texte}\n\n${mots.join(" ")}` : ecrit.texte,
      date: DATE,
      fichierCle: "https://exemple-r2.test/video.mp4",
      cible: CIBLES[reseauId],
      cleEnvoi: `essai-${formatId}-${reseauId}`,
      format: choisi?.ratio ?? format.ratios[0],
      dureeSec,
      ...(transmissible ? { premierCommentaire: commentaire } : {}),
      ...(reseauId === "tiktok" ? { consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" } : {}),
    };
    const corps = corpsPostZernio(demande, { maintenant: MAINTENANT, createurTiktok: CREATEUR, profilLinkedinProuve: true });
    const specifique = corps.platforms[0].platformSpecificData as Record<string, unknown> | undefined;
    if (corps.platforms[0].platform !== reseauId) noter("corps-zernio", `plateforme ${corps.platforms[0].platform}`);
    else if (corps.content !== demande.texte || corps.mediaItems[0]?.type !== "video" || corps.isDraft !== true) noter("corps-zernio", "contenu, média ou brouillon inattendu");
    else if ((specifique?.firstComment !== undefined) !== transmissible) noter("corps-zernio", "premier commentaire mal placé dans le corps");
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

const CASES = FORMATS_ACTIFS.flatMap((f) => RESEAUX_MATRICE.map((r) => ({ nom: `${f.id} × ${obtenirReseau(r).nom}`, formatId: f.id, reseauId: r })));

describe("matrice générateur × réseau", () => {
  it("compte une case par format actif et par réseau de la matrice", () => {
    expect(CASES).toHaveLength(FORMATS_ACTIFS.length * RESEAUX_MATRICE.length);
  });

  it.each(CASES)("$nom", async ({ formatId, reseauId }) => {
    const nom = obtenirReseau(reseauId).nom;
    const observes = await jouerCase(formatId, reseauId);
    const listes = ECARTS_CONNUS.filter((e) => e.generateur === formatId && e.reseau === reseauId);
    const nonListes = observes.filter((o) => !listes.some((l) => l.controle === o.controle));
    const corriges = listes.filter((l) => !observes.some((o) => o.controle === l.controle));
    expect(nonListes, `Écart NON listé pour ${formatId} × ${nom} : à corriger ou à inscrire dans ecarts-connus.ts`).toEqual([]);
    expect(corriges, `Écart listé mais corrigé pour ${formatId} × ${nom} : retirer la ligne de ecarts-connus.ts`).toEqual([]);
  });
});
