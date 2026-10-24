/**
 * L15 · Lanceur `scripts/image-video/fabriquer.ts` : arguments, arrêts aux portes de Will, reprise depuis l'état gardé
 * sans repayer, jusqu'à la vidéo prête. Branchements SIMULÉS (doubles du lot) : aucun appel payant, aucun réseau.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { EntreeRole } from "@/generateur/roles/types";
import { attendWillIV, type DecisionCarteIV, type DecisionScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { pngSimule } from "@/moteurs/montage-image-video/lecture/simulation";
import { ErreurArguments, lancer, lireArguments } from "../../scripts/image-video/fabriquer";
import { carteFixe, monde, outilsSimules, type Monde } from "./doubles-fabrication";
import { outilsAvecRendu, ServeurDouble } from "./doubles-rendu";

vi.setConfig({ testTimeout: 120_000 });

describe("lanceur : arguments", () => {
  it("--image et --plafond obligatoires ; réseaux, offre et type vérifiés", () => {
    expect(() => lireArguments(["--plafond", "2"])).toThrow(ErreurArguments);
    expect(() => lireArguments(["--image", "x.png"])).toThrow(/--plafond/);
    expect(() => lireArguments(["--image", "x.png", "--plafond", "deux"])).toThrow(/illisible/);
    expect(() => lireArguments(["--image", "x.png", "--plafond", "2", "--reseaux", "youtube-shorts,myspace"])).toThrow(/myspace/);
    expect(() => lireArguments(["--image", "x.png", "--plafond", "2", "--offre", "cadeau"])).toThrow(/Offre inconnue/);
    expect(() => lireArguments(["--image", "x.png", "--plafond", "2", "--inconnue"])).toThrow(/Option inconnue/);
    expect(lireArguments(["--image", "x.png", "--plafond", "2,50"])).toMatchObject({ image: "x.png", plafondCentimes: 250, reel: false, reseaux: ["youtube-shorts", "linkedin", "instagram", "facebook"], finSeule: false });
    expect(lireArguments(["--image", "x.png", "--plafond", "1", "--reel", "--reseaux", "linkedin,youtube-shorts", "--fin-seule"])).toMatchObject({ reel: true, reseaux: ["youtube-shorts", "linkedin"], finSeule: true });
  });
});

describe("lanceur : portes de Will, reprise sans repayer, vidéo prête", () => {
  it("carte → script → prête, en trois lancements ; les lectures et l'écriture ne sont jamais refaites", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const carte = carteFixe("C");
    const m = monde();
    // Double de l'écriture : la fiche simulée de l'image C, posée sur l'empreinte de l'image déposée.
    const branchements = async (): Promise<{ outils: OutilsFabricationIV }> => {
      const o = outilsSimules(carte, m);
      return {
        outils: {
          ...o,
          ecriture: {
            appeler: async (role, entree: EntreeRole) => {
              const empreinte = /<empreinte_carte>"([^"]+)"<\/empreinte_carte>/.exec(entree.variable)?.[1] ?? "";
              const r = await o.ecriture.appeler(role, { ...entree, variable: entree.variable.replace(/<image-id>[^<]*<\/image-id>/, "<image-id>essai-c</image-id>") });
              return r.ok && r.donnees ? { ...r, donnees: { ...(r.donnees as FicheImage), empreinteCarte: empreinte } } : r;
            },
          },
        },
      };
    };
    const lignes: string[] = [];
    const deps = { ecrire: (l: string) => lignes.push(l), branchements, attendre: async () => undefined };
    const base = ["--image", image, "--plafond", "5", "--dossier", dossier];

    expect(await lancer(lireArguments(base), deps)).toBe(5);
    expect(JSON.parse(readFileSync(join(dossier, "carte.json"), "utf8")).carte.titre).toBe(carte.titre);
    expect(m.appelsClaude.filter((a) => a.role === "lecture-image")).toHaveLength(2);

    // Relancé sans décision : l'état est repris, rien n'est relu.
    expect(await lancer(lireArguments(base), deps)).toBe(5);
    expect(m.appelsClaude.filter((a) => a.role === "lecture-image")).toHaveLength(2);

    expect(await lancer(lireArguments([...base, "--valider-carte"]), deps)).toBe(5);
    const script = JSON.parse(readFileSync(join(dossier, "script.json"), "utf8"));
    expect(script.prix.auPlusCentimes).toBeGreaterThan(0);
    expect(lignes.join("\n")).toMatch(/Prix de la suite : environ/);
    expect(m.lus).toEqual([]);

    expect(await lancer(lireArguments([...base, "--valider-script"]), deps)).toBe(0);
    expect(m.appelsClaude.filter((a) => a.role === "lecture-image")).toHaveLength(2);
    expect(m.appelsClaude.filter((a) => a.role === "ecriture-image-video")).toHaveLength(1);
    expect(lignes.join("\n")).toMatch(/youtube-shorts : final\//);
    const etat = JSON.parse(readFileSync(join(dossier, "etat.json"), "utf8"));
    expect(etat.etape).toBe("prete");
  });

  it("plafond trop bas : arrêt net (code 4), aucun appel", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const lignes: string[] = [];
    const code = await lancer(lireArguments(["--image", image, "--plafond", "0,05", "--dossier", dossier]), { ecrire: (l) => lignes.push(l), branchements: async () => ({ outils: outilsSimules(carteFixe("C"), m) }) });
    expect(code).toBe(4);
    expect(lignes.join("\n")).toMatch(/Plafond de cette vidéo atteint/);
    expect(m.appelsClaude).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Mode réel joué sur des doubles : portes validées dans le studio       */
/* ------------------------------------------------------------------ */

/** Outils simulés de l'image C, écriture posée sur l'empreinte de la carte lue (comme plus haut). */
function outilsImageC(m: Monde): OutilsFabricationIV {
  const o = outilsSimules(carteFixe("C"), m);
  return {
    ...o,
    ecriture: {
      appeler: async (role, entree: EntreeRole) => {
        const empreinte = /<empreinte_carte>"([^"]+)"<\/empreinte_carte>/.exec(entree.variable)?.[1] ?? "";
        const r = await o.ecriture.appeler(role, { ...entree, variable: entree.variable.replace(/<image-id>[^<]*<\/image-id>/, "<image-id>essai-c</image-id>") });
        return r.ok && r.donnees ? { ...r, donnees: { ...(r.donnees as FicheImage), empreinteCarte: empreinte } } : r;
      },
    },
  };
}

/** Le studio vu par le lanceur : vitrine publiée, décisions gardées par l'écran, fichiers et dépense lus. */
function studioDouble(m: Monde, serveur: ServeurDouble) {
  const decisions: { carte?: DecisionCarteIV; script?: DecisionScriptIV } = {};
  const publies: EtatFabricationIV[] = [];
  /** Will clique « Valider » dans l'écran sur ce qui y est montré. */
  const willValide = () => {
    const e = publies.at(-1)!;
    if (attendWillIV(e) === "carte") decisions.carte = { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" };
    if (attendWillIV(e) === "script") decisions.script = { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) };
  };
  const branchements = async () => ({
    outils: { ...outilsAvecRendu(m, serveur, outilsImageC(m)), decisions: { carte: async () => decisions.carte ?? null, script: async () => decisions.script ?? null } },
    publier: async (e: EtatFabricationIV) => {
      publies.push(e);
      return "/image-video/v-essai";
    },
    telecharger: async (cle: string) => new TextEncoder().encode(`mp4:${cle}`),
    depenseReelle: async () => ({ centimes: 137, lignes: [{ etape: "Image → vidéo · voix", fournisseur: "heygen", centimes: 137 }] }),
  });
  return { decisions, publies, willValide, branchements };
}

describe("lanceur, mode réel sur doubles : validations dans le studio, rendu, sortie", () => {
  it("s'arrête à la carte puis au script (vitrine publiée, rien de payé avant le script) ; relancé après chaque validation faite dans le studio, il va jusqu'aux MP4 et écrit la sortie", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-reel-"));
    const sortie = join(dossier, "sortie");
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const serveur = new ServeurDouble();
    const studio = studioDouble(m, serveur);
    const lignes: string[] = [];
    const deps = { ecrire: (l: string) => lignes.push(l), branchements: studio.branchements, attendre: async () => undefined };
    // Plafond 6 € (24/10 : LinkedIn en 4:5 est un fichier à part de YouTube Shorts, d'où une relecture et une voix de plus : prix au plus 5,44 €).
    const base = ["--image", image, "--plafond", "6", "--dossier", dossier, "--sortie", sortie, "--reseaux", "youtube-shorts,linkedin"];

    expect(await lancer(lireArguments(base), deps)).toBe(5);
    expect(attendWillIV(studio.publies.at(-1)!)).toBe("carte");
    expect(lignes.join("\n")).toMatch(/Validez \(ou corrigez\) la carte dans le studio : \/image-video\/v-essai/);
    expect(serveur.soumises).toEqual([]);
    expect(m.lus).toEqual([]);

    studio.willValide();
    expect(await lancer(lireArguments(base), deps)).toBe(5);
    expect(attendWillIV(studio.publies.at(-1)!)).toBe("script");
    expect(lignes.join("\n")).toMatch(/Validez le script dans le studio/);
    expect(m.lus).toEqual([]);

    studio.willValide();
    expect(await lancer(lireArguments(base), deps)).toBe(0);
    expect(m.appelsClaude.filter((a) => a.role === "lecture-image")).toHaveLength(2);
    expect(m.appelsClaude.filter((a) => a.role === "ecriture-image-video")).toHaveLength(1);
    expect(studio.publies.at(-1)!.etape).toBe("prete");

    const resume = JSON.parse(readFileSync(join(sortie, "resume.json"), "utf8"));
    expect(resume).toMatchObject({ etape: "prete", arret: null, plafondCentimes: 600, depenseReelle: { centimes: 137 }, verdict: { ok: true } });
    expect(resume.engageCentimes).toBeGreaterThan(0);
    expect(resume.engageCentimes).toBeLessThanOrEqual(600);
    for (const r of ["youtube-shorts", "linkedin"]) {
      const l = resume.reseaux.find((x: { reseau: string }) => x.reseau === r);
      expect(l.fichier).toMatch(/\.mp4$/);
      expect(readFileSync(join(sortie, l.fichier), "utf8")).toMatch(/^mp4:studio\/dev\/videos\//);
      expect(readFileSync(join(sortie, `${r}.txt`), "utf8")).toMatch(/Texte :/);
    }
    expect(readFileSync(join(sortie, "youtube-shorts.txt"), "utf8")).toMatch(/Lien suivi :/);
  });

  it("--attendre : le lanceur relit la validation faite dans le studio et continue seul jusqu'à la vidéo prête", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-attente-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const serveur = new ServeurDouble({ enCours: 1 });
    const studio = studioDouble(m, serveur);
    let attentes = 0;
    const lignes: string[] = [];
    // Will valide pendant la 2e attente de chaque porte.
    const attendre = async () => {
      attentes++;
      if (attentes % 2 === 0) studio.willValide();
    };
    const code = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", dossier, "--reseaux", "youtube-shorts", "--attendre", "2", "--sortie", join(dossier, "s")]), { ecrire: (l) => lignes.push(l), branchements: studio.branchements, attendre });
    expect(code).toBe(0);
    expect(lignes.join("\n")).toMatch(/En attente de votre validation de la carte dans le studio/);
    expect(existsSync(join(dossier, "s", "youtube-shorts.mp4"))).toBe(true);
  });

  it("--attendre écoulé sans validation : arrêt à la porte (code 5), rien de payé après la lecture", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-sans-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const studio = studioDouble(m, new ServeurDouble());
    let attentes = 0;
    const code = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", dossier, "--attendre", "0,5"]), { ecrire: () => undefined, branchements: studio.branchements, attendre: async () => void attentes++ });
    expect(code).toBe(5);
    expect(attentes).toBe(2);
    expect(m.appelsClaude.filter((a) => a.role === "ecriture-image-video")).toEqual([]);
  });

  it("arguments --sortie et --attendre", () => {
    expect(lireArguments(["--image", "x.png", "--plafond", "2", "--sortie", "out", "--attendre", "30"])).toMatchObject({ sortie: "out", attendreMinutes: 30 });
    expect(lireArguments(["--image", "x.png", "--plafond", "2"])).toMatchObject({ attendreMinutes: 0 });
    expect(() => lireArguments(["--image", "x.png", "--plafond", "2", "--attendre", "bientôt"])).toThrow(/Attente illisible/);
  });
});

/* ------------------------------------------------------------------ */
/* Relecture argent : drapeaux de validation refusés en mode réel, un seul lanceur par vidéo */
/* ------------------------------------------------------------------ */

describe("lanceur, mode réel : jamais de validation par la ligne de commande", () => {
  it("--reel avec --valider-carte ou --valider-script : refus clair (code 1), rien n'est branché ni appelé", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-drapeaux-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    for (const drapeau of ["--valider-carte", "--valider-script"]) {
      let branches = 0;
      const lignes: string[] = [];
      const code = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", dossier, "--reel", drapeau]), {
        ecrire: (l) => lignes.push(l),
        branchements: async () => {
          branches++;
          throw new Error("ne doit pas être branché");
        },
      });
      expect(code).toBe(1);
      expect(branches).toBe(0);
      expect(lignes.join("\n")).toMatch(/se valident dans le studio.*Rien n'a été lancé ni payé/);
      expect(existsSync(join(dossier, "etat.json"))).toBe(false);
    }
  });

  it("branchements avec vitrine (mode réel) et --valider-script : refus (code 1), aucun appel, rien de publié", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "iv-lanceur-drapeaux-vitrine-"));
    const image = join(dossier, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const studio = studioDouble(m, new ServeurDouble());
    const code = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", dossier, "--valider-carte", "--valider-script"]), { ecrire: () => undefined, branchements: studio.branchements });
    expect(code).toBe(1);
    expect(m.appelsClaude).toEqual([]);
    expect(m.lus).toEqual([]);
    expect(studio.publies).toEqual([]);
  });
});

describe("lanceur, mode réel : un seul lanceur à la fois par vidéo (bail dans la base du studio)", () => {
  it("un second lanceur sur la même image (autre dossier) pendant --attendre s'arrête net (code 3) sans rien payer ; libre ensuite", async () => {
    const { verrouillerLanceurIV } = await import("@/services/image-video-lanceur");
    const racine = mkdtempSync(join(tmpdir(), "iv-lanceur-verrou-"));
    const image = join(racine, "image.png");
    writeFileSync(image, pngSimule(1080, 1350));
    const m = monde();
    const studio = studioDouble(m, new ServeurDouble());
    const branchements = async (demande: { videoId: string }) => ({ ...(await studio.branchements()), verrouiller: () => verrouillerLanceurIV(demande.videoId) });
    const lignesSecond: string[] = [];
    let codeSecond: number | null = null;
    let appelsAvantSecond = -1;
    let appelsApresSecond = -1;
    let attentes = 0;
    const attendre = async () => {
      attentes++;
      if (attentes === 1) {
        appelsAvantSecond = m.appelsClaude.length;
        codeSecond = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", join(racine, "b"), "--reseaux", "youtube-shorts"]), { ecrire: (l) => lignesSecond.push(l), branchements, attendre: async () => undefined });
        appelsApresSecond = m.appelsClaude.length;
      }
    };
    const premier = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", join(racine, "a"), "--reseaux", "youtube-shorts", "--attendre", "0,25"]), { ecrire: () => undefined, branchements, attendre });
    expect(premier).toBe(5);
    expect(codeSecond).toBe(3);
    expect(appelsApresSecond).toBe(appelsAvantSecond);
    expect(lignesSecond.join("\n")).toMatch(/déjà fabriquée par un autre lanceur.*Rien n'a été lancé ni payé/);
    expect(existsSync(join(racine, "b", "etat.json"))).toBe(false);
    // Le premier a rendu le bail : un lanceur suivant reprend la main.
    const suivant = await lancer(lireArguments(["--image", image, "--plafond", "5", "--dossier", join(racine, "a"), "--reseaux", "youtube-shorts"]), { ecrire: () => undefined, branchements, attendre: async () => undefined });
    expect(suivant).toBe(5);
  });

  it("bail : exclusif, prolongé par son titulaire, repris à l'expiration (lanceur mort) ; un bail perdu arrête le lanceur", async () => {
    const { prendreBail, rendreBail } = await import("@/donnees/memoire");
    const { verrouillerLanceurIV, cleVerrouLanceurIV } = await import("@/services/image-video-lanceur");
    const cle = cleVerrouLanceurIV("v-bail");
    expect(await prendreBail(cle, "a", 60_000)).toBe(true);
    expect(await prendreBail(cle, "b", 60_000)).toBe(false);
    expect(await prendreBail(cle, "a", 60_000)).toBe(true);
    await rendreBail(cle, "b");
    expect(await prendreBail(cle, "b", 60_000)).toBe(false);
    await rendreBail(cle, "a");
    expect(await prendreBail(cle, "b", 1)).toBe(true);
    await new Promise((ok) => setTimeout(ok, 5));
    expect(await prendreBail(cle, "c", 60_000)).toBe(true);
    await rendreBail(cle, "c");

    let horloge = 0;
    let accepte = true;
    const v = await verrouillerLanceurIV("v-perdu", { titulaire: "a", dureeMs: 100, prolongerMs: 1, maintenant: () => horloge, prendre: async () => accepte, rendre: async () => undefined });
    expect(v?.perdu()).toBe(false);
    horloge = 100;
    expect(v?.perdu()).toBe(true);
    await v?.rendre();
    horloge = 0;
    const w = await verrouillerLanceurIV("v-perdu", { titulaire: "a", dureeMs: 100, prolongerMs: 1, maintenant: () => horloge, prendre: async () => accepte, rendre: async () => undefined });
    accepte = false;
    await new Promise((ok) => setTimeout(ok, 10));
    expect(w?.perdu()).toBe(true);
    await w?.rendre();
    expect(await verrouillerLanceurIV("v-pris", { prendre: async () => false })).toBeNull();
  });
});
