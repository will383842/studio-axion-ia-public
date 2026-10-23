/**
 * Lot B2 — VEILLE DES OUTILS : les sources publiques, SANS réseau. Les réponses sont celles relevées le 02/10
 * (`outils/veille/lecture-reelle.mts`), tronquées, rejouées par un faux `fetch`. Une source muette ne passe jamais
 * pour « à jour ».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireAnthropic } from "@/veille/anthropic";
import { lectureFal, lireFal } from "@/veille/fal";
import { lireGithub, normaliserFichier } from "@/veille/github";
import { empreinte } from "@/veille/http";
import { adresseSource, lireSource } from "@/veille/lecture";
import { lireNpm } from "@/veille/npm";
import { OUTILS_DEPART, sourceDepuisAdresse } from "@/veille/outils-depart";
import { dateLaPlusRecente, lecturePage, lirePage } from "@/veille/page";
import type { ContexteLecture } from "@/veille/types";
import { comparerVersions, ecartVersions, plusRecente } from "@/veille/versions";

const fixture = <T>(nom: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", nom), "utf8")) as T;
const NPM = fixture<Record<string, unknown>>("b2-npm-remotion.json");
const RELEASE = fixture<Record<string, unknown>>("b2-github-remotion.json");
const LICENCE = fixture<{ texte: string }>("b2-remotion-license.json").texte;
const REFS_FFMPEG = fixture<{ ref: string }[]>("b2-github-ffmpeg-refs.json");
const FAL = fixture<Record<string, { models: unknown[] }>>("b2-fal.json");
const HEYGEN = fixture<{ url: string; texte: string }>("b2-page-heygen.json");
const ELEVEN = fixture<{ url: string; texte: string }>("b2-page-elevenlabs.json");

const LE_02_10 = new Date("2026-10-02T09:00:00Z");

/** Faux fetch : une table adresse → réponse ; toute autre adresse = 404. Garde la trace des appels. */
function fauxFetch(table: Record<string, () => Response>) {
  const appels: { url: string; init?: RequestInit }[] = [];
  const f = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    appels.push({ url, init });
    const r = table[url];
    return r ? r() : new Response("introuvable", { status: 404 });
  }) as typeof fetch;
  return { f, appels };
}
const json = (v: unknown) => () => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
const texte = (t: string) => () => new Response(t, { status: 200 });
const ctx = (appeler: typeof fetch, extra: Partial<ContexteLecture> = {}): ContexteLecture => ({ appeler, env: {}, maintenant: LE_02_10, delaiMs: 1000, ...extra });

const TABLE_REMOTION = {
  "https://api.github.com/repos/remotion-dev/remotion/releases/latest": json(RELEASE),
  "https://registry.npmjs.org/remotion": json(NPM),
  "https://raw.githubusercontent.com/remotion-dev/remotion/HEAD/LICENSE.md": texte(LICENCE),
};

describe("numéros de version", () => {
  it("compare v4.0.532 / 4.0.532 / n9.0.2 ; refuse ce qui n'en est pas un", () => {
    expect(comparerVersions("v4.0.532", "4.0.532")).toBe(0);
    expect(comparerVersions("9.0.2", "5.1")).toBeGreaterThan(0);
    expect(comparerVersions("4.0.10", "4.0.9")).toBeGreaterThan(0);
    expect(comparerVersions("Flux 3 Image", "4.0")).toBeNull();
  });
  it("ampleur du saut : majeur, mineur, correctif", () => {
    expect(ecartVersions("4.0.532", "5.0.0")).toBe("majeur");
    expect(ecartVersions("4.0.532", "4.1.0")).toBe("mineur");
    expect(ecartVersions("4.0.532", "4.0.533")).toBe("correctif");
    expect(ecartVersions("4.0.532", "4.0.532")).toBe("aucun");
  });
  it("plus grande étiquette stable : -dev écartée (FFmpeg n9.1-dev)", () => {
    expect(plusRecente(REFS_FFMPEG.map((r) => r.ref.replace("refs/tags/", "")))).toBe("9.0.2");
  });
});

describe("registre npm", () => {
  it("Remotion : dernière version 4.0.532 et sa date, lien public", async () => {
    const { f, appels } = fauxFetch({ "https://registry.npmjs.org/remotion": json(NPM) });
    const l = await lireNpm("remotion", ctx(f));
    expect(l).toMatchObject({ ok: true, version: "4.0.532", lien: "https://www.npmjs.com/package/remotion/v/4.0.532" });
    expect(l.ok && l.date).toMatch(/^2026-/);
    expect(appels).toHaveLength(1);
  });
});

describe("GitHub", () => {
  it("Remotion : version npm (celle qu'on installe) + empreinte de LICENSE.md (texte réel)", async () => {
    const { f } = fauxFetch(TABLE_REMOTION);
    const l = await lireGithub("remotion-dev/remotion", ["LICENSE.md"], ctx(f));
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.version).toBe("4.0.532");
    expect(l.fichiers?.["LICENSE.md"]).toBe(empreinte(normaliserFichier(LICENCE)));
  });
  it("l'année du copyright qui change n'est PAS un changement de licence ; un mot changé, si", () => {
    const base = normaliserFichier(LICENCE);
    expect(normaliserFichier(LICENCE.replace(/Copyright © 2026/, "Copyright © 2027"))).toBe(base);
    expect(normaliserFichier(LICENCE.replace("for free", "for a fee"))).not.toBe(base);
  });
  it("FFmpeg sans « release » : la plus grande étiquette stable (9.0.2)", async () => {
    const { f, appels } = fauxFetch({ "https://api.github.com/repos/FFmpeg/FFmpeg/git/matching-refs/tags/": json(REFS_FFMPEG) });
    const l = await lireGithub("FFmpeg/FFmpeg", [], ctx(f));
    expect(l).toMatchObject({ ok: true, version: "9.0.2", lien: "https://github.com/FFmpeg/FFmpeg/tags" });
    expect(appels.map((a) => a.url)).toEqual(["https://api.github.com/repos/FFmpeg/FFmpeg/releases/latest", "https://api.github.com/repos/FFmpeg/FFmpeg/git/matching-refs/tags/"]);
  });
  it("jeton GitHub facultatif envoyé seulement à GitHub", async () => {
    const { f, appels } = fauxFetch(TABLE_REMOTION);
    await lireGithub("remotion-dev/remotion", [], ctx(f, { env: { GITHUB_TOKEN_VEILLE: "jeton-essai" } }));
    expect((appels[0].init?.headers as Record<string, string>).authorization).toBe("Bearer jeton-essai");
    expect((appels.find((a) => a.url.includes("npmjs"))!.init?.headers as Record<string, string>).authorization).toBeUndefined();
  });
  it("quota dépassé (403) : source muette, pas « à jour »", async () => {
    const f = (async () => new Response("rate limit", { status: 403 })) as unknown as typeof fetch;
    expect(await lireGithub("m-bain/whisperX", [], ctx(f))).toEqual({ ok: false, raison: "La source refuse la lecture." });
  });
});

describe("catalogue fal.ai (public, sans clé)", () => {
  it("modèle le plus récent des catégories surveillées ; notes = modèles parus depuis la dernière lecture", async () => {
    const { f, appels } = fauxFetch({
      "https://api.fal.ai/v1/models?category=text-to-image&limit=100": json(FAL["text-to-image"]),
      "https://api.fal.ai/v1/models?category=image-to-video&limit=100": json(FAL["image-to-video"]),
    });
    const l = await lireFal(undefined, ctx(f, { precedente: { derniereVersionLe: "2026-09-18T00:00:00Z" } }));
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.version).toBeTruthy();
    expect(l.lien).toMatch(/^https:\/\/fal\.ai\/models\//);
    expect(l.notes.split("\n").length).toBeGreaterThan(0);
    expect(appels.every((a) => !(a.init?.headers as Record<string, string>)?.authorization)).toBe(true);
  });
  it("catalogue vide : muette", () => {
    expect(lectureFal([])).toEqual({ ok: false, raison: "Catalogue vide." });
  });
});

describe("pages de nouveautés", () => {
  it("HeyGen : date la plus récente sans dépasser aujourd'hui (l'arrêt annoncé au 31 octobre n'est pas une nouveauté)", () => {
    const l = lecturePage(HEYGEN.url, `<html><body><main>${HEYGEN.texte}</main></body></html>`, LE_02_10);
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.version! <= "2026-10-02").toBe(true);
    expect(l.version).not.toBe("2026-10-31");
  });
  it("ElevenLabs : 28 septembre 2026", () => {
    const l = lecturePage(ELEVEN.url, `<html><body>${ELEVEN.texte}</body></html>`, LE_02_10);
    expect(l).toMatchObject({ ok: true, version: "2026-09-28", date: "2026-09-28T00:00:00.000Z" });
  });
  it("dates françaises et ISO", () => {
    expect(dateLaPlusRecente("Mis à jour le 1er octobre 2026, puis 2026-09-30", LE_02_10)?.cle).toBe("2026-10-01");
  });
  it("page rendue seulement par un navigateur (TikTok) : muette", async () => {
    const { f } = fauxFetch({ "https://support.tiktok.com/x": texte("<html><head><title>TikTok Support</title><script>app()</script></head><body><div id=root></div></body></html>") });
    expect(await lirePage("https://support.tiktok.com/x", ctx(f))).toEqual({ ok: false, raison: "Page lisible seulement dans un navigateur." });
  });
  it("source qui ne répond pas (délai dépassé) : muette", async () => {
    const f = (async () => {
      throw new DOMException("délai", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await lirePage("https://exemple.fr/nouveautes", ctx(f))).toEqual({ ok: false, raison: "La source ne répond pas." });
  });
});

describe("Claude", () => {
  it("sans clé : carte grise « impossible de vérifier », aucun appel", async () => {
    const { f, appels } = fauxFetch({});
    expect(await lireAnthropic(ctx(f))).toEqual({ ok: false, raison: "Impossible de vérifier : Claude n'est pas encore relié." });
    expect(appels).toHaveLength(0);
  });
  it("avec clé : modèle le plus récent", async () => {
    const { f, appels } = fauxFetch({ "https://api.anthropic.com/v1/models?limit=20": json({ data: [{ id: "claude-a", created_at: "2026-01-01T00:00:00Z" }, { id: "claude-b", created_at: "2026-09-01T00:00:00Z" }] }) });
    expect(await lireAnthropic(ctx(f, { env: { ANTHROPIC_API_KEY: "cle" } }))).toMatchObject({ ok: true, version: "claude-b" });
    expect((appels[0].init?.headers as Record<string, string>)["x-api-key"]).toBe("cle");
  });
});

describe("outils de départ et ajout par Will", () => {
  it("les 11 outils prévus, Remotion surveille LICENSE.md, Claude par la liste des modèles", () => {
    expect(OUTILS_DEPART.map((o) => o.nom)).toEqual(["HeyGen", "ElevenLabs", "Remotion", "Modèles d'illustration", "Claude", "WhisperX", "FFmpeg", "TikTok", "Instagram", "YouTube", "LinkedIn"]);
    expect(OUTILS_DEPART.find((o) => o.nom === "Remotion")!.source).toEqual({ type: "github", depot: "remotion-dev/remotion", fichiersSurveilles: ["LICENSE.md"] });
    expect(OUTILS_DEPART.find((o) => o.nom === "Claude")!.source).toEqual({ type: "anthropic" });
  });
  it("adresse → source : GitHub, npm, page ; rien de local ni d'invalide", () => {
    expect(sourceDepuisAdresse("https://github.com/Kling-AI/kling/releases")).toEqual({ type: "github", depot: "Kling-AI/kling" });
    expect(sourceDepuisAdresse("https://www.npmjs.com/package/@remotion/renderer")).toEqual({ type: "npm", paquet: "@remotion/renderer" });
    expect(sourceDepuisAdresse("https://klingai.com/release-notes")).toEqual({ type: "page", url: "https://klingai.com/release-notes" });
    expect(sourceDepuisAdresse("http://localhost:3000")).toBeNull();
    expect(sourceDepuisAdresse("ftp://exemple.fr")).toBeNull();
    expect(sourceDepuisAdresse("pas une adresse")).toBeNull();
  });
  it("aiguillage et adresse publique de chaque source", async () => {
    const { f } = fauxFetch({ "https://registry.npmjs.org/remotion": json(NPM) });
    expect(await lireSource({ type: "npm", paquet: "remotion" }, ctx(f))).toMatchObject({ ok: true, version: "4.0.532" });
    expect(adresseSource({ type: "github", depot: "m-bain/whisperX" })).toBe("https://github.com/m-bain/whisperX/releases");
  });
});

describe("empreinte d'une page stable d'une lecture à l'autre", () => {
  it("les identifiants changeants de l'aide Google ne font pas une fausse nouveauté ; un vrai mot changé, si", async () => {
    const { texteStable } = await import("@/veille/page");
    const a = "Menu principal 18002803627149579251 true Rechercher dans le centre d'aide false 59 © 2026 Shorts de 3 minutes";
    const b = "Menu principal 8093787125500735536 true Rechercher dans le centre d'aide false 59 © 2027 Shorts de 3 minutes";
    expect(texteStable(a)).toBe(texteStable(b));
    expect(texteStable(a.replace("3 minutes", "5 minutes"))).not.toBe(texteStable(a));
  });
  it("libellés du bilan au pluriel", async () => {
    const { compteEtatVeille } = await import("@/domaine/libelles");
    expect([compteEtatVeille("nouveaute", 2), compteEtatVeille("nouveaute", 1), compteEtatVeille("injoignable", 3), compteEtatVeille("attention", 1), compteEtatVeille("a-jour", 6)]).toEqual(["2 nouveautés", "1 nouveauté", "3 impossibles à vérifier", "1 alerte", "6 à jour"]);
  });
});
