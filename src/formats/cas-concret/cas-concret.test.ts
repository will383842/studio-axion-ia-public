/** Fiche « Cas concret MD » (F1) : masquée, non inscrite ; contrat d'un cas ; recettes ; fins par réseau. */
import { describe, expect, it } from "vitest";
import { empreinteCas, OBJETS, verifierCas, type CasConcret } from "./cas";
import { CATALOGUE, trouverCas } from "./catalogue";
import { FIN_APRES_DERNIER_MOT_SEC, finsParReseau, formatCasConcret, FORMAT_VOIX_DE_REFERENCE, PAGE_DIAGNOSTIC, TEMPO_VOIX, VALIDITE_CAS_JOURS } from "./index";
import { ETIQUETTE_POSTURE, recettePour } from "./recette";

const base = (): CasConcret => ({
  id: "cas-essai",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "offre",
  titre: "Un rendez-vous réservé",
  promesse: "Votre rendez-vous se confirme tout seul.",
  cible: "Un dirigeant qui perd du temps en relances.",
  avant: { taches: ["Confirmer à la main", "Relancer par téléphone"], total: "Chaque jour" },
  etapes: [
    { titre: "Réservation", ligne: "La personne choisit son créneau.", detail: "Elle voit l'agenda.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "Confirmation", ligne: "Un e-mail part tout seul.", detail: "Il reprend le créneau.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "Rappel", ligne: "Le rappel part la veille.", detail: "Un message court.", visuel: { sorte: "objet", objet: "telephone-notification" }, humaine: false },
  ],
  resteHumain: "Vous animez le rendez-vous.",
  resultat: "Moins d'absents.",
  faits: [{ id: "rappel-veille", enonce: "Le rappel part la veille.", valeurs: [1], source: "site", preuve: "Page de l'offre." }],
  documentPromis: { nom: "Schéma du parcours", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "IA",
  vigilance: [],
});

const refus = (cas: unknown): string => {
  const r = verifierCas(cas);
  if (r.ok) throw new Error("cas accepté à tort");
  return r.raisons.join(" | ");
};

describe("fiche du format", () => {
  it("active, code CC, musique interdite, voix seule, aucun visage", () => {
    expect(formatCasConcret.id).toBe("cas-concret");
    expect(formatCasConcret.nom).toBe("Cas concret MD");
    expect(formatCasConcret.statut).toBe("actif");
    expect(formatCasConcret.codeClassement).toBe("CC");
    expect(formatCasConcret.musique).toBe("interdite");
    expect(formatCasConcret.personnages.roles).toEqual(["voix"]);
    expect(formatCasConcret.capacitesRequises).not.toContain("visage");
    expect(formatCasConcret.moteur).toBe("montage-cas-concret");
    expect(formatCasConcret.pieces?.habillage).toBe("charte-duo/1");
    expect(formatCasConcret.recetteScript.motsParSeconde).toBe(3.4);
    expect(formatCasConcret.sansPrix).toBeUndefined();
    expect(formatCasConcret.durees).toMatchObject({ zoneSec: [40, 60], zoneOrangeSec: [60, 65], cibleParDefautSec: 50 });
  });

  it("constantes du format", () => {
    expect([PAGE_DIAGNOSTIC, TEMPO_VOIX, FIN_APRES_DERNIER_MOT_SEC, FORMAT_VOIX_DE_REFERENCE, VALIDITE_CAS_JOURS]).toEqual(["https://axion-ia.com/fr/diagnostic", 1.08, 2.1, "avocat", 180]);
  });

  it("le catalogue ne trouve pas un cas inconnu", () => {
    expect(trouverCas("rien")).toBeUndefined();
    expect(CATALOGUE.every((c) => trouverCas(c.id) === c)).toBe(true);
  });
});

describe("verifierCas", () => {
  it("accepte un cas bien formé", () => {
    expect(verifierCas(base()).ok).toBe(true);
  });

  it("refuse plus de 7 étapes", () => {
    const cas = base();
    cas.etapes = Array.from({ length: 8 }, () => cas.etapes[0]!);
    expect(refus(cas)).toMatch(/pas plus de 7 étapes/);
  });

  it("refuse une étape à écran réel sans repli", () => {
    const cas = base();
    cas.etapes[0] = { ...cas.etapes[0]!, visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/appel", mouvement: "image" } };
    expect(refus(cas)).toMatch(/objet de repli/);
    cas.etapes[0] = { ...cas.etapes[0]!, visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/appel", mouvement: "image", repli: "calendrier" } };
    expect(verifierCas(cas).ok).toBe(true);
  });

  it("refuse une adresse hors https://axion-ia.com/", () => {
    const cas = base();
    cas.etapes[0] = { ...cas.etapes[0]!, visuel: { sorte: "ecran", adresse: "https://exemple.fr/page", mouvement: "image", repli: "calendrier" } };
    expect(refus(cas)).toMatch(/adresse hors de https:\/\/axion-ia\.com\//);
    cas.etapes[0] = { ...cas.etapes[0]!, visuel: { sorte: "ecran", adresse: "https://axion-ia.com.autre.fr/", mouvement: "image", repli: "calendrier" } };
    expect(refus(cas)).toMatch(/adresse hors/);
  });

  it("refuse un cas « chez nous » sans enServiceVerifie", () => {
    const cas = { ...base(), posture: "chez-nous" as const };
    expect(refus(cas)).toMatch(/en service/);
    expect(verifierCas({ ...cas, enServiceVerifie: { le: "2026-10-11", source: "Code relu" } }).ok).toBe(true);
  });

  it("refuse un fait sans source", () => {
    const cas = base() as unknown as { faits: Record<string, unknown>[] };
    delete cas.faits[0]!.source;
    expect(refus(cas)).toMatch(/faits\.0\.source/);
  });

  it("refuse une promesse de plus de 8 mots", () => {
    expect(refus({ ...base(), promesse: "Votre rendez-vous se confirme tout seul sans que personne ne bouge" })).toMatch(/plus de 8 mots/);
  });

  it("refuse un champ inconnu, un objet inconnu, un mot mal formé, une forme lue trop longue", () => {
    expect(refus({ ...base(), extra: 1 })).toMatch(/champ inconnu/);
    const cas = base();
    cas.etapes[0] = { ...cas.etapes[0]!, visuel: { sorte: "objet", objet: "inconnu" as never } };
    expect(refus(cas)).toMatch(/valeur non permise/);
    expect(refus({ ...base(), mot: "deux mots" })).toMatch(/mot de 2 à 24/);
    expect(refus({ ...base(), motDit: "I.A.I.A.I.A.I.A." })).toMatch(/12 caractères/);
    expect(OBJETS).toHaveLength(17);
  });
});

describe("empreinteCas", () => {
  it("change si un fait change, pas si l'ordre des clés change", () => {
    const cas = base();
    const autre = base();
    autre.faits[0] = { ...autre.faits[0]!, valeurs: [2] };
    expect(empreinteCas(autre)).not.toBe(empreinteCas(cas));
    const melange = JSON.parse(JSON.stringify(cas)) as Record<string, unknown>;
    expect(empreinteCas(Object.fromEntries(Object.entries(melange).reverse()) as unknown as CasConcret)).toBe(empreinteCas(cas));
  });
});

describe("recettes", () => {
  it("formation, audit, intégration : blocs dans l'ordre, étiquette selon la posture", () => {
    for (const offre of ["formation", "audit", "integration"] as const) {
      const blocs = recettePour({ offre, posture: "offre", etapes: base().etapes });
      expect(blocs.map((b) => b.id)).toEqual(["accroche", "chiffre", "avant", "bascule", "etapes", "reste-humain", "conformite", "resultat", "question"]);
      expect(blocs.filter((b) => b.facultatif).map((b) => b.id)).toEqual(["conformite"]);
      for (const b of blocs) expect(b.etiquette).toBe("notre méthode");
    }
    expect(recettePour({ offre: "audit", posture: "chez-nous", etapes: base().etapes })[0]?.etiquette).toBe("cas réel");
    expect(ETIQUETTE_POSTURE).toEqual({ "chez-nous": "cas réel", offre: "notre méthode" });
  });
});

describe("finsParReseau (X6 : une seule demande par fin)", () => {
  const FB = ["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"];
  it("aujourd'hui (rien n'est branché) : la fin « diagnostic » partout", () => {
    expect(finsParReseau("integration", [], "automatisation")).toEqual({
      facebook: FB,
      instagram: ["fin-if-diagnostic-gratuit", "fin-ig-lien-profil"],
      tiktok: ["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"],
      linkedin: ["fin-li-diagnostic-gratuit", "fin-li-lien-commentaire"],
    });
  });

  it("le mot n'est dit que sur un compte où il est branché ; jamais sur TikTok ni LinkedIn", () => {
    const f = finsParReseau("integration", ["instagram", "tiktok", "linkedin"], "automatisation");
    // X7 : sur Instagram, la fin au mot est la phrase avec l'abonnement, en une ligne.
    expect(f.instagram).toEqual(["fin-ig-mot-abonnement"]);
    expect(f.facebook).toEqual(FB);
    expect(f.tiktok).toEqual(["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"]);
    expect(f.linkedin).toEqual(["fin-li-diagnostic-gratuit", "fin-li-lien-commentaire"]);
    expect(finsParReseau("formation", ["facebook"]).facebook).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
  });

  it("une offre sans document (coaching) n'a jamais le mot", () => {
    expect(finsParReseau("coaching", ["facebook", "instagram"]).facebook).toEqual(FB);
  });
});
