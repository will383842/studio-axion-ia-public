/**
 * FIX-LINKEDIN · deux comptes LinkedIn de Zernio exposent la MÊME organisation (Zernio simulé, clé fictive, fetch interdit).
 * Compte A « Organisation Exemple » (type organisation) ; compte B « Personne Exemple » (profil personnel). Données génériques.
 */
import { describe, expect, it, vi } from "vitest";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { ciblesZernioPour, traduireSelectionVersZernio } from "@/services/zernio-cibles";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import type { CanalPublication } from "@/fournisseurs/types";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const A = "exemple-compte-a";
const B = "exemple-compte-b";
const ORG = "111222333";
const NOM = "Organisation Exemple";
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const CLE = cleEnvoiPublication("video-exemple", "linkedin", "2026-11-05T10:00:00Z", "exemple");

function monter(orgsDe: (id: string) => { id: string; localizedName: string }[] = () => [{ id: ORG, localizedName: NOM }], comptes: Record<string, unknown>[] = [
  { _id: A, platform: "linkedin", displayName: NOM, accountType: "organization" },
  { _id: B, platform: "linkedin", displayName: "Personne Exemple", accountType: "personal" },
]) {
  const serveur = (a: AppelEnregistre): ReponsePreparee => {
    if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: comptes } };
    const m = /accounts\/([^/]+)\/linkedin-organizations$/.exec(a.url);
    if (m) return { statut: 200, corps: { organizations: orgsDe(m[1]) } };
    if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
    if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
    return { statut: 404, corps: {} };
  };
  const t = creerFauxClientZernio(serveur);
  return { ...t, f: creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire: async () => ({ corps: flux(), taille: 1 }), maintenant: t.horloge.maintenant }) };
}
const canalBuffer = (id: string, nom: string): CanalPublication => ({ id, organisationId: "org-buffer", nom, service: "linkedin", deconnecte: false });

describe("FIX-LINKEDIN · un seul canal par organisation", () => {
  it("2 comptes exposent la même organisation : un canal organisation (compte A) + un canal profil distinct (B)", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
    const { f } = monter();
    const canaux = await f.listerCanaux!();
    expect(canaux.filter((c) => c.genre === "page").map((c) => c.id)).toEqual([`${A}:li:${ORG}`]);
    expect(canaux.filter((c) => c.genre === "profile").map((c) => c.id)).toEqual([`${B}:li:profil`]);
    expect(canaux).toHaveLength(2);
  });

  it("la présélection par le nom de l'organisation se traduit en UN canal (plus de CIBLE_AMBIGUE)", async () => {
    const { f } = monter();
    const traduit = await traduireSelectionVersZernio(f, "linkedin", ["buf-o"], [canalBuffer("buf-o", NOM)]);
    expect(traduit).toEqual([`${A}:li:${ORG}`]);
    const r = await ciblesZernioPour(f, "linkedin", traduit);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual([`${A}:li:${ORG}`]);
  });

  it("rien de choisi : l'organisation par défaut, jamais le profil personnel", async () => {
    const { f } = monter();
    const r = await ciblesZernioPour(f, "linkedin", undefined);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual([`${A}:li:${ORG}`]);
  });

  it("le profil personnel n'est ciblé que sur choix explicite", async () => {
    const { f } = monter();
    const r = await ciblesZernioPour(f, "linkedin", [`${B}:li:profil`]);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual([`${B}:li:profil`]);
  });

  it("rien de choisi et plusieurs organisations : refus, jamais de choix au hasard", async () => {
    const { f } = monter((id) => [{ id: id === A ? ORG : "999888777", localizedName: id === A ? NOM : "Autre Organisation" }]);
    const r = await ciblesZernioPour(f, "linkedin", undefined);
    expect(r.ok).toBe(false);
  });

  it("deux VRAIES organisations homonymes d'identifiants différents : refus avec le message nommé", async () => {
    const comptes = [
      { _id: A, platform: "linkedin", displayName: "Compte A", accountType: "organization" },
      { _id: B, platform: "linkedin", displayName: "Compte B", accountType: "organization" },
    ];
    const { f } = monter((id) => [{ id: id === A ? ORG : "999888777", localizedName: NOM }], comptes);
    const traduit = await traduireSelectionVersZernio(f, "linkedin", ["buf-o"], [canalBuffer("buf-o", NOM)]);
    const r = await ciblesZernioPour(f, "linkedin", traduit);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("Plusieurs comptes de l'outil de publication portent le nom");
  });

  it("même organisation vue par deux comptes sans pouvoir trancher : refus, les deux canaux restent", async () => {
    const comptes = [
      { _id: A, platform: "linkedin", displayName: "Compte A", accountType: "organization" },
      { _id: B, platform: "linkedin", displayName: "Compte B", accountType: "organization" },
    ];
    const { f } = monter(() => [{ id: ORG, localizedName: NOM }], comptes);
    expect((await f.listerCanaux!()).filter((c) => c.genre === "page")).toHaveLength(2);
  });

  it("le corps d'envoi cible compte A + organisation, en brouillon", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer({ reseau: "linkedin", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: `${A}:li:${ORG}`, cleEnvoi: CLE });
    expect(r.statut).toBe("brouillon");
    const p = faux.appels.find((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"))!;
    expect(p.json).toMatchObject({ isDraft: true, platforms: [{ platform: "linkedin", accountId: A, platformSpecificData: { organizationUrn: `urn:li:organization:${ORG}` } }] });
    expect(p.corps).not.toMatch(/publishNow/);
  });
});
