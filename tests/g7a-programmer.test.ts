/**
 * G7a : « PROGRAMMER LES N » DÉVERROUILLÉ (plan v5 B.5.5, B.0 n° 62). Les versions d'un sujet qui ont leur vidéo, un
 * format à la fois, chacune sur SON réseau, dans l'ordre J à J+4 de `classement-generateur.ts` ; chaque envoi passe par
 * `envoyerVersBuffer` (SIMULÉ ici : aucun appel à Buffer, rien n'est publié).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { controlerCreneauManuel, planProgrammation, versionsAProgrammer, type VersionProgrammable } from "@/domaine/mesures";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const pub = await import("@/services/publications");
const mes = await import("@/services/mesures");

const MDP = "essai-g7a-programmer";
const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
/** Vidéos prêtes de la démonstration, rangées sous les 5 versions. */
const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const v = (code: string, reseau: VersionProgrammable["reseau"], extra: Partial<VersionProgrammable> = {}): VersionProgrammable => ({ id: `id-${code}`, code, reseau, formatId: "avocat", etatCase: "en-video", videoId: `vid-${code}`, rangLigne: 0, ...extra });

describe("versions retenues et créneaux (pur)", () => {
  it("seulement les versions qui ont leur vidéo ; un format à la fois ; une par réseau (1re ligne d'abord) ; jamais deux fois", () => {
    const versions = [
      v("0042-AV-TT", "tiktok"),
      v("0042-AV-TT-L", "tiktok", { rangLigne: 1 }),
      v("0042-AV-LI", "linkedin"),
      v("0042-AV-IG", "instagram", { etatCase: "validee", videoId: undefined }),
      v("0042-AV-FB", "facebook", { etatCase: "programmee" }),
      v("0042-PO-YS", "youtube-shorts", { formatId: "podcast", rangLigne: 2 }),
    ];
    expect(versionsAProgrammer(versions).map((x) => x.code)).toEqual(["0042-AV-TT", "0042-AV-LI"]);
    expect(versionsAProgrammer(versions, { formatId: "podcast" }).map((x) => x.code)).toEqual(["0042-PO-YS"]);
    expect(versionsAProgrammer(versions, { dejaEnvoyees: new Set(["id-0042-AV-TT"]) }).map((x) => x.code)).toEqual(["0042-AV-LI", "0042-AV-TT-L"]);
  });

  it("ordre J à J+4 (TikTok, Reels, Shorts, LinkedIn, Facebook) ; LinkedIn tombé un samedi passe au lundi ; 9 h à Paris par défaut", () => {
    const retenues = CINQ.map((r, i) => v(`0042-AV-${i}`, r));
    // J = jeudi 8 octobre 2026 : LinkedIn J+3 = dimanche 11 → lundi 12.
    const c = planProgrammation("2026-10-08", retenues, undefined, { instagram: "18:30" });
    expect(c.map((x) => [x.reseau, x.rang, x.jour])).toEqual([
      ["tiktok", 0, "2026-10-08"],
      ["instagram", 1, "2026-10-09"],
      ["youtube-shorts", 2, "2026-10-10"],
      ["linkedin", 3, "2026-10-12"],
      ["facebook", 4, "2026-10-12"],
    ]);
    expect(c.find((x) => x.reseau === "linkedin")?.decaleWeekEnd).toBe(true);
    expect(c[0]).toMatchObject({ date: "2026-10-08T07:00:00.000Z", heureParDefaut: true });
    expect(c[1]).toMatchObject({ date: "2026-10-09T16:30:00.000Z", heureParDefaut: false, heure: "18:30" });
  });
});

/** n° du sujet, 5 réseaux, versions validées, une vidéo prête rangée sous chacune, « Avant de publier » coché. */
async function sujetPret(options: { cocher?: boolean } = {}) {
  await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" });
  if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
  const vue = (await gen.obtenirSujet(s.id))!;
  await gen.validerVersions(vue.versions.map((x) => x.variante.id));
  for (const [i, r] of CINQ.entries()) {
    const version = vue.versions.find((x) => x.variante.reseau === r)!;
    await gen.rangerVideo(VIDEOS[i], version.variante.id);
    if (options.cocher !== false) for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEOS[i], c, true);
  }
  return s.id;
}

describe("« Programmer les N » déverrouillé", () => {
  it("le plan propose les 5 versions dans l'ordre J à J+4, puis chacune part sur SON réseau avec sa version (essai)", async () => {
    // Le jour J (05/10/2026) doit rester À VENIR : un brouillon déjà passé ne compte plus comme envoyé (« pas encore
    // passées »). Écrit le 03/10, ce test devenait rouge à partir du 05/10 : l'horloge est figée au 03/10.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const id = await sujetPret();
    const plan = await mes.planProgrammerSujet(id, { jourJ: "2026-10-05" });
    expect(plan.envoiSimule).toBe(true);
    expect(plan.formatId).toBe("avocat");
    expect(plan.creneaux.map((c) => [c.reseau, c.jour])).toEqual([
      ["tiktok", "2026-10-05"],
      ["instagram", "2026-10-06"],
      ["youtube-shorts", "2026-10-07"],
      ["linkedin", "2026-10-08"],
      ["facebook", "2026-10-09"],
    ]);
    const r = await mes.programmerSujet(id, { jourJ: "2026-10-05" });
    expect(r.simulation).toBe(true);
    expect(r.ignorees).toEqual([]);
    expect(r.programmees).toHaveLength(5);
    const pubs = await depots().publications.lister((p) => r.programmees.some((x) => x.publicationId === p.id));
    for (const p of pubs) {
      const variante = await depots().variantes.obtenir(p.varianteId!);
      expect(variante?.reseau).toBe(p.reseau);
      expect(variante?.videoId).toBe(p.videoId);
      expect(p.idExterne).toBeTruthy();
      expect(p.lienSuivi).toContain(`utm_campaign=${variante!.code}`);
      // Essai : jamais affiché comme programmé.
      expect(p).toMatchObject({ via: "simulation", statut: "brouillon" });
    }
    expect(pubs.find((p) => p.reseau === "linkedin")?.date).toBe("2026-10-08T07:00:00.000Z");
    // Jamais deux fois : le plan suivant est vide.
    expect((await mes.planProgrammerSujet(id, { jourJ: "2026-10-05" })).creneaux).toHaveLength(0);
  });

  it("une version dont « Avant de publier » n'est pas coché n'est pas envoyée, la raison est rendue", async () => {
    const id = await sujetPret({ cocher: false });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier("v-15", c, true);
    const r = await mes.programmerSujet(id, { jourJ: "2026-10-05" });
    // v-01 et v-13 (démonstration) ont déjà leurs cases cochées ; v-02 (Reels) et v-11 (LinkedIn) non.
    expect(r.programmees.map((x) => x.reseau)).toEqual(["tiktok", "youtube-shorts", "facebook"]);
    expect(r.ignorees.map((x) => x.reseau)).toEqual(["instagram", "linkedin"]);
    // Le message dit ce qui manque, accordé au nombre (« Il reste 1 vérification sur 4 : Droits. »).
    expect(r.ignorees[0].message).toMatch(/Avant de publier|Il reste \d+ vérifications? sur \d/);
  });

  it("une version sans vidéo n'est jamais proposée", async () => {
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "Sans vidéo", reseaux: ["tiktok"], formatId: "avocat" });
    await gen.ecrireSujetSimule(s.id);
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    expect((await mes.planProgrammerSujet(s.id)).creneaux).toHaveLength(0);
  });

  it("le verrou « Bientôt » a disparu de la fiche sujet et de la feuille Buffer", () => {
    const racine = join(__dirname, "..");
    for (const f of ["src/components/generateur/FicheSujet.tsx", "src/components/publication/FeuilleEnvoyer.tsx"]) {
      const s = readFileSync(join(racine, f), "utf8");
      expect(s).not.toMatch(/la mesure des résultats doit être branchée/);
    }
    expect(readFileSync(join(racine, "src/components/publication/FeuilleEnvoyer.tsx"), "utf8")).toMatch(/\?programmer=1/);
  });
});

describe("même garde que la feuille Buffer", () => {
  it("une vidéo sans le format d'image du réseau n'est pas programmée (raison rendue)", async () => {
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "Format d'image absent", reseaux: ["tiktok"], formatId: "avocat" });
    await gen.ecrireSujetSimule(s.id);
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    // v-12 (démonstration) n'existe qu'en 16:9.
    await gen.rangerVideo("v-12", vue.versions[0].variante.id);
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier("v-12", c, true);
    const r = await mes.programmerSujet(s.id, { jourJ: "2026-10-05" });
    expect(r.programmees).toHaveLength(0);
    expect(r.ignorees).toEqual([expect.objectContaining({ reseau: "tiktok" })]);
  });
});

describe("L3-18 : « Programmer les N » tient compte des autres sujets (pur)", () => {
  it("un autre sujet LinkedIn à J+3 09:00 : le second est décalé au jour libre suivant, avec un motif en français", () => {
    // J = lundi 5 octobre 2026 : LinkedIn J+3 = jeudi 8 à 9 h (7 h UTC, heure d'été).
    const autres = [{ reseau: "linkedin" as const, date: "2026-10-08T07:00:00.000Z" }];
    const c = planProgrammation("2026-10-05", CINQ.map((r, i) => v(`0042-AV-${i}`, r)), undefined, {}, autres).find((x) => x.reseau === "linkedin")!;
    // J+4 (vendredi 9) est le jour de Facebook : on saute au premier jour libre du plan, lundi 12.
    expect(c.jour).toBe("2026-10-12");
    expect(c.date).toBe("2026-10-12T07:00:00.000Z");
    expect(c.motif).toMatch(/autre sujet.*LinkedIn|LinkedIn.*autre sujet/);
    expect(c.motif).toMatch(/jeudi/);
  });

  it("sans autre sujet à ce créneau, rien n'est décalé et aucun motif", () => {
    const autres = [{ reseau: "linkedin" as const, date: "2026-10-09T07:00:00.000Z" }, { reseau: "tiktok" as const, date: "2026-10-08T07:00:00.000Z" }];
    const c = planProgrammation("2026-10-05", CINQ.map((r, i) => v(`0042-AV-${i}`, r)), undefined, {}, autres).find((x) => x.reseau === "linkedin")!;
    expect(c).toMatchObject({ jour: "2026-10-08", date: "2026-10-08T07:00:00.000Z" });
    expect(c.motif).toBeUndefined();
  });

  it("un décalage qui tombe un samedi : AVERTISSEMENT sur LinkedIn, jamais un refus ; Vous pouvez confirmer", () => {
    const r = controlerCreneauManuel("linkedin", "2026-10-10", "09:00", []);
    expect(r.ok).toBe(true);
    expect(r.avertissements.join(" ")).toMatch(/samedi/);
    expect(r.avertissements.join(" ")).toMatch(/vous pouvez confirmer/i);
    expect(r.date).toBe("2026-10-10T07:00:00.000Z");
  });

  it("un décalage manuel est revalidé contre les autres sujets : avertissement, pas de refus", () => {
    const r = controlerCreneauManuel("linkedin", "2026-10-08", "09:00", [{ reseau: "linkedin", date: "2026-10-08T07:00:00.000Z" }]);
    expect(r.ok).toBe(true);
    expect(r.avertissements.join(" ")).toMatch(/autre sujet/);
    expect(controlerCreneauManuel("tiktok", "2026-10-10", "09:00", []).avertissements).toEqual([]);
  });
});

describe("L3-18 (corrections) : décalage fiable (pur)", () => {
  const cinq = (extra: Partial<VersionProgrammable> = {}) => CINQ.map((r, i) => v(`0042-AV-${i}`, r, extra));
  const li = (jourJ: string, autres: { reseau: (typeof CINQ)[number]; date: string }[]) => planProgrammation(jourJ, cinq(), undefined, {}, autres).find((x) => x.reseau === "linkedin")!;

  it("samedi LinkedIn puis conflit le lundi : l'avertissement dit le jour FINAL (mardi), jamais « lundi »", () => {
    // J = mercredi 7 : LinkedIn J+3 = samedi 10 → lundi 12 ; un autre sujet LinkedIn le lundi 12 à 9 h → mardi 13.
    const c = li("2026-10-07", [{ reseau: "linkedin", date: "2026-10-12T07:00:00.000Z" }]);
    expect(c.jour).toBe("2026-10-13");
    expect(c.avertissement).toMatch(/mardi/);
    expect(c.avertissement).not.toMatch(/lundi/);
    expect(c.avertissement).toMatch(/Vous pouvez confirmer/);
  });

  it("aucun jour libre trouvé : on garde le jour d'origine, pas de faux motif « décalée », un avertissement à confirmer", () => {
    const autres: { reseau: "linkedin"; date: string }[] = [];
    for (let i = 0; i < 150; i++) autres.push({ reseau: "linkedin", date: new Date(Date.UTC(2026, 9, 1 + i, 7, 0)).toISOString() });
    const c = li("2026-10-05", autres);
    expect(c.jour).toBe("2026-10-08");
    expect(c.date).toBe("2026-10-08T07:00:00.000Z");
    expect(c.motif ?? "").not.toMatch(/décalée au/);
    expect(c.avertissement).toMatch(/Vous pouvez confirmer/);
  });

  it("un autre sujet LinkedIn le même jour à une AUTRE heure (9 h 30) : conflit vu, version décalée", () => {
    const c = li("2026-10-05", [{ reseau: "linkedin", date: "2026-10-08T07:30:00.000Z" }]);
    expect(c.jour).not.toBe("2026-10-08");
    expect(c.motif).toMatch(/autre sujet/);
  });

  it("le décalage ne tombe jamais sur le jour d'un autre réseau du MÊME sujet", () => {
    // LinkedIn J+3 = jeudi 8 (pris) ; J+4 = vendredi 9 = jour de Facebook → on va au premier jour libre du plan : lundi 12.
    const plan = planProgrammation("2026-10-05", cinq(), undefined, {}, [{ reseau: "linkedin", date: "2026-10-08T07:00:00.000Z" }]);
    const jours = plan.map((x) => x.jour);
    expect(new Set(jours).size).toBe(jours.length);
    expect(plan.find((x) => x.reseau === "linkedin")!.jour).toBe("2026-10-12");
  });

  it("le motif nomme le réseau (TikTok, YouTube Shorts), pas « ce réseau »", () => {
    const tk = planProgrammation("2026-10-05", cinq(), undefined, {}, [{ reseau: "tiktok", date: "2026-10-05T07:00:00.000Z" }]).find((x) => x.reseau === "tiktok")!;
    expect(tk.motif).toMatch(/TikTok/);
    expect(tk.motif).not.toMatch(/ce réseau/);
    const yt = planProgrammation("2026-10-05", cinq(), undefined, {}, [{ reseau: "youtube-shorts", date: "2026-10-07T07:00:00.000Z" }]).find((x) => x.reseau === "youtube-shorts")!;
    expect(yt.motif).toMatch(/YouTube Shorts/);
  });

  it("décalage manuel : un autre sujet le même jour à une autre heure est signalé, avec le nom du réseau", () => {
    const r = controlerCreneauManuel("tiktok", "2026-10-08", "09:00", [{ reseau: "tiktok", date: "2026-10-08T15:30:00.000Z" }]);
    expect(r.avertissements.join(" ")).toMatch(/autre sujet.*TikTok|TikTok.*autre sujet/);
  });
});

describe("L3-18 : le plan lit les autres sujets (essai, aucun appel réel)", () => {
  it("un brouillon LinkedIn d'un autre sujet à J+3 09:00 décale la version LinkedIn, avec le motif", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const id = await sujetPret();
    const t = new Date().toISOString();
    await depots().publications.enregistrer({ id: "pub-autre", videoId: "v-03", varianteId: "autre-variante", reseau: "linkedin", statut: "programmee", via: "simulation", date: "2026-10-08T07:00:00.000Z", texte: "", creeLe: t, modifieLe: t } as never);
    const plan = await mes.planProgrammerSujet(id, { jourJ: "2026-10-05" });
    const li = plan.creneaux.find((c) => c.reseau === "linkedin")!;
    expect(li.jour).toBe("2026-10-12");
    expect(li.motif).toBeTruthy();
    expect(plan.creneaux.find((c) => c.reseau === "tiktok")?.motif).toBeUndefined();
  });

  it("un autre sujet sans varianteId (même réseau, même jour, autre heure) décale aussi ; un sujet déjà passé, non", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const id = await sujetPret();
    const t = new Date().toISOString();
    await depots().publications.enregistrer({ id: "pub-libre", videoId: "v-03", reseau: "linkedin", statut: "programmee", via: "simulation", date: "2026-10-08T13:30:00.000Z", texte: "", creeLe: t, modifieLe: t } as never);
    await depots().publications.enregistrer({ id: "pub-passee", videoId: "v-04", reseau: "tiktok", statut: "publiee", via: "simulation", date: "2026-10-01T07:00:00.000Z", texte: "", creeLe: t, modifieLe: t } as never);
    const plan = await mes.planProgrammerSujet(id, { jourJ: "2026-10-05" });
    expect(plan.creneaux.find((c) => c.reseau === "linkedin")!.motif).toMatch(/LinkedIn/);
    expect(plan.creneaux.find((c) => c.reseau === "tiktok")?.motif).toBeUndefined();
  });

  it("décalage manuel : un jour ou une heure qui n'existent pas sont refusés (INVALIDE)", async () => {
    const id = await sujetPret();
    for (const [jour, heure] of [["2026-13-45", "09:00"], ["2026-02-30", "09:00"], ["2026-10-08", "25:99"], ["2026-10-08", "24:00"]]) {
      await expect(mes.controlerDecalageManuel(id, "linkedin", jour, heure)).rejects.toMatchObject({ code: "INVALIDE" });
    }
    await expect(mes.controlerDecalageManuel(id, "linkedin", "2026-10-08", "23:59")).resolves.toMatchObject({ ok: true });
  });

  it("aucun texte ne promet un choix « en prendre un autre » que l'écran ne permet pas : seul « Confirmer » existe", () => {
    const c = planProgrammation("2026-10-07", CINQ.map((r, i) => v(`0042-AV-${i}`, r)), undefined, {}, [{ reseau: "linkedin", date: "2026-10-12T07:00:00.000Z" }]).find((x) => x.reseau === "linkedin")!;
    expect(c.avertissement).toMatch(/Vous pouvez confirmer/);
    expect(c.avertissement).not.toMatch(/en prendre un autre/);
    const m = controlerCreneauManuel("linkedin", "2026-10-10", "09:00", []);
    expect(m.avertissements.join(" ")).not.toMatch(/en prendre un autre/);
  });

  it("aucun prénom de personne dans les commentaires de mesures.ts (dépôt public)", () => {
    const src = readFileSync(join(__dirname, "..", "src/domaine/mesures.ts"), "utf8");
    const prenom = ["Wi", "ll"].join(""); // jamais écrit en clair dans le dépôt public
    expect(src).not.toMatch(new RegExp(`\\b${prenom}`));
  });

  it("l'envoi de mesures.ts reste branché sur envoyerVersBuffer (non modifié par cette fiche)", () => {
    const src = readFileSync(join(__dirname, "..", "src/services/mesures.ts"), "utf8");
    expect(src).toMatch(/envoyerVersBuffer\(c\.videoId, \[c\.reseau\], c\.date\)/);
  });
});
