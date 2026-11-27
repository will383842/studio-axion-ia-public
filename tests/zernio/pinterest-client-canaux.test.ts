/** PR 3 Pinterest · route de lecture des tableaux, canaux « tableau », cibles, promotion gardée. Zernio simulé, données fictives. */
import { describe, expect, it } from "vitest";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { ciblesZernioPour } from "@/services/zernio-cibles";
import { comptesACocherZernio } from "@/services/comptes-envoi-zernio";
import { reseauDepuisPlateforme } from "@/domaine/rapatriement-zernio";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const ACC = "exemple-compte-pin";
const BOARDS = [
  { id: "111", name: "Idées", privacy: "PUBLIC" },
  { id: "222", name: "Brouillons", privacy: "SECRET" },
  { id: "333", name: "Guides", privacy: "PUBLIC" },
  { name: "Sans identifiant", privacy: "PUBLIC" },
  { id: 444, name: "Identifiant nombre", privacy: "PUBLIC" },
];
const serveur = (boards: unknown[] = BOARDS) => (a: AppelEnregistre): ReponsePreparee => {
  if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: ACC, platform: "pinterest", displayName: "Compte exemple" }] } };
  if (a.url.endsWith(`/v1/accounts/${ACC}/pinterest-boards`)) return { statut: 200, corps: { boards } };
  return { statut: 404, corps: {} };
};

describe("Pinterest · client", () => {
  it("GET pinterest-boards accepté ; entrées sans id texte écartées", async () => {
    const { client, faux } = creerFauxClientZernio(serveur());
    const t = await client.tableauxPinterest(ACC);
    expect(t.map((b) => b.id)).toEqual(["111", "222", "333"]);
    expect(faux.appels).toHaveLength(1);
    expect(faux.appels[0].methode).toBe("GET");
  });
  it("PUT, POST sur la même route et POST …/edit refusés sans appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio(serveur());
    for (const [methode, chemin] of [["PUT", `/v1/accounts/${ACC}/pinterest-boards`], ["POST", `/v1/accounts/${ACC}/pinterest-boards`], ["POST", "/v1/posts/x/edit"]] as const) {
      await expect(client.requete({ methode, chemin, corps: {} })).rejects.toBeTruthy();
    }
    expect(faux.appels).toHaveLength(0);
  });
});

describe("Pinterest · canaux", () => {
  const monter = (boards?: unknown[]) => {
    const t = creerFauxClientZernio(serveur(boards));
    return creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, maintenant: t.horloge.maintenant });
  };
  it("1 compte, 3 tableaux dont 1 SECRET et 1 sans id → 2 canaux « tableau »", async () => {
    const canaux = await monter().listerCanaux!();
    expect(canaux.map((c) => c.id)).toEqual([`${ACC}:pin:111`, `${ACC}:pin:333`]);
    expect(canaux[0]).toMatchObject({ service: "pinterest", genre: "tableau", nom: "Compte exemple · Idées" });
  });
  it("aucun tableau public → aucun canal", async () => {
    expect(await monter([{ id: "9", privacy: "SECRET" }]).listerCanaux!()).toEqual([]);
  });
  it("cibles : un seul tableau et rien de choisi → CIBLE_ABSENTE (jamais de tableau d'office)", async () => {
    const f = monter([BOARDS[0]]);
    const r = await ciblesZernioPour(f, "pinterest", []);
    expect(r).toMatchObject({ ok: false, code: "CIBLE_ABSENTE" });
    expect(r.ok === false && r.message).toContain("Idées");
    expect(await ciblesZernioPour(f, "pinterest", [`${ACC}:pin:111`])).toMatchObject({ ok: true });
  });
  it("comptesACocherZernio : une liste d'un choix, même avec un seul canal", () => {
    const canal = { id: `${ACC}:pin:111`, organisationId: "zernio", nom: "Compte · Idées", service: "pinterest", genre: "tableau", deconnecte: false };
    expect(comptesACocherZernio("pinterest", [canal])).toEqual({ choix: [{ id: canal.id, nom: canal.nom, genre: "tableau" }], memorises: [] });
  });
});

describe("Pinterest · promotion", () => {
  const post = (boardId: unknown) => postExemple({ platforms: [{ platform: "pinterest", accountId: ACC, status: "pending", platformSpecificData: { boardId } }] });
  const demande = { postId: "exemple-post-1", cleJournal: "studio-exemple", dateJournal: "2026-11-09T10:00:00Z" };
  it("tableau relu différent de celui attendu → refus, aucun PUT", async () => {
    const { client, faux } = creerFauxClientZernio((a) => (a.methode === "GET" ? { statut: 200, corps: { post: post("999") } } : { statut: 500 }));
    const r = await client.promouvoir({ ...demande, tableauAttendu: "111" });
    expect(r.etat).toBe("refuse");
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });
  it("tableau attendu absent de la demande → refus aussi (jamais promu sans garde)", async () => {
    const { client, faux } = creerFauxClientZernio((a) => (a.methode === "GET" ? { statut: 200, corps: { post: post("111") } } : { statut: 500 }));
    expect((await client.promouvoir(demande)).etat).toBe("refuse");
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });
  it("même tableau → PUT de promotion envoyé", async () => {
    const { client, faux } = creerFauxClientZernio((a) => {
      if (a.methode === "GET") return { statut: 200, corps: { post: { ...post("111"), ...(faux.appels.some((x) => x.methode === "PUT") ? { status: "scheduled", scheduledFor: "2026-11-09T10:00:00Z" } : {}) } } };
      return { statut: 200, corps: {} };
    });
    await client.promouvoir({ ...demande, tableauAttendu: "111" });
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(1);
  });
});

describe("Pinterest · accord des tables", () => {
  it("RESEAUX_PLATEFORME ↔ PLATEFORME_VERS_RESEAU", () => {
    expect(plateformeZernio("pinterest")).toBe("pinterest");
    expect(reseauDepuisPlateforme("pinterest")).toBe("pinterest");
  });
});
