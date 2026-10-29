/**
 * Page « À publier » simplifiée : une carte par vidéo, réseaux pas prêts regroupés, détail replié, une seule case
 * « J'ai regardé la vidéo » qui coche les vérifications requises, et le serveur qui refuse toujours sans vérifications.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));

const { LignesAPublier } = await import("@/components/publication/LignesAPublier");
const { casesAChanger, rapportLecteur, regrouperParVideo, toutesCochees } = await import("@/components/publication/regrouper-a-publier");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const AUCUNE = { image: false, son: false, sousTitres: false, mentionIA: false, droits: false };

function ligne(videoId: string, reseau: "instagram" | "facebook" | "linkedin" | "tiktok", x: Partial<LigneAPublier> = {}): LigneAPublier {
  return {
    famille: "video", cle: `${videoId}:${reseau}`, videoId, titre: `Titre ${videoId}`, jaquette: null, lecture: `/v/${videoId}.mp4`, reseau, reseauNom: reseau[0].toUpperCase() + reseau.slice(1),
    texte: "Phrase", motsDiese: [], apercu: "Phrase", commentaireTransmissible: true, compte: { nom: "Axion", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: { ...AUCUNE }, ...x,
  } as LigneAPublier;
}
const vue = (lignes: LigneAPublier[], x: Partial<VueAPublier> = {}): VueAPublier => ({ envoiSimule: false, modeBuffer: "brouillon", lignes, ...x });
const html = (v: VueAPublier) => renderToStaticMarkup(createElement(LignesAPublier, { vue: v }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

describe("À publier simplifiée — affichage", () => {
  const six = (id: string) => [ligne(id, "instagram"), ligne(id, "facebook"), ligne(id, "linkedin"), ligne(id, "tiktok", { blocage: "Aucun fichier au bon format pour Tiktok." })];

  it("une seule carte par vidéo, même avec plusieurs réseaux", () => {
    const h = html(vue([...six("v-1"), ...six("v-2")]));
    expect(h.match(/<li /g)?.length).toBe(2);
    expect(h.match(/Titre v-1/g)?.length).toBe(1);
    expect(regrouperParVideo([...six("v-1"), ...six("v-2")]).map((c) => c.videoId)).toEqual(["v-1", "v-2"]);
  });

  it("un bouton par réseau prêt ; les réseaux pas prêts sont regroupés en une ligne avec la raison", () => {
    const cartes = regrouperParVideo([ligne("v-1", "instagram"), ligne("v-1", "facebook", { compte: { probleme: "Aucun compte Facebook n'est relié dans Buffer." } }), ligne("v-1", "tiktok", { blocage: "Aucun fichier au bon format pour Tiktok." })]);
    expect(cartes[0].pretes.map((l) => l.reseau)).toEqual(["instagram"]);
    expect(cartes[0].pasPretes.map((p) => p.reseau)).toEqual(["facebook", "tiktok"]);
    const t = texte(html(vue([ligne("v-1", "instagram"), ligne("v-1", "facebook", { compte: { probleme: "Aucun compte Facebook n'est relié dans Buffer." } }), ligne("v-1", "tiktok", { blocage: "Aucun fichier au bon format pour Tiktok." })])));
    expect(t).toContain("2 réseaux pas encore prêts");
    expect(t).toContain("Aucun compte Facebook n'est relié dans Buffer.");
    expect(t).toContain("Aucun fichier au bon format pour Tiktok.");
    expect(t.match(/Aucun fichier au bon format/g)?.length).toBe(1);
  });

  it("le détail est replié par défaut (aucun <details> ouvert) et contient phrase, commentaire, compte, date et cases", () => {
    const h = html(vue([ligne("v-1", "instagram", { premierCommentaire: "Le lien" })]));
    expect(h).not.toMatch(/<details[^>]*\bopen\b/);
    expect(h).toContain("Voir le détail");
    const t = texte(h);
    for (const m of ["Phrase du post", "Premier commentaire", "Compte Buffer", "Date", "Avant de publier", "Sous-titres", "Mention IA", "Droits"]) expect(t).toContain(m);
    // Le panneau du réseau est masqué tant qu'on n'a pas cliqué sur son bouton.
    expect(h).toMatch(/aria-expanded="false"/);
    expect(h).toMatch(/id="reseau-v-1-instagram"[^>]*hidden/);
  });

  it("une seule case « J'ai regardé la vidéo » au premier niveau, une seule action principale par réseau", () => {
    const h = html(vue([ligne("v-1", "instagram"), ligne("v-1", "facebook")]));
    const t = texte(h);
    expect(t).toContain("J'ai regardé la vidéo, tout est en règle");
    expect(t.match(/Mettre en brouillon dans Buffer/g)?.length).toBe(2);
    expect(t).not.toMatch(/Mettre le sujet en brouillon|Programmer programme|Programmer. programme/);
  });

  it("le bouton du sujet n'apparaît que si la vidéo vient d'un sujet", () => {
    expect(texte(html(vue([ligne("v-1", "instagram", { sujetId: "s-1" })])))).toContain("Mettre le sujet en brouillon");
    expect(texte(html(vue([ligne("v-1", "instagram")])))).not.toContain("sujet");
  });

  it("une vidéo d'essai ou d'exemple : une seule phrase, aucun réseau prêt", () => {
    const msg = "Vidéo d'essai : elle ne part pas sur vos réseaux.";
    const l = (r: "instagram" | "facebook") => ligne("v-1", r, { blocage: msg, blocageVideo: true });
    const c = regrouperParVideo([l("instagram"), l("facebook")])[0];
    expect(c.pretes).toEqual([]);
    expect(c.pasPretes).toEqual([]);
    expect(texte(html(vue([l("instagram"), l("facebook")]))).match(/Vidéo d'essai/g)?.length).toBe(1);
  });

  it("vouvoiement, pas de message technique répété", () => {
    const t = texte(html(vue([ligne("v-1", "instagram"), ligne("v-1", "facebook")])));
    expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
  });
});

describe("À publier simplifiée — la case unique", () => {
  it("coche d'un geste les 5 vérifications requises, et seulement celles qui manquent", () => {
    expect(casesAChanger(CASES, AUCUNE, true)).toEqual([...CASES]);
    expect(casesAChanger(CASES, { ...AUCUNE, son: true, droits: true }, true)).toEqual(["image", "sousTitres", "mentionIA"]);
    expect(casesAChanger(CASES, { image: true, son: true, sousTitres: true, mentionIA: true, droits: true }, true)).toEqual([]);
    expect(casesAChanger(CASES, { image: true, son: true, sousTitres: true, mentionIA: true, droits: true }, false)).toEqual([...CASES]);
  });

  it("n'est cochée que si TOUTES les vérifications requises le sont ; mention IA coupée : 4 cases suffisent", () => {
    expect(toutesCochees(CASES, { image: true, son: true, sousTitres: true, mentionIA: true, droits: false })).toBe(false);
    expect(toutesCochees(CASES, { image: true, son: true, sousTitres: true, mentionIA: true, droits: true })).toBe(true);
    const quatre = CASES.filter((c) => c !== "mentionIA");
    expect(toutesCochees(quatre, { image: true, son: true, sousTitres: true, mentionIA: false, droits: true })).toBe(true);
    expect(toutesCochees([], {})).toBe(false);
  });
});

describe("À publier simplifiée — le serveur garde ses gardes", () => {
  const MDP = "essai-carte-video";
  const VIDEO = "v-15";
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(async () => {
    reinitialiserDepots();
    await exemplesCommeVraies(depots(), { plusExemples: true });
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
  });
  const demain = () => new Date(Date.now() + 86_400_000).toISOString();

  it("un envoi sans aucune vérification est refusé, rien n'est créé", async () => {
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/vérification/);
    expect(await depots().publications.compter((p) => p.videoId === VIDEO)).toBe(0);
  });

  it("une vérification manquante suffit à refuser ; toutes cochées, l'envoi passe (essai)", async () => {
    for (const c of CASES.filter((x) => x !== "droits")) await pub.cocherAvantDePublier(VIDEO, c, true);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/vérification/);
    await pub.cocherAvantDePublier(VIDEO, "droits", true);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], demain());
    expect(r.simulation).toBe(true);
  });
});

describe("À publier — petits défauts de la relecture", () => {
  const publiee = { libelle: "Publiée", ton: "sauge" as const, lien: "https://exemple.test/p/1", envoye: true, comptesPris: [], sansCompte: false };
  const echec = { libelle: "Échec", ton: "brique" as const, detail: "Refusé par Buffer", envoye: false, comptesPris: [], sansCompte: false };

  it("un réseau pas prêt garde son état (Publiée + lien, échec) dans la ligne repliable", () => {
    const lignes = [ligne("v-1", "instagram"), ligne("v-1", "facebook", { blocage: "Aucun fichier au bon format pour Facebook.", etat: publiee }), ligne("v-1", "linkedin", { compte: { probleme: "Aucun compte LinkedIn." }, etat: echec })];
    const c = regrouperParVideo(lignes)[0];
    expect(c.pasPretes.map((p) => p.etat?.libelle)).toEqual(["Publiée", "Échec"]);
    const h = html(vue(lignes));
    expect(h).toContain('href="https://exemple.test/p/1"');
    expect(texte(h)).toContain("Voir la publication");
    expect(texte(h)).toContain("Refusé par Buffer");
  });

  it("les pastilles d'état disent à quel réseau elles s'appliquent", () => {
    const t = texte(html(vue([ligne("v-1", "instagram", { etat: publiee }), ligne("v-1", "facebook", { etat: echec })])));
    expect(t).toContain("Instagram : Publiée");
    expect(t).toContain("Facebook : Échec");
  });

  it("le bouton d'envoi est désactivé pendant l'écriture des cases", async () => {
    const src = (await import("node:fs")).readFileSync("src/components/publication/LignesAPublier.tsx", "utf8");
    expect(src).toMatch(/disabled=\{!peutEnvoyer \|\| enCoursCases\}/);
  });
});

describe("À publier — lecteur sans rognage", () => {
  it("montre la vidéo entière : jamais de cadre 9:16 forcé ni de object-cover", () => {
    const h = html(vue([ligne("v-1", "instagram", { dimensions: { largeur: 1080, hauteur: 1350 } })]));
    const lecteur = h.match(/<video[^>]*>/)![0];
    expect(lecteur).toContain("object-contain");
    expect(lecteur).not.toContain("object-cover");
    expect(lecteur).not.toContain("aspect-[9/16]");
    expect(h).not.toContain("aspect-[9/16]");
  });

  it("le cadre suit le vrai rapport de la vidéo (4:5, 16:9, 9:16), sinon aucun cadre imposé", () => {
    expect(html(vue([ligne("v-1", "linkedin", { dimensions: { largeur: 1080, hauteur: 1350 } })]))).toMatch(/aspect-ratio:\s*1080 \/ 1350/);
    expect(html(vue([ligne("v-2", "facebook", { dimensions: { largeur: 1920, hauteur: 1080 } })]))).toMatch(/aspect-ratio:\s*1920 \/ 1080/);
    expect(rapportLecteur({ largeur: 1080, hauteur: 1920 })).toBe("1080 / 1920");
    expect(rapportLecteur(null)).toBeUndefined();
    expect(html(vue([ligne("v-3", "instagram")]))).not.toContain("aspect-ratio");
  });
});
