/**
 * GV2-03 : une panne imprévue de la chaîne face caméra remonte à la boucle (plus avalée), un échec « aucune vidéo »
 * s'affiche, et un travail de la chaîne dont le serveur de montage n'est plus relié échoue (jamais la vidéo de démonstration).
 * Double de simulation du studio-aligneur : aucun réseau.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import type { DependancesChaine } from "@/moteurs/montage-facecam/chaine";
import { creerMoteurMontageFacecam } from "@/moteurs/montage-facecam";

const TEXTE = "Bonjour, je suis le fondateur. Aujourd'hui je vous parle de la formation. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function commande(avecPrise = true): CommandeFabrication {
  return {
    videoId: "v-err",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: avecPrise ? [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-err/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }] : [],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

const CTX = { travailId: "t-err", versionId: "ver-err", titre: "Essai" };

describe("GV2-03 : pannes de la chaîne face caméra", () => {
  it("une dépendance qui lève à chaque tour : `avancer` lève (la boucle compte la panne), l'état du dernier tour n'est pas touché", async () => {
    const facecam = creerFacecamSimule();
    const deps: DependancesChaine = { facecam: { ...facecam, soumettre: async () => { throw new Error("réseau coupé"); } } as typeof facecam };
    const moteur = creerMoteurMontageFacecam({ chaine: () => deps });
    const c = commande();
    const travail: Travail = await moteur.lancer(c, CTX);
    const avant = JSON.stringify(travail.parametres);
    await expect(moteur.avancer(travail, c, Date.now())).rejects.toThrow("réseau coupé");
    expect(JSON.stringify(travail.parametres)).toBe(avant);
  });

  it("une erreur d'un seul tour puis succès : la vidéo finit", async () => {
    const facecam = creerFacecamSimule();
    let appels = 0;
    const deps: DependancesChaine = {
      facecam: { ...facecam, soumettre: async (route, d) => { if (appels++ === 0) throw new Error("coupure d'un tour"); return facecam.soumettre(route, d); } } as typeof facecam,
    };
    const moteur = creerMoteurMontageFacecam({ chaine: () => deps, relire: async () => undefined });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, CTX);
    let leve = 0;
    for (let i = 0; i < 40 && travail.statut !== "termine"; i++) {
      try {
        travail = (await moteur.avancer(travail, c, Date.now())).travail;
      } catch {
        leve++;
      }
    }
    expect(leve).toBe(1);
    expect(travail.statut).toBe("termine");
  });

  it("commande sans prises : l'étape « Votre vidéo reçue » passe en échec avec le message « Aucune vidéo reçue pour ce montage. »", async () => {
    const moteur = creerMoteurMontageFacecam({ chaine: () => ({ facecam: creerFacecamSimule() }) });
    const c = commande(false);
    const travail: Travail = await moteur.lancer(c, CTX);
    const { travail: apres } = await moteur.avancer(travail, c, Date.now());
    expect(apres.statut).toBe("echec");
    const reception = apres.etapes.find((e) => e.cle === "reception")!;
    expect(reception.statut).toBe("echec");
    expect(reception.erreur?.messagePourWill).toBe("Aucune vidéo reçue pour ce montage.");
    expect(apres.erreur?.messagePourWill).toBe("Aucune vidéo reçue pour ce montage.");
  });

  it("travail porteur de `parametres.chaine` mais serveur de montage non relié : échec FACECAM_NON_RELIE réessayable, pas de squelette", async () => {
    const relie = creerMoteurMontageFacecam({ chaine: () => ({ facecam: creerFacecamSimule() }) });
    const c = commande();
    const travail: Travail = await relie.lancer(c, CTX);
    expect(travail.parametres?.chaine).toBeDefined();
    const nonRelie = creerMoteurMontageFacecam({ chaine: () => null });
    const { travail: apres, resultat } = await nonRelie.avancer(travail, c, Date.now());
    expect(resultat).toBeUndefined();
    expect(apres.statut).toBe("echec");
    expect(apres.erreur).toMatchObject({ code: "FACECAM_NON_RELIE", reessayable: true, messagePourWill: "Le serveur de montage n'est plus relié. Vous pouvez réessayer quand il sera revenu." });
    expect(apres.etapes.some((e) => e.statut === "echec" && e.erreur?.code === "FACECAM_NON_RELIE")).toBe(true);
  });

  it("travail sans état de chaîne (mode essai) : le squelette reste", async () => {
    const moteur = creerMoteurMontageFacecam({ chaine: () => null });
    const c = commande();
    const travail: Travail = await moteur.lancer(c, CTX);
    expect(travail.parametres?.chaine).toBeUndefined();
    const { travail: apres } = await moteur.avancer(travail, c, Date.now());
    expect(apres.statut).not.toBe("echec");
  });
});
