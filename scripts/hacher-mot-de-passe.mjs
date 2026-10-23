// Usage : MOT_DE_PASSE='...' node scripts/hacher-mot-de-passe.mjs
// Affiche l'empreinte argon2id à poser dans STUDIO_PASSWORD_HASH_B64 (empreinte encodée en base64). Le mot de passe n'est jamais écrit.
import { hash } from "@node-rs/argon2";
const mdp = process.env.MOT_DE_PASSE;
if (!mdp) { console.error("MOT_DE_PASSE manquant"); process.exit(1); }
const empreinte = await hash(mdp, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
process.stdout.write(Buffer.from(empreinte).toString("base64"));
