// VERIF-REPAUTO : garde sans IA. Aucune réponse publique ni message privé automatique sur LinkedIn (page, profil) ni TikTok.
// Lecture seule de src/services/mots-capacites.ts (fichier de la session Zernio) : on l'importe, on ne le modifie pas.
import { describe, expect, it } from "vitest";
import { CAPACITES, RESEAUX, capaciteDe, construireGrapheReseau, grapheConformeAuReseau, peutMessagePrive, type Reseau } from "../src/services/mots-capacites";

const INTERDITS_AUTO: readonly string[] = ["linkedin_page", "linkedin_profil", "tiktok"];
const TEXTES = { reponsePublique: "Merci pour votre message.", messagePrive: "Voici le lien." } as never;

// Tout réseau dont le nom évoque LinkedIn ou TikTok est couvert, même s'il est ajouté plus tard.
const sensibles = (): Reseau[] => RESEAUX.filter((r) => /linkedin|tiktok/.test(r));

describe("garde : aucune réponse automatique sur LinkedIn et TikTok", () => {
  it("les trois réseaux nommés existent bien dans la liste des réseaux", () => {
    for (const r of INTERDITS_AUTO) expect(RESEAUX as readonly string[]).toContain(r);
  });

  it("couvre aussi tout réseau futur dont le nom contient linkedin ou tiktok", () => {
    expect(sensibles().length).toBeGreaterThanOrEqual(3);
    for (const r of INTERDITS_AUTO) expect(sensibles()).toContain(r);
  });

  it.each(INTERDITS_AUTO)("%s : reponsePublique n'est pas « auto »", (r) => {
    expect(CAPACITES[r as Reseau].reponsePublique).not.toBe("auto");
    expect(capaciteDe(r as Reseau).reponsePublique).not.toBe("auto");
  });

  it.each(INTERDITS_AUTO)("%s : messagePrive n'est pas « auto »", (r) => {
    expect(CAPACITES[r as Reseau].messagePrive).not.toBe("auto");
    expect(peutMessagePrive(r as Reseau)).toBe(false);
  });

  it.each(INTERDITS_AUTO)("%s : non automatisable, aucun graphe de workflow construit", (r) => {
    expect(CAPACITES[r as Reseau].automatisable).toBe(false);
    const g = construireGrapheReseau(TEXTES, r);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.code).toBe("manuel_seulement");
  });

  it.each(INTERDITS_AUTO)("%s : un workflow, même vide de messages privés, n'est jamais conforme", (r) => {
    const w = { nom: "x", etapes: [{ id: "e1", type: "repondre_commentaire", texte: "Merci", suite: null }] } as never;
    expect(grapheConformeAuReseau(w, r as Reseau)).toBe(false);
  });

  it("aucun réseau sensible n'est automatisable ni auto, par aucune des trois capacités", () => {
    for (const r of sensibles()) {
      const c = CAPACITES[r];
      expect(c.reponsePublique === "auto" || c.messagePrive === "auto" || c.automatisable).toBe(false);
    }
  });

  it("témoin : Facebook et Instagram restent automatiques (le garde ne coupe pas tout)", () => {
    expect(CAPACITES.facebook.reponsePublique).toBe("auto");
    expect(CAPACITES.instagram.reponsePublique).toBe("auto");
  });
});
