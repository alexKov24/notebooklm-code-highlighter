import { test as base, expect } from '@playwright/test';
import { launch, LEGACY_HOST, NEW_HOST, VIEWPORT, type Driver, type Engine } from './harness';
import { inspectBlock, placeBlockAt, settle, type BlockState } from './probes';

const BLOCK_IDS = ['short', 'wide', 'long', 'bottom'];

const test = base.extend<{ engine: Engine; driver: Driver }>({
  engine: ['chromium', { option: true }],
  driver: async ({ engine }, use) => {
    const driver = await launch(engine);
    await use(driver);
    await driver.close();
  },
});

async function inspect(driver: Driver, id: string): Promise<BlockState> {
  const state = await driver.evaluate(inspectBlock, id);
  if (!state.injected) throw new Error(`Block #${id} was not highlighted`);
  return state as BlockState;
}

async function openPage(driver: Driver, host = NEW_HOST) {
  await driver.goto(host);
  expect(await driver.evaluate(async () => [innerWidth, innerHeight]), 'viewport size').toEqual([
    VIEWPORT.width,
    VIEWPORT.height,
  ]);
  await expect
    .poll(async () => (await driver.evaluate(inspectBlock, 'bottom')).injected, { timeout: 10_000 })
    .toBe(true);
}

async function openMenu(driver: Driver, id: string): Promise<BlockState> {
  const { button } = await inspect(driver, id);
  await driver.click((button.left + button.right) / 2, (button.top + button.bottom) / 2);
  await driver.evaluate(settle);
  const state = await inspect(driver, id);
  expect(state.menu, 'language menu should be open').not.toBeNull();
  return state;
}

async function wheel(driver: Driver, x: number, y: number, dx: number, dy: number) {
  await driver.wheel(x, y, dx, dy);
  await driver.evaluate(settle);
}

async function expectScreenshot(driver: Driver, name: string) {
  await driver.evaluate(settle);
  expect(await driver.screenshot()).toMatchSnapshot(name);
}

function expectMenuFullyVisible(state: BlockState) {
  expect(state.menu!.nearEdgeVisible, 'top of the menu is clipped or off-screen').toBe(true);
  expect(state.menu!.farEdgeVisible, 'bottom of the menu is clipped or off-screen').toBe(true);
}

/** Gap between the button and the menu edge facing it. */
function menuGap(state: BlockState) {
  const { menu, button } = state;
  return menu!.rect.top >= button.bottom - 1
    ? menu!.rect.top - button.bottom
    : button.top - menu!.rect.bottom;
}

// Left page margin: outside the chat column, so the wheel scrolls the window
const PAGE_MARGIN = { x: 40, y: 350 };

test.describe('domains', () => {
  for (const host of [NEW_HOST, LEGACY_HOST]) {
    test(`highlights code blocks on ${host}`, async ({ driver }) => {
      await openPage(driver, host);
      for (const id of BLOCK_IDS) {
        expect((await driver.evaluate(inspectBlock, id)).injected, `#${id}`).toBe(true);
      }
      if (host === NEW_HOST) await expectScreenshot(driver, 'initial-render.png');
    });
  }
});

test.describe('language menu placement', () => {
  test.beforeEach(async ({ driver }) => openPage(driver));

  test('opens below a one-line block without being clipped', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'short', 40);
    const state = await openMenu(driver, 'short');

    expect(menuGap(state)).toBeGreaterThanOrEqual(0);
    expect(state.menu!.rect.top).toBeGreaterThan(state.button.bottom - 1);
    expect(state.menu!.rect.bottom, 'menu should extend past the block').toBeGreaterThan(state.container.bottom);
    expectMenuFullyVisible(state);
    await expectScreenshot(driver, 'menu-short-block.png');
  });

  test('opens upward when the block is near the bottom of the viewport', async ({ driver }) => {
    const { container, viewportHeight } = await inspect(driver, 'bottom');
    await driver.evaluate(placeBlockAt, 'bottom', viewportHeight - container.height - 20);
    const state = await openMenu(driver, 'bottom');

    expect(state.menu!.rect.bottom).toBeLessThanOrEqual(state.button.top + 1);
    expectMenuFullyVisible(state);
    await expectScreenshot(driver, 'menu-flipped-up.png');
  });
});

test.describe('window scroll', () => {
  test.beforeEach(async ({ driver }) => openPage(driver));

  test('open menu stays attached to its button while the window scrolls', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'wide', 150);
    const before = await openMenu(driver, 'wide');

    await wheel(driver, PAGE_MARGIN.x, PAGE_MARGIN.y, 0, 100);
    const after = await inspect(driver, 'wide');

    expect(after.scrollY - before.scrollY).toBeCloseTo(100, -1);
    expect(after.menu, 'menu should stay open').not.toBeNull();
    expect(after.button.top).toBeCloseTo(before.button.top - 100, -1);
    expect(menuGap(after)).toBeCloseTo(menuGap(before), 0);
    expectMenuFullyVisible(after);
    await expectScreenshot(driver, 'menu-after-window-scroll.png');
  });

  test('open menu flips upward when the window scrolls the block to the bottom', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'bottom', 100);
    const before = await openMenu(driver, 'bottom');
    expect(before.menu!.rect.top, 'menu starts below the button').toBeGreaterThan(before.button.bottom - 1);

    // Moves the block from y=100 to y=550: no room for the menu below anymore
    await wheel(driver, PAGE_MARGIN.x, PAGE_MARGIN.y, 0, -450);
    const after = await inspect(driver, 'bottom');

    expect(after.button.top).toBeGreaterThan(500);
    expect(after.menu!.rect.bottom).toBeLessThanOrEqual(after.button.top + 1);
    expectMenuFullyVisible(after);
    await expectScreenshot(driver, 'menu-flipped-after-window-scroll.png');
  });
});

test.describe('code container scroll', () => {
  test.beforeEach(async ({ driver }) => openPage(driver));

  test('wheel over a tall block scrolls its code, not the page', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'long', 40);
    const before = await inspect(driver, 'long');
    expect(before.content.height, 'block should be capped at the max height').toBeLessThanOrEqual(401);

    await wheel(driver, before.content.left + 200, before.content.top + 150, 0, 200);
    const after = await inspect(driver, 'long');

    expect(after.contentScrollTop).toBeGreaterThan(0);
    expect(after.scrollY).toBe(before.scrollY);
    expect(after.header.top, 'header should not scroll with the code').toBe(before.header.top);
    // Line numbers and code scroll together
    expect(after.gutter.top - after.code.top).toBeCloseTo(before.gutter.top - before.code.top, 0);
    expect(after.gutter.top).toBeLessThan(before.gutter.top);
    await expectScreenshot(driver, 'long-block-scrolled.png');
  });

  test('horizontal scroll moves the code but keeps line numbers in view', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'wide', 40);
    const before = await inspect(driver, 'wide');

    await wheel(driver, before.content.left + 200, before.content.top + 20, 300, 0);
    const after = await inspect(driver, 'wide');

    expect(after.codeScrollLeft + after.contentScrollLeft).toBeGreaterThan(0);
    expect(after.scrollX).toBe(0);
    expect(after.gutter.left, 'line numbers should not scroll away').toBe(before.gutter.left);
    await expectScreenshot(driver, 'wide-block-scrolled.png');
  });

  test('open menu stays put while the code underneath scrolls', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'long', 40);
    const before = await openMenu(driver, 'long');

    // Left side of the code, away from the right-aligned menu
    await wheel(driver, before.content.left + 100, before.content.top + 300, 0, 200);
    const after = await inspect(driver, 'long');

    expect(after.contentScrollTop).toBeGreaterThan(0);
    expect(after.scrollY).toBe(before.scrollY);
    expect(after.menu!.rect).toEqual(before.menu!.rect);
    expectMenuFullyVisible(after);
    await expectScreenshot(driver, 'menu-over-scrolled-code.png');
  });

  test('wheel over the open menu scrolls the menu list only', async ({ driver }) => {
    await driver.evaluate(placeBlockAt, 'long', 40);
    const before = await openMenu(driver, 'long');
    const { rect } = before.menu!;

    await wheel(driver, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, 0, 150);
    const after = await inspect(driver, 'long');

    expect(after.menu!.scrollTop).toBeGreaterThan(0);
    expect(after.contentScrollTop, 'code should not scroll').toBe(0);
    expect(after.scrollY, 'page should not scroll').toBe(before.scrollY);
    await expectScreenshot(driver, 'menu-list-scrolled.png');
  });
});
