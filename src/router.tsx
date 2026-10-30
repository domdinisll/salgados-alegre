import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/**
 * Router por hash com nomes simples (#produtos, #produto-coxinhas, #admin-encomendas).
 * Funciona como ficheiro único, sem servidor. Ao migrar para Next.js, cada nome passa a ser
 * uma rota do App Router (ex.: /produtos/[slug]).
 */

function current(): string {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  } catch {
    return '';
  }
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, current, current);
}

export function navigate(to: string) {
  const target = to.replace(/^#/, '');
  if (current() === target) {
    window.scrollTo({ top: 0 });
    return;
  }
  window.location.hash = target;
}

export function href(to: string) {
  return `#${to.replace(/^#/, '')}`;
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={href(to)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}

/** Devolve o parâmetro após um prefixo, ex.: match('produto-coxinhas', 'produto-') → 'coxinhas'. */
export function param(route: string, prefix: string): string | null {
  return route.startsWith(prefix) ? route.slice(prefix.length) : null;
}
