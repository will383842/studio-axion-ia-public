"use server";

/** Actions de « Écrire » (idées, atelier, façon de parler). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { BlocScript, NoteScript } from "@/domaine/types";
import type { ScriptGenere } from "@/fournisseurs";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { ajouterIdee, archiverIdee, modifierIdee } from "@/services/idees";
import { enregistrerFaconDeParler, enregistrerScript, genererScripts, type FaconDeParler } from "@/services/scripts";

export async function ajouterIdeeEcrireAction(texte: string): Promise<Resultat<{ id: string; formatSuggere?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const i = await ajouterIdee(texte);
    revalidatePath("/ecrire");
    return { id: i.id, formatSuggere: i.formatSuggere };
  });
}

export async function archiverIdeeAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await archiverIdee(id);
    revalidatePath("/ecrire");
    return undefined;
  });
}

export async function restaurerIdeeAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await modifierIdee(id, { etat: "nouvelle" });
    revalidatePath("/ecrire");
    return undefined;
  });
}

export async function genererAtelierAction(demande: { formatId: string; sujet: string; cible?: string; ton?: string; dureeSec: number }): Promise<Resultat<ScriptGenere[]>> {
  await exigerSession();
  return essayer(() => genererScripts({ ...demande, nombre: 3 }));
}

export async function garderScriptAction(donnees: { formatId: string; sujet: string; blocs: BlocScript[]; notes?: NoteScript; dureeCibleSec: number; cible?: string; ton?: string; ideeId?: string }): Promise<Resultat<string>> {
  await exigerSession();
  return essayer(async () => {
    const id = await enregistrerScript(donnees);
    revalidatePath("/ecrire");
    return id;
  });
}

export async function enregistrerFaconAction(f: FaconDeParler): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await enregistrerFaconDeParler(f);
    return undefined;
  });
}
