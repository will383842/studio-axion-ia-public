/** Encart vidéo, PR 7 : le corps d'envoi au format du site, validé par une copie du schéma strict du site. */
import { describe, expect, it } from "vitest";
import { corpsSite, type EntreeCorpsSite } from "@/domaine/site-videos/corps-site";
import { passeportOk } from "./helpers-controles";
import { schemaPublicationSite } from "./helpers-schema-site";

const t = (n: number) => "a".repeat(n);
const image = (nom: string) => ({ chemin: `/medias/videos/automatiser-ses-devis/v2/${nom}.jpg`, octets: 40000, type: "image/jpeg" as const, largeur: 1280, hauteur: 720 });

function entree(surcharge: Partial<EntreeCorpsSite> = {}): EntreeCorpsSite {
  return {
    idStudio: "vid_exemple_01",
    passeport: passeportOk({
      titreWeb: "Automatiser ses devis en dix minutes",
      resume: t(450),
      aRetenir: [t(25), t(25), t(25)],
      questions: [{ question: "Faut-il un logiciel pour cela ?", reponse: t(50) }, { question: "Combien de temps faut-il ?", reponse: t(50) }],
      transcription: "Vos devis prennent du temps. Voici comment faire.",
      chapitres: [{ debutSec: 0, finSec: 12.4, libelle: "Accroche", blocRecette: "accroche" }, { debutSec: 12.4, finSec: 40, libelle: "Cœur", blocRecette: "coeur" }],
    }),
    slug: "automatiser-ses-devis",
    description: t(120),
    theme: "automatisation",
    lien: { type: "service", chemin: "/fr/implementation" },
    dureeSec: 40.4,
    fichiers: {
      video: { chemin: "/medias/videos/automatiser-ses-devis/v2/video.mp4", octets: 5_000_000, type: "video/mp4", sha256: "a".repeat(64), largeur: 1920, hauteur: 1080 },
      affiche169: image("affiche"),
      vignette43: image("vignette-43"),
      vignette11: image("vignette-11"),
      sousTitres: { chemin: "/medias/videos/automatiser-ses-devis/v2/sous-titres.vtt", octets: 900, type: "text/vtt" },
    },
    ia: { voixGeneree: false, doubleNumerique: false },
    personnesALImage: { williams: false },
    aucunClient: true,
    ...surcharge,
  };
}

describe("encart PR 7 : corps au format du site", () => {
  it("passe le schéma strict du site", () => {
    const r = schemaPublicationSite.safeParse(corpsSite(entree()));
    expect(r.success, JSON.stringify(r.success ? "" : r.error.issues)).toBe(true);
  });

  it("n'envoie que les champs du site : ni motsCles, generateur, credits, publieLe, ni noms du Studio", () => {
    const c = corpsSite(entree()) as unknown as Record<string, unknown>;
    for (const interdit of ["motsCles", "generateur", "credits", "publieLe", "versionContrat", "idStudio", "slugPropose", "rubrique", "lienService", "dureeSec", "contenuGenere"]) expect(c, interdit).not.toHaveProperty(interdit);
  });

  it("renommages, arrondis, chapitres convertis (finSec supprimé)", () => {
    const c = corpsSite(entree());
    expect(c).toMatchObject({ schemaVersion: 1, studioVideoId: "vid_exemple_01", version: 2, slug: "automatiser-ses-devis", langue: "fr", dureeSecondes: 40, serie: null });
    expect(c.chapitres).toEqual([{ titre: "Accroche", debutSecondes: 0 }, { titre: "Cœur", debutSecondes: 12 }]);
  });

  it("une transcription vide devient null (jamais une chaîne vide)", () => {
    const c = corpsSite(entree({ passeport: { ...entree().passeport, transcription: "  " } }));
    expect(c.transcription).toBeNull();
    expect(schemaPublicationSite.safeParse(c).success).toBe(true);
  });

  it("sans l'attestation « aucun client nommé », pas de corps", () => {
    expect(() => corpsSite(entree({ aucunClient: false }))).toThrow(/attestation/);
  });

  it("le schéma du site refuse bien un corps hors bornes (la copie du schéma est vivante)", () => {
    expect(schemaPublicationSite.safeParse(corpsSite(entree({ description: "court" }))).success).toBe(false);
  });

  it("la copie du schéma applique les règles croisées du site (chapitres, chemins)", () => {
    const base = corpsSite(entree());
    const refuse = (c: unknown) => schemaPublicationSite.safeParse(c).success === false;
    expect(refuse({ ...base, dureeSecondes: 20 })).toBe(true);
    expect(refuse({ ...base, chapitres: [{ titre: "Deux", debutSecondes: 20 }, { titre: "Un", debutSecondes: 5 }] })).toBe(true);
    expect(refuse({ ...base, version: 9 })).toBe(true);
  });

  it("chapitres : le début arrondi ne dépasse jamais la durée arrondie ni le précédent (écarté plutôt que refusé par le site)", () => {
    const chap = (debutSec: number, libelle: string) => ({ debutSec, finSec: debutSec + 5, libelle, blocRecette: "coeur" });
    const p = { ...entree().passeport, chapitres: [chap(0, "Début"), chap(12.4, "Milieu"), chap(12.49, "Même seconde"), chap(13.6, "Suivant"), chap(39.6, "Fin")] };
    const c = corpsSite(entree({ passeport: p, dureeSec: 40.4 }));
    expect(c.chapitres).toEqual([{ titre: "Début", debutSecondes: 0 }, { titre: "Milieu", debutSecondes: 12 }, { titre: "Suivant", debutSecondes: 14 }]);
    expect(schemaPublicationSite.safeParse(c).success).toBe(true);
  });

  it("sous 30 s : aucun chapitre envoyé", () => {
    const c = corpsSite(entree({ dureeSec: 20 }));
    expect(c.chapitres).toEqual([]);
    expect(schemaPublicationSite.safeParse(c).success).toBe(true);
  });
});
