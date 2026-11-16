/**
 * G12-05 : le projet de montage garde la clé du master (sans texte) de chaque fin quand le moteur de rendu en a posé une.
 * Doubles seulement (aucun fournisseur réel). Une fin sans `masterCle` garde exactement ses anciennes clés, dans le même ordre.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import type { DemandeRendu } from "@/fournisseurs/types";
import { banc, commandeCasConcret, versOutils } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
type Fin = Record<string, unknown> & { id: string; masterCle?: string };

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail): Promise<ResultatFabrication | undefined> {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200 && t.statut !== "termine" && t.statut !== "echec"; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
  }
  expect(t.statut).toBe("termine");
  return resultat;
}

async function projet(): Promise<Record<string, unknown>> {
  const b = banc();
  const c = b.commande();
  const r = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, { travailId: "t-master", versionId: "ver-master", titre: "Essai", maintenant: T0 }));
  return r!.projetMontage;
}

async function fins(): Promise<Fin[]> {
  return ((await projet()).casConcret as { fins: Fin[] }).fins;
}

/** Même fabrication, mais le rendu ne pose aucun master (la clé du master de la demande est vidée, test seulement). */
async function projetSansMaster(): Promise<Record<string, unknown>> {
  const b = banc();
  const c = commandeCasConcret(b.d);
  const outils = versOutils(b.d, b.fiches);
  const rendu = outils.montage.rendu();
  const moteur = creerMoteurMontageCasConcret({
    outils: async () => ({
      ...outils,
      montage: {
        ...outils.montage,
        rendu: () => ({
          ...rendu,
          soumettre: async (d: DemandeRendu) => {
            const dep = (d.parametres as { depots: { master?: { cle: string } } }).depots;
            if (dep.master) dep.master = { ...dep.master, cle: "" };
            return rendu.soumettre(d);
          },
        }),
      },
    }),
    retouchesAllumees: () => false,
  });
  const r = await jusquAuBout(moteur, c, await moteur.lancer(c, { travailId: "t-master", versionId: "ver-master", titre: "Essai", maintenant: T0 }));
  return r!.projetMontage;
}

describe("G12-05 · masterCle de chaque fin au projet de montage", () => {
  it("la clé du master est gardée dans chaque fin qui en a une", async () => {
    const lesFins = await fins();
    expect(lesFins.length).toBeGreaterThan(0);
    for (const f of lesFins) expect(f.masterCle).toMatch(/master-sans-texte\.mov$/);
  });

  it("les anciennes clés restent, dans le même ordre, et aucune clé vide n'apparaît", async () => {
    for (const f of await fins()) {
      const { masterCle, ...ancien } = f;
      void masterCle;
      expect(Object.keys(ancien)).toEqual(["id", "reseaux", "fichierCle", "dureeSec", "mesures", "sousTitres"]);
      expect(JSON.stringify(f)).not.toContain("undefined");
    }
  });

  it("sans master posé par le rendu : aucune clé masterCle, projet identique au caractère près à la valeur témoin d'avant", async () => {
    const sans = await projetSansMaster();
    const lesFins = (sans.casConcret as { fins: Fin[] }).fins;
    expect(lesFins.length).toBeGreaterThan(0);
    for (const f of lesFins) expect(f).not.toHaveProperty("masterCle");
    // Témoin : le même projet avec les fins remappées comme avant la ligne (sans masterCle), serialisé.
    const avec = await projet();
    const cc = avec.casConcret as { fins: Fin[] };
    const temoin = { ...avec, casConcret: { ...cc, fins: cc.fins.map(({ masterCle, ...ancien }) => (void masterCle, ancien)) } };
    // Le journal d'étapes porte des durées d'horloge et les demandes de rendu (donc le master) : il est écarté des deux côtés ; tout le reste est comparé.
    const sansJournal = (p: Record<string, unknown>) => JSON.stringify({ ...p, casConcret: { ...(p.casConcret as object), journal: null } });
    expect(sansJournal(sans)).toBe(sansJournal(temoin));
  });
});
