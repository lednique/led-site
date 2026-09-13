/**
 * Ближайший прокручиваемый предок элемента.
 *
 * Статья живёт внутри собственного scrollport (`.stage-reader`) — и на
 * компьютере, и на телефоне. Блокам, которые следят за прокруткой (появление
 * по скроллу, параллакс-видео), нужен именно он, а не окно браузера.
 */
export function scrollParent(el: Element | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflow}`)) return node;
    node = node.parentElement;
  }
  return null;
}

/** Окно просмотра, относительно которого считаем положение блока. */
export function viewportBox(scroller: HTMLElement | null): { top: number; height: number } {
  if (!scroller) return { top: 0, height: window.innerHeight };
  const box = scroller.getBoundingClientRect();
  return { top: box.top, height: scroller.clientHeight };
}

/**
 * Насколько прокручено окно просмотра: 0 — статья открыта и стоит на самом
 * верху. Для scrollport'а статьи это его `scrollTop`, для окна — прокрутка
 * документа.
 */
export function scrollOffset(scroller: HTMLElement | null): number {
  if (scroller) return scroller.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}
