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
  lienCommentaire: "https://exemple.fr/post-42?commentaire=c1",
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
    expect(JSON.stringify(c)).not.toContain("exemple.fr/contact");
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

  it("commentaire « stop » : aucune carte", async () => {
    const { p, cartes } = ports();
    const r = await recevoirCommentaire({ ...base, mot: "STOP", texte: "stop" }, p);
    expect(r).toEqual({ issue: "ignore", raison: "opposition" });
    expect(cartes.size).toBe(0);
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

  it("l'extrait ne garde ni adresse e-mail ni pseudo", async () => {
    const { p, cartes } = ports();
    await recevoirCommentaire({ ...base, texte: "GUIDE pour personne@exemple.fr et @pseudo" }, p);
    const e = cartes.get("evt-1")!.extrait;
    expect(e).not.toContain("personne");
    expect(e).not.toContain("exemple.fr");
    expect(e).not.toContain("pseudo");
  });
});
