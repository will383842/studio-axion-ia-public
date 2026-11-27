/** RAP-1 · décision PURE du rapatriement : aucun réseau, aucun dépôt. Identifiants fictifs. */
import { describe, expect, it } from "vitest";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { cleRapatriement, compterEcart, deciderRapatriement, estConnu, reseauDepuisPlateforme, type ConnusLocaux } from "@/domaine/rapatriement-zernio";

const VIDE: ConnusLocaux = { idsExternes: new Set(), clesEnvoi: new Set(), clesCreneaux: new Set() };
const INSTANT = "2026-11-20T10:00:00.000Z";
const post = (n: number, partiel: Partial<PostZernio> = {}): PostZernio => ({
  _id: `post-fictif-${n}`,
  content: `Texte fictif ${n}`,
  status: "scheduled",
  scheduledFor: `2026-11-2${n}T08:30:00.000Z`,
  platforms: [{ platform: "instagram", accountId: "compte-fictif-1", status: "scheduled" }],
  mediaItems: [{ type: "image", url: "https://exemple.invalid/x.png" }],
  metadata: { origine: "import-buffer", bufferId: `buf-${n}`, studioCle: `imp-fictive-${n}` },
  ...partiel,
});
const trois = [post(1), post(2), post(3)];

describe("RAP-1 · deciderRapatriement", () => {
  it("3 posts programmés inconnus → 3 publications à créer, sans vidéo ni visuel", () => {
    const d = deciderRapatriement(trois, VIDE, { instant: INSTANT });
    expect(d.aCreer).toHaveLength(3);
    expect(d.connus).toBe(0);
    expect(d.ecarts).toEqual([]);
    expect(d.aCreer[0]).toMatchObject({
      id: cleRapatriement("post-fictif-1", "compte-fictif-1"),
      via: "zernio",
      idExterne: "post-fictif-1",
      statut: "programmee",
      date: "2026-11-21T08:30:00.000Z",
      reseau: "instagram",
      canalId: "compte-fictif-1",
      cleEnvoi: "imp-fictive-1",
      texte: "Texte fictif 1",
      etatEnvoi: "envoye",
      origineDiffuseur: "import-buffer",
      rapatrieeLe: INSTANT,
      envoiCommenceLe: INSTANT,
      etatLuLe: INSTANT,
      mediaDiffuseur: { type: "image", nombre: 1 },
    });
    for (const p of d.aCreer) {
      expect(p.videoId).toBeUndefined();
      expect(p.visuelId).toBeUndefined();
    }
  });

  it("un post connu (idExterne, cleEnvoi ou clé d'un envoi planifié) n'est jamais recréé", () => {
    const c: ConnusLocaux = { idsExternes: new Set(["post-fictif-1"]), clesEnvoi: new Set(["imp-fictive-2"]), clesCreneaux: new Set(["imp-fictive-3"]) };
    const d = deciderRapatriement(trois, c, { instant: INSTANT });
    expect(d.aCreer).toEqual([]);
    expect(d.connus).toBe(3);
    expect(trois.map((p) => estConnu(p, c))).toEqual([true, true, true]);
  });

  it("brouillon → statut brouillon ; sans date → écart « sans-date » ; plateforme inconnue → écart « reseau-inconnu »", () => {
    const d = deciderRapatriement(
      [post(1, { status: "draft" }), post(2, { scheduledFor: undefined }), post(3, { platforms: [{ platform: "threads", accountId: "c", status: "scheduled" }] })],
      VIDE,
      { instant: INSTANT },
    );
    expect(d.aCreer.map((p) => p.statut)).toEqual(["brouillon"]);
    expect(d.ecarts).toEqual([
      { postId: "post-fictif-2", raison: "sans-date" },
      { postId: "post-fictif-3", raison: "reseau-inconnu" },
    ]);
  });

  it("une plateforme sans correspondance n'est JAMAIS jetée en silence : elle compte dans l'écart", () => {
    const e = compterEcart([post(1, { platforms: [{ platform: "threads", accountId: "c" }] })], VIDE);
    expect(e.chezDiffuseur).toBe(1);
    expect(e.absents).toEqual([{ postId: "post-fictif-1", raison: "reseau-inconnu" }]);
  });

  it("idempotence : rejouée avec les publications du premier tour comme connues, aucune création", () => {
    const premier = deciderRapatriement(trois, VIDE, { instant: INSTANT });
    const connus: ConnusLocaux = { idsExternes: new Set(premier.aCreer.map((p) => p.idExterne!)), clesEnvoi: new Set(), clesCreneaux: new Set() };
    const second = deciderRapatriement(trois, connus, { instant: INSTANT });
    expect(second.aCreer).toEqual([]);
    expect(second.connus).toBe(3);
  });

  it("un post à deux plateformes donne deux publications d'identifiants distincts", () => {
    const p = post(1, { platforms: [{ platform: "instagram", accountId: "compte-a" }, { platform: "facebook", accountId: { _id: "compte-b" } }] });
    const d = deciderRapatriement([p], VIDE, { instant: INSTANT, nomsComptes: new Map([["compte-b", "Page fictive"]]) });
    expect(d.aCreer.map((x) => x.id)).toEqual(["zr_post-fictif-1_compte-a", "zr_post-fictif-1_compte-b"]);
    expect(d.aCreer.map((x) => x.reseau)).toEqual(["instagram", "facebook"]);
    expect(d.aCreer[1].canalNom).toBe("Page fictive");
    expect(d.aCreer[0].canalNom).toBeUndefined();
  });

  it("origine « externe » quand le post n'a pas de métadonnées du Studio ; pas de cleEnvoi sans studioCle", () => {
    const d = deciderRapatriement([post(1, { metadata: undefined })], VIDE, { instant: INSTANT });
    expect(d.aCreer[0].origineDiffuseur).toBe("externe");
    expect(d.aCreer[0].cleEnvoi).toBeUndefined();
  });

  it("texte : le contenu propre à la plateforme prime", () => {
    const d = deciderRapatriement([post(1, { platforms: [{ platform: "linkedin", accountId: "c", customContent: "Version LinkedIn" }] })], VIDE, { instant: INSTANT });
    expect(d.aCreer[0].texte).toBe("Version LinkedIn");
  });
});

describe("RAP-1 · correspondance plateforme → réseau (celle du code d'envoi, à l'envers)", () => {
  it("YouTube chez le diffuseur = youtube-shorts, comme le code d'envoi", () => {
    expect(reseauDepuisPlateforme("youtube")).toBe("youtube-shorts");
    expect(reseauDepuisPlateforme("threads")).toBeNull();
  });
  it("cohérente avec plateformeZernio pour tout réseau porté", () => {
    for (const r of ["instagram", "facebook", "linkedin", "tiktok", "youtube-shorts"] as const) expect(reseauDepuisPlateforme(plateformeZernio(r))).toBe(r);
  });
});
