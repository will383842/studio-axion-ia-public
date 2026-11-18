/** ATR-02b : tri par priorité, spam masqué mais consultable, filtre par post, compteurs, clavier, heure du « fait ». Cartes fictives, rien n'est envoyé. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { actionClavier, EcranATraiter, libelleFait } from "@/components/a-traiter/EcranATraiter";
import { CompteursATraiter } from "@/components/a-traiter/CompteursATraiter";
import type { CarteATraiter } from "@/services/a-traiter-types";

const carte = (id: string, sur: Partial<CarteATraiter> = {}): CarteATraiter => ({
  idEvenement: id,
  reseau: "instagram",
  post: "post_fictif_1",
  lienPost: null,
  mot: null,
  motif: "mot_manuel",
  extrait: "Extrait fictif",
  creeLe: "2026-11-11T10:00:00.000Z",
  statut: "a_traiter",
  kit: "Merci !",
  ...sur,
});
const services = { fait: vi.fn(), ignorer: vi.fn(), stop: vi.fn() };
const rendre = (cartes: CarteATraiter[], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "normal" as const, cartes, compteur: cartes.length }, services, compte: "", ...extra } as never));

describe("tri par priorité et spam masqué", () => {
  const cartes = [
    carte("evt-banale", { extrait: "Bonjour, belle vidéo" }),
    carte("evt-reclam", { extrait: "Je veux une réclamation, c'est nul", creeLe: "2026-11-11T12:00:00.000Z" }),
    carte("evt-spam", { extrait: "Gagnez vite avec le casino" }),
  ];
  const h = rendre(cartes);
  it("la carte la plus prioritaire passe d'abord", () => {
    expect(h).toContain("réclamation");
    expect(h).not.toContain("belle vidéo");
  });
  it("le spam est masqué, avec un bouton qui indique le nombre, rien de supprimé", () => {
    expect(h).not.toContain("casino");
    expect(h).toContain("Voir les messages masqués (1)");
    expect(h).not.toMatch(/Supprimer/);
  });
  it("sans spam : pas de bouton", () => {
    expect(rendre([cartes[0]])).not.toContain("Voir les messages masqués");
  });
});

describe("filtre par post", () => {
  const cartes = [carte("evt-a", { post: "post_a" }), carte("evt-b", { post: "post_b" })];
  const h = rendre(cartes);
  it("liste simple des posts de l'onglet, sans identifiant technique", () => {
    expect(h).toMatch(/<select[^>]*>/);
    expect(h).toContain("Tous les posts");
    expect(h).not.toContain("post_a");
    expect(h).not.toContain("post_b");
    expect(h.match(/<option/g)).toHaveLength(3);
  });
});

describe("compteurs", () => {
  const cartes = [
    carte("evt-1", { reseau: "instagram", post: "post_a", creeLe: "2026-11-11T08:00:00.000Z" }),
    carte("evt-2", { reseau: "instagram", post: "post_a", statut: "fait", faitLe: "2026-11-11T09:00:00.000Z" }),
    carte("evt-3", { reseau: "facebook", post: "post_b" }),
  ];
  const maintenant = new Date("2026-11-11T20:00:00.000Z");
  const h = renderToStaticMarkup(createElement(CompteursATraiter, { cartes, onglet: "tous", maintenant }));
  it("par réseau puis par post : arrivés, répondus, en retard", () => {
    expect(h).toContain("Instagram");
    expect(h).toContain("Facebook");
    for (const l of ["arrivés", "répondus", "en retard"]) expect(h).toContain(l);
    expect(h).toMatch(/Instagram[\s\S]*Post 1/);
  });
  it("onglet d'un réseau : seulement ce réseau", () => {
    const f = renderToStaticMarkup(createElement(CompteursATraiter, { cartes, onglet: "facebook", maintenant }));
    expect(f).toContain("Facebook");
    expect(f).not.toContain("Instagram");
  });
  it("pastilles neutres : ni rouge, ni clignotement, ni alerte", () => {
    expect(h).not.toMatch(/red|rouge|danger|animate|pulse|role="alert"|aria-live/i);
  });
});

describe("clavier", () => {
  it("Flèche droite et S : carte suivante ; F : Fait", () => {
    expect(actionClavier({ key: "ArrowRight" })).toBe("suivante");
    expect(actionClavier({ key: "s" })).toBe("suivante");
    expect(actionClavier({ key: "S" })).toBe("suivante");
    expect(actionClavier({ key: "f" })).toBe("fait");
    expect(actionClavier({ key: "F" })).toBe("fait");
  });
  it("jamais de raccourci pour STOP ni pour Ignorer", () => {
    for (const key of ["t", "T", "x", "i", "Delete", "Backspace", "Enter", "Escape"]) expect(actionClavier({ key })).toBeNull();
  });
  it("inactif dans un champ de saisie et avec une touche de commande", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(actionClavier({ key: "f", target: { tagName } })).toBeNull();
    expect(actionClavier({ key: "s", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
    expect(actionClavier({ key: "f", ctrlKey: true })).toBeNull();
    expect(actionClavier({ key: "s", metaKey: true })).toBeNull();
    expect(actionClavier({ key: "ArrowRight", target: { tagName: "BUTTON" } })).toBe("suivante");
  });
});

describe("heure du « fait » (Paris)", () => {
  it("hiver : UTC+1", () => expect(libelleFait("2026-11-18T13:05:00.000Z")).toBe("Fait le 18/11 à 14h05"));
  it("été : UTC+2", () => expect(libelleFait("2026-07-02T07:09:00.000Z")).toBe("Fait le 02/07 à 09h09"));
  it("date absente ou illisible : « Fait » seul", () => {
    expect(libelleFait(undefined)).toBe("Fait");
    expect(libelleFait("pas une date")).toBe("Fait");
  });
  it("affichée dans « Déjà traitées »", () => {
    const h = rendre([], { dejaTraitees: [{ idEvenement: "evt-f", reseau: "instagram", extrait: "Extrait fictif", creeLe: "2026-11-18T10:00:00.000Z", statut: "fait", faitLe: "2026-11-18T13:05:00.000Z" }] });
    expect(h).toContain("Fait le 18/11 à 14h05");
  });
});

describe("libellés et gabarit conservés", () => {
  const h = rendre([carte("evt-x")]);
  it("libellés existants", () => {
    for (const l of ["Copier la réponse", "Fait", "Ignorer", "STOP", "Réponse proposée"]) expect(h).toContain(l);
    expect(rendre([])).toContain("Rien à traiter");
  });
  it("lisible à 375 px, aucun prix", () => {
    expect(h).toContain("flex flex-wrap");
    expect(h).not.toMatch(/€|prix|tarif/i);
  });
});
