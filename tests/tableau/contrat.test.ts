/**
 * TB-11 : le moteur `montage-tableau` passe le contrat commun des moteurs (`testerMoteurVideo`, format sans prix), sur
 * la VRAIE chaîne (`fabriquerTableau`) branchée sur des doubles (aucun appel réel).
 */
import { testerMoteurVideo } from "../../src/moteurs/contrat";
import { ficheDemonstration } from "./regles/exemples";
import { banc } from "./moteur/doubles";

const b = banc(ficheDemonstration);

testerMoteurVideo(b.moteur, async () => b.commande(ficheDemonstration), { sansPrix: true });
