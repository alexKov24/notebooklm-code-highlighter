/**
 * Functions that run inside the page. They're serialized with toString(), so
 * each must be self-contained: no imports, no references to outer scope.
 */

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
}

export interface MenuState {
  rect: Rect;
  scrollTop: number;
  /** The edge next to the button is on screen and not clipped. */
  nearEdgeVisible: boolean;
  /** The edge away from the button is on screen and not clipped. */
  farEdgeVisible: boolean;
}

export interface BlockState {
  injected: boolean;
  scrollX: number;
  scrollY: number;
  viewportHeight: number;
  container: Rect;
  header: Rect;
  button: Rect;
  content: Rect;
  contentScrollTop: number;
  contentScrollLeft: number;
  codeScrollLeft: number;
  gutter: Rect;
  code: Rect;
  menu: MenuState | null;
}

/** Geometry and scroll state of the highlighted block that replaced `pre#id`. */
export async function inspectBlock(id: string): Promise<BlockState | { injected: false }> {
  const host = document.getElementById(id)?.previousElementSibling;
  const sr = host?.shadowRoot;
  if (!sr || !sr.querySelector('.code-block-container')) return { injected: false };

  const q = (selector: string) => sr.querySelector(selector) as HTMLElement;
  const rect = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
  };
  // A point is "visible" if hit-testing it lands on the element: false when
  // it's clipped by an ancestor, covered, or outside the viewport.
  const hits = (el: Element, x: number, y: number) => {
    const hit = sr.elementFromPoint(x, y);
    return !!hit && el.contains(hit);
  };

  const container = q('.code-block-container');
  const button = q('.language-picker-button');
  const content = q('.code-block-content');
  const codeEl = q('.line-numbers-content');
  const menuEl = sr.querySelector('.language-picker-menu');

  let menu: MenuState | null = null;
  if (menuEl) {
    const m = rect(menuEl);
    const below = m.top >= rect(button).bottom - 1;
    const x = (m.left + m.right) / 2;
    menu = {
      rect: m,
      scrollTop: menuEl.scrollTop,
      nearEdgeVisible: hits(menuEl, x, below ? m.top + 6 : m.bottom - 6),
      farEdgeVisible: hits(menuEl, x, below ? m.bottom - 6 : m.top + 6),
    };
  }

  return {
    injected: true,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    container: rect(container),
    header: rect(q('.code-block-header')),
    button: rect(button),
    content: rect(content),
    contentScrollTop: content.scrollTop,
    contentScrollLeft: content.scrollLeft,
    codeScrollLeft: codeEl.scrollLeft,
    gutter: rect(q('.line-numbers-gutter')),
    code: rect(codeEl),
    menu,
  };
}

/** Scrolls the window so the block's top sits at `viewportY`. */
export async function placeBlockAt(id: string, viewportY: number): Promise<void> {
  const host = document.getElementById(id)!.previousElementSibling!;
  const top = host.getBoundingClientRect().top + window.scrollY;
  // Whole pixels: fractional scroll offsets render differently between runs
  window.scrollTo({ top: Math.round(top - viewportY), behavior: 'instant' });
}

/** Waits out transitions (0.2s) and pending layout, and hides input carets. */
export async function settle(): Promise<void> {
  for (const host of document.querySelectorAll('.nlm-code-highlighter-container')) {
    host.shadowRoot?.querySelectorAll('input').forEach((input) => {
      input.style.caretColor = 'transparent';
    });
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 300));
}
