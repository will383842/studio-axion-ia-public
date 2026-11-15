/**
 * L5-02a : corps réels. Le VRAI constructeur `zernio-corps.ts` (aucun faux service de corps), validé contre l'extrait
 * OpenAPI. Premier commentaire : seulement là où la plateforme l'admet ; LinkedIn : aucune réponse automatique.
 */
import { existsSync, readFileSync } from "node:fs";
import Ajv from "ajv";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsPostZernio, premierCommentaireTransmissibleZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { corpsBrouillonCreneau } from "@/services/envoi-depuis-creneau";

const CHEMIN = resolve(process.cwd(), "docs/zernio/openapi-extrait-1.418.1.json");

const MAINTENANT = Date.parse("2026-11-20T08:00:00Z");
const CREATEUR = { privacyLevels: ["PUBLIC_TO_EVERYONE"], allowComment: true, allowDuet: true, allowStitch: false };
const CIBLES: Record<string, string> = { facebook: "compte-1:fb:page-1", linkedin: "compte-1:li:42", instagram: "compte-2", tiktok: "compte-3" };

function corps(reseau: string) {
  const d = corpsBrouillonCreneau({
    videoId: "v1", reseau: reseau as never, dateIso: "2026-11-20T11:00:00Z", texte: "Texte d'exemple", premierCommentaire: "Voir le guide",
    cleEnvoi: "envoi:v1:" + reseau + ":v1", idempotence: "studio-" + "a".repeat(64), consentementTiktok: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE",
  });
  const demande: DemandeZernio = { ...d, fichierCle: "https://exemple.test/v.mp4", cible: CIBLES[reseau] };
  return corpsPostZernio(demande, { maintenant: MAINTENANT, createurTiktok: CREATEUR });
}

describe("L5-02a · corps réel du brouillon", () => {
  it("Facebook, LinkedIn : exactement un premier commentaire ; Instagram et TikTok : aucun dans le corps", () => {
    for (const r of ["facebook", "linkedin"]) expect((corps(r).platforms[0].platformSpecificData as { firstComment?: string }).firstComment).toBe("Voir le guide");
    for (const r of ["instagram", "tiktok"]) expect(JSON.stringify(corps(r))).not.toContain("firstComment");
    expect(premierCommentaireTransmissibleZernio("tiktok")).toBe(false);
  });

  it("le corps est un brouillon, lié à l'envoi par studioCle ; aucune réponse automatique LinkedIn", () => {
    const c = corps("linkedin");
    expect(c.isDraft).toBe(true);
    expect(c.metadata).toEqual({ origine: "studio", studioCle: "envoi:v1:linkedin:v1" });
    expect(JSON.stringify(c)).not.toMatch(/autoReply|autoDm|reponseAuto|replyTo/i);
  });

  it("corps validés par l'extrait OpenAPI Zernio (ajv) ; le fichier d'extrait doit exister", () => {
    expect(existsSync(CHEMIN), `extrait OpenAPI manquant : ${CHEMIN}`).toBe(true);
    const spec = JSON.parse(readFileSync(CHEMIN, "utf8"));
    const racine = spec.paths["/v1/posts"].post.requestBody.content["application/json"].schema;
    // Les schémas de plateforme de l'extrait n'ont que des champs facultatifs : un `oneOf` y est toujours ambigu pour ajv.
    // Seul ce nœud passe en `anyOf` (le corps doit satisfaire au moins un schéma de plateforme) ; le reste est validé tel quel.
    const psd = racine.properties.platforms.items.properties.platformSpecificData;
    if (psd?.oneOf) { psd.anyOf = psd.oneOf; delete psd.oneOf; }
    const ajv = new Ajv({ strict: false, allErrors: true });
    const valider = ajv.compile({ ...racine, components: spec.components });
    for (const r of ["facebook", "linkedin", "instagram", "tiktok"]) {
      expect(valider(corps(r)), `${r} : ${ajv.errorsText(valider.errors)}`).toBe(true);
    }
  });
});
