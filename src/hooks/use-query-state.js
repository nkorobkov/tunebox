import { useReducer } from 'preact/hooks';

// State that lives in the URL query (?name=value): back/forward and bookmarks
// restore it, and a plain link to the page clears it. The URL is read on every
// render, so it is the only source of truth. Default values are left out of
// the URL. With `list: true` the value is an array, written as ?name=a&name=b.
export function useQueryState(name, initial, { list = false } = {}) {
  const [, rerender] = useReducer(n => n + 1, 0);

  const read = () => {
    const params = new URLSearchParams(window.location.search);
    if (list) return params.has(name) ? params.getAll(name) : initial;
    return params.get(name) ?? initial;
  };

  const set = (next) => {
    const value = typeof next === 'function' ? next(read()) : next;
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    if (list) value.forEach(v => url.searchParams.append(name, v));
    else if (value !== initial) url.searchParams.set(name, value);
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, '', url);
      rerender();
    }
  };

  return [read(), set];
}
