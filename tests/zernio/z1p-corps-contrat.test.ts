/** Les corps produits par z1p sont validés par l'extrait OpenAPI Zernio (spec 1.429.1) : emplacement exact des champs. */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsPostZernio, type CreateurTiktok, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";

const CHEMIN = "docs/zernio/openapi-extrait-1.418.1.json";
function charger(): any | null {
  const local = resolve(process.cwd(), CHEMIN);
  if (existsSync(local)) return JSON.parse(readFileSync(local, "utf8"));
  try {
    return JSON.parse(execSync(`git show origin/zernio/z0:${CHEMIN}`, { encoding: "utf8", maxBuffer: 20_000_000, stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}
const spec = charger();

/** Validateur minimal du schéma OpenAPI (ajv n'est pas une dépendance ici) : $ref, type, enum, propriétés connues, éléments, maxItems. */
function erreurs(sch: any, v: unknown, chemin: string, racine: any): string[] {
  if (sch?.$ref) return erreurs(racine.components.schemas[String(sch.$ref).split("/").pop()!], v, chemin, racine);
  if (!sch || v === undefined) return [];
  const types: string[] = [].concat(sch.type ?? []);
  const reel = v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
  if (types.length && !types.includes(reel) && !(reel === "integer" && types.includes("number"))) return [`${chemin}: type ${reel}, attendu ${types}`];
  if (sch.enum && !sch.enum.includes(v)) return [`${chemin}: valeur hors énumération`];
  if (typeof v === "string" && sch.maxLength && v.length > sch.maxLength) return [`${chemin}: trop long`];
  if (Array.isArray(v)) return [...(sch.maxItems && v.length > sch.maxItems ? [`${chemin}: trop d'éléments`] : []), ...v.flatMap((x, i) => erreurs(sch.items, x, `${chemin}[${i}]`, racine))];
  if (reel === "object" && sch.properties) {
    const o = v as Record<string, unknown>;
    return [
      ...(sch.required ?? []).filter((k: string) => o[k] === undefined).map((k: string) => `${chemin}.${k}: requis`),
      ...Object.keys(o).flatMap((k) => (k in sch.properties ? erreurs(sch.properties[k], o[k], `${chemin}.${k}`, racine) : [`${chemin}.${k}: champ inconnu du schéma`])),
    ];
  }
  return [];
}
const CREATEUR: CreateurTiktok = { privacyLevels: ["PUBLIC_TO_EVERYONE"], allowComment: true, allowDuet: true, allowStitch: false };
const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const d = (p: Partial<DemandeZernio>): DemandeZernio => ({ reseau: "instagram", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple.test/v.mp4", cible: "exemple-compte-1", cleEnvoi: "b".repeat(64), ...p });

describe.skipIf(!spec)("z1p · corps validés par l'OpenAPI", () => {
  const valide = (nom: string, v: unknown) => expect(erreurs(spec.components.schemas[nom], v, nom, spec), nom).toEqual([]);
  const racine = spec?.paths["/v1/posts"].post.requestBody.content["application/json"].schema;
  const champsRacine = Object.keys(racine?.properties ?? {});
  const champsEntree = Object.keys(racine?.properties.platforms.items.properties ?? {});
  const cas: [string, Partial<DemandeZernio>, string][] = [
    ["Instagram Reel IA", { contenuIA: true }, "InstagramPlatformData"],
    ["Facebook Reel", { reseau: "facebook", cible: "a:fb:p1", format: "9:16", dureeSec: 20, premierCommentaire: "Voir" }, "FacebookPlatformData"],
    ["LinkedIn page + PDF", { reseau: "linkedin", cible: "a:li:42", document: { url: "https://exemple.test/d.pdf", titre: "Guide" } }, "LinkedInPlatformData"],
    ["TikTok marque + IA", { reseau: "tiktok", consentementTiktok: true, votreMarque: true, contenuIA: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE" }, "TikTokPlatformData"],
  ];
  it.each(cas)("%s", (_nom, p, schema) => {
    const c = corpsPostZernio(d(p), { maintenant: MAINTENANT, createurTiktok: CREATEUR });
    for (const k of Object.keys(c)) expect(champsRacine, `champ racine ${k}`).toContain(k);
    for (const e of c.platforms) {
      for (const k of Object.keys(e)) expect(champsEntree, `champ d'entrée ${k}`).toContain(k);
      valide(schema, e.platformSpecificData ?? {});
    }
    for (const m of c.mediaItems ?? []) valide("MediaItem", m);
    expect(JSON.stringify(c)).not.toMatch(/publishNow|"draft"/);
  });
  it("TikTok : aucun champ du corps hors schéma (tiktokSettings jamais utilisé, tout dans platformSpecificData)", () => {
    const c = corpsPostZernio(d({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE" }), { maintenant: MAINTENANT, createurTiktok: CREATEUR });
    expect(c).not.toHaveProperty("tiktokSettings");
    expect(Object.keys(c.platforms[0].platformSpecificData as object).sort()).toEqual(["allowComment", "allowDuet", "allowStitch", "contentPreviewConfirmed", "expressConsentGiven", "privacyLevel"]);
  });
});
