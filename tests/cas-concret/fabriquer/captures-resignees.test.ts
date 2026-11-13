/**
 * GV2-07 · « Réessayer » le lendemain : les adresses de lecture des captures (signées 1 h) sont RE-SIGNÉES dans les
 * demandes d'écran reprises. L'empreinte (qui ignore l'adresse) et la clé de l'étape ne changent pas.
 */
import { describe, expect, it } from "vitest";
import { ErreurFabricationCasConcret, fabriquerCasConcret, relancerRendusCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "./doubles";

const jetons = (x: unknown) => [...JSON.stringify(x).matchAll(/jeton=([a-z0-9]+)/g)].map((m) => m[1]);

describe("GV2-07 · captures re-signées à la reprise des écrans", () => {
  it("après « Réessayer », la demande soumise porte la nouvelle adresse ; empreinte et clé d'étape identiques", async () => {
    const d = doubles({ reseaux: ["linkedin"] });
    // Un premier passage s'arrête pendant les écrans : le journal garde des cartes avec les adresses de cette heure-là.
    d.pannes.journalEcransApres = 1;
    await expect(fabriquerCasConcret(d.options)).rejects.toThrow();
    const avant = d.partage.journal.valeur;
    expect(avant?.ecrans).toBeDefined();
    const cartesAvant = avant!.ecrans!.etat.cartes;
    const anciens = new Set(cartesAvant.flatMap((c) => jetons(c.demande.parametres)));
    expect(anciens.size).toBeGreaterThan(0);
    const empreintesAvant = cartesAvant.map((c) => (c as { empreinte?: string }).empreinte);
    const cleAvant = avant!.ecrans!.empreinte;

    // Les rendus partiels sont oubliés (le serveur de rendu et le stockage ont tout perdu), puis « Réessayer ».
    d.partage.etats!.clear();
    for (const f of [...d.partage.fichiers]) if (/ecran|scene/i.test(f)) d.partage.fichiers.delete(f);
    d.partage.journal.valeur = relancerRendusCasConcret(avant, 1);
    const d2 = doubles({ reseaux: ["linkedin"], partage: d.partage });
    await fabriquerCasConcret(d2.options).catch((e: unknown) => {
      if (!(e instanceof ErreurFabricationCasConcret)) throw e;
    });
    const soumis = d2.ecransSoumis().filter((s) => jetons(s.parametres).length > 0);
    expect(soumis.length).toBeGreaterThan(0);
    for (const s of soumis) for (const j of jetons(s.parametres)) expect(anciens.has(j)).toBe(false);
    const apres = d2.partage.journal.valeur!.ecrans!;
    expect(apres.empreinte).toBe(cleAvant);
    expect(apres.etat.cartes.map((c) => (c as { empreinte?: string }).empreinte)).toEqual(empreintesAvant);
  });
});
