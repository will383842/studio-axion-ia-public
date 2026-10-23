/**
 * FACE CAMÉRA ANIMÉE — CORRECTIFS DE L'ESSAI RÉEL DE WILL (17/10/2026).
 *  1. visible dans l'interface connectée (grille « Nouvelle vidéo », menu latéral) avec une pastille « Essai », jamais grisé ;
 *  2. envoi par morceaux RÉSISTANT (partagé par tous les formats) : faux serveur qui répond 503 puis 200, coupure au milieu, reprise au
 *     bon morceau, au moins 3 minutes de nouveaux essais, phrases exactes (pas commencé / interrompu à X % / refusé) ;
 *  3. plusieurs prises d'un coup : une vidéo par prise, toutes mises en file, aucune perdue (doubles du studio) ;
 *  4. petits points : extension en majuscules, prise horizontale recadrée en vertical sur le visage (vrai FFmpeg), phrase à l'écran.
 * AUCUN appel réseau.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BarreLaterale } from "@/components/coquille/BarreLaterale";
import { CarteFormat } from "@/components/ui/CarteFormat";
import { consigneDepart, estVideoAcceptee, etatPrise, libelleAnimer, phraseOrientation, pretesALancer, prochaineAEnvoyer, trierDepot, type Prise } from "@/components/formats/facecam-animee/prises";
import type { MotHorodate } from "@/domaine/types";
import { listerFormats, obtenirFormat } from "@/formats";
import {
  avecReprises,
  cleReprise,
  CoupurePassagere,
  DUREE_REPRISES_MS,
  envoyerFichier,
  ErreurEnvoi,
  MO,
  phraseAttente,
  RefusEnvoi,
  statutPassager,
  typeDuFichier,
  type AttenteEnvoi,
} from "@/lib/envoi-multipart";
import { phraseLisible } from "@/lib/erreur-lisible";
import { avancerChaineV4, EnCoursChaineV4, entreeRealisateurV4, etatInitialV4, priseHorizontale, recadrageVerticalV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { filtreMontageV4, lireParametresFacecamV4, PRISE_MONTEE_V4 } from "../../studio-rendu/src/operations/facecam-v4";

vi.mock("next/navigation", () => ({ usePathname: () => "/videos", useRouter: () => ({ push: () => undefined }) }));

const RACINE = join(__dirname, "..", "..");
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/* ------------------------------------------------------------------ */
/* 1. Visible dans l'interface connectée                                */
/* ------------------------------------------------------------------ */

describe("Essai réel · 1. visible pour Will (grille et menu), pastille « Essai », jamais grisé", () => {
  const fa = obtenirFormat("facecam-animee");

  it("format toujours actif et réservé à Will (accord d'essai exigé : `reserveAWill` gardé)", () => {
    expect(fa.statut).toBe("actif");
    expect(fa.reserveAWill).toBe(true);
  });

  it("liste de l'interface connectée : présent ; liste publique (idées, prix…) : toujours absent", () => {
    expect(listerFormats({ inclureReservesAWill: true }).map((f) => f.id)).toContain("facecam-animee");
    expect(listerFormats().map((f) => f.id)).not.toContain("facecam-animee");
    // Les formats « bientôt » restent dans les deux listes (grisés par la PR #338), les masqués dans aucune.
    const bientot = listerFormats().filter((f) => f.statut === "bientot").map((f) => f.id);
    expect(listerFormats({ inclureReservesAWill: true }).filter((f) => f.statut === "bientot").map((f) => f.id)).toEqual(bientot);
    expect(listerFormats({ inclureReservesAWill: true }).some((f) => f.statut === "masque")).toBe(false);
  });

  it("le service des compteurs (grille + menu) le donne marqué `essai`", () => {
    const src = readFileSync(join(RACINE, "src/services/formats.ts"), "utf8");
    expect(src).toContain("listerFormatsNavigation()");
    expect(src).toMatch(/formatEnEssai\(f\) \? \{ essai: true \}/);
    expect(readFileSync(join(RACINE, "src/app/(studio)/layout.tsx"), "utf8")).toContain("essai: true");
  });

  it("menu latéral : lien sous « Mes vidéos » avec son compteur et la pastille « Essai », pas grisé ; les « bientôt » restent grisés", () => {
    const formats = [
      { id: "facecam-animee", nom: fa.nom, icone: fa.icone, statut: "actif" as const, nbVideos: 3, essai: true },
      { id: "bidon", nom: "Format pas fait", icone: fa.icone, statut: "bientot" as const, nbVideos: 0 },
    ];
    const html = renderToStaticMarkup(createElement(BarreLaterale, { formats, actionDeconnexion: async () => undefined }));
    const lien = /<a[^>]*href="\/formats\/facecam-animee"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    expect(lien).not.toBeNull();
    expect(texte(lien![1])).toContain("Essai");
    expect(texte(lien![1])).toContain("3");
    expect(lien![0]).not.toContain("aria-disabled");
    // Le format pas fait reste grisé, non cliquable (PR #338).
    expect(html).toMatch(/aria-disabled="true"[^>]*>[\s\S]*?Format pas fait[\s\S]*?Bientôt/);
  });

  it("grille « Nouvelle vidéo » : carte cliquable avec la pastille « Essai » ; /nouvelle/facecam-animee mène à l'écran de dépôt", () => {
    const html = renderToStaticMarkup(createElement(CarteFormat, { format: { ...fa, statut: "actif" as const, durees: [30], ratios: fa.ratios, essai: true }, href: "/nouvelle/facecam-animee" }));
    expect(html).toContain('href="/nouvelle/facecam-animee"');
    expect(texte(html)).toContain("Essai");
    expect(html).not.toContain("aria-disabled");
    expect(texte(html)).not.toContain("Bientôt");
    const page = readFileSync(join(RACINE, "src/app/(studio)/nouvelle/[format]/page.tsx"), "utf8");
    expect(page).toMatch(/ID_FORMAT_FACECAM_ANIMEE\) redirect\(sp\.brouillon \? `\/face-camera-animee\?brouillon=[^`]*` : "\/face-camera-animee"\)/);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Envoi par morceaux résistant                                      */
/* ------------------------------------------------------------------ */

function stockageMemoire(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
}

/** Horloge factice : `attendre` avance le temps sans dormir. */
function horloge() {
  let t = 0;
  const attentes: number[] = [];
  return { maintenant: () => t, attendre: async (ms: number) => void (attentes.push(ms), (t += ms)), attentes, get t() { return t; } };
}

/**
 * Faux studio + faux seau. `pannes` : appels (« action » ou « put:N ») qui échouent, dans l'ordre, avec un statut (503, 502…) ou
 * « reseau » ; `pannes` est consommé à chaque appel correspondant.
 */
function fauxServeur(o: { pannes?: Record<string, (number | "reseau")[]>; refus?: Record<string, string> } = {}) {
  const recus = new Map<number, string>();
  const appels: string[] = [];
  const envoyes: number[] = [];
  const panne = (cle: string) => {
    const liste = o.pannes?.[cle];
    const p = liste?.shift();
    if (p === undefined) return;
    if (p === "reseau") throw new TypeError("Failed to fetch");
    throw new CoupurePassagere("redemarrage", p);
  };
  const api = async (corps: Record<string, unknown>) => {
    const action = String(corps.action);
    appels.push(action);
    panne(action);
    if (o.refus?.[action]) throw new RefusEnvoi(o.refus[action]);
    switch (action) {
      case "commencer":
        return { fichierId: "f-1", cle: "studio/dev/entree/facecam-animee/f-1.mov", idEnvoi: "e-1", tailleMorceau: 10 * MO };
      case "recus":
        return { morceaux: Array.from(recus, ([numero, etag]) => ({ numero, etag, taille: 10 * MO })) };
      case "signer":
        return { adresses: Object.fromEntries((corps.numeros as number[]).map((n) => [n, `https://r2/morceau/${n}`])) };
      case "terminer":
        return { fichierId: corps.fichierId };
    }
    return {};
  };
  const envoyerMorceau = async (url: string) => {
    const n = Number(url.split("/").pop());
    panne(`put:${n}`);
    envoyes.push(n);
    recus.set(n, `"e${n}"`);
    return `"e${n}"`;
  };
  return { api, envoyerMorceau, appels, envoyes, recus };
}

let numeroFichier = 0;
/** Prise de 100 Mo (10 morceaux de 10 Mo) ; `cle` : même fichier pour une reprise, sinon un nouveau. */
const fichier100 = (cle = ++numeroFichier) => new File([new Uint8Array(100 * MO)], "IMG_7747.MOV", { type: "video/quicktime", lastModified: cle });
const CIBLE = { typeEntite: "entree", entiteId: "facecam-animee" };

describe("Essai réel · 2. l'envoi par morceaux reprend tout seul (tous les formats)", () => {
  it("statuts passagers : 502, 503, 504 (redémarrage), 408, 429, 500, Cloudflare 520 à 524 ; jamais 400, 401, 403, 413", () => {
    for (const s of [408, 429, 500, 502, 503, 504, 520, 522, 524]) expect(statutPassager(s)).toBe(true);
    for (const s of [200, 400, 401, 403, 404, 413]) expect(statutPassager(s)).toBe(false);
  });

  it("faux serveur qui répond 503 puis 200 : l'ouverture, une signature et un morceau sont réessayés, l'envoi se termine sans repartir de zéro", async () => {
    const s = fauxServeur({ pannes: { commencer: [503, 503], signer: [502], "put:4": [503, "reseau"], terminer: [504] } });
    const h = horloge();
    const attentes: (AttenteEnvoi | null)[] = [];
    const progression: number[] = [];
    const r = await envoyerFichier(fichier100(), CIBLE, { api: s.api, envoyerMorceau: s.envoyerMorceau, stockage: stockageMemoire(), attendre: h.attendre, maintenant: h.maintenant, onAttente: (a) => attentes.push(a), onProgression: (p) => progression.push(p) });
    expect(r).toEqual({ fichierId: "f-1", simulation: false });
    expect(s.appels.filter((a) => a === "commencer")).toHaveLength(3); // 2 × 503 puis 200 : un seul envoi ouvert
    expect(s.envoyes.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // chaque morceau UNE fois
    expect(s.appels.filter((a) => a === "terminer")).toHaveLength(2);
    // Attente croissante, phrase « le studio redémarre » pendant un 503.
    expect(h.attentes.slice(0, 2)).toEqual([1_000, 2_000]);
    expect(attentes[0]).toMatchObject({ cause: "redemarrage", essai: 1, dansMs: 1_000 });
    expect(phraseAttente(attentes[0]!)).toBe("Le studio redémarre, l'envoi reprend tout seul…");
    expect(attentes[attentes.length - 1]).toBeNull();
    expect(progression[progression.length - 1]).toBe(100);
  });

  it("coupure au milieu : le studio ne répond plus pendant 2 min 30 au morceau 5, l'envoi attend puis reprend AU MORCEAU 5 (1 à 4 jamais renvoyés)", async () => {
    // 2 min 30 de 503 sur le morceau 5 (redémarrage du studio pendant l'envoi).
    const pannes = Array.from({ length: 9 }, () => 503 as const); // 1+2+4+8+15+30+30+30+30 = 150 s
    const s = fauxServeur({ pannes: { "put:5": pannes } });
    const h = horloge();
    const r = await envoyerFichier(fichier100(), CIBLE, { api: s.api, envoyerMorceau: s.envoyerMorceau, stockage: stockageMemoire(), attendre: h.attendre, maintenant: h.maintenant });
    expect(r.fichierId).toBe("f-1");
    expect(h.t).toBeGreaterThanOrEqual(150_000);
    expect(s.envoyes.filter((n) => n === 5)).toHaveLength(1);
    expect(new Set(s.envoyes).size).toBe(10);
    expect(s.appels.filter((a) => a === "commencer")).toHaveLength(1);
  });

  it("au moins 3 minutes de nouveaux essais avant d'abandonner (attentes 1, 2, 4, 8, 15, puis 30 s)", async () => {
    expect(DUREE_REPRISES_MS).toBeGreaterThanOrEqual(3 * 60_000);
    const h = horloge();
    let n = 0;
    const e = await avecReprises(
      async () => {
        n++;
        throw new CoupurePassagere("redemarrage", 503);
      },
      { attendre: h.attendre, maintenant: h.maintenant },
    ).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CoupurePassagere);
    expect(h.t).toBeGreaterThanOrEqual(3 * 60_000);
    expect(h.attentes.slice(0, 7)).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000]);
    expect(n).toBeGreaterThan(8);
    // Un refus net n'est jamais réessayé.
    let refus = 0;
    await avecReprises(async () => {
      refus++;
      throw new RefusEnvoi("ce fichier dépasse 15 Go.");
    }).catch(() => undefined);
    expect(refus).toBe(1);
  });

  it("morceau 4 injoignable plus de 5 minutes : « interrompu à X % », puis « Reprendre l'envoi » repart des morceaux manquants (pas du début)", async () => {
    const pannes: Record<string, (number | "reseau")[]> = { "put:4": Array.from({ length: 40 }, () => "reseau" as const) };
    const s = fauxServeur({ pannes });
    const stockage = stockageMemoire();
    const h = horloge();
    const f = fichier100();
    // Les autres morceaux continuent en parallèle pendant que le 4 attend : l'arrêt dit le pourcentage réellement reçu.
    const e = await envoyerFichier(f, CIBLE, { api: s.api, envoyerMorceau: s.envoyerMorceau, stockage, attendre: h.attendre, maintenant: h.maintenant }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurEnvoi);
    const err = e as ErreurEnvoi;
    expect(err.cas).toBe("interrompu");
    expect(err.reprenable).toBe(true);
    expect(err.message).toMatch(/^L'envoi s'est interrompu à \d+ % : le studio ne répond plus/);
    expect(err.message).toContain(`repart de ${err.pourcentage} %`);
    expect(err.pourcentage).toBeGreaterThanOrEqual(20);
    expect(err.pourcentage).toBeLessThan(100);
    expect(phraseLisible(err.message)).toBe(true);
    // L'état est gardé dans ce navigateur.
    expect(stockage.getItem(cleReprise(f, CIBLE))).toBeTruthy();
    const deja = new Set(s.envoyes);
    expect(deja.has(4)).toBe(false);
    expect(err.pourcentage).toBe(deja.size * 10);

    // Le studio revient. « Reprendre l'envoi » (même fichier) : le stockage dit ce qu'il a reçu, seuls les morceaux manquants partent.
    pannes["put:4"] = [];
    s.envoyes.length = 0;
    const progression: number[] = [];
    const r = await envoyerFichier(fichier100(f.lastModified), CIBLE, { api: s.api, envoyerMorceau: s.envoyerMorceau, stockage, attendre: h.attendre, maintenant: h.maintenant, onProgression: (p) => progression.push(p) });
    expect(r.fichierId).toBe("f-1");
    expect(s.envoyes).toContain(4);
    for (const n of deja) expect(s.envoyes).not.toContain(n);
    expect(s.appels.filter((a) => a === "commencer")).toHaveLength(1);
    expect(progression[0]).toBe(deja.size * 10);
    expect(stockage.getItem(cleReprise(f, CIBLE))).toBeNull();
  });

  it("phrases exactes : n'a pas pu commencer / refusé / session expirée / fin non enregistrée", async () => {
    const h = horloge();
    const o = (s: ReturnType<typeof fauxServeur>) => ({ api: s.api, envoyerMorceau: s.envoyerMorceau, stockage: stockageMemoire(), attendre: h.attendre, maintenant: h.maintenant });

    const pasCommence = (await envoyerFichier(fichier100(), CIBLE, o(fauxServeur({ pannes: { commencer: Array.from({ length: 40 }, () => 503 as const) } }))).catch((x: unknown) => x)) as ErreurEnvoi;
    expect(pasCommence.cas).toBe("pas-commence");
    expect(pasCommence.message).toMatch(/^L'envoi n'a pas pu commencer : le studio ne répond pas/);

    const refuse = (await envoyerFichier(fichier100(), CIBLE, o(fauxServeur({ refus: { commencer: "Ce fichier dépasse 15 Go." } }))).catch((x: unknown) => x)) as ErreurEnvoi;
    expect(refuse.cas).toBe("refuse");
    expect(refuse.reprenable).toBe(false);
    expect(refuse.message).toBe("L'envoi a été refusé : Ce fichier dépasse 15 Go.");

    const sFin = fauxServeur({ pannes: { terminer: Array.from({ length: 40 }, () => 502 as const) } });
    const fin = (await envoyerFichier(fichier100(), CIBLE, o(sFin)).catch((x: unknown) => x)) as ErreurEnvoi;
    expect(fin.cas).toBe("pas-enregistre");
    expect(fin.message).toMatch(/le termine sans rien renvoyer/);

    for (const m of [pasCommence.message, refuse.message, fin.message]) expect(phraseLisible(m)).toBe(true);
    // L'ancien message trompeur n'existe plus.
    expect(readFileSync(join(RACINE, "src/lib/envoi-multipart.ts"), "utf8")).not.toContain('"L\'envoi n\'a pas pu commencer."');
  });

  it("vraie route (fetch) : 401 = session expirée (reprenable), page HTML d'une mise en ligne = passagère, réseau coupé = passager", async () => {
    const reponses: (Response | Error)[] = [
      new TypeError("Failed to fetch"),
      new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }),
      new Response("<html>Mise à jour</html>", { status: 200, headers: { "content-type": "text/html" } }),
      new Response(JSON.stringify({ erreur: "Connexion requise." }), { status: 401 }),
    ];
    const h = horloge();
    const fetchFaux = vi.fn(async () => {
      const r = reponses.shift();
      if (!r) throw new Error("plus de réponse");
      if (r instanceof Error) throw r;
      return r;
    });
    vi.stubGlobal("fetch", fetchFaux);
    try {
      const e = (await envoyerFichier(fichier100(), CIBLE, { stockage: stockageMemoire(), attendre: h.attendre, maintenant: h.maintenant }).catch((x: unknown) => x)) as ErreurEnvoi;
      expect(fetchFaux).toHaveBeenCalledTimes(4); // 3 passagères réessayées, puis le 401
      expect(e).toBeInstanceOf(ErreurEnvoi);
      expect(e.cas).toBe("refuse");
      expect(e.reprenable).toBe(true);
      expect(e.message).toMatch(/^Votre session a expiré/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("type du fichier : celui du navigateur, sinon l'extension, casse ignorée (.MOV, .mov, .MP4)", () => {
    expect(typeDuFichier({ name: "IMG_7747.MOV", type: "" })).toBe("video/quicktime");
    expect(typeDuFichier({ name: "img.mov", type: "" })).toBe("video/quicktime");
    expect(typeDuFichier({ name: "PRISE.MP4", type: "" })).toBe("video/mp4");
    expect(typeDuFichier({ name: "x.mp4", type: "video/mp4" })).toBe("video/mp4");
    expect(typeDuFichier({ name: "inconnu.xyz", type: "" })).toBe("application/octet-stream");
  });

  it("formats concernés : tous les écrans d'envoi passent par `envoyerFichier` (ZoneDepot, facecam, image → vidéo, tournage…)", () => {
    const src = (f: string) => readFileSync(join(RACINE, f), "utf8");
    for (const f of ["src/components/ui/ZoneDepot.tsx", "src/components/formats/facecam-animee/DepotPrise.tsx", "src/components/formats/image-video/Depot.tsx", "src/components/facecam/EnvoiIphone.tsx", "src/components/tournage/Enregistreur.tsx"]) expect(src(f)).toMatch(/envoyerFichier\(/);
    // ZoneDepot : glisser-déposer accepté (entrée et survol), phrase d'attente, bouton « Reprendre l'envoi ».
    const zone = src("src/components/ui/ZoneDepot.tsx");
    expect(zone).toContain("onDragEnter");
    expect(zone).toContain("onDrop");
    expect(zone).toContain("phraseAttente");
    expect(zone).toContain("Reprendre l&apos;envoi");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Plusieurs prises d'un coup                                        */
/* ------------------------------------------------------------------ */

const prise = (x: Partial<Prise> = {}): Prise => ({ id: "p", nom: "IMG_1.MOV", taille: 1, url: "blob:1", dureeSec: 60, largeur: 1080, hauteur: 1920, etape: "a-envoyer", envoi: 0, texte: "", texteOuvert: false, ...x });

describe("Essai réel · 3. plusieurs vidéos d'un coup", () => {
  it("tri du dépôt : vidéos gardées dans l'ordre (casse ignorée), autres refusées par leur nom, 20 au plus", () => {
    const f = (name: string, type = "") => ({ name, type });
    const { gardes, refus } = trierDepot([f("IMG_1.MOV"), f("notes.pdf", "application/pdf"), f("b.mp4", "video/mp4"), f("C.MP4"), f("d.mov")], 0);
    expect(gardes.map((x) => x.name)).toEqual(["IMG_1.MOV", "b.mp4", "C.MP4", "d.mov"]);
    expect(refus).toBe("« notes.pdf » n'est pas une vidéo (MP4 ou MOV).");
    const trop = trierDepot(Array.from({ length: 5 }, (_, i) => f(`v${i}.mov`)), 18);
    expect(trop.gardes).toHaveLength(2);
    expect(trop.refus).toMatch(/Au plus 20 vidéos/);
    expect(estVideoAcceptee(f("IMG_7747.MOV"))).toBe(true);
    expect(estVideoAcceptee(f("photo.JPG"))).toBe(false);
  });

  it("file d'envoi : une prise à la fois, dans l'ordre ; le bouton attend que TOUTES soient envoyées", () => {
    const l = [prise({ id: "a", etape: "prete", fichierId: "f-a" }), prise({ id: "b" }), prise({ id: "c" })];
    expect(prochaineAEnvoyer(l)?.id).toBe("b");
    expect(prochaineAEnvoyer([l[0], { ...l[1], etape: "envoi" }, l[2]])).toBeUndefined();
    expect(pretesALancer(l)).toBe(false);
    expect(pretesALancer(l.map((p) => ({ ...p, etape: "prete" as const, fichierId: `f-${p.id}` })))).toBe(true);
    expect(pretesALancer([prise({ etape: "prete", fichierId: "f", dureeSec: 3 })])).toBe(false);
    expect(pretesALancer([])).toBe(false);
    expect(libelleAnimer(1)).toBe("Animer ma vidéo");
    expect(libelleAnimer(3)).toBe("Animer mes 3 vidéos");
    expect(etatPrise(prise({ etape: "envoi", envoi: 42 }))).toBe("60 s · envoi 42 %");
    expect(etatPrise(prise({ etape: "arretee", envoi: 8 }))).toBe("60 s · envoi arrêté à 8 %");
    expect(consigneDepart([prise()])).toMatch(/Gardez cette page ouverte pendant l'envoi/);
    expect(consigneDepart([prise({ etape: "prete", fichierId: "f" })])).toMatch(/Vous pourrez quitter la page/);
  });

  it("« Animer mes 3 vidéos » : 3 vidéos distinctes, chacune mise en file avec SON texte ; une refusée n'empêche pas les autres ; un doublon n'est lancé qu'une fois", async () => {
    vi.resetModules();
    vi.doMock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
    try {
      const { deposerFacecamAnimeeLot, PHRASES_FA } = await import("@/services/facecam-animee");
      const fichiers: Record<string, { id: string; cleStockage: string; mime: string; nom: string; taille: number }> = {
        "f-1": { id: "f-1", cleStockage: "studio/dev/entree/facecam-animee/f-1.mov", mime: "video/quicktime", nom: "IMG_1.MOV", taille: 1 },
        "f-2": { id: "f-2", cleStockage: "studio/dev/entree/facecam-animee/f-2.mov", mime: "application/octet-stream", nom: "IMG_2.MOV", taille: 1 },
        "f-3": { id: "f-3", cleStockage: "studio/dev/entree/facecam-animee/f-3.png", mime: "image/png", nom: "photo.png", taille: 1 },
        "f-4": { id: "f-4", cleStockage: "studio/dev/entree/facecam-animee/f-4.mp4", mime: "video/mp4", nom: "IMG_4.MP4", taille: 1 },
      };
      let n = 0;
      const file: string[] = [];
      const brouillon = vi.fn(async (e: { entrees: Record<string, unknown> }) => ({ id: `v-${++n}`, entrees: e.entrees }));
      const lancer = vi.fn(async (videoId: string) => {
        file.push(videoId);
        return { travailId: `trav-${videoId}` };
      });
      const enregistrerAccord = vi.fn(async () => undefined);
      let accord = false;
      const { issues } = await deposerFacecamAnimeeLot(
        [
          { fichierId: "f-1", dureeSec: 60, texte: "Texte de la prise un.", accordEssai: true },
          { fichierId: "f-2", dureeSec: 45, accordEssai: true },
          { fichierId: "f-3", dureeSec: 30, accordEssai: true },
          { fichierId: "f-4", dureeSec: 90, texte: "Texte quatre.", accordEssai: true },
          { fichierId: "f-1", dureeSec: 60, accordEssai: true },
        ],
        {
          fichier: async (id) => fichiers[id],
          accordEssai: async () => accord,
          enregistrerAccord: async () => {
            accord = true;
            await enregistrerAccord();
          },
          brouillon,
          lancer,
        },
      );
      expect(issues.map((i) => [i.fichierId, i.statut])).toEqual([
        ["f-1", "lancee"],
        ["f-2", "lancee"], // .MOV sans type du navigateur : accepté par l'extension
        ["f-3", "refusee"],
        ["f-4", "lancee"],
      ]);
      expect(issues[2]).toMatchObject({ phrase: PHRASES_FA.pasUneVideo });
      expect(file).toEqual(["v-1", "v-2", "v-3"]); // chaque vidéo mise en file, dans l'ordre, une seule fois
      expect(enregistrerAccord).toHaveBeenCalledTimes(1);
      expect(brouillon.mock.calls.map((c) => (c[0].entrees.facecamAnimee as { texteValide?: string }).texteValide)).toEqual(["Texte de la prise un.", undefined, "Texte quatre."]);
      // Un lancement qui casse (studio) : la prise reste avec sa phrase, rien d'autre n'est perdu.
      const casse = await deposerFacecamAnimeeLot([{ fichierId: "f-1", dureeSec: 60 }, { fichierId: "f-4", dureeSec: 90 }], {
        fichier: async (id) => fichiers[id],
        accordEssai: async () => true,
        brouillon,
        lancer: async (id) => {
          if (id === "v-4") throw new Error("panne");
          return { travailId: "t" };
        },
        abandonner: async () => undefined,
      });
      expect(casse.issues.map((i) => i.statut)).toEqual(["refusee", "lancee"]);
    } finally {
      vi.doUnmock("@/services/auth");
    }
  });

  it("la file de fabrication est celle du studio (lancement commun, concurrence de la boucle) et l'écran envoie le lot d'un geste", () => {
    const service = readFileSync(join(RACINE, "src/services/facecam-animee.ts"), "utf8");
    expect(service).toMatch(/import\("\.\/fabrication"\)/);
    expect(service).toContain("lancerFabrication(videoId)");
    const travaux = readFileSync(join(RACINE, "src/services/travaux.ts"), "utf8");
    expect(travaux).toMatch(/calculerFile\(actifs, await concurrence\(\)/);
    const ecran = readFileSync(join(RACINE, "src/components/formats/facecam-animee/DepotPrise.tsx"), "utf8");
    expect(ecran).toContain("deposerFacecamAnimeeLotAction");
    expect(ecran).toContain("libelleAnimer(n)");
    expect(ecran).toMatch(/multiple\n/);
    expect(ecran).toContain('router.push(lancees.length === 1 ? `/videos/${lancees[0].videoId}` : "/formats/facecam-animee")');
  });
});

/* ------------------------------------------------------------------ */
/* 4. Prise horizontale → vertical, cadré sur le visage                 */
/* ------------------------------------------------------------------ */

const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };

describe("Essai réel · 4. prise horizontale (IMG_7747, 3840 × 2160) recadrée en vertical sur le visage", () => {
  it("colonne 9:16 de toute la hauteur, centrée sur le visage, bornée, paire ; aucun zoom en plus", () => {
    const r = recadrageVerticalV4({ largeur: 3840, hauteur: 2160 }, { centreX: 0.6, yeux: 0.38, largeurVisage: 0.12 });
    expect(r).toMatchObject({ largeur: 1216, hauteur: 2160, visage: true });
    expect(r.x).toBe(Math.round(0.6 * 3840 - 608) - (Math.round(0.6 * 3840 - 608) % 2));
    expect(r.x % 2).toBe(0);
    expect(r.centreX).toBeCloseTo(0.5, 2);
    expect(r.yeux).toBe(0.38);
    expect(r.largeurVisage).toBeCloseTo((0.12 * 3840) / 1216, 3);
    // 1216 × 2160 → 1080 × 1920 : même rapport (0,5630 ≈ 0,5625), l'image est seulement réduite.
    expect(Math.abs(r.largeur / r.hauteur - 1080 / 1920)).toBeLessThan(0.001);
    // Visage au bord : la colonne reste dans l'image.
    expect(recadrageVerticalV4({ largeur: 3840, hauteur: 2160 }, { centreX: 0.98 }).x).toBe(3840 - 1216);
    expect(recadrageVerticalV4({ largeur: 3840, hauteur: 2160 }, { centreX: 0.01 }).x).toBe(0);
    // Visage introuvable : colonne centrée.
    expect(recadrageVerticalV4({ largeur: 3840, hauteur: 2160 }, null)).toMatchObject({ x: 1312, visage: false, centreX: 0.5 });
    expect(priseHorizontale({ largeur: 3840, hauteur: 2160 })).toBe(true);
    expect(priseHorizontale({ largeur: 1080, hauteur: 1920 })).toBe(false);
    expect(priseHorizontale({})).toBe(false);
  });

  it("chaîne : prise horizontale → visage repéré (repris tant qu'il tourne) → cadrage gardé → rendu avec le recadrage ; prise verticale : rien ne change", async () => {
    const reperer = vi.fn().mockRejectedValueOnce(new EnCoursChaineV4("Le cadrage")).mockResolvedValue({ centreX: 0.62, yeux: 0.4, largeurVisage: 0.1 });
    const rendus: unknown[] = [];
    const outils = (largeurSource: number, hauteurSource: number): OutilsChaineV4 => ({
      transcrire: async () => ({ mots: BRUT.mots, dureeSec: 130.732, largeurSource, hauteurSource }),
      reperer,
      plafondClaudeAtteint: async () => true, // plan v4 minimal : aucun Claude
      rendre: async (d) => {
        rendus.push(d.recadrage ?? null);
        return { cle: "k.mp4", vignetteCle: "k.jpg", dureeSec: d.plan.duree, taille: 1 };
      },
    });
    const derouler = async (o: OutilsChaineV4) => {
      let etat: EtatChaineV4 = etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "studio/dev/entree/facecam-animee/f-1.mov" });
      for (let k = 0; k < 10 && etat.etape !== "prete"; k++) {
        try {
          etat = await avancerChaineV4(etat, o);
        } catch (e) {
          if (!(e instanceof EnCoursChaineV4)) throw e;
        }
      }
      return etat;
    };
    const h = await derouler(outils(3840, 2160));
    expect(h.etape).toBe("prete");
    expect(reperer).toHaveBeenCalledTimes(2);
    expect(h.cadrage).toMatchObject({ largeur: 1216, hauteur: 2160, visage: true });
    expect(rendus[0]).toEqual(h.cadrage);
    // Le visage dans la colonne gardée va au réalisateur (plaquettes et sous-titres l'évitent).
    expect(entreeRealisateurV4(h).prise).toMatchObject({ src: PRISE_MONTEE_V4, centreX: h.cadrage!.centreX, yeux: 0.4 });

    reperer.mockClear();
    const v = await derouler(outils(1080, 1920));
    expect(v.etape).toBe("prete");
    expect(reperer).not.toHaveBeenCalled();
    expect(v.cadrage).toBeUndefined();
    expect(rendus[1]).toBeNull();
    expect(entreeRealisateurV4(v).prise).toEqual({ src: PRISE_MONTEE_V4, finSec: v.coupes!.dureeSec });
  });

  it("service de rendu : recadrage contrôlé ; filtre sans recadrage inchangé au caractère près", () => {
    const gardes = [
      { debutSec: 0.5, finSec: 2 },
      { debutSec: 3, finSec: 4.5 },
    ];
    const sans = filtreMontageV4(gardes);
    expect(sans).toBe("[0:v]trim=start=0.5:end=2,setpts=PTS-STARTPTS,fps=30[v0];[0:a]atrim=start=0.5:end=2,asetpts=PTS-STARTPTS[a0];[0:v]trim=start=3:end=4.5,setpts=PTS-STARTPTS,fps=30[v1];[0:a]atrim=start=3:end=4.5,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]");
    const r = { x: 1774, largeur: 1216, hauteur: 2160, sortieLargeur: 1080, sortieHauteur: 1920 };
    expect(filtreMontageV4(gardes, r)).toBe(sans.replace("[v][a]", "[vc][a];[vc]crop=1216:2160:1774:0,scale=1080:1920:flags=lanczos,setsar=1[v]"));
    expect(filtreMontageV4(gardes, r)).not.toMatch(/zoompan|scale=[0-9]+\*|rotate/);
    const plan = { elementsV4: [{}], sons: [], duree: 10, fps: 30, prise: { src: PRISE_MONTEE_V4 } };
    expect(lireParametresFacecamV4({ plan, gardes, recadrage: r }).recadrage).toEqual(r);
    expect(lireParametresFacecamV4({ plan, gardes }).recadrage).toBeUndefined();
    expect(() => lireParametresFacecamV4({ plan, gardes, recadrage: { ...r, x: 3 } })).toThrow(/Recadrage/);
    expect(() => lireParametresFacecamV4({ plan, gardes, recadrage: { ...r, largeur: 4000 } })).toThrow(/Recadrage/);
  });

  it("vrai FFmpeg : une prise horizontale 16:9 (réduite) devient une vidéo verticale 1080 × 1920, colonne du visage gardée", () => {
    const dossier = mkdtempSync(join(tmpdir(), "fa-recadrage-"));
    try {
      const brute = join(dossier, "brute.mp4");
      // Prise horizontale 640 × 360 : fond gris, « visage » blanc à 62 % de la largeur.
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=640x360:d=3:r=30", "-f", "lavfi", "-i", "sine=f=440:d=3", "-vf", "drawbox=x=380:y=120:w=36:h=60:color=white:t=fill", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", brute]);
      const r = recadrageVerticalV4({ largeur: 640, hauteur: 360 }, { centreX: 398 / 640 });
      const script = join(dossier, "filtre.txt");
      writeFileSync(script, filtreMontageV4([{ debutSec: 0, finSec: 1 }, { debutSec: 1.5, finSec: 2.5 }], { x: r.x, largeur: r.largeur, hauteur: r.hauteur, sortieLargeur: 1080, sortieHauteur: 1920 }));
      const montee = join(dossier, "montee.mp4");
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", brute, "-filter_complex_script", script, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", montee]);
      const sonde = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", montee], { encoding: "utf8" })) as { streams: { width: number; height: number }[] };
      expect(sonde.streams[0]).toEqual({ width: 1080, height: 1920 });
      // Le « visage » blanc est au centre de la colonne : pixel du milieu de l'image (à la hauteur du visage) blanc.
      const pixel = execFileSync("ffmpeg", ["-v", "error", "-i", montee, "-frames:v", "1", "-vf", "crop=2:2:539:799", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
      expect(pixel[0]).toBeGreaterThan(200);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("écran : la prise horizontale est annoncée (« Votre vidéo horizontale sera mise en vertical »), la verticale non ; aperçu ENTIER", () => {
    expect(phraseOrientation({ largeur: 3840, hauteur: 2160 })).toMatch(/^Votre vidéo horizontale sera mise en vertical \(1080 × 1920\), cadrée sur votre visage, sans zoom\.$/);
    expect(phraseOrientation({ largeur: 1080, hauteur: 1920 })).toBeNull();
    expect(phraseOrientation({ largeur: 0, hauteur: 0 })).toBeNull();
    const ecran = readFileSync(join(RACINE, "src/components/formats/facecam-animee/DepotPrise.tsx"), "utf8");
    expect(ecran).toContain("object-contain");
    expect(ecran).not.toContain("object-cover");
    expect(ecran).toContain("phraseOrientation(p)");
  });
});
