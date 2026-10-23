/**
 * LOT R7 — corrections de la relecture SÉCURITÉ (`3042b94`, refus) : téléchargement d'une vidéo HeyGen.
 *  n° 1 : hôtes HeyGen seulement (https, port 443, jamais une IP en clair, DNS public), redirections revalidées et
 *         bornées ; n° 2 : taille annoncée exigée et plafonnée AVANT de lire le corps, octets relayés comptés ;
 *  n° 3 : signature vidéo (studio et studio-rendu).
 * Tout sur doublures : aucun appel réseau, aucun DNS réel, aucune clé.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copierEnFlux, hoteAutorise, ipNonPublique, plafondVideoHeygen, SAUTS_MAX, verifierAdresseHeygen, type Resoudre } from "@/fournisseurs/heygen/telechargement";
import { creerStockageR2 } from "@/fournisseurs/r2/stockage";
import { signatureVideo } from "@/lib/signature-video";
import { demultiplexeurPrise, optionsEntreePrise } from "../studio-rendu/src/entrees-video";
import { argumentsAssemblageVideo, assemblerFichiers } from "../studio-rendu/src/operations/assemblage";

const MP4 = (() => {
  const o = new Uint8Array(64);
  o.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return o;
})();
const M3U = new TextEncoder().encode("#EXTM3U\n#EXTINF:1,\nhttp://169.254.169.254/latest/meta-data\n");

/** DNS doublé : chaque nom → ses adresses (inconnu : une adresse publique de documentation). */
const dns = (table: Record<string, string[]> = {}): Resoudre => async (hote) => table[hote] ?? ["203.0.113.10"];

/** Réseau doublé : chaque appel est noté ; le dépôt LIT le corps (comme le ferait le stockage). */
function reseau(reponses: Record<string, () => Response>) {
  const appels: { methode: string; url: string; redirect?: string }[] = [];
  let recu = 0;
  const appeler = (async (url: string, init?: RequestInit) => {
    const methode = init?.method ?? "GET";
    appels.push({ methode, url: String(url), redirect: init?.redirect });
    if (methode === "PUT") {
      recu = (await new Response(init?.body).arrayBuffer()).byteLength;
      return new Response("", { status: 200 });
    }
    const r = reponses[String(url).split("?")[0]];
    return r ? r() : new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  return { appeler, appels, recu: () => recu, puts: () => appels.filter((a) => a.methode === "PUT") };
}

const DEPOT = "https://r2.exemple/studio/dev/rush/v/f.mp4?depot";
const SOURCE = "https://files2.heygen.ai/video/vid_001.mp4";
const video = (corps: Uint8Array<ArrayBuffer> = MP4, entetes: Record<string, string> = { "content-length": String(corps.byteLength) }) => () => new Response(corps, { status: 200, headers: entetes });
const saut = (vers: string, statut = 302) => () => new Response(null, { status: statut, headers: { location: vers } });

describe("n° 1 — adresses acceptées (PUR)", () => {
  it("liste blanche : le nom ou un sous-domaine, jamais un nom qui lui ressemble", () => {
    expect(hoteAutorise("files2.heygen.ai")).toBe(true);
    expect(hoteAutorise("resource2.heygen.com")).toBe(true);
    expect(hoteAutorise("heygen.ai")).toBe(true);
    expect(hoteAutorise("evilheygen.ai")).toBe(false);
    expect(hoteAutorise("heygen.ai.evil.exemple")).toBe(false);
    expect(hoteAutorise("files2.heygen.ai.")).toBe(true);
  });
  it("IP non publiques : privées, boucle locale, lien local, CGNAT, multidiffusion, IPv6 locales et transposées", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "pas-une-ip"]) expect(ipNonPublique(ip), ip).toBe(true);
    for (const ip of ["203.0.113.10", "8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) expect(ipNonPublique(ip), ip).toBe(false);
  });
  it("refusées : http, autre port, identifiants, IP en clair, hôte hors liste, DNS vers l'interne", async () => {
    for (const a of ["http://files2.heygen.ai/v.mp4", "https://files2.heygen.ai:8443/v.mp4", "https://moi:secret@files2.heygen.ai/v.mp4", "https://169.254.169.254/latest", "https://[::1]/v.mp4", "https://0x7f.0.0.1/v.mp4", "https://interne.exemple/v.mp4", "pas une adresse"]) {
      await expect(verifierAdresseHeygen(a, dns()), a).rejects.toMatchObject({ code: "refuse", message: expect.stringMatching(/adresse inattendue/) });
    }
    await expect(verifierAdresseHeygen(SOURCE, dns({ "files2.heygen.ai": ["10.0.0.5"] }))).rejects.toMatchObject({ code: "refuse" });
    await expect(verifierAdresseHeygen(SOURCE, dns({ "files2.heygen.ai": ["203.0.113.10", "127.0.0.1"] }))).rejects.toMatchObject({ code: "refuse" });
    await expect(verifierAdresseHeygen(SOURCE, dns())).resolves.toBeInstanceOf(URL);
    // Une IP écrite en clair est refusée même si elle figurait par erreur dans la liste.
    for (const a of ["https://203.0.113.10/v.mp4", "https://[2606:4700::1111]/v.mp4"]) {
      await expect(verifierAdresseHeygen(a, dns(), ["203.0.113.10", "2606:4700::1111", "[2606:4700::1111]"]), a).rejects.toMatchObject({ code: "refuse" });
    }
  });
});

describe("n° 1 — copie : aucun appel hors liste, chaque saut revalidé", () => {
  it("ROUGE — hôte hors liste : refus, AUCUN appel (ni lecture ni dépôt)", async () => {
    const r = reseau({ "https://interne.exemple/v.mp4": video() });
    await expect(copierEnFlux("https://interne.exemple/v.mp4", DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() })).rejects.toMatchObject({ code: "refuse" });
    expect(r.appels).toEqual([]);
  });

  it("ROUGE — DNS de l'hôte HeyGen vers une adresse privée : refus, aucun appel", async () => {
    const r = reseau({ [SOURCE]: video() });
    await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns({ "files2.heygen.ai": ["192.168.0.10"] }) })).rejects.toMatchObject({ code: "refuse" });
    expect(r.appels).toEqual([]);
  });

  it("ROUGE — 302 vers une IP privée (métadonnées du nuage) : refus, le saut n'est PAS suivi, rien déposé", async () => {
    for (const cible of ["http://169.254.169.254/latest/meta-data/", "https://10.0.0.8/interne", "http://coolify:8000/api"]) {
      const r = reseau({ [SOURCE]: saut(cible), [cible]: video() });
      await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() }), cible).rejects.toMatchObject({ code: "refuse" });
      expect(r.appels.map((a) => a.url)).toEqual([SOURCE]);
      expect(r.appels[0].redirect).toBe("manual");
    }
  });

  it("ROUGE — 307 vers un hôte HeyGen dont le DNS pointe vers l'interne : refus, rien déposé", async () => {
    const cible = "https://files3.heygen.ai/v.mp4";
    const r = reseau({ [SOURCE]: saut(cible, 307), [cible]: video() });
    await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns({ "files3.heygen.ai": ["127.0.0.1"] }) })).rejects.toMatchObject({ code: "refuse" });
    expect(r.appels.map((a) => a.url)).toEqual([SOURCE]);
  });

  it("une redirection vers un autre hôte HeyGen public est suivie (revalidée) ; trop de sauts : refus", async () => {
    const cible = "https://resource2.heygen.ai/v.mp4";
    const r = reseau({ [SOURCE]: saut("https://resource2.heygen.ai/v.mp4?sig=1", 301), [cible]: video() });
    expect(await copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() })).toBe(64);
    expect(r.appels.map((a) => `${a.methode} ${a.url.split("?")[0]} ${a.redirect ?? ""}`.trim())).toEqual([`GET ${SOURCE} manual`, `GET ${cible} manual`, `PUT ${DEPOT.split("?")[0]}`]);
    // Boucle de redirections : bornée.
    const boucle = reseau({ [SOURCE]: saut(SOURCE) });
    await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: boucle.appeler, resoudre: dns() })).rejects.toMatchObject({ code: "refuse" });
    expect(boucle.appels).toHaveLength(SAUTS_MAX + 1);
    expect(boucle.puts()).toEqual([]);
  });
});

describe("n° 2 — taille : annoncée, plafonnée, comptée ; jamais lue en entier en mémoire", () => {
  /** Corps qui note s'il a été lu. */
  function corpsSurveille() {
    const etat = { lu: false };
    const flux = new ReadableStream<Uint8Array>({
      pull(c) {
        etat.lu = true;
        c.enqueue(MP4);
        c.close();
      },
    }, { highWaterMark: 0 }); // rien n'est tiré tant que personne ne lit
    return { etat, flux };
  }

  it("ROUGE — sans taille annoncée : refus AVANT de lire le corps, aucun dépôt", async () => {
    const { etat, flux } = corpsSurveille();
    const r = reseau({ [SOURCE]: () => new Response(flux, { status: 200 }) });
    await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() })).rejects.toMatchObject({ code: "refuse", message: expect.stringMatching(/n'annonce pas la taille/) });
    expect(etat.lu).toBe(false);
    expect(r.puts()).toEqual([]);
  });

  it("ROUGE — taille annoncée au-delà du plafond (ou illisible) : refus AVANT de lire le corps, aucun dépôt", async () => {
    for (const taille of [String(3 * 1024 * 1024 * 1024), "0", "-5", "64, 64", "abc"]) {
      const { etat, flux } = corpsSurveille();
      const r = reseau({ [SOURCE]: () => new Response(flux, { status: 200, headers: { "content-length": taille } }) });
      await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns(), plafond: 2 * 1024 * 1024 * 1024 }), taille).rejects.toMatchObject({ code: "refuse" });
      expect(etat.lu, taille).toBe(false);
      expect(r.puts(), taille).toEqual([]);
    }
    // Plafond par défaut : 2 048 Mo ; réglable par HEYGEN_VIDEO_MAX_MO.
    expect(plafondVideoHeygen({})).toBe(2048 * 1024 * 1024);
    expect(plafondVideoHeygen({ HEYGEN_VIDEO_MAX_MO: "500" })).toBe(500 * 1024 * 1024);
    expect(plafondVideoHeygen({ HEYGEN_VIDEO_MAX_MO: "beaucoup" })).toBe(2048 * 1024 * 1024);
  });

  it("ROUGE — corps plus long qu'annoncé : la copie s'arrête, refus", async () => {
    const r = reseau({ [SOURCE]: video(new Uint8Array(128), { "content-length": "64" }) });
    await expect(copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() })).rejects.toMatchObject({ message: expect.stringMatching(/plus lourde qu'annoncé/) });
  });

  it("nominal : le corps est relayé EN FLUX, la taille renvoyée est celle réellement relayée", async () => {
    const r = reseau({ [SOURCE]: video() });
    expect(await copierEnFlux(SOURCE, DEPOT, "video/mp4", { appeler: r.appeler, resoudre: dns() })).toBe(64);
    expect(r.recu()).toBe(64);
  });
});

describe("n° 3 — signature vidéo (studio et studio-rendu)", () => {
  const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0, 0, 0]);
  it("ftyp (MP4/MOV) et Matroska/WebM reconnus ; liste de lecture, texte, vide : refusés", () => {
    expect(signatureVideo(MP4)).toBe("iso-bmff");
    expect(signatureVideo(WEBM)).toBe("matroska");
    expect(signatureVideo(M3U)).toBeNull();
    expect(signatureVideo(new Uint8Array(0))).toBeNull();
    expect(demultiplexeurPrise(MP4)).toBe("mov");
    expect(demultiplexeurPrise(WEBM)).toBe("matroska");
    expect(demultiplexeurPrise(M3U)).toBeNull();
  });

  it("ROUGE — studio-rendu : prise « #EXTM3U » nommée .mp4 refusée ; une vraie prise est rouverte en fichier local, format imposé", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "r7-prise-"));
    writeFileSync(join(dossier, "piege.mp4"), M3U);
    writeFileSync(join(dossier, "prise.mp4"), MP4);
    writeFileSync(join(dossier, "prise.webm"), WEBM);
    await expect(optionsEntreePrise(join(dossier, "piege.mp4"))).rejects.toMatchObject({ message: expect.stringMatching(/pas une vidéo reconnue/) });
    expect(await optionsEntreePrise(join(dossier, "prise.mp4"))).toEqual(["-protocol_whitelist", "file", "-f", "mov"]);
    expect(await optionsEntreePrise(join(dossier, "prise.webm"))).toEqual(["-protocol_whitelist", "file", "-f", "matroska"]);
    const args = argumentsAssemblageVideo(["a.mp4", "b.webm"], [{ entree: "a", deSec: 0, aSec: 1 }, { entree: "b", deSec: 0, aSec: 1 }], { largeur: 1080, hauteur: 1920, fps: 25 }, 12, "sortie.mp4", [["-protocol_whitelist", "file", "-f", "mov"], ["-protocol_whitelist", "file", "-f", "matroska"]]);
    expect(args.slice(3, 15)).toEqual(["-protocol_whitelist", "file", "-f", "mov", "-i", "a.mp4", "-protocol_whitelist", "file", "-f", "matroska", "-i", "b.webm"]);
    // L'assemblage des prises refuse le piège AVANT de lancer FFmpeg.
    await expect(assemblerFichiers({ a: join(dossier, "piege.mp4") }, { sortie: "mp4", morceaux: [{ entree: "a", deSec: 0, aSec: 1 }], video: { largeur: 1080, hauteur: 1920, fps: 25 } }, dossier)).rejects.toMatchObject({ message: expect.stringMatching(/pas une vidéo reconnue/) });
  });
});

describe("stockage R2 : lecture du début, effacement, taille confirmée (doublé, sans réseau)", () => {
  it("lecture PARTIELLE (Range) bornée ; DELETE signé ; HEAD donne la taille réelle", async () => {
    const appels: { methode: string; url: string; range?: string }[] = [];
    const appeler = (async (url: string, init?: RequestInit) => {
      const methode = init?.method ?? "GET";
      appels.push({ methode, url: String(url), range: (init?.headers as Record<string, string> | undefined)?.range });
      if (methode === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "4096" } });
      if (methode === "DELETE") return new Response(null, { status: 204 });
      return new Response(new Uint8Array(1000).fill(7), { status: 206 });
    }) as unknown as typeof fetch;
    const s = creerStockageR2({ compte: "c", cleAcces: "a", secret: "s", seau: "seau", hote: "c.r2.cloudflarestorage.com", env: "dev" }, { fetch: appeler });
    const debut = await s.lireDebut!("studio/dev/rush/v/f.mp4", 16);
    expect(debut.byteLength).toBe(16);
    expect(appels[0]).toMatchObject({ methode: "GET", range: "bytes=0-15" });
    expect(await s.confirmerDepot("studio/dev/rush/v/f.mp4")).toEqual({ ok: true, taille: 4096 });
    await s.supprimer!("studio/dev/rush/v/f.mp4");
    expect(appels.at(-1)!.methode).toBe("DELETE");
    expect(appels.at(-1)!.url).toMatch(/^https:\/\/c\.r2\.cloudflarestorage\.com\/seau\/studio\/dev\/rush\/v\/f\.mp4\?/);
  });
});
