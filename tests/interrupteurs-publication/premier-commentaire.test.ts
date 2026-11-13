/**
 * L5-07 · interrupteur « Premier commentaire » (réglage publication.premier_commentaire_coupe, sert UNIQUEMENT à couper).
 * Aucun appel réel : faux client Zernio. Fichiers de tests/zernio non modifiés (on réutilise seulement ses aides).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { CLE_PREMIER_COMMENTAIRE_COUPE } from "@/domaine/interrupteurs/registre";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { corpsPostZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "../zernio/aides/faux-zernio";

const NOW = Date.parse("2026-11-05T08:00:00Z");
const CLE = cleEnvoiPublication("video-exemple", "facebook", "2026-11-05T10:00:00Z", "exemple-compte-1:fb:111");
const base = (r: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "facebook", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1:fb:111", cleEnvoi: CLE, premierCommentaire: "Commentaire d'exemple", ...r });
const premier = (c: unknown) => (c as { platforms: { platformSpecificData?: { firstComment?: string } }[] }).platforms[0].platformSpecificData?.firstComment;

describe("corps : premierCommentaireCoupe", () => {
  const corps = (v: unknown, r: DemandeZernio = base()) => corpsPostZernio(r, { maintenant: NOW, ...(v === "ABSENT" ? {} : { premierCommentaireCoupe: v as boolean }) });
  const refTexte = JSON.stringify(corps("ABSENT"));
  it("absent, faux ou toute autre valeur que true = identique à aujourd'hui", () => {
    expect(premier(corps("ABSENT"))).toBe("Commentaire d'exemple");
    for (const v of [false, undefined, null, 0, 1, "true", "oui", {}, []]) expect(JSON.stringify(corps(v))).toBe(refTexte);
  });
  it("true = pas de premier commentaire (Facebook et LinkedIn), reste du corps identique", () => {
    expect(premier(corps(true))).toBeUndefined();
    const li = base({ reseau: "linkedin", cible: "exemple-compte-1:li:123" });
    expect(premier(corps("ABSENT", li))).toBe("Commentaire d'exemple");
    expect(premier(corps(true, li))).toBeUndefined();
    const sans = JSON.parse(refTexte);
    delete sans.platforms[0].platformSpecificData.firstComment;
    expect(JSON.parse(JSON.stringify(corps(true)))).toEqual(sans);
  });
  it("mutation prouvée : la condition est bien `=== true` (inverser la condition ferait échouer les tests ci-dessus)", () => {
    const src = readFileSync("src/fournisseurs/publication/zernio-corps.ts", "utf8");
    expect(src.match(/premierCommentaireCoupe === true/g)?.length).toBe(1);
    expect(src.match(/premierCommentaireCoupe/g)?.length).toBe(2); // champ + condition
  });
});

describe("fournisseur : lecture à chaque envoi, jamais bloquante", () => {
  const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
  const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
  const serveur = (a: AppelEnregistre): ReponsePreparee => {
    if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
    if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
    return { statut: 404, corps: {} };
  };
  const envoyer = async (lecture: (() => Promise<unknown>) | undefined) => {
    const t = creerFauxClientZernio(serveur);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant, ...(lecture ? { lirePremierCommentaireCoupe: lecture } : {}) });
    const r = await f.envoyer(base({ date: new Date(t.horloge.maintenant() + 3 * 3600_000).toISOString() }));
    const envoi = t.faux.appels.find((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
    return { r, commentaire: premier(envoi?.json) };
  };
  it("vrai : pas de premier commentaire dans l'envoi", async () => expect((await envoyer(async () => true)).commentaire).toBeUndefined());
  it("faux, absent, illisible : le premier commentaire part comme aujourd'hui", async () => {
    for (const v of [false, undefined, null, "true", 1]) expect((await envoyer(async () => v)).commentaire).toBe("Commentaire d'exemple");
  });
  it("lecture en échec (exception) : le premier commentaire part et la publication n'est pas bloquée", async () => {
    const e = await envoyer(async () => { throw new Error("base indisponible"); });
    expect(e.commentaire).toBe("Commentaire d'exemple");
    expect(e.r).toMatchObject({ idExterne: "exemple-post-9" });
  });
  it("lecture qui ne répond pas : la publication n'attend pas et le premier commentaire part", async () => {
    const debut = Date.now();
    const e = await envoyer(() => new Promise(() => undefined));
    expect(Date.now() - debut).toBeLessThan(5000);
    expect(e.commentaire).toBe("Commentaire d'exemple");
  });
  it("lue à chaque envoi", async () => {
    let n = 0;
    const lecture = async () => ++n === 1;
    expect((await envoyer(lecture)).commentaire).toBeUndefined();
    expect((await envoyer(lecture)).commentaire).toBe("Commentaire d'exemple");
  });
  it("le nom du réglage est celui de la fiche", () => expect(CLE_PREMIER_COMMENTAIRE_COUPE).toBe("publication.premier_commentaire_coupe"));
});
