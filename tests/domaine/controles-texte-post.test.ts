/**
 * L3-09 : contrôleur du texte de post et du commentaire. Données fictives, aucun appel réel.
 * Les mots interdits ne sont jamais écrits en clair : ils sont assemblés.
 */
import { describe, expect, it } from "vitest";
import { controlerTextePost } from "@/domaine/controles-script/texte-post";

const J = (...p: string[]) => p.join("");
const INTERDIT = J("cert", "ifié");
const BASE = "Trois gestes simples pour ranger vos fichiers. Chacun prend une minute.";

describe("controlerTextePost", () => {
  it("un texte conforme est vert", () => {
    const r = controlerTextePost({ reseau: "linkedin", texte: BASE, commentaire: "Sources : les notes de l'atelier." });
    expect(r.passe).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("post LinkedIn de 3200 signes + commentaire à deux appels + interdit = trois violations bloquantes", () => {
    const texte = (BASE + " ").repeat(50).slice(0, 3200);
    expect(texte.length).toBe(3200);
    const commentaire = `Commentez PLAN. Écrivez-moi en message privé. Cela vous rend ${INTERDIT}.`;
    const r = controlerTextePost({ reseau: "linkedin", texte, commentaire });
    const codes = r.violations.map((v) => v.code).sort();
    expect(codes).toEqual(["appels-multiples", "interdit", "texte-trop-long"]);
    expect(r.violations.every((v) => v.niveau === "bloquant")).toBe(true);
    expect(r.passe).toBe(false);
  });

  it("une seule violation de longueur sur le texte, rattachée à la zone du texte", () => {
    const r = controlerTextePost({ reseau: "linkedin", texte: "a".repeat(3001) });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ code: "texte-trop-long", zone: "texte", niveau: "bloquant" });
  });

  it("3000 signes pile passent", () => {
    expect(controlerTextePost({ reseau: "linkedin", texte: "a".repeat(3000) }).passe).toBe(true);
  });

  it("un seul appel dans le commentaire est permis", () => {
    const r = controlerTextePost({ reseau: "linkedin", texte: BASE, commentaire: "Quelle pratique gardez-vous ?" });
    expect(r.violations).toEqual([]);
  });

  it("l'interdit est repéré dans la légende et le premier commentaire, avec sa zone", () => {
    const r = controlerTextePost({ reseau: "linkedin", texte: BASE, legende: `Un atelier ${INTERDIT}`, commentaire: BASE });
    expect(r.violations.map((v) => `${v.code}:${v.zone}`)).toEqual(["interdit:legende"]);
  });

  it("un ajout manuel (auteur fondateur) n'est bloqué que sur le format technique ; style et interdit avertissent", () => {
    const commentaire = `Commentez PLAN. Écrivez-moi. ${INTERDIT}.`;
    const r = controlerTextePost({ reseau: "linkedin", texte: BASE, commentaire, auteur: "fondateur" });
    expect(r.passe).toBe(true);
    expect(r.violations.map((v) => v.code).sort()).toEqual(["appels-multiples", "interdit"]);
    expect(r.violations.every((v) => v.niveau === "alerte")).toBe(true);
    const long = controlerTextePost({ reseau: "linkedin", texte: "a".repeat(3200), auteur: "fondateur" });
    expect(long.passe).toBe(false);
  });

  it("la limite de commentaire de la table des réseaux est reprise (format technique)", () => {
    const r = controlerTextePost({ reseau: "instagram", texte: BASE, commentaire: "a".repeat(2201), auteur: "fondateur" });
    expect(r.violations.map((v) => v.code)).toContain("commentaire-trop-long");
    expect(r.passe).toBe(false);
  });

  it("ne cite aucun prix et ne porte aucune consigne Buffer", () => {
    const r = controlerTextePost({ reseau: "linkedin", texte: "a".repeat(3200), commentaire: "Commentez. Écrivez." });
    const messages = r.violations.map((v) => v.message).join(" ");
    expect(messages).not.toMatch(/€|euro|buffer/i);
  });
});
