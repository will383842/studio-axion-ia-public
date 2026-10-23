/**
 * Brique 3 (relire le script) : le repère « script relu » qu'envoie l'écran pour le script validé du catalogue de
 * « recrutement-apporteurs » (empreinte des lignes relues, sans modification). PUR.
 */
import { empreinte } from "@/domaine/relecture-script";
import { lignesDesEcrans } from "@/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans, scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";

export const RELU_RECRUTEMENT = empreinte(lignesDesEcrans(apercuDesEcrans(scriptValideDuCatalogue("recrutement-apporteurs")!.ecrans)));
