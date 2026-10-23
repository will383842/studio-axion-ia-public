/**
 * LOT M1b — conteneur `studio-rendu`, testé en local avec Node (sans Docker, sans Remotion) :
 * file courte prioritaire, un seul montage à la fois, idempotence, délai maximal, 404 après redémarrage,
 * serveur HTTP, et concordance du contrat avec celui du studio.
 */
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { DemandeRendu as DemandeStudio, EtatRendu as EtatStudio } from "@/fournisseurs";
import { creerServiceRenduHttp, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, EtatRendu, Operation } from "../studio-rendu/src/contrat";
import { verifierDemande } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { creerServeur } from "../studio-rendu/src/serveur";
import { lireProbe } from "../studio-rendu/src/operations/analyse-media";

// Concordance des deux copies du contrat (vérifiée à la compilation).
const _aller: DemandeStudio = {} as DemandeRendu;
const _retour: DemandeRendu = {} as DemandeStudio;
const _etat: EtatStudio = {} as EtatRendu;
void [_aller, _retour, _etat];

function demande(id: string, file: "courte" | "longue", operation: DemandeRendu["operation"] = file === "courte" ? "analyse-media" : "composition"): DemandeRendu {
  return { idRendu: id, operation, file, entrees: { media: "https://r2/x" }, sortie: { urlDepot: "https://r2/depot", cle: `sorties/${id}` }, parametres: {} };
}

/** Opération pilotée à la main : chaque appel attend qu'on le relâche. */
function operationManuelle() {
  const enAttente = new Map<string, () => void>();
  const ordre: string[] = [];
  let enCours = 0;
  let maxSimultanes = 0;
  const op: Operation = (d, ctx) =>
    new Promise((ok) => {
      ordre.push(d.idRendu);
      enCours++;
      maxSimultanes = Math.max(maxSimultanes, enCours);
      ctx.progression(50);
      enAttente.set(d.idRendu, () => {
        enCours--;
        ok({ mesures: { duree: 1 } });
      });
    });
  return { op, ordre, relacher: (id: string) => enAttente.get(id)?.(), max: () => maxSimultanes };
}

const dossierFactice = async () => "inexistant";
// 30 ms (au lieu de 5) : sur une machine chargée (rendu en cours), un tour de la file peut dépasser 5 ms.
const attendreTour = () => new Promise((r) => setTimeout(r, 30));

describe("files de studio-rendu", () => {
  it("un seul montage à la fois ; la file courte passe devant les montages en attente", async () => {
    const longue = operationManuelle();
    const courte = operationManuelle();
    const files = new FilesRendu({ operations: { composition: longue.op, "analyse-media": courte.op }, creerDossier: dossierFactice });
    files.soumettre(demande("m1", "longue"));
    files.soumettre(demande("m2", "longue"));
    files.soumettre(demande("c1", "courte"));
    await attendreTour();
    expect(longue.ordre).toEqual(["m1"]);
    expect(files.etat("m2")).toEqual({ statut: "en_file", rang: 1 });
    expect(files.etat("m1")).toEqual({ statut: "en_cours", progression: 50 });
    // Le travail court part tout de suite, à côté du montage en cours.
    expect(courte.ordre).toEqual(["c1"]);
    // Un second travail court arrive pendant que m1 tourne : m2 attend derrière lui.
    files.soumettre(demande("c2", "courte"));
    files.soumettre(demande("c3", "courte"));
    await attendreTour();
    expect(courte.ordre).toEqual(["c1", "c2"]); // 2 travaux courts au plus en parallèle
    expect(files.etat("c3")).toEqual({ statut: "en_file", rang: 1 });
    expect(files.etat("m2")).toEqual({ statut: "en_file", rang: 2 }); // derrière c3
    longue.relacher("m1");
    await attendreTour();
    // m1 fini, mais c3 attend encore : m2 ne part pas avant lui.
    expect(longue.ordre).toEqual(["m1"]);
    courte.relacher("c1");
    await attendreTour();
    expect(courte.ordre).toEqual(["c1", "c2", "c3"]);
    expect(longue.ordre).toEqual(["m1", "m2"]);
    courte.relacher("c2");
    courte.relacher("c3");
    longue.relacher("m2");
    await files.inactif();
    expect(longue.max()).toBe(1);
    expect(files.etat("m2")).toEqual({ statut: "termine", sortieCle: "sorties/m2", mesures: { duree: 1 } });
  });

  it("idempotent sur idRendu ; un échec peut être soumis à nouveau ; opération absente refusée clairement", async () => {
    let appels = 0;
    const files = new FilesRendu({
      operations: {
        "analyse-media": async () => {
          appels++;
          if (appels === 1) throw new Error("ffprobe a échoué");
          return {};
        },
      },
      creerDossier: dossierFactice,
    });
    files.soumettre(demande("a", "courte"));
    files.soumettre(demande("a", "courte"));
    await files.inactif();
    expect(appels).toBe(1);
    expect(files.etat("a")).toMatchObject({ statut: "echec", erreur: { reessayable: true } });
    expect(files.soumettre(demande("a", "courte")).nouveau).toBe(true);
    await files.inactif();
    expect(files.etat("a")).toMatchObject({ statut: "termine" });
    files.soumettre(demande("t", "courte", "tranches-audio"));
    await files.inactif();
    expect(files.etat("t")).toMatchObject({ statut: "echec", erreur: { code: "refuse", reessayable: false } });
  });

  it("délai maximal de la file courte : le travail est arrêté et marqué en échec réessayable", async () => {
    let interrompu = false;
    const files = new FilesRendu({
      operations: {
        "analyse-media": (_d, ctx) =>
          new Promise((ok) => {
            ctx.signal.addEventListener("abort", () => {
              interrompu = true;
              ok({});
            });
          }),
      },
      delaiCourteMs: 20,
      creerDossier: dossierFactice,
    });
    files.soumettre(demande("lent", "courte"));
    await files.inactif();
    expect(interrompu).toBe(true);
    expect(files.etat("lent")).toMatchObject({ statut: "echec", erreur: { code: "indisponible", reessayable: true } });
  });

  it("rien n'est gardé après 24 h ; après un redémarrage, tout est inconnu", async () => {
    let maintenant = 0;
    const files = new FilesRendu({ operations: { "analyse-media": async () => ({}) }, horloge: () => maintenant, creerDossier: dossierFactice });
    files.soumettre(demande("x", "courte"));
    await files.inactif();
    maintenant = 25 * 3600_000;
    files.soumettre(demande("y", "courte"));
    expect(files.etat("x")).toBeNull();
    expect(new FilesRendu({ operations: {} }).etat("y")).toBeNull();
  });

  it("validation des demandes", () => {
    expect(verifierDemande(demande("ok", "courte"))).toBeNull();
    expect(verifierDemande({ ...demande("ok", "courte"), operation: "rm -rf" })).toBe("opération inconnue");
    expect(verifierDemande({ ...demande("../x", "courte") })).toBe("idRendu invalide");
    expect(verifierDemande({ ...demande("ok", "courte"), entrees: { media: "file:///etc/passwd" } })).toBe("entrée invalide");
  });

  it("lecture ffprobe : vertical, cadence, HDR (HLG) repéré, rotation", () => {
    const m = lireProbe(JSON.stringify({ streams: [{ codec_type: "video", width: 3840, height: 2160, r_frame_rate: "25/1", color_transfer: "arib-std-b67", side_data_list: [{ rotation: -90 }] }, { codec_type: "audio" }], format: { duration: "182.4", size: "1500000000" } }));
    expect(m).toMatchObject({ largeur: 2160, hauteur: 3840, vertical: 1, fps: 25, hdr: 1, audio: 1, dureeSec: 182.4 });
  });

  it("lecture ffprobe : iPhone HDR (HLG BT.2020 10 bits, Dolby Vision 8.4) détaillé ; SDR sans HDR", () => {
    const iphone = { codec_type: "video", width: 1080, height: 1920, r_frame_rate: "30/1", pix_fmt: "yuv420p10le", color_transfer: "arib-std-b67", color_primaries: "bt2020", side_data_list: [{ dv_profile: 8 }] };
    expect(lireProbe(JSON.stringify({ streams: [iphone], format: {} }))).toMatchObject({ hdr: 1, hlg: 1, pq: 0, bt2020: 1, dolbyVision: 8, bits10: 1 });
    const sdr = { codec_type: "video", width: 1080, height: 1920, pix_fmt: "yuv420p", color_transfer: "bt709", color_primaries: "bt709" };
    expect(lireProbe(JSON.stringify({ streams: [sdr], format: {} }))).toMatchObject({ hdr: 0, hlg: 0, pq: 0, bt2020: 0, dolbyVision: 0, bits10: 0 });
  });
});

describe("serveur HTTP de studio-rendu + client du studio", () => {
  let fermer: (() => void) | undefined;
  afterEach(() => fermer?.());

  async function demarrer(cle?: string) {
    const files = new FilesRendu({ operations: { "analyse-media": async () => ({ mesures: { dureeSec: 12 } }) }, creerDossier: dossierFactice });
    const serveur = creerServeur(files, { cle });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    fermer = () => serveur.close();
    return { base: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`, files };
  }

  it("POST /rendus répond tout de suite, GET /rendus/{id} suit, 404 si inconnu, /sante répond", async () => {
    const { base, files } = await demarrer();
    const client = creerServiceRenduHttp(base);
    expect(await client.soumettre(demande("r1", "courte"))).toEqual({ idRendu: "r1" });
    await files.inactif();
    expect(await client.etat("r1")).toEqual({ statut: "termine", sortieCle: "sorties/r1", mesures: { dureeSec: 12 } });
    expect(await client.etat("jamais")).toEqual({ statut: "inconnu" });
    expect((await fetch(`${base}/sante`)).status).toBe(200);
    const mauvais = await fetch(`${base}/rendus`, { method: "POST", body: "{pas du json" });
    expect(mauvais.status).toBe(400);
    await expect(creerServiceRenduHttp(base).soumettre({ ...demande("r2", "courte"), operation: "inconnue" as never })).rejects.toMatchObject({ reessayable: false });
  });

  it("redémarrage du conteneur : le rendu connu répond 404, le client le soumet à nouveau avec le même idRendu", async () => {
    const premier = await demarrer();
    const client1 = creerServiceRenduHttp(premier.base);
    await client1.soumettre(demande("r-redemarre", "courte"));
    fermer!();
    // Nouveau processus : nouvelles files, vides.
    const second = await demarrer();
    const client2 = creerServiceRenduHttp(second.base);
    const etat = await suivreRendu(client2, demande("r-redemarre", "courte"));
    expect(etat).toMatchObject({ statut: "en_file", resoumis: true });
    await second.files.inactif();
    expect(await client2.etat("r-redemarre")).toMatchObject({ statut: "termine", sortieCle: "sorties/r-redemarre" });
  });

  it("clé partagée : sans elle, 401", async () => {
    const { base } = await demarrer("cle-interne");
    await expect(creerServiceRenduHttp(base).soumettre(demande("k", "courte"))).rejects.toMatchObject({ reessayable: false });
    expect(await creerServiceRenduHttp(base, { cle: "cle-interne" }).soumettre(demande("k", "courte"))).toEqual({ idRendu: "k" });
    expect((await fetch(`${base}/sante`)).status).toBe(200);
  });
});
