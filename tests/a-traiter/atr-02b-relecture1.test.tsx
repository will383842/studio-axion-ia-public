/** ATR-02b, correctifs du tour 1 de relecture : opposées, compteurs « répondus », noms de posts, répétition de touche. Cartes fictives, rien d'envoyé. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { actionClavier, decisionClavier, EcranATraiter } from "@/components/a-traiter/EcranATraiter";
import { etiquettesPosts } from "@/components/a-traiter/CompteursATraiter";
import { masqueesPourEcran, trierPourEcran } from "@/services/a-traiter-pur";
import type { CarteDejaTraitee } from "@/services/a-traiter-onglets";
import type { CarteATraiter } from "@/services/a-traiter-types";

const carte = (id: string, sur: Partial<CarteATraiter> = {}): CarteATraiter => ({
  idEvenement: id, reseau: "instagram", post: "post_fictif_1", lienPost: null, mot: null, motif: "mot_manuel",
  extrait: "Extrait fictif", creeLe: "2026-11-11T10:00:00.000Z", statut: "a_traiter", kit: "Merci !", ...sur,
});
const services = { fait: vi.fn(), ignorer: vi.fn(), stop: vi.fn() };
const rendre = (cartes: CarteATraiter[], dejaTraitees: CarteDejaTraitee[] = []) =>
  renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "normal" as const, cartes, compteur: cartes.length }, services, compte: "", dejaTraitees } as never));

describe("cartes opposées (STOP)", () => {
  it("une opposée banale passe avant une réclamation", () => {
    const l = trierPourEcran([
      carte("evt-reclam", { extrait: "Je veux une réclamation, c'est nul" }),
      carte("evt-opp", { extrait: "Bonjour", opposee: true, kit: null, creeLe: "2026-11-11T15:00:00.000Z" }),
    ]);
    expect(l.map((c) => c.idEvenement)).toEqual(["evt-opp", "evt-reclam"]);
    expect(rendre([carte("evt-reclam", { extrait: "Je veux une réclamation" }), carte("evt-opp", { extrait: "Bonjour opposé", opposee: true, kit: null })])).toContain("Bonjour opposé");
  });
  it("une opposée n'est jamais masquée, même avec un mot de spam ou deux liens", () => {
    const o = carte("evt-opp", { extrait: "followers http://a.fr http://b.fr", opposee: true, kit: null });
    expect(masqueesPourEcran([o, carte("evt-spam", { extrait: "Gagnez au casino" })]).map((c) => c.idEvenement)).toEqual(["evt-spam"]);
    expect(trierPourEcran([o]).map((c) => c.idEvenement)).toEqual(["evt-opp"]);
    expect(rendre([o])).toContain("followers");
  });
});

describe("compteur « répondus » avec les cartes déjà traitées", () => {
  it("une carte déjà faite compte dans arrivés et répondus", () => {
    const deja: CarteDejaTraitee[] = [{ idEvenement: "evt-ancien", reseau: "instagram", post: "post_fictif_1", extrait: "Ancien", creeLe: "2026-11-10T10:00:00.000Z", faitLe: "2026-11-10T11:00:00.000Z", statut: "fait" }];
    const h = rendre([carte("evt-1")], deja);
    expect(h).toContain("2 arrivés");
    expect(h).toContain("1 répondus");
  });
});

describe("noms de posts : un seul calcul, stable", () => {
  it("même nom dans le filtre et dans les compteurs, quel que soit l'état des cartes", () => {
    const cartes = [
      carte("evt-a", { post: "post_b", creeLe: "2026-11-12T10:00:00.000Z" }),
      carte("evt-b", { post: "post_a", creeLe: "2026-11-11T10:00:00.000Z", extrait: "Gagnez au casino" }),
      carte("evt-c", { post: "post_a", creeLe: "2026-11-11T11:00:00.000Z", statut: "fait" }),
    ];
    expect(etiquettesPosts(cartes).get("instagram|post_a")).toBe("Post 1");
    expect(etiquettesPosts(cartes).get("instagram|post_b")).toBe("Post 2");
    const h = rendre(cartes);
    // Filtre : seul post_b a une carte à traiter hors spam ; il s'appelle « Post 2 » aussi dans les compteurs.
    expect(h).toMatch(/<option[^>]*>Instagram · Post 2<\/option>/);
    expect(h).not.toMatch(/<option[^>]*>Instagram · Post 1<\/option>/);
    expect(h).toContain("<span>Post 2</span>");
  });
});

describe("clavier", () => {
  it("la touche maintenue (répétition) n'agit pas", () => {
    expect(actionClavier({ key: "f", repeat: true })).toBeNull();
    expect(actionClavier({ key: "ArrowRight", repeat: true })).toBeNull();
    expect(actionClavier({ key: "f" })).toBe("fait");
  });
  it("décision de l'écran : rien en cours, éteint ou sans carte ; jamais « fait » sur une opposée ; → et S sans service", () => {
    const c = { opposee: false };
    expect(decisionClavier("fait", { carte: c, enCours: false, etat: "normal" })).toBe("fait");
    expect(decisionClavier("suivante", { carte: c, enCours: false, etat: "normal" })).toBe("suivante");
    expect(decisionClavier("fait", { carte: { opposee: true }, enCours: false, etat: "normal" })).toBeNull();
    expect(decisionClavier("fait", { carte: c, enCours: true, etat: "normal" })).toBeNull();
    expect(decisionClavier("fait", { carte: c, enCours: false, etat: "desactive" })).toBeNull();
    expect(decisionClavier("suivante", { carte: undefined, enCours: false, etat: "normal" })).toBeNull();
    expect(decisionClavier(null, { carte: c, enCours: false, etat: "normal" })).toBeNull();
    expect(services.fait).not.toHaveBeenCalled();
    expect(services.stop).not.toHaveBeenCalled();
  });
});
