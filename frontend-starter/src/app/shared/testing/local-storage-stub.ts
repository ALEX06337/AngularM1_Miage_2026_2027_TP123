// AuthService lit localStorage dès sa construction, or l'environnement de
// test n'en fournit pas. Ce stub en mémoire (importé pour son effet de bord)
// isole les tests du navigateur. Il stocke réellement les valeurs pour que
// les assertions sur le token restent significatives.
const store = new Map<string, string>();

(globalThis as { localStorage?: Storage }).localStorage ??= {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;
