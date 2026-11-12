import { describe, expect, it } from "vitest";
import { TYPES_CONTENU_USINE } from "@/domaine/usine";
import {
  RESEAUX_CALENDRIER,
  jourParis,
  lireCadenceUsine,
  lirePropositionCalendrier,
  lireReponseCalendrier,
} from "@/domaine/usine-calendrier";

const MAINTENANT = new Date("2026-11-20T09:00:00Z");
const HEX = "a".repeat(64);

function proposition(sur: Record<string, unknown> = {}) {
  return {
    cle_proposition: HEX,
    reseau: "linkedin",
    compte: "linkedin:compte-fictif",
    type_contenu: "video",
    dueAt: "2026-11-25T08:30:00+01:00",
    jour_vise: "2026-11-25",
    origine: "usine",
    ...sur,
  };
}

describe("PropositionCalendrier", () => {
  it("accepte une proposition valable", () => {
    const r = lirePropositionCalendrier(proposition(), MAINTENANT);
    expect(r.ok).toBe(true);
  });

  it("refuse une date passée (400 champ_invalide, champ dueAt)", () => {
    const r = lirePropositionCalendrier(proposition({ dueAt: "2026-11-01T08:30:00+01:00", jour_vise: "2026-11-01" }), MAINTENANT);
    expect(r).toMatchObject({ ok: false, statut: 400, code: "champ_invalide", champ: "dueAt" });
  });

  it("refuse une date sans décalage", () => {
    const r = lirePropositionCalendrier(proposition({ dueAt: "2026-11-25T08:30:00" }), MAINTENANT);
    expect(r).toMatchObject({ ok: false, statut: 400, code: "champ_invalide", champ: "dueAt" });
  });

  it("refuse un jour visé différent de la date locale (Europe/Paris) de dueAt", () => {
    const r = lirePropositionCalendrier(proposition({ jour_vise: "2026-11-26" }), MAINTENANT);
    expect(r).toMatchObject({ ok: false, statut: 400, code: "champ_invalide", champ: "jour_vise" });
  });

  it("le jour visé suit l'heure de Paris, pas l'UTC", () => {
    expect(jourParis("2026-11-25T23:30:00Z")).toBe("2026-11-26");
    const r = lirePropositionCalendrier(proposition({ dueAt: "2026-11-25T23:30:00Z", jour_vise: "2026-11-26" }), MAINTENANT);
    expect(r.ok).toBe(true);
  });

  it("refuse un réseau inconnu (422 reseau_inconnu)", () => {
    const r = lirePropositionCalendrier(proposition({ reseau: "myspace", compte: "myspace:x" }), MAINTENANT);
    expect(r).toMatchObject({ ok: false, statut: 422, code: "reseau_inconnu" });
  });

  it("refuse un réseau éteint (409 reseau_eteint) : YouTube", () => {
    for (const reseau of ["youtube", "youtube-shorts"]) {
      const r = lirePropositionCalendrier(proposition({ reseau, compte: `${reseau}:compte-fictif` }), MAINTENANT);
      expect(r).toMatchObject({ ok: false, statut: 409, code: "reseau_eteint" });
    }
  });

  it("refuse un type de contenu inactif (422 type_inactif) et inconnu (400)", () => {
    for (const type_contenu of ["carrousel", "image", "texte", "story"]) {
      const r = lirePropositionCalendrier(proposition({ type_contenu }), MAINTENANT);
      expect(r).toMatchObject({ ok: false, statut: 422, code: "type_inactif" });
    }
    expect(lirePropositionCalendrier(proposition({ type_contenu: "podcast" }), MAINTENANT)).toMatchObject({ ok: false, statut: 400, code: "champ_invalide", champ: "type_contenu" });
  });

  it("refuse un compte qui n'est pas de la forme <reseau>:<identifiant> ou d'un autre réseau", () => {
    expect(lirePropositionCalendrier(proposition({ compte: "Compte Fictif" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide", champ: "compte" });
    expect(lirePropositionCalendrier(proposition({ compte: "instagram:compte-fictif" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide", champ: "compte" });
  });

  it("refuse une origine autre que « usine » et une clé qui n'est pas un sha256", () => {
    expect(lirePropositionCalendrier(proposition({ origine: "fondateur" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide", champ: "origine" });
    expect(lirePropositionCalendrier(proposition({ cle_proposition: "abc" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide", champ: "cle_proposition" });
  });

  it("refuse tout champ d'état, toute valeur programmee/publiee/echec et tout nom de diffuseur", () => {
    for (const sur of [{ etat: "programmee" }, { statut: "publiee" }, { diffuseur: "zernio" }, { zernio_id: "x" }, { origine: "publiee" }, { type_contenu: "echec" }, { compte: "zernio:x" }]) {
      const r = lirePropositionCalendrier(proposition(sur), MAINTENANT);
      expect(r).toMatchObject({ ok: false, statut: 400, code: "champ_invalide" });
    }
  });

  it("refuse un corps qui n'est pas un objet", () => {
    expect(lirePropositionCalendrier(null, MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide" });
    expect(lirePropositionCalendrier("x", MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide" });
  });
});

describe("PropositionCalendrier : diffuseurs (correction après relecture)", () => {
  it("accepte un compte légitime qui contient « buffer » dans son identifiant", () => {
    expect(lirePropositionCalendrier(proposition({ reseau: "instagram", compte: "instagram:buffet-buffer" }), MAINTENANT).ok).toBe(true);
    expect(lirePropositionCalendrier(proposition({ compte: "linkedin:latelier-buffer" }), MAINTENANT).ok).toBe(true);
  });

  it("refuse toujours une valeur qui EST un nom de diffuseur, et toute clé de diffuseur", () => {
    expect(lirePropositionCalendrier(proposition({ compte: "buffer" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide" });
    expect(lirePropositionCalendrier(proposition({ zernio: "x" }), MAINTENANT)).toMatchObject({ ok: false, code: "champ_invalide" });
  });
});

describe("ReponseCalendrier", () => {
  const entree = (sur: Record<string, unknown> = {}) => ({
    cle_proposition: HEX,
    creneau_id: "cr-1",
    date_retenue: "2026-11-25T07:30:00Z",
    origine_date: "usine",
    etat_validation: "propose",
    avertissements: [],
    ...sur,
  });
  const reponse = (sur: Record<string, unknown> = {}) => ({ commande_id: "cmd-1", entrees: [entree()], deja: false, ...sur });

  it("accepte une réponse valable, y compris une date du fondateur", () => {
    expect(lireReponseCalendrier(reponse()).ok).toBe(true);
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ origine_date: "fondateur" })] })).ok).toBe(true);
  });

  it("refuse une origine de date, un état de validation ou un champ inconnu hors contrat", () => {
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ origine_date: "studio" })] })).ok).toBe(false);
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ etat_validation: "programmee" })] })).ok).toBe(false);
    expect(lireReponseCalendrier(reponse({ extra: 1 })).ok).toBe(false);
  });

  it("refuse une date retenue qui n'existe pas au calendrier (31 février)", () => {
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ date_retenue: "2026-02-31T10:00:00Z" })] })).ok).toBe(false);
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ date_retenue: "2026-02-28T10:00:00Z" })] })).ok).toBe(true);
  });

  it("l'état de validation d'un créneau ne vaut que « propose » ou « valide »", () => {
    expect(lireReponseCalendrier(reponse({ entrees: [entree({ etat_validation: "valide" })] })).ok).toBe(true);
  });
});

describe("CadenceUsine", () => {
  const cadence = (sur: Record<string, unknown> = {}) => ({
    version: 3,
    regle_le: "2026-11-20T08:00:00Z",
    quotas: [
      { reseau: "linkedin", type_contenu: "video", periode: "semaine", nombre: 3 },
      { reseau: "instagram", type_contenu: "video", periode: "jour", nombre: 0 },
    ],
    ...sur,
  });

  it("accepte des quantités, zéro compris", () => {
    expect(lireCadenceUsine(cadence()).ok).toBe(true);
  });

  it("refuse tout montant ou champ en euros ou en centimes (400 champ_invalide)", () => {
    for (const sur of [{ budget_eur: 5 }, { prix: 1 }, { montant_centimes: 100 }]) {
      expect(lireCadenceUsine(cadence(sur))).toMatchObject({ ok: false, statut: 400, code: "champ_invalide" });
    }
    const q = [{ reseau: "linkedin", type_contenu: "video", periode: "jour", nombre: 1, euros: 2 }];
    expect(lireCadenceUsine(cadence({ quotas: q }))).toMatchObject({ ok: false, statut: 400, code: "champ_invalide" });
  });

  it("refuse un nombre négatif ou non entier, une période inconnue, une version non entière", () => {
    const q = (sur: Record<string, unknown>) => [{ reseau: "linkedin", type_contenu: "video", periode: "jour", nombre: 1, ...sur }];
    expect(lireCadenceUsine(cadence({ quotas: q({ nombre: -1 }) })).ok).toBe(false);
    expect(lireCadenceUsine(cadence({ quotas: q({ nombre: 1.5 }) })).ok).toBe(false);
    expect(lireCadenceUsine(cadence({ quotas: q({ periode: "mois" }) })).ok).toBe(false);
    expect(lireCadenceUsine(cadence({ version: 1.5 })).ok).toBe(false);
  });

  it("refuse un réseau inconnu dans un quota", () => {
    const r = lireCadenceUsine(cadence({ quotas: [{ reseau: "myspace", type_contenu: "video", periode: "jour", nombre: 1 }] }));
    expect(r).toMatchObject({ ok: false, statut: 422, code: "reseau_inconnu" });
  });
});

describe("cohérence avec le contrat publié", () => {
  it("les six réseaux du contrat, YouTube éteint", () => {
    expect(RESEAUX_CALENDRIER.map((r) => r.id)).toEqual(["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"]);
    expect(RESEAUX_CALENDRIER.filter((r) => !r.allume).map((r) => r.id)).toEqual(["youtube", "youtube-shorts"]);
  });

  it("les cinq types de contenu du contrat, y compris « story » (incohérence corrigée), seule la vidéo est active", () => {
    expect(TYPES_CONTENU_USINE.map((t) => t.id)).toEqual(["video", "carrousel", "image", "texte", "story"]);
    expect(TYPES_CONTENU_USINE.filter((t) => t.actif).map((t) => t.id)).toEqual(["video"]);
  });

  it("les codes d'erreur et leurs statuts, et les valeurs d'origine de date, sont ceux du contrat", () => {
    const code = (corps: unknown) => lirePropositionCalendrier(corps, MAINTENANT);
    expect(code(proposition({ reseau: "mastodon", compte: "mastodon:x" }))).toMatchObject({ statut: 422, code: "reseau_inconnu" });
    expect(code(proposition({ reseau: "youtube", compte: "youtube:x" }))).toMatchObject({ statut: 409, code: "reseau_eteint" });
    expect(code(proposition({ type_contenu: "image" }))).toMatchObject({ statut: 422, code: "type_inactif" });
    expect(code(proposition({ jour_vise: "x" }))).toMatchObject({ statut: 400, code: "champ_invalide" });
    for (const origine of ["usine", "fondateur"]) {
      const e = { cle_proposition: HEX, creneau_id: "c", date_retenue: "2026-11-25T07:30:00Z", origine_date: origine, etat_validation: "propose", avertissements: [] };
      expect(lireReponseCalendrier({ commande_id: "c", entrees: [e], deja: false }).ok).toBe(true);
    }
  });
});
