/**
 * « compte-studio » = « rien de choisi » : le marqueur n'est jamais une cible, la règle des cibles par défaut s'applique.
 * Faux fournisseur (liste de comptes seulement), aucun appel réel. Données fictives.
 */
import { describe, expect, it } from "vitest";
import { ciblesZernioPour } from "@/services/zernio-cibles";
import { COMPTE_PAR_DEFAUT, estCompteParDefaut } from "@/domaine/plan-editorial/compte-par-defaut";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";

const svc = (canaux: CanalPublication[]): FournisseurPublication => ({ listerCanaux: async () => canaux }) as unknown as FournisseurPublication;
const page = (id: string, nom = "Page"): CanalPublication => ({ id, organisationId: "z", nom, service: "linkedin", genre: "page", deconnecte: false });
const profil: CanalPublication = { id: "c2:li:profil", organisationId: "z", nom: "Profil", service: "linkedin", genre: "profile", deconnecte: false };

describe("compte par défaut : marqueur", () => {
  it("valeur et reconnaissance", () => {
    expect(COMPTE_PAR_DEFAUT).toBe("compte-studio");
    expect(estCompteParDefaut("compte-studio")).toBe(true);
    expect(estCompteParDefaut("c1:li:42")).toBe(false);
    expect(estCompteParDefaut(undefined)).toBe(false);
  });
});

describe("ciblesZernioPour avec le marqueur", () => {
  it("LinkedIn page + profil : la page seule", async () => {
    const r = await ciblesZernioPour(svc([page("c1:li:42"), profil]), "linkedin", ["compte-studio"]);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual(["c1:li:42"]);
  });
  it("deux pages LinkedIn : CIBLE_ABSENTE, jamais le profil", async () => {
    const r = await ciblesZernioPour(svc([page("c1:li:1"), page("c1:li:2"), profil]), "linkedin", ["compte-studio"]);
    expect(r).toMatchObject({ ok: false, code: "CIBLE_ABSENTE" });
  });
  it("Facebook : CIBLE_ABSENTE", async () => {
    const fb: CanalPublication = { id: "c1:fb:p1", organisationId: "z", nom: "Page FB", service: "facebook", genre: "page", deconnecte: false };
    expect(await ciblesZernioPour(svc([fb]), "facebook", ["compte-studio"])).toMatchObject({ ok: false, code: "CIBLE_ABSENTE" });
  });
  it("Instagram, un compte : ce compte", async () => {
    const ig: CanalPublication = { id: "c3", organisationId: "z", nom: "IG", service: "instagram", deconnecte: false };
    const r = await ciblesZernioPour(svc([ig]), "instagram", ["compte-studio"]);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual(["c3"]);
  });
  it("marqueur + identifiant réel : l'identifiant réel seul", async () => {
    const r = await ciblesZernioPour(svc([page("c1:li:42"), profil]), "linkedin", ["compte-studio", "c2:li:profil"]);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual(["c2:li:profil"]);
  });
});
