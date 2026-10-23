import { describe, expect, it } from "vitest";
import { envoyerMessage, extraireJson } from "@/fournisseurs/claude/client";
import { construireRequete } from "@/generateur/roles/types";
import { roleSonde } from "@/generateur/roles/sonde";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseFlux } from "./helpers/g0";

describe("client Claude · extraireJson (sortie sans format structuré)", () => {
  const OBJ = { a: 1, b: { c: "x}y", d: [1, 2] } };
  const JSON_TXT = JSON.stringify(OBJ);
  it("JSON seul : inchangé", () => expect(JSON.parse(extraireJson(JSON_TXT))).toEqual(OBJ));
  it("texte avant et après : l'objet est extrait", () => expect(JSON.parse(extraireJson(`Voici la fiche :\n${JSON_TXT}\nBonne journée {fin}`))).toEqual(OBJ));
  it("clôture Markdown : retirée", () => expect(JSON.parse(extraireJson("```json\n" + JSON_TXT + "\n```"))).toEqual(OBJ));
  it("clôture entourée de texte : l'objet est extrait", () => expect(JSON.parse(extraireJson("Voilà :\n```json\n" + JSON_TXT + "\n```\nFin."))).toEqual(OBJ));
  it("accolades dans une chaîne (même échappées) : équilibre correct", () => {
    const t = JSON.stringify({ s: 'a "{" \\" }' });
    expect(JSON.parse(extraireJson(`avant ${t} après`))).toEqual({ s: 'a "{" \\" }' });
  });
  it("JSON tronqué : texte rendu tel quel (l'échec reste celui d'avant)", () => {
    const t = 'Voici {"a": 1, "b": {"c": 2';
    expect(extraireJson(t)).toBe(t);
    expect(() => JSON.parse(extraireJson(t))).toThrow();
  });
  it("aucun JSON : texte rendu tel quel", () => expect(extraireJson("pas de json")).toBe("pas de json"));

  // Re-relecture A09 du 15/10 : jamais un sous-objet d'un objet coupé, jamais un objet parmi plusieurs.
  it("JSON tronqué avec un sous-objet complet : texte rendu tel quel (pas de sous-objet extrait)", () => {
    for (const t of ['{"angles":[{"titre":"A","probleme":"B"},{"titre":"C","prob', '{"verdict":"ok","note":{"score":3},"texte":"tronq']) {
      expect(extraireJson(t), t).toBe(t);
    }
  });
  it("plusieurs objets lisibles : texte rendu tel quel (aucun choix au hasard)", () => {
    const t = 'Brouillon : {"texte":"v1"} Version finale : {"texte":"v2"}';
    expect(extraireJson(t)).toBe(t);
  });
  it("parcours linéaire : 20 000 accolades ouvertes sont traitées vite", () => {
    const t = "{".repeat(20_000);
    const debut = performance.now();
    expect(extraireJson(t)).toBe(t);
    expect(performance.now() - debut).toBeLessThan(200);
  });
});

// Re-relecture A09 (PR #254) : une réponse coupée par max_tokens est un échec, jamais un JSON extrait.
describe("client Claude · réponse coupée (stop_reason = max_tokens)", () => {
  const requete = { ...construireRequete(roleSonde, { contexte: {}, variable: "x" }), json: true };
  const texte = 'Voici la fiche : {"phrase":"Bonjour"} et la suite {"phr';
  const texteComplet = 'Voici la fiche : {"phrase":"Bonjour"}';
  it("max_tokens : texte rendu tel quel, même si un objet complet s'y trouve", async () => {
    for (const t of [texte, texteComplet]) {
      const { fetch } = fauxFetch([() => reponseFlux(fluxReussi({ texte: t, stop: "max_tokens" }))]);
      const r = await envoyerMessage(requete, { cle: CLE_ESSAI_CLAUDE, fetch });
      expect(r.stopReason).toBe("max_tokens");
      expect(r.texte, t).toBe(t);
    }
  });
  it("end_turn : l'unique objet est extrait (témoin)", async () => {
    const { fetch } = fauxFetch([() => reponseFlux(fluxReussi({ texte: texteComplet }))]);
    const r = await envoyerMessage(requete, { cle: CLE_ESSAI_CLAUDE, fetch });
    expect(JSON.parse(r.texte)).toEqual({ phrase: "Bonjour" });
  });
});
