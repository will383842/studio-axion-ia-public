/**
 * G1a : COHÉRENCE DES ÉTATS sur 200 transitions aléatoires, fabrications comprises (plan v5 B.2.5).
 *
 * Après CHAQUE transition : pour toute vidéo rattachée, `Video.etapeEditoriale` = copie de `etatReseau` ; pour tout texte
 * rattaché, `Script.statutEditorial` = « valide » si et seulement si toutes ses versions courantes sont validées.
 * La fabrication est rejouée telle qu'elle écrit aujourd'hui (`fabrication.ts` : `statutEditorial: "valide"` ;
 * `travaux.ts` : `etapeEditoriale: "a_relire"`, `statut: "prete"`), puis `synchroniserApresFabrication`.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
import { etapeEditorialeDe, etatReseau, statutEditorialDerive, versionsCourantes } from "@/domaine/derivations-generateur";
import type { Publication, Video } from "@/domaine/types";

const MDP = "essai-g1a-transitions";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Générateur pseudo-aléatoire à graine (rejouable). */
function aleatoire(graine: number) {
  let x = graine >>> 0;
  return () => {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    x ^= x + Math.imul(x ^ (x >>> 7), 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

async function verifierCoherence(): Promise<string[]> {
  const d = depots();
  const variantes = await d.variantes.lister();
  const publications = await d.publications.lister();
  const ecarts: string[] = [];
  for (const video of await d.videos.lister((x) => !!x.varianteId)) {
    const v = variantes.find((x) => x.id === video.varianteId)!;
    const attendu = etapeEditorialeDe(etatReseau(v, video, publications));
    if (attendu && video.etapeEditoriale !== attendu) ecarts.push(`${video.id} : ${video.etapeEditoriale} ≠ ${attendu}`);
  }
  for (const s of await d.scripts.lister((x) => !!x.scriptMaitreId)) {
    const attendu = statutEditorialDerive(s.id, variantes);
    if (s.statutEditorial !== attendu) ecarts.push(`${s.id} : ${s.statutEditorial} ≠ ${attendu}`);
  }
  return ecarts;
}

describe("200 transitions aléatoires, fabrications comprises", () => {
  it("aucun écart entre l'état calculé et ses copies", async () => {
    const d = depots();
    const hasard = aleatoire(20261002);
    const choisir = <T>(liste: T[]): T | undefined => (liste.length ? liste[Math.floor(hasard() * liste.length)] : undefined);
    await d.matieres.enregistrer(matiere("Dans presque toutes les PME, le même fichier circule en 5 versions.", "observation"));
    const sujets: string[] = [];
    for (const [idee, reseaux] of [
      ["Vos fichiers en 5 versions", ["tiktok", "instagram", "linkedin"]],
      ["Le tableau partagé", ["tiktok", "facebook", "youtube-shorts"]],
    ] as const) {
      const s = await gen.creerSujet({ idee, reseaux: [...reseaux], formatId: "avocat" });
      const r = await gen.ecrireSujetSimule(s.id);
      expect(r.ok).toBe(true);
      sujets.push(s.id);
    }
    await gen.ecrireSujetSimule(sujets[0], { mode: "teleprompteur", reseaux: ["tiktok"] });
    const modeleVideo = (await d.videos.lister())[0];
    const compte: Record<string, number> = {};
    let n = 0;

    const actions: Record<string, () => Promise<boolean>> = {
      valider: async () => {
        const v = choisir(versionsCourantes(await d.variantes.lister()).filter((x) => x.etat === "a-relire"));
        if (!v) return false;
        await gen.validerVariante(v.id);
        return true;
      },
      rejeter: async () => {
        const v = choisir(versionsCourantes(await d.variantes.lister()).filter((x) => x.etat === "validee"));
        if (!v) return false;
        await gen.rejeterVariante(v.id, ["trop-long"]);
        return true;
      },
      retoucherVersion: async () => {
        const v = choisir(versionsCourantes(await d.variantes.lister()));
        if (!v) return false;
        await gen.retoucherVariante(v.id, { encadre: { texte: `Encadré ${n}` } });
        return true;
      },
      retoucherCorps: async () => {
        const v = choisir(versionsCourantes(await d.variantes.lister()));
        if (!v) return false;
        const s = (await d.scripts.obtenir(v.scriptId))!;
        const blocs = structuredClone(s.blocs);
        blocs[0].segments.push({ id: `ajout-${n}`, texte: `Phrase ajoutée ${n}.` });
        await gen.retoucherCorps(s.id, blocs);
        return true;
      },
      revalider: async () => {
        const vs = versionsCourantes(await d.variantes.lister()).filter((x) => x.etat === "a-reverifier");
        if (!vs.length) return false;
        await gen.revaliderVariantes(vs.map((x) => x.id));
        return true;
      },
      fabriquer: async () => {
        const v = choisir(versionsCourantes(await d.variantes.lister()).filter((x) => x.etat === "validee" && !x.videoId));
        if (!v) return false;
        const video: Video = { ...modeleVideo, id: `vid-${n}`, titre: v.code, scriptId: v.scriptId, statut: "en_file", etapeEditoriale: undefined, estDemo: false };
        await d.videos.enregistrer(video);
        await gen.rattacherVideoAVariante(video.id, v.id);
        // Fabrication telle qu'elle écrit aujourd'hui (fichiers du moteur, jamais modifiés par le générateur) :
        await d.scripts.modifier(v.scriptId, { statutEditorial: "valide" });
        await d.videos.modifier(video.id, { statut: "prete", etapeEditoriale: "a_relire" });
        await gen.synchroniserApresFabrication(video.id);
        return true;
      },
      fabricationRatee: async () => {
        const video = choisir(await d.videos.lister((x) => !!x.varianteId && x.statut === "prete"));
        if (!video) return false;
        await d.videos.modifier(video.id, { statut: "echec" });
        await gen.synchroniserApresFabrication(video.id);
        return true;
      },
      programmer: async () => {
        const video = choisir(await d.videos.lister((x) => !!x.varianteId && x.statut === "prete"));
        if (!video) return false;
        const v = (await d.variantes.obtenir(video.varianteId!))!;
        const via: Publication["via"] = hasard() < 0.3 ? "simulation" : "buffer";
        await d.publications.enregistrer({ id: `pub-${n}`, videoId: video.id, varianteId: v.id, reseau: v.reseau, statut: via === "simulation" ? "brouillon" : "programmee", via, date: "2026-10-10T16:04:00Z", texte: "", creeLe: "x", modifieLe: "x" });
        // L'envoi existant écrit aussi la copie (publications.ts) : la synchronisation doit retomber sur ses pieds.
        if (via !== "simulation") await d.videos.modifier(video.id, { etapeEditoriale: "programmee" });
        await gen.synchroniserEtats(v.id);
        return true;
      },
      publier: async () => {
        const p = choisir(await d.publications.lister((x) => !!x.varianteId && x.statut === "programmee"));
        if (!p) return false;
        await d.publications.modifier(p.id, { statut: hasard() < 0.15 ? "echec" : "publiee" });
        await gen.synchroniserEtats(p.varianteId!);
        return true;
      },
      archiverOuRestaurer: async () => {
        const id = choisir(sujets)!;
        const m = (await d.scriptsMaitres.obtenir(id))!;
        if (m.archiveLe) await gen.restaurerSujet(id);
        else if (hasard() < 0.3) await gen.archiverSujet(id);
        else return false;
        return true;
      },
    };
    const noms = Object.keys(actions);
    let essais = 0;
    while (n < 200 && essais < 5000) {
      essais++;
      const nom = choisir(noms)!;
      if (!(await actions[nom]())) continue;
      n++;
      compte[nom] = (compte[nom] ?? 0) + 1;
      const ecarts = await verifierCoherence();
      expect(ecarts, `après la transition n° ${n} (${nom})`).toEqual([]);
    }
    expect(n).toBe(200);
    // Toutes les sortes de transitions ont été jouées, fabrications comprises.
    for (const nom of noms) expect(compte[nom] ?? 0, nom).toBeGreaterThan(0);
  }, 120_000);
});
