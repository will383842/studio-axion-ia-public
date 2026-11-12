/**
 * LOT D'IMAGES · L11 — essai de bout en bout SIMULÉ (plan § h.3) : un lot de 5 images, fabriqué par la vraie boucle de
 * fond et le vrai moteur « Image → vidéo », avec des outils simulés (Claude, voix, rendu, stockage) : `fetch` espionné,
 * jamais appelé. Un redémarrage du serveur est simulé pendant la fabrication de la 3e image.
 *
 *  1 propre → faite · 2 deux lectures qui divergent → mise de côté (carte) · 3 propre → faite (redémarrage au milieu)
 *  4 formule trop affirmative dans le script → mise de côté (script) · 5 propre → faite.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { LotIV } from "@/domaine/image-video/lot";
import type { EtatFabricationIV, OutilsFabricationIV } from "@/moteurs/montage-image-video";
import { mockHeaders } from "../../helpers/next-mocks";
import { carteFixe, monde, outilsSimules, type Monde, type OptionsMonde } from "../doubles-fabrication";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";

vi.setConfig({ testTimeout: 600_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
// Ce test décrit le lot « en cas de doute » : ce qui est douteux est mis de côté. Le défaut est « automatique » (../mode-automatique.test.ts).
vi.mock("@/formats/image-video", async (orig) => {
  const v = await orig<typeof import("@/formats/image-video")>();
  const s = v.schemaReglagesImageVideo;
  const avec = (x: unknown) => ({ ...(x as object), validationCarte: "si-doute" });
  return { ...v, schemaReglagesImageVideo: { parse: (x: unknown) => s.parse(avec(x)), safeParse: (x: unknown) => s.safeParse(avec(x)) } };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const reseau = vi.spyOn(globalThis, "fetch");

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { brancherServicesImageVideo, tarifVoixCentimesEur } = await import("@/moteurs/montage-image-video");
const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
const boucle = await import("@/services/boucle");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const lots = await import("@/services/image-video-lot");
const ecran = await import("@/services/image-video-ecran");
const partages = await import("@/services/partages");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

/** Une image du jeu d'essai, sous un autre nom (même contenu lu, autre fichier). */
function variante(base: CarteImage, nom: string): CarteImage {
  const c = structuredClone(base);
  // Même contenu (et même empreinte : l'écriture simulée retrouve ainsi son script), autre fichier.
  return { ...c, image: { ...c.image, cle: `images/${nom}.png` } };
}

interface Image {
  nom: string;
  carte: CarteImage;
  options: OptionsMonde;
  /** Le script écrit contient cette phrase (formule trop affirmative que la carte ne laisse pas voir). */
  ajouteAuScript?: string;
}

function jeu(): Image[] {
  const propre = carteFixe("B");
  const ecart = variante(propre, "e2");
  const lecturePropre = lectureDeCarte(ecart);
  return [
    { nom: "e1", carte: variante(propre, "e1"), options: {} },
    { nom: "e2", carte: ecart, options: { lectures: { b: { ...lecturePropre, titre: `${lecturePropre.titre} (autre lecture)` } } } },
    { nom: "e3", carte: variante(propre, "e3"), options: {} },
    { nom: "d4", carte: variante(propre, "d4"), options: {}, ajouteAuScript: "Zéro erreur garanti." },
    { nom: "e5", carte: variante(propre, "e5"), options: {} },
  ];
}

const images = jeu();
const parCle = new Map(images.map((i) => [i.carte.image.cle, i]));
const mondes = new Map<string, Monde>();
/** Les outils d'une vidéo vivent le temps de sa fabrication (le serveur de rendu simulé garde ses travaux d'un pas à l'autre). */
const outilsParVideo = new Map<string, OutilsFabricationIV>();
const etatDe = async (videoId: string) => ((await depots().travaux.lister((t) => t.cibleId === videoId)).sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0]?.parametres?.imageVideo ?? null) as EtatFabricationIV | null;

beforeAll(async () => {
  reinitialiserDepots();
  credits.injecterLecteursPourEssai(null);
  // Les décisions de Will sont lues comme en production (réglages du studio) ; le lot n'en a pas besoin.
  brancherServicesImageVideo({
    outils: async (commande) => {
      const deja = outilsParVideo.get(commande.videoId);
      if (deja) return deja;
      const cle = (commande.entrees as { imageVideo: { imageCle: string } }).imageVideo.imageCle;
      const i = parCle.get(cle)!;
      let m = mondes.get(commande.videoId);
      if (!m) mondes.set(commande.videoId, (m = monde()));
      const sim = outilsSimules(i.carte, m, { cartesValidees: 0, ...i.options });
      // Tarif de la voix : celui de l'estimation du dépôt (comme en production), pas le tarif d'essai des doubles.
      const base = { ...sim, voix: { ...sim.voix, tarifCentimesParCaractere: tarifVoixCentimesEur(CENTIMES_USD_PAR_CARACTERE_HEYGEN, 0.9) } };
      if (i.ajouteAuScript) {
        const appeler = base.ecriture.appeler;
        base.ecriture.appeler = async (role, entree) => {
          const r = await appeler(role, entree);
          const fiche = (r as { donnees?: { ecrans?: { texteDit: string }[] } }).donnees;
          // Pas sur le premier écran : l'accroche est limitée en mots.
          const cible = fiche?.ecrans?.[Math.min(2, (fiche?.ecrans?.length ?? 1) - 1)];
          if (cible) cible.texteDit = `${cible.texteDit} ${i.ajouteAuScript}`;
          return r;
        };
      }
      const decision = async (cleDecision: "carte" | "script") => ((await lireParametre<Record<string, unknown> | null>(`imageVideo.decisions.${commande.videoId}`, null))?.[cleDecision] ?? null) as never;
      const outils = { ...base, decisions: { carte: () => decision("carte"), script: () => decision("script") } };
      outilsParVideo.set(commande.videoId, outils);
      return outils;
    },
    numeroVersion: async () => 42,
  });
  // Le seul réglage posé, dans les dépôts mémoire de CE test : l'essai réel accepté (sinon le moteur refuse tout lancement).
  await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
  // Les 5 images de ce jeu d'essai partagent UNE empreinte (même contenu lu, voir `variante`) : le contrôle « image déjà traitée »
  // (lot L6) les prendrait pour des doublons. Il est éteint ici ; son comportement est testé dans tests/image-video/sujets-traites.
  await ecrireParametre("sujets.garde", "eteint");
});
afterAll(() => {
  expect(reseau).not.toHaveBeenCalled();
});

describe("lot de 5 images, de bout en bout, sans appel payant", () => {
  it("se fabrique une vidéo à la fois, met de côté ce qui est douteux sans payer sa voix, reprend après un redémarrage", async () => {
    const prix = ecran.prixDuDepot(["linkedin"], 0.9);
    const depot = await lots.deposerLotImageVideo(
      { images: images.map((i) => ({ fichierId: `f-${i.nom}`, largeur: 1080, hauteur: 1350 })), reseaux: ["linkedin"], accordCentimes: prix * 5 },
      {
        formatOuvert: () => true,
        voix: async () => ({ voixId: "voix-1", personnageId: "perso-1" }),
        fichier: async (id: string) => {
          const i = images.find((x) => `f-${x.nom}` === id)!;
          return { id, cleStockage: i.carte.image.cle, mime: "image/png", taille: 5000, nom: `${i.nom}.png`, sha256: i.carte.image.empreinte };
        },
        taux: async () => 0.9,
      },
    );
    expect(depot.statut).toBe("lancee");
    const lotId = (depot as { lotId: string }).lotId;
    const lu = async () => (await lots.lireLotIV(lotId)) as LotIV;
    const ids = (await lu()).videos.map((v) => v.videoId);
    expect(ids).toHaveLength(5);

    // La réservation du lot est faite dès l'accord ; rien n'est lancé tant que la boucle n'a pas tourné.
    expect((await depots().reservations.lister((r) => r.travailId === `lot:${lotId}`)).length).toBeGreaterThanOrEqual(0);
    expect(await depots().travaux.lister((t) => ids.includes(t.cibleId))).toHaveLength(0);

    const ordre: string[] = [];
    let redemarre = false;
    let sommets = 0;
    for (let tour = 0; tour < 1500 && (await lu()).statut !== "termine"; tour++) {
      await boucle.contenuDuTour();
      const travaux = await depots().travaux.lister((t) => ids.includes(t.cibleId));
      for (const t of travaux.sort((a, b) => a.creeLe.localeCompare(b.creeLe))) if (!ordre.includes(t.cibleId)) ordre.push(t.cibleId);
      // Jamais deux fabrications Image → vidéo qui avancent en même temps.
      const actifs = travaux.filter((t) => t.statut === "en_cours" || t.statut === "en_file");
      sommets = Math.max(sommets, actifs.length);
      expect(actifs.length).toBeLessThanOrEqual(1);
      // Redémarrage du serveur pendant la fabrication de la 3e image : la boucle repart de la base.
      if (!redemarre && actifs[0]?.cibleId === ids[2]) {
        redemarre = true;
        boucle.avancementsEnVol().clear();
        boucle.simulerRedemarragePourEssai();
      }
    }
    expect(redemarre).toBe(true);
    expect(sommets).toBe(1);

    const lot = await lu();
    expect(lot.statut).toBe("termine");
    expect(ordre).toEqual(ids);
    expect(lot.videos.map((v) => v.statut)).toEqual(["faite", "mise-de-cote", "faite", "mise-de-cote", "faite"]);
    expect(lot.videos[1].miseDeCote).toMatchObject({ porte: "carte", motif: "Les deux lectures de l'image ne disent pas la même chose." });
    expect(lot.videos[3].miseDeCote?.porte).toBe("script");
    expect(lot.videos[3].miseDeCote?.motif).toContain("formule trop affirmative");

    // Aucune voix payée pour les deux vidéos mises de côté ; la caisse n'a que la lecture et l'écriture.
    for (const k of [1, 3]) {
      expect(mondes.get(ids[k])!.lus, `voix lue pour la vidéo ${k + 1}`).toHaveLength(0);
      const e = (await etatDe(ids[k]))!;
      expect([...new Set(e.caisse.reservations.map((r) => r.etape))].every((x) => x === "lecture" || x === "ecriture")).toBe(true);
    }
    // Les autres ont leur voix.
    for (const k of [0, 2, 4]) expect(mondes.get(ids[k])!.lus.length).toBeGreaterThan(0);

    // L'argent : la somme des caisses ne dépasse jamais le prix accordé ; la réservation et l'engagement du lot sont libérés.
    const engage = (await Promise.all(ids.map(etatDe))).reduce((s, e) => s + (e ? e.caisse.reservations.reduce((x, r) => x + r.centimes, 0) : 0), 0);
    expect(engage).toBeLessThanOrEqual(lot.accordCentimes);
    expect((await depots().reservations.lister((r) => r.travailId === `lot:${lotId}`)).every((r) => r.statut === "liberee")).toBe(true);
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);

    // Une seule notification de fin de lot.
    const notifs = await depots().notifications.lister((n) => n.titre === "Lot terminé : 3 faites, 2 mises de côté");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].lien).toBe(`/image-video/lot/${lotId}`);

    // La page du lot : les deux mises de côté d'abord, l'action est « Relire la première mise de côté ».
    const vue = (await lots.vueLotImageVideo(lotId))!;
    expect(vue.aRelire.map((c) => c.rang)).toEqual([2, 4]);
    expect(vue.action).toBe("relire");
    expect(vue.sousTitre).toBe("3 faites · 2 mises de côté · 0 à venir");

    // Will valide la carte mise de côté (la vidéo 2) : elle reprend, le script passe le contrôle automatique, elle devient faite.
    const reprise = await ecran.validerCarteEtReprendre(ids[1], undefined);
    expect(reprise.statut).toBe("reprise");
    for (let tour = 0; tour < 1500 && (await lu()).videos[1].statut !== "faite"; tour++) await boucle.contenuDuTour();
    expect((await lu()).videos[1]).toMatchObject({ statut: "faite" });
    expect((await lu()).videos[1].miseDeCote).toBeUndefined();
    expect((await etatDe(ids[1]))!.carte?.par).toBe("will");
    expect((await lu()).statut).toBe("termine");
    // Le compteur des cartes validées par Will ne compte que celle-là (les cartes du lot validées automatiquement n'y sont pas).
    expect(await lireParametre<string[]>("imageVideo.cartesValidees", [])).toEqual([ids[1]]);

    // « Lien privé » créé sur la première vidéo faite.
    const p = await partages.creerPartage(ids[0], { dureeJours: 7, telechargementAutorise: false });
    expect(p.chemin).toMatch(/^\/v\//);
    expect((await partages.listerPartages(ids[0]))[0].actif).toBe(true);
  });
});
