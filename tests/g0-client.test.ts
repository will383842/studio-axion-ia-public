/**
 * G0 — CLIENT CLAUDE (fetch + flux SSE, sans SDK), TARIFS, RÔLES. Aucun réseau : réponses enregistrées
 * (`tests/helpers/g0.ts`, forme documentée par la skill `claude-api` le 02/10).
 */
import { describe, expect, it } from "vitest";
import { appliquerEvenement, classerErreur, corpsRequete, envoyerMessage, ErreurClaude, BETA_REPLI, DELAI_INACTIVITE_MS, DELAI_TOTAL_MS } from "@/fournisseurs/claude/client";
import { centimesUsd, coutUsd, pireCasUsd, tarifDe, TARIFS_CLAUDE } from "@/fournisseurs/claude/tarifs";
import { construireRequete, marqueurArret, PHRASES_FIXES, pireCasRole } from "@/generateur/roles/types";
import { roleSonde } from "@/generateur/roles/sonde";
import { lireSortie } from "@/fournisseurs/claude/inscription";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";

describe("G0 · tarifs (vérifiés avec la skill claude-api le 02/10)", () => {
  it("Opus 5.5 : 4 $ / 20 $ par million, lecture en cache 0,20 $, écriture 5 $ (5 min) et 8 $ (1 h) ; Sonnet 5.5 : 2 $ / 10 $", () => {
    expect(TARIFS_CLAUDE["claude-opus-5-5"]).toEqual({ entree: 4, sortie: 20, cacheLu: 0.2, cacheEcrit: 5, cacheEcrit1h: 8 });
    expect(TARIFS_CLAUDE["claude-sonnet-5-5"]).toEqual({ entree: 2, sortie: 10, cacheLu: 0.2, cacheEcrit: 2.5, cacheEcrit1h: 4 });
  });
  it("coût réel : entrée + cache lu + cache écrit + sortie, au tarif du modèle renvoyé", () => {
    expect(coutUsd({ entree: 1200, cacheLu: 0, cacheEcrit: 800, sortie: 150 }, "claude-opus-5-5")).toBeCloseTo(0.0118, 6);
    expect(coutUsd({ entree: 0, cacheLu: 10_000, cacheEcrit: 0, sortie: 0 }, "claude-opus-5-5")).toBeCloseTo(0.002, 6);
  });
  it("modèle inconnu : tarif le plus cher (jamais sous-estimé) ; arrondi au centime supérieur", () => {
    expect(tarifDe("claude-inconnu").sortie).toBe(25);
    expect(centimesUsd(0.0118)).toBe(2);
    expect(centimesUsd(0.02)).toBe(2);
    expect(pireCasUsd("claude-opus-5-5", 1000, 1000)).toBeCloseTo(0.025, 6);
    // Dont 400 jetons de socle écrits pour 1 h (8 $ le million au lieu de 5 $).
    expect(pireCasUsd("claude-opus-5-5", 1000, 1000, 400)).toBeCloseTo(0.0262, 6);
  });
});

describe("G0 · requête (forme vérifiée, B.3.2 et B.3.3)", () => {
  const entree = { contexte: { gagnants: "G", contexteAxion: "A", preuves: "P", styleWill: "S" }, variable: "<brief>un sujet</brief>" };
  it("ORDRE FIGÉ (axion, style, preuves = le socle, point 1 h ; puis gagnants), puis la consigne (point 5 min)", () => {
    const r = construireRequete(roleSonde, entree);
    expect(r.systeme.map((b) => b.texte.split("\n")[0])).toEqual(["<contexte_axion>", "<style_will>", "<preuves>", "<gagnants>", expect.stringContaining("Tu vérifies")]);
    expect(r.systeme.map((b) => b.cache ?? false)).toEqual([false, false, "1h", false, true]);
    for (const p of PHRASES_FIXES) expect(r.systeme.at(-1)!.texte).toContain(p);
    expect(r.messages).toEqual([{ role: "user", contenu: entree.variable }]);
  });
  it("corps : modèle, effort explicite, JSON demandé dans la consigne (aucun format structuré : il casse le cache), repli « default », flux ; ni thinking, ni temperature, ni tool_choice", () => {
    const c = corpsRequete(construireRequete(roleSonde, entree));
    expect(c).toMatchObject({ model: "claude-opus-5-5", max_tokens: 1024, stream: true, fallbacks: "default", output_config: { effort: "low" } });
    expect(c.output_config).not.toHaveProperty("format");
    const sys = c.system as { text: string; cache_control?: unknown }[];
    const fmt = JSON.parse(/<schema_sortie>\n([\s\S]*?)\n<\/schema_sortie>/.exec(sys.at(-1)!.text)![1]) as Record<string, unknown>;
    expect(fmt.additionalProperties).toBe(false);
    expect(fmt.$schema).toBeUndefined();
    for (const k of ["thinking", "temperature", "top_p", "tool_choice"]) expect(c).not.toHaveProperty(k);
    expect(sys.filter((b) => b.cache_control).map((b) => b.cache_control)).toEqual([{ type: "ephemeral", ttl: "1h" }, { type: "ephemeral" }]);
  });
  it("plus de 4 points de cache : refusé avant tout envoi", () => {
    expect(() => corpsRequete({ modele: "m", maxTokens: 1, effort: "low", systeme: Array.from({ length: 5 }, () => ({ texte: "x", cache: true })), messages: [] })).toThrow(ErreurClaude);
  });
  it("pire cas du rôle : borne l'appel réel (entrée au tarif d'écriture en cache + maxTokens en sortie)", () => {
    const p = pireCasRole(roleSonde, entree);
    expect(p).toBeGreaterThan(1024 * 20 / 1e6);
    expect(p).toBeLessThan(0.03);
  });
});

describe("G0 · flux SSE et erreurs", () => {
  it("lit le texte, le modèle, les jetons (usage final) et ignore la pensée ; en-têtes x-api-key, version, bêta du repli", async () => {
    const { fetch, appels } = fauxFetch([() => reponseFlux(fluxReussi({ texte: '{"phrase":"Bonjour Will"}' }))]);
    const r = await envoyerMessage(construireRequete(roleSonde, { contexte: {}, variable: "x" }), { cle: CLE_ESSAI_CLAUDE, fetch });
    expect(r).toMatchObject({ texte: '{"phrase":"Bonjour Will"}', modele: "claude-opus-5-5", stopReason: "end_turn", jetons: { entree: 1200, cacheLu: 0, cacheEcrit: 800, sortie: 150 }, replis: [] });
    expect(appels[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(appels[0].entetes).toMatchObject({ "x-api-key": CLE_ESSAI_CLAUDE, "anthropic-version": "2023-06-01", "anthropic-beta": BETA_REPLI });
    expect(JSON.stringify(appels[0].corps)).not.toContain("sk-ant-");
    expect(lireSortie(roleSonde, r).donnees).toEqual({ phrase: "Bonjour Will" });
  });
  it("repli serveur : seul le texte du modèle qui répond compte, le modèle effectif et le refus sont gardés", async () => {
    const { fetch } = fauxFetch([() => reponseFlux(fluxReussi({ texte: "ok", modele: "claude-opus-4-8", repliDe: "claude-opus-5-5" }))]);
    const r = await envoyerMessage(construireRequete(roleSonde, { contexte: {}, variable: "x" }), { cle: CLE_ESSAI_CLAUDE, fetch });
    expect(r.texte).toBe("ok");
    expect(r.modele).toBe("claude-opus-4-8");
    expect(r.replis).toEqual(["claude-opus-5-5"]);
  });
  it("classement des erreurs : facturation (402, « credit balance », limite du compte), modèle, surcharge, clé", () => {
    expect(classerErreur(402, "billing_error", "Billing issue").code).toBe("facturation");
    expect(classerErreur(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.").code).toBe("facturation");
    expect(classerErreur(400, "invalid_request_error", "You have reached your specified API usage limits.").code).toBe("facturation");
    expect(classerErreur(404, "not_found_error", "model: claude-opus-5-5").code).toBe("modele-introuvable");
    for (const s of [429, 500, 529]) expect(classerErreur(s, undefined, "").reessayable).toBe(true);
    expect(classerErreur(401, "authentication_error", "invalid x-api-key").code).toBe("cle-refusee");
    expect(classerErreur(400, "invalid_request_error", "max_tokens: too large").code).toBe("requete");
  });
  it("erreur au milieu du flux (événement `error`) : classée, jamais avalée", () => {
    const etat = { texte: "", replis: [], stopReason: null, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
    expect(() => appliquerEvenement(etat, "error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } })).toThrow(expect.objectContaining({ code: "surcharge", reessayable: true }));
  });
  it("HTTP 529 avec retry-after : surcharge réessayable, attente conseillée lue", async () => {
    const { fetch } = fauxFetch([() => reponseErreur(529, "overloaded_error", "Overloaded", { "retry-after": "3" })]);
    await expect(envoyerMessage(construireRequete(roleSonde, { contexte: {}, variable: "x" }), { cle: CLE_ESSAI_CLAUDE, fetch })).rejects.toMatchObject({ code: "surcharge", attenteSec: 3 });
  });
  it("délais relevés après le banc G4 : 150 s sans nouvelles, 300 s au total (au lieu de 60 / 180)", () => {
    expect(DELAI_INACTIVITE_MS).toBe(150_000);
    expect(DELAI_TOTAL_MS).toBe(300_000);
  });
  it("délai d'inactivité : un flux muet est coupé (150 s en vrai, 50 ms ici)", async () => {
    const muet = (async (_u: unknown, init?: RequestInit) =>
      new Response(
        new ReadableStream({
          start(c) {
            init?.signal?.addEventListener("abort", () => c.error(new Error("coupé")));
          },
        }),
        { status: 200 },
      )) as typeof fetch;
    await expect(envoyerMessage(construireRequete(roleSonde, { contexte: {}, variable: "x" }), { cle: CLE_ESSAI_CLAUDE, fetch: muet, delaiInactiviteMs: 50 })).rejects.toMatchObject({ code: "delai", message: expect.stringContaining("150 s sans nouvelles") });
  });
  it("marqueurs d'arrêt propre et sortie hors schéma", () => {
    expect(marqueurArret("ANCRAGE_MANQUANT : aucune matière ne convient")).toBe("ANCRAGE_MANQUANT");
    expect(marqueurArret("PREUVE_MANQUANTE")).toBe("PREUVE_MANQUANTE");
    const base = { modeleDemande: "m", modele: "m", replis: [], stopReason: "end_turn", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
    expect(lireSortie(roleSonde, { ...base, texte: '{"autre":1}' }).invalide).toBeTruthy();
    expect(lireSortie(roleSonde, { ...base, texte: "pas du json" }).invalide).toBeTruthy();
  });
});
