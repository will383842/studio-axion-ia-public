import { describe, expect, it } from "vitest";
import { PROPOSITION_YOUTUBE, type ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";
import { appliquerSuggestions, confirmationPublicRequise, detailInterrupteur, etatInterrupteur, recalerFormulaire, reglagesModifies, resumeCarteYoutube, TEXTES_LOGIQUE_YOUTUBE } from "./youtube-logique";

const enregistres: ReglagesYoutube = { visibilite: "private", categorieId: "28", synthetique: "non", pourEnfants: false, titre: "premiere-ligne" };

describe("résumé de la carte YouTube Shorts", () => {
  it("éteint : rien ne part", () => {
    expect(resumeCarteYoutube(false)).toBe("Éteint : rien ne part vers YouTube tant que vous ne l'allumez pas");
  });
  it("allumé : les Shorts partent avec les réglages enregistrés", () => {
    expect(resumeCarteYoutube(true)).toBe("Allumé : les Shorts partent vers YouTube avec les réglages enregistrés");
  });
});

describe("« Remplir avec les suggestions »", () => {
  it("ne touche pas la visibilité courante", () => {
    const r = appliquerSuggestions({ visibilite: "private", categorieId: "" });
    expect(r.visibilite).toBe("private");
    expect(r.categorieId).toBe(PROPOSITION_YOUTUBE.categorieId);
    expect(r.titre).toBe(PROPOSITION_YOUTUBE.titre);
  });
  it("visibilité non choisie : reste non choisie (jamais Public d'office)", () => {
    expect(appliquerSuggestions({ categorieId: "" }).visibilite).toBeUndefined();
  });
  it("ne passe jamais Public tout seul", () => {
    expect(appliquerSuggestions({ visibilite: "unlisted", categorieId: "" }).visibilite).toBe("unlisted");
  });
});

describe("formulaire modifié ou non", () => {
  it("identique aux réglages enregistrés : pas modifié", () => {
    expect(reglagesModifies({ ...enregistres }, enregistres)).toBe(false);
  });
  it("un champ change : modifié", () => {
    expect(reglagesModifies({ ...enregistres, visibilite: "public" }, enregistres)).toBe(true);
  });
  it("rien d'enregistré et formulaire vide : pas modifié ; rempli : modifié", () => {
    expect(reglagesModifies({ categorieId: "" }, null)).toBe(false);
    expect(reglagesModifies({ categorieId: "27" }, null)).toBe(true);
  });
});

const relie = { etat: "relie", nom: "Ma chaîne" } as const;

describe("interrupteur grisé ou non", () => {
  const base = { enCours: false, actif: false, reglages: enregistres, modifie: false, chaine: relie } as const;
  it("formulaire modifié + envoi éteint : grisé", () => {
    const modifie = reglagesModifies({ ...enregistres, visibilite: "public" }, enregistres);
    expect(modifie).toBe(true);
    const r = etatInterrupteur({ ...base, modifie });
    expect(r.desactive).toBe(true);
    expect(r.raison).toBe(TEXTES_LOGIQUE_YOUTUBE.enregistrerD);
  });
  it("formulaire modifié + envoi allumé : on peut toujours éteindre", () => {
    expect(etatInterrupteur({ ...base, actif: true, modifie: true }).desactive).toBe(false);
  });
  it("tout est en ordre : allumable", () => {
    expect(etatInterrupteur(base)).toEqual({ desactive: false, raison: null });
  });
  it("pas de réglages enregistrés : grisé", () => {
    expect(etatInterrupteur({ ...base, reglages: null }).desactive).toBe(true);
  });
  it("chaîne absente, inconnue ou déconnectée : grisé avec explication", () => {
    for (const [chaine, texte] of [
      [{ etat: "absent" }, TEXTES_LOGIQUE_YOUTUBE.chaineAbsente],
      [{ etat: "inconnu" }, TEXTES_LOGIQUE_YOUTUBE.chaineInconnue],
      [{ etat: "deconnecte", nom: "X" }, TEXTES_LOGIQUE_YOUTUBE.chaineDeconnectee],
    ] as const) {
      expect(etatInterrupteur({ ...base, chaine })).toEqual({ desactive: true, raison: texte });
    }
  });
  it("chaîne absente mais envoi déjà allumé : on peut l'éteindre", () => {
    expect(etatInterrupteur({ ...base, actif: true, chaine: { etat: "absent" } }).desactive).toBe(false);
  });
  it("action en cours : grisé dans tous les cas", () => {
    expect(etatInterrupteur({ ...base, enCours: true }).desactive).toBe(true);
    expect(etatInterrupteur({ ...base, enCours: true, actif: true }).desactive).toBe(true);
  });
});

describe("détail de l'interrupteur", () => {
  it("éteint : dit ce qui se passera à l'allumage, avec la visibilité enregistrée", () => {
    expect(detailInterrupteur(false, enregistres)).toBe("Éteint : rien ne part vers YouTube. Allumé : les Shorts partent en Privé.");
    expect(detailInterrupteur(false, { ...enregistres, visibilite: "public" })).toContain("Allumé : les Shorts partent en Public");
  });
  it("allumé : dit seulement ce qui se passe maintenant, sans « Éteint »", () => {
    expect(detailInterrupteur(true, enregistres)).toBe("Allumé : les Shorts partent en Privé.");
    expect(detailInterrupteur(true, { ...enregistres, visibilite: "unlisted" })).not.toContain("Éteint");
  });
  it("éteint sans réglages : demande d'enregistrer d'abord", () => {
    expect(detailInterrupteur(false, null)).toContain("Enregistrez d'abord");
  });
  it("allumé sans réglages valides : dit clairement que l'envoi est bloqué", () => {
    const t = detailInterrupteur(true, null);
    expect(t).toBe(TEXTES_LOGIQUE_YOUTUBE.allumeBloque);
    expect(t).toContain("rien ne part");
    expect(t).not.toContain("partent en");
  });
});

describe("confirmation avant de passer en « public » avec l'envoi allumé", () => {
  it("envoi allumé, visibilité enregistrée privée, formulaire public : confirmation requise", () => {
    expect(confirmationPublicRequise(true, enregistres, { ...enregistres, visibilite: "public" })).toBe(true);
  });
  it("envoi éteint : pas de confirmation (rien ne part)", () => {
    expect(confirmationPublicRequise(false, enregistres, { ...enregistres, visibilite: "public" })).toBe(false);
  });
  it("déjà public en base : pas de nouvelle confirmation", () => {
    expect(confirmationPublicRequise(true, { ...enregistres, visibilite: "public" }, { ...enregistres, visibilite: "public" })).toBe(false);
  });
  it("formulaire non public : pas de confirmation", () => {
    expect(confirmationPublicRequise(true, enregistres, { ...enregistres, visibilite: "unlisted" })).toBe(false);
  });
  it("allumé sans réglages enregistrés, formulaire public : confirmation requise", () => {
    expect(confirmationPublicRequise(true, null, { categorieId: "27", visibilite: "public" })).toBe(true);
  });
});

describe("recalage du formulaire sur la base", () => {
  const autre: ReglagesYoutube = { ...enregistres, visibilite: "unlisted", categorieId: "27" };
  it("base inchangée : rien ne bouge, pas d'avertissement", () => {
    const b = { ...enregistres, titre: "studio" as const };
    expect(recalerFormulaire(b, enregistres, { ...enregistres })).toEqual({ brouillon: b, avertir: false });
  });
  it("base changée, formulaire sans modification : recalé, pas d'avertissement", () => {
    const r = recalerFormulaire({ ...enregistres }, enregistres, autre);
    expect(r).toEqual({ brouillon: autre, avertir: false });
  });
  it("base changée, formulaire modifié : modifications gardées + avertissement", () => {
    const b = { ...enregistres, visibilite: "public" as const };
    expect(recalerFormulaire(b, enregistres, autre)).toEqual({ brouillon: b, avertir: true });
  });
  it("base changée vers ce que le formulaire contient déjà (enregistrement fait ici) : pas d'avertissement", () => {
    const b = { ...enregistres, visibilite: "public" as const };
    expect(recalerFormulaire(b, enregistres, b)).toEqual({ brouillon: b, avertir: false });
  });
  it("réglages effacés en base, formulaire sans modification : formulaire vidé", () => {
    expect(recalerFormulaire({ ...enregistres }, enregistres, null)).toEqual({ brouillon: { categorieId: "" }, avertir: false });
  });
  it("réglages apparus en base, formulaire vide : recalé", () => {
    expect(recalerFormulaire({ categorieId: "" }, null, enregistres)).toEqual({ brouillon: enregistres, avertir: false });
  });
});
