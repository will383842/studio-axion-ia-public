/**
 * L5-02a : corps réels. Le VRAI constructeur `zernio-corps.ts` (aucun faux service de corps), validé contre l'extrait
 * OpenAPI. Premier commentaire : seulement là où la plateforme l'admet ; LinkedIn : aucune réponse automatique.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsPostZernio, premierCommentaireTransmissibleZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { corpsBrouillonCreneau } from "@/services/envoi-depuis-creneau";

const CHEMIN = resolve(process.cwd(), "docs/zernio/openapi-extrait-1.418.1.json");
const spec = existsSync(CHEMIN) ? JSON.parse(readFileSync(CHEMIN, "utf8")) : null;

/* eslint-disable @typescript-eslint/no-explicit-any */
function erreurs(sch: any, v: unknown, chemin: string, racine: any): string[] {
  if (sch?.$ref) return erreurs(racine.components.schemas[String(sch.$ref).split("/").pop()!], v, chemin, racine);
  if (!sch || v === undefined) return [];
  const types: string[] = ([] as string[]).concat(sch.type ?? []);
  const reel = v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
  if (types.length && !types.includes(reel) && !(reel === "integer" && types.includes("number"))) return [`${chemin}: type ${reel}, attendu ${types}`];
  if (sch.enum && !sch.enum.includes(v)) return [`${chemin}: valeur hors énumération`];
  if (Array.isArray(v)) return v.flatMap((x, i) => erreurs(sch.items, x, `${chemin}[${i}]`, racine));
  if (reel === "object" && sch.properties) {
    const o = v as Record<string, unknown>;
    return [
      ...(sch.required ?? []).filter((k: string) => o[k] === undefined).map((k: string) => `${chemin}.${k}: requis`),
      ...Object.keys(o).flatMap((k) => (k in sch.properties ? erreurs(sch.properties[k], o[k], `${chemin}.${k}`, racine) : [`${chemin}.${k}: champ inconnu du schéma`])),
    ];
  }
  return [];
}

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

  it.skipIf(!spec)("corps validés par l'extrait OpenAPI Zernio", () => {
    const racine = spec.paths["/v1/posts"].post.requestBody.content["application/json"].schema;
    for (const r of ["facebook", "linkedin", "instagram", "tiktok"]) {
      expect(erreurs(racine, corps(r), r, spec), r).toEqual([]);
    }
  });
});
