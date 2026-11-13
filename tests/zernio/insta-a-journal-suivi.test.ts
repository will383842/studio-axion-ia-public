/** INSTA-A · le journal et les erreurs ne portent jamais l'identifiant de la personne (follow-status). Données fictives. */
import { describe, expect, it } from "vitest";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { creerFauxClientZernio, fetchInterdit, type ReponsePreparee } from "./aides/faux-zernio";
import { creerClientZernio } from "@/fournisseurs/publication/zernio-client";
import { CLE_FICTIVE } from "./aides/faux-zernio";

const PERSONNE = "personne-fictive-9876";

async function tout(reps: ReponsePreparee[]) {
  const { client, journal } = creerFauxClientZernio(reps);
  const e = await client.suiviInstagram("exemple-compte-1", PERSONNE).then(() => null, (x: unknown) => x);
  return { e, texte: JSON.stringify(journal.lignes) + (e instanceof ErreurZernio ? JSON.stringify({ m: e.message, d: e.detailTechnique }) : "") };
}

describe("insta-a · identifiant de la personne absent du journal et des erreurs", () => {
  it("succès : libellé masqué", async () => {
    const { journal, client } = creerFauxClientZernio([{ statut: 200, corps: { isFollower: true } }]);
    await client.suiviInstagram("exemple-compte-1", PERSONNE);
    expect(journal.lignes.length).toBeGreaterThan(0);
    expect(JSON.stringify(journal.lignes)).not.toContain(PERSONNE);
    expect(JSON.stringify(journal.lignes)).toContain("follow-status/<personne>");
  });
  it.each<[string, ReponsePreparee[]]>([
    ["500", [{ statut: 500, corps: { error: PERSONNE } }, { statut: 500, corps: { error: PERSONNE } }, { statut: 500, corps: { error: PERSONNE } }, { statut: 500, corps: { error: PERSONNE } }]],
    ["404", [{ statut: 404, corps: { error: PERSONNE } }]],
    ["403", [{ statut: 403, corps: { error: PERSONNE } }]],
    ["400", [{ statut: 400, corps: { error: PERSONNE, message: PERSONNE } }]],
    ["délai", [{ erreur: "delai", message: PERSONNE }, { erreur: "delai", message: PERSONNE }, { erreur: "delai", message: PERSONNE }]],
  ])("erreur %s : ni journal ni erreur ne contiennent l'identifiant", async (_n, reps) => {
    const { e, texte } = await tout(reps);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect(texte).not.toContain(PERSONNE);
  });
  it("refus de méthode : le message ne contient pas l'identifiant, sans réseau", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    const e = await client.requete({ methode: "POST", chemin: `/v1/accounts/exemple-compte-1/follow-status/${PERSONNE}`, corps: {} }).then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).message).not.toContain(PERSONNE);
    expect(faux.appels).toHaveLength(0);
  });
});
