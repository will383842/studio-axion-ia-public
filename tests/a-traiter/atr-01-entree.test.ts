import { describe, expect, it } from "vitest";
import {
  recevoirCommentaire,
  type CarteEntree,
  type CommentaireRecu,
  type PortsEntree,
} from "@/services/a-traiter-entree";

function ports(over: Partial<PortsEntree> = {}) {
  const cartes = new Map<string, CarteEntree>();
  const appelsEcriture: string[] = [];
  // Faux client réseau : toute écriture échoue.
  const clientReseau = new Proxy(
    {},
    {
      get: (_c, nom) => () => {
        appelsEcriture.push(String(nom));
        throw new Error("ecriture_interdite");
      },
    },
  );
  const p: PortsEntree = {
    file: {
      existe: async (id) => cartes.has(id),
      ajouter: async (c) => void cartes.set(c.idEvenement, c),
    },
    oppositions: { estOpposee: async () => false },
    ...over,
  };
  return { p, cartes, appelsEcriture, clientReseau };
}
const base: CommentaireRecu = {
  idEvenement: "evt-1",
  reseau: "linkedin",
  post: "post-42",
  lienCommentaire: "https://www.linkedin.com/feed/post-42?commentaire=c1",
  texte: "GUIDE merci",
  mot: "GUIDE",
  idContact: "contact-1@exemple.fr",
};

describe("ATR-01 entrée À traiter", () => {
  it("crée une carte complète pour un commentaire LinkedIn page", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire(base, p);
    expect(r).toEqual({ issue: "carte_creee" });
    const c = cartes.get("evt-1")!;
    expect(c).toMatchObject({
      reseau: "linkedin",
      post: "post-42",
      mot: "GUIDE",
      lienCommentaire: base.lienCommentaire,
    });
    expect(c.extrait).toContain("GUIDE");
    expect(JSON.stringify(c)).not.toContain("contact-1@exemple.fr");
  });

  it("crée une carte pour TikTok", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire({ ...base, idEvenement: "evt-2", reseau: "tiktok" }, p);
    expect(cartes.get("evt-2")?.reseau).toBe("tiktok");
  });

  it("refuse un réseau hors LinkedIn page / TikTok", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, reseau: "instagram" as never }, p);
    expect(r).toEqual({ issue: "ignore", raison: "reseau_non_gere" });
    expect(cartes.size).toBe(0);
  });

  it("sans mot détecté : aucune carte", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, mot: null }, p);
    expect(r).toEqual({ issue: "ignore", raison: "sans_mot" });
    expect(cartes.size).toBe(0);
  });

  it("le même commentaire reçu deux fois ne crée qu'une carte", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire(base, p);
    const r2 = await recevoirCommentaire(base, p);
    expect(r2).toEqual({ issue: "ignore", raison: "deja_recu" });
    expect(cartes.size).toBe(1);
  });

  it("personne en opposition : aucune carte", async () => {
    const { p, cartes } = ports({ oppositions: { estOpposee: async () => true } });
    const r = await recevoirCommentaire(base, p);
    expect(r).toEqual({ issue: "ignore", raison: "opposition" });
    expect(cartes.size).toBe(0);
  });

  it("texte « stop » avec un mot neutre : aucune carte", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, mot: "GUIDE", texte: "stop" }, p);
    expect(r).toEqual({ issue: "ignore", raison: "opposition" });
    expect(cartes.size).toBe(0);
  });

  it("mot « STOP » avec un texte neutre : aucune carte", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, mot: "STOP", texte: "merci" }, p);
    expect(r).toEqual({ issue: "ignore", raison: "opposition" });
    expect(cartes.size).toBe(0);
  });

  it.each(["GUIDE stop", "stop GUIDE merci", "ne m'écrivez plus GUIDE"])(
    "opposition douteuse « %s » : aucune carte, raison distincte",
    async (texte) => {
      const { p, cartes } = ports();
      const r = await recevoirCommentaire({ ...base, texte }, p);
      expect(r).toEqual({ issue: "ignore", raison: "opposition_douteuse" });
      expect(cartes.size).toBe(0);
    },
  );

  it("mot douteux (mot de la demande mêlé à « stop ») : aucune carte", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, mot: "GUIDE STOP", texte: "merci" }, p);
    expect(r.issue).toBe("ignore");
    expect(cartes.size).toBe(0);
  });

  it("sans idContact : registre non consulté, aucune carte, rien d'écrit", async () => {
    let lu = 0;
    const { p, cartes } = ports({ oppositions: { estOpposee: async () => (lu++, true) } });
    for (const idContact of [null, undefined, ""]) {
      const r = await recevoirCommentaire({ ...base, idContact }, p);
      expect(r).toEqual({ issue: "ignore", raison: "contact_inconnu" });
    }
    expect(cartes.size).toBe(0);
    expect(lu).toBe(0);
  });

  it("mot hors format (minuscules mêlées, trop long, symboles) : aucune carte", async () => {
    const { p, cartes } = ports();
    for (const mot of ["G", "GUIDE-X", "A".repeat(21)]) {
      const r = await recevoirCommentaire({ ...base, mot }, p);
      expect(r).toEqual({ issue: "ignore", raison: "donnee_invalide" });
    }
    expect(cartes.size).toBe(0);
  });

  it("identifiant d'événement ou de post invalide : aucune carte", async () => {
    const { p, cartes } = ports();
    for (const o of [{ idEvenement: "evt 1/../" }, { idEvenement: "" }, { post: "<x>" }, { idEvenement: "a".repeat(101) }]) {
      const r = await recevoirCommentaire({ ...base, ...o }, p);
      expect(r).toEqual({ issue: "ignore", raison: "donnee_invalide" });
    }
    expect(cartes.size).toBe(0);
  });

  it("extrait : texte brut nettoyé (non échappé), tronqué à 140 caractères", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire({ ...base, texte: `GUIDE <b>&</b> ${"x".repeat(300)}` }, p);
    const e = cartes.get("evt-1")!.extrait;
    expect(e.startsWith("GUIDE <b>&</b> x")).toBe(true);
    expect(e).not.toContain("&amp;");
    expect(e.length).toBe(140);
  });

  it("registre d'opposition illisible : rien d'écrit, à rejouer", async () => {
    const { p, cartes } = ports({
      oppositions: {
        estOpposee: async () => {
          throw new Error("illisible");
        },
      },
    });
    const r = await recevoirCommentaire(base, p);
    expect(r).toEqual({ issue: "reessai", raison: "registre_illisible" });
    expect(cartes.size).toBe(0);
  });

  it("lecture seule : aucun appel d'écriture vers un réseau", async () => {
    const { p, appelsEcriture, clientReseau } = ports();
    // Le faux client est tendu à l'entrée : le service ne doit jamais l'appeler.
    await recevoirCommentaire(base, { ...p, clientReseau } as PortsEntree);
    await recevoirCommentaire({ ...base, idEvenement: "evt-9", reseau: "tiktok" }, { ...p, clientReseau } as PortsEntree);
    expect(appelsEcriture).toEqual([]);
  });

  it("lien de commentaire non https : carte sans lien, jamais d'échec", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire({ ...base, lienCommentaire: "javascript:alert(1)" }, p);
    expect(cartes.get("evt-1")?.lienCommentaire).toBeNull();
  });

  it("lien https hors hôtes du réseau : carte sans lien ; sous-domaine accepté", async () => {
    const { p, cartes } = ports();
    for (const [i, l] of ["https://exemple.fr/x", "https://linkedin.com.exemple.fr/x", "https://faux-tiktok.com/x"].entries()) {
      await recevoirCommentaire({ ...base, idEvenement: `evt-h${i}`, lienCommentaire: l }, p);
      expect(cartes.get(`evt-h${i}`)?.lienCommentaire).toBeNull();
    }
    await recevoirCommentaire({ ...base, idEvenement: "evt-ok", lienCommentaire: "https://www.tiktok.com/@x/video/1" }, p);
    expect(cartes.get("evt-ok")?.lienCommentaire).toBe("https://www.tiktok.com/@x/video/1");
    await recevoirCommentaire({ ...base, idEvenement: "evt-nu", lienCommentaire: "https://linkedin.com/feed/x" }, p);
    expect(cartes.get("evt-nu")?.lienCommentaire).toBe("https://linkedin.com/feed/x");
    await recevoirCommentaire({ ...base, idEvenement: "evt-http", lienCommentaire: "http://www.linkedin.com/feed/x" }, p);
    expect(cartes.get("evt-http")?.lienCommentaire).toBeNull();
  });

  it("l'extrait ne garde ni adresse e-mail ni pseudo", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire({ ...base, texte: "GUIDE pour personne@exemple.fr et @pseudo" }, p);
    const e = cartes.get("evt-1")!.extrait;
    expect(e).not.toContain("personne");
    expect(e).not.toContain("exemple.fr");
    expect(e).not.toContain("pseudo");
  });
});
