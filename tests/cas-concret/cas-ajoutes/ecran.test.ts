/**
 * Écran « Ajouter un cas » (parties pures) : traduction de la saisie en formulaire du serveur, champ en faute, listes déjà faits /
 * retirés qui montrent un cas ajouté, et import du stock qui refuse le préfixe réservé.
 */
import { describe, expect, it } from "vitest";
import { champEnFaute, saisieVide, versFormulaire } from "@/components/formats/cas-concret/ajouter/formulaire-cas";
import { listerCasRetires } from "@/components/formats/cas-concret/stock/cas-retires";
import { listerDejaFaits } from "@/components/formats/cas-concret/stock/deja-faits";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { chargerStock } from "@/formats/cas-concret/stock-metiers/charger";
import { lireFormulaireCas, preparerCasAjoute } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { FORMULAIRE_MINIMAL } from "./formulaires";

const r = preparerCasAjoute(FORMULAIRE_MINIMAL, { id: "ajout-essai-ab12", autres: CATALOGUE });
if (!r.ok) throw new Error(r.raisons.join("|"));

describe("saisie → formulaire", () => {
  it("une saisie complète donne un formulaire lisible par le serveur", () => {
    const s = {
      ...saisieVide(),
      ...FORMULAIRE_MINIMAL,
      taches: FORMULAIRE_MINIMAL.taches.join("\n"),
      etapes: FORMULAIRE_MINIMAL.etapes.map((e) => ({ ligne: e.ligne, titre: "", detail: "", objet: "" as const })),
      apres: "3",
      secteur: "",
      taille: "",
      valider: true,
      script: "",
    };
    const f = versFormulaire(s as never);
    expect(lireFormulaireCas(f).ok).toBe(true);
    expect(f).not.toHaveProperty("secteur");
    expect(f).not.toHaveProperty("script");
    expect((f.etapes as object[])[0]).toEqual({ ligne: FORMULAIRE_MINIMAL.etapes[0].ligne });
  });
  it("hors intégration, pas de nature ; la nature n'est envoyée que pour une intégration", () => {
    expect(versFormulaire({ ...saisieVide(), offre: "audit" })).not.toHaveProperty("nature");
    expect(versFormulaire({ ...saisieVide(), offre: "integration", nature: "outils-relies" })).toMatchObject({ nature: "outils-relies" });
  });
  it("partie humaine illisible : 0 (refusé par le schéma, en phrase)", () => {
    expect(versFormulaire({ ...saisieVide(), apres: "abc" }).resteHumainApresEtape).toBe(0);
  });
  it("champEnFaute : champs simples, tâches, étapes", () => {
    expect(champEnFaute("Titre : contient un nombre")).toBe("titre");
    expect(champEnFaute("Scène : raconte un client")).toBe("scene");
    expect(champEnFaute("Ce qui reste humain : 12 mots")).toBe("resteHumain");
    expect(champEnFaute("Tâche 2 : trop long")).toBe("taches");
    expect(champEnFaute("Étape 3 : trop long")).toBe("etape-2");
    expect(champEnFaute("Étape 3 (précision) : x")).toBe("etape-2");
    expect(champEnFaute("Refus avant le prix : x")).toBeNull();
  });
});

describe("listes qui montrent un cas ajouté", () => {
  const ajoute = { cas: r.cas, secteur: "AS", taille: "TPE" };
  it("déjà faits : titre, détails et bouton « remettre en stock » (il est au catalogue du studio)", () => {
    const l = listerDejaFaits(new Map([[r.cas.id, { videoId: "v1", titre: "x", le: "2026-10-24T10:00:00.000Z" }]]), { catalogueEtendu: false }, new Set(), [ajoute]);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ casId: r.cas.id, titre: r.cas.titre, auCatalogue: true });
    expect(l[0].details).toMatch(/Artisanat et services/);
    expect(l[0].details).toMatch(/TPE/);
  });
  it("déjà faits : un cas ajouté retiré n'est pas listé", () => {
    expect(listerDejaFaits(new Map([[r.cas.id, { videoId: "v1", titre: "x", le: "2026-10-24T10:00:00.000Z" }]]), { catalogueEtendu: false }, new Set([r.cas.id]), [ajoute])).toEqual([]);
  });
  it("retirés : titre, détails et bouton « remettre »", () => {
    const l = listerCasRetires({ [r.cas.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: "x" } }, { catalogueEtendu: false }, [ajoute]);
    expect(l[0]).toMatchObject({ casId: r.cas.id, titre: r.cas.titre, auCatalogue: true });
    expect(l[0].details).toMatch(/TPE/);
  });
});

describe("import du stock", () => {
  it("le préfixe « ajout- » est réservé : une ligne du stock qui le porte est refusée", () => {
    const rangement = { fiche: "AS-99", secteur: "AS", metier: "artisanat.essai", metierNom: "Essai", taille: "TPE", socle: "S14", inventaire: [], niveauPreuve: "a-confirmer", douleur: "essai", casUsage: null, voisinCatalogue: null, angle: null };
    const ok = chargerStock([{ rangement, cas: { ...r.cas, id: "essai-normal" } }], { ids: [], mots: [] });
    expect(ok.refuses).toEqual([]);
    const refuse = chargerStock([{ rangement, cas: r.cas }], { ids: [], mots: [] });
    expect(refuse.cas).toEqual([]);
    expect(refuse.refuses[0].raisons.join("|")).toMatch(/réservé aux cas ajoutés/);
  });
});
