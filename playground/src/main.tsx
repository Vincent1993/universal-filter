import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

// 创建路由实例
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  basepath: '/universal-filter/',
});

// 注册路由类型
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element with id "root" was not found.');
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
