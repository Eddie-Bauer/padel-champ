// A stand-in for the browser: every property read and every call returns
// another stand-in, so view code runs without a real DOM.
const make = () => {
  const target = function () {};
  const p = new Proxy(target, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (!(k in t)) t[k] = make();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return make(); },
  });
  return p;
};

export function installFakeDom({ search = '', stored = null } = {}) {
  const mem = new Map(stored ? [['padelchamp_v1', JSON.stringify(stored)]] : []);
  globalThis.document = make();
  globalThis.window = globalThis;
  globalThis.location = { search, protocol: 'https:' };
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: k => void mem.delete(k),
  };
  globalThis.fetch = async () => { throw new Error('offline in tests'); };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
}
