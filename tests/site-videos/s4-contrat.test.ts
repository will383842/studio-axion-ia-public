/** S4.1 — le contrat studio → site est figé : le JSON envoyé et ses exemples ne bougent jamais en silence. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsPasseport, VERSION_CONTRAT } from "@/domaine/site-videos/contrat";
import { construireExemples, corpsExemple, PASSEPORT_EXEMPLE } from "./helpers-contrat";

const DOSSIER = "docs/site-videos/contrat";

/** Champs du corps du POST, dans l'ordre du plan § 7.3. */
const CHAMPS = [
  "versionContrat", "idStudio", "versionPasseport", "slugPropose", "titre", "resume", "transcription", "aRetenir", "questions", "chapitres",
  "rubrique", "motsCles", "generateur", "langue", "dureeSec", "largeur", "hauteur", "contenuGenere", "publieLe", "urlVideo", "urlVignette",
  "largeurVignette", "hauteurVignette", "urlVtt", "credits", "lienService",
];

describe("S4.1 corpsPasseport", () => {
  it("produit exactement les champs du plan § 7.3, dans l'ordre", () => {
    expect(Object.keys(corpsExemple())).toEqual(CHAMPS);
    expect(corpsExemple().versionContrat).toBe(VERSION_CONTRAT);
  });

  it("n'envoie ni bloc de recette, ni origines, ni identifiant de fichier privé, ni sortie", () => {
    const texte = JSON.stringify(corpsExemple());
    for (const interdit of ["blocRecette", "origines", "sortieId", "sortie_privee_1", "fichierId", "modifieLe"]) expect(texte, interdit).not.toContain(interdit);
    for (const c of corpsExemple().chapitres) expect(Object.keys(c)).toEqual(["debutSec", "finSec", "libelle"]);
  });

  it("le lien de service est facultatif : absent, le champ n'est pas envoyé", () => {
    expect("lienService" in corpsExemple()).toBe(true);
    const { lienService: _enleve, ...sans } = PASSEPORT_EXEMPLE;
    void _enleve;
    const corps = corpsPasseport({ idStudio: "v", passeport: sans, slugPropose: "s", generateur: "avocat", langue: "fr", dureeSec: 40, largeur: 1080, hauteur: 1920, publieLe: "2026-10-18T10:00:00.000Z", urls: { video: "a", vignette: "b", vtt: "c" }, vignette: { largeur: 1280, hauteur: 720 } });
    expect("lienService" in corps).toBe(false);
  });

  it("les adresses des fichiers sont publiques (même domaine, préfixe medias/videos/)", () => {
    const c = corpsExemple();
    for (const u of [c.urlVideo, c.urlVignette, c.urlVtt]) expect(u).toMatch(/^https:\/\/axion-ia\.com\/medias\/videos\//);
  });
});

describe("S4.1 exemples du contrat (docs/site-videos/contrat/)", () => {
  it("chaque exemple existe et correspond exactement au code", async () => {
    const exemples = await construireExemples();
    if (process.env.ECRIRE_EXEMPLES_CONTRAT === "1") {
      mkdirSync(DOSSIER, { recursive: true });
      for (const [nom, contenu] of Object.entries(exemples)) writeFileSync(join(DOSSIER, nom), contenu);
    }
    for (const [nom, contenu] of Object.entries(exemples)) {
      expect(existsSync(join(DOSSIER, nom)), `${nom} manque`).toBe(true);
      expect(readFileSync(join(DOSSIER, nom), "utf8"), nom).toBe(contenu);
    }
  });

  it("les réponses d'exemple viennent du site factice (mêmes clés que le contrat)", async () => {
    const e = await construireExemples();
    expect(Object.keys(JSON.parse(e["reponse-publication.exemple.json"]))).toEqual(["statut", "slug", "url", "versionPasseport", "inchange"]);
    expect(JSON.parse(e["reponse-retrait.exemple.json"])).toEqual({ statut: "retiree" });
    expect(Object.keys(JSON.parse(e["reglages.exemple.json"]))).toEqual(["versionContrat", "certifexempleCertificationObtenue", "avisPublies"]);
  });
});
