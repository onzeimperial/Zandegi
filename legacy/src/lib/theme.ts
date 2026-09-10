/**
 * Inline script injected in <head> to set the theme class before first paint,
 * avoiding a flash of the wrong theme. Kept framework-free so it can be imported
 * by the root (server) layout.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('zandegi-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
