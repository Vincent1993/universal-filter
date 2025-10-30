import React, { act, type ReactElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

type RenderResult = {
  container: HTMLElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
};

type RenderHookResult<TValue> = {
  result: { current: TValue };
  rerender: () => void;
  unmount: () => void;
};

type RenderHookOptions = {
  wrapper?: ComponentType<{ children?: React.ReactNode }>;
};

const mountedContainers = new Set<{ container: HTMLElement; unmount: () => void }>();

export { act };

export function render(ui: ReactElement): RenderResult {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  const unmount = () => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    mountedContainers.delete(entry);
  };

  const entry = {
    container,
    unmount
  };

  mountedContainers.add(entry);

  return {
    container,
    rerender(nextUi) {
      act(() => {
        root.render(nextUi);
      });
    },
    unmount
  };
}

export function cleanup(): void {
  Array.from(mountedContainers).forEach(entry => {
    entry.unmount();
  });
}

export async function waitFor<TValue>(
  assertion: () => TValue,
  { timeout = 1000, interval = 50 }: { timeout?: number; interval?: number } = {}
): Promise<TValue> {
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return assertion();
    } catch (error) {
      if (Date.now() - start >= timeout) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

export function renderHook<TValue>(
  callback: () => TValue,
  options: RenderHookOptions = {}
): RenderHookResult<TValue> {
  const { wrapper: Wrapper } = options;
  const result = { current: undefined as unknown as TValue };

  function HookContainer(): null {
    result.current = callback();
    return null;
  }

  const element = Wrapper
    ? React.createElement(Wrapper, null, React.createElement(HookContainer))
    : React.createElement(HookContainer);

  const renderResult = render(element);

  return {
    result,
    rerender() {
      const nextElement = Wrapper
        ? React.createElement(Wrapper, null, React.createElement(HookContainer))
        : React.createElement(HookContainer);
      renderResult.rerender(nextElement);
    },
    unmount() {
      renderResult.unmount();
    }
  };
}
