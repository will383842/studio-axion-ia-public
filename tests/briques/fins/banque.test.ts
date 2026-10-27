/**
 * BANQUE DE FINS COMMUNE (14/10/2026) : la base 7 de l'Usine recopiée telle quelle (codes, phrases, objectifs et publics
 * du contrat d'échange) ; les tables du studio en tirent leurs phrases ; garde-fou LinkedIn commun.
 */
import { describe, expect, it } from "vitest";
import {
  APPEL_A_COMMENTER_LINKEDIN,
  BANQUE_APPELS,
  ErreurFin,
  OBJECTIFS_APPEL,
  PUBLICS_APPEL,
  TABLE_FINS,
  TABLE_FINS_DIAGNOSTIC,
  TYPES_CONTENU,
  appelDeLaBanque,
  appelsDeLaBanque,
  choisir,
  estAppelACommenter,
  phrasesDeLaBanque,
  type FinTable,
} from "../../../src/briques/fins";
import { RESEAUX_FIN } from "../../../src/briques/fins/types";

describe("base 7 de l'Usine, recopiée telle quelle", () => {
  it("90 lignes, codes uniques de forme « fin-<groupe>-<slug> », table gelée", () => {
    expect(BANQUE_APPELS).toHaveLength(90);
    expect(new Set(BANQUE_APPELS.map((a) => a.code)).size).toBe(90);
    for (const a of BANQUE_APPELS) expect(a.code).toMatch(/^fin-[a-z]+-[a-z0-9-]+$/);
    expect(Object.isFrozen(BANQUE_APPELS)).toBe(true);
    for (const a of BANQUE_APPELS) expect(Object.isFrozen(a), a.code).toBe(true);
  });

  it("objectifs, publics, sortes de contenu et réseaux : seulement ceux du contrat d'échange", () => {
    for (const a of BANQUE_APPELS) {
      expect(OBJECTIFS_APPEL, a.code).toContain(a.objectif);
      expect(PUBLICS_APPEL, a.code).toContain(a.public);
      expect(TYPES_CONTENU, a.code).toContain(a.typeContenu);
      for (const r of a.reseaux) expect(RESEAUX_FIN, a.code).toContain(r);
    }
    expect(BANQUE_APPELS.filter((a) => a.public === "public.clients")).toHaveLength(44);
    expect(BANQUE_APPELS.filter((a) => a.public === "public.apporteurs")).toHaveLength(23);
    expect(BANQUE_APPELS.filter((a) => a.public === "public.formateurs")).toHaveLength(23);
    // « linkedin_page » des bases = réseau linkedin, compte de nature « page ».
    expect(appelDeLaBanque("fin-li-question")).toMatchObject({ reseaux: ["linkedin"], naturesLinkedin: ["profil", "page"] });
    expect(appelDeLaBanque("fin-li-mot-texte")).toMatchObject({ reseaux: ["linkedin"], naturesLinkedin: ["profil"] });
  });

  it("phrases mot pour mot (échantillon des lignes que le studio reprend)", () => {
    expect(appelDeLaBanque("fin-if-mot-envoi")).toMatchObject({ reseaux: ["facebook"], dit: "Écrivez {MOT} en commentaire. Je vous l'envoie.", ecran: "Écrivez {MOT} en commentaire", objectif: "MOT_CADEAU" });
    expect(appelDeLaBanque("fin-ig-mot-abonnement")).toMatchObject({ dit: "Abonnez-vous et écrivez {MOT} en commentaire : je vous l'envoie.", ecran: "Abonnez-vous et écrivez {MOT}", objectif: "MOT_CADEAU" });
    expect(appelDeLaBanque("fin-ig-rdv-seul")).toMatchObject({ dit: "Réservez votre diagnostic gratuit.", lien: "https://axion-ia.com/fr/appel?depuis=entete", objectif: "RENDEZ_VOUS" });
    expect(appelDeLaBanque("fin-ig-carrousel-mot")?.etat).toBe("retire");
    expect(appelDeLaBanque("fin-li-post-mot")?.typeContenu).toBe("texte");
  });

  it("règles de la base 7 : rien de dit ni d'affiché sur LinkedIn ; « Écrivez {MOT} » dit seulement sur Instagram et Facebook", () => {
    for (const a of BANQUE_APPELS.filter((x) => x.reseaux.includes("linkedin"))) {
      expect(a.dit, a.code).toBe("");
      expect(a.ecran, a.code).toBe("");
    }
    for (const a of BANQUE_APPELS.filter((x) => x.dit.includes("{MOT}"))) {
      expect(a.reseaux.every((r) => r === "instagram" || r === "facebook"), a.code).toBe(true);
      expect(a.mot, a.code).toBe("{MOT}");
    }
  });

  it("lecture par réseau, public et sorte de contenu : lignes validées seulement", () => {
    const ig = appelsDeLaBanque({ reseau: "instagram", public: "public.clients", typeContenu: "carrousel" }).map((a) => a.code);
    expect(ig).toEqual(["fin-ig-carrousel-enregistrement", "fin-ig-carrousel-envoi", "fin-ig-carrousel-question"]);
    expect(() => phrasesDeLaBanque("fin-inconnue")).toThrow(/base 7/);
  });
});

describe("les tables du studio tirent leurs phrases de la banque", () => {
  it("toute ligne du tableau ou du cas concret dont le code est dans la base 7 en dit la phrase (deux écarts connus du cas concret)", () => {
    const repris: string[] = [];
    for (const f of [...TABLE_FINS, ...TABLE_FINS_DIAGNOSTIC]) {
      const a = appelDeLaBanque(f.id);
      if (!a) continue;
      repris.push(f.id);
      // Écarts à trancher par Will, gardés pour ne pas changer le cas concret (PR #167 ouverte) : sa fin LinkedIn dit
      // « Le lien est en premier commentaire. » (base 7 : rien de dit) ; l'écran de sa fin au mot d'Instagram.
      if (f.id === "fin-li-lien-commentaire") continue;
      expect(f.dit, f.id).toBe(a.dit);
      if (f.id !== "fin-ig-mot-abonnement") expect(f.ecran, f.id).toBe(a.ecran);
    }
    expect(repris.sort()).toEqual(["fin-fb-lien", "fin-if-enregistrement", "fin-if-mot-envoi", "fin-ig-lien", "fin-ig-mot-abonnement", "fin-li-lien-commentaire", "fin-ty-lien-profil", "fin-ty-question"]);
  });

  it("toute fin validée du tableau dit une phrase de la base 7", () => {
    const dits = new Set(BANQUE_APPELS.map((a) => a.dit));
    for (const f of TABLE_FINS.filter((x) => x.validee)) expect(dits.has(f.dit), f.id).toBe(true);
  });
});

describe("LinkedIn : aucun appel à commenter dit dans la vidéo (garde-fou commun)", () => {
  const auMot: FinTable = { id: "fin-li-essai", groupe: "linkedin", type: "commentaire", dit: "Écrivez {MOT} en commentaire. Je vous l'envoie.", ecran: "Écrivez {MOT} en commentaire", validee: true };

  it("fin-li-mot-envoi n'existe plus", () => {
    expect(TABLE_FINS.find((f) => f.id === "fin-li-mot-envoi")).toBeUndefined();
  });

  it("une fin au mot ajoutée à la main pour LinkedIn est refusée par `choisir`, quoi que dise la table", () => {
    expect(() => choisir(auMot, "linkedin", { mot: "GUIDE" })).toThrow(ErreurFin);
    expect(() => choisir(auMot, "linkedin", { mot: "GUIDE" })).toThrow(APPEL_A_COMMENTER_LINKEDIN);
    expect(() => choisir({ ...auMot, type: "envoi", dit: "Commentez et je vous l'envoie.", ecran: "Commentez" }, "linkedin")).toThrow(APPEL_A_COMMENTER_LINKEDIN);
  });

  it("« le lien est en premier commentaire » n'est pas un appel à commenter : le cas concret garde sa fin LinkedIn", () => {
    expect(estAppelACommenter({ type: "lien", dit: "Le lien est en premier commentaire.", ecran: "Diagnostic gratuit · lien en commentaire" })).toBe(false);
    expect(estAppelACommenter({ type: "commentaire", dit: "Écrivez IA en commentaire.", ecran: "x" })).toBe(true);
    expect(estAppelACommenter({ type: "envoi", dit: "Écrivez GUIDE en commentaire.", ecran: "x" })).toBe(true);
    const li = TABLE_FINS_DIAGNOSTIC.find((f) => f.id === "fin-li-lien-commentaire")!;
    expect(choisir(li, "linkedin").dit).toBe("Le lien est en premier commentaire.");
  });
});
