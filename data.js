// Uses the GitHub backend on the live site (USERNAME.github.io), otherwise the in-browser demo backend.
import { GITHUB } from "./config.js";

const live = Boolean(GITHUB.owner || location.hostname.endsWith(".github.io"));
const be = live ? await import("./backend-github.js") : await import("./backend-demo.js");

export const {
  mode, onAuth, onChange, signInAdmin, signOut,
  getPlayers, addPlayers, renamePlayer, removePlayer,
  getFixtures, saveFixture, deleteFixture, seedFixtures, getMeta, saveMeta
} = be;
