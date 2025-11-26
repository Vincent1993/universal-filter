/**
 * 全局 Options 配置
 * 包含 QueryClient 和 Mock 请求客户端
 */

import { QueryClient } from '@tanstack/react-query';
import type { RequestClient, OptionRequestConfig, OptionRequestContext } from '@dfx/universal-filter';

// 创建 React Query Client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Mock 数据
const MOCK_DATA: Record<string, { label: string; value: string }[]> = {
  '/api/brands': [
    { label: 'Nike', value: 'nike' },
    { label: 'Adidas', value: 'adidas' },
    { label: 'Puma', value: 'puma' },
    { label: 'New Balance', value: 'new-balance' },
    { label: 'Converse', value: 'converse' },
    { label: 'Vans', value: 'vans' },
  ],
  '/api/skus/search': [
    { label: 'SKU-001 - Nike Air Max', value: 'sku-001' },
    { label: 'SKU-002 - Adidas Ultraboost', value: 'sku-002' },
    { label: 'SKU-003 - Puma RS-X', value: 'sku-003' },
    { label: 'SKU-004 - New Balance 574', value: 'sku-004' },
    { label: 'SKU-005 - Converse Chuck 70', value: 'sku-005' },
  ],
  '/api/warehouses': [
    { label: '北京仓', value: 'wh-beijing' },
    { label: '上海仓', value: 'wh-shanghai' },
    { label: '广州仓', value: 'wh-guangzhou' },
    { label: '深圳仓', value: 'wh-shenzhen' },
  ],
};

// Mock 请求客户端
export const mockRequestClient: RequestClient = async (
  config: OptionRequestConfig,
  context: OptionRequestContext
) => {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { url } = config;
  const { keyword, deps } = context;

  let data = MOCK_DATA[url] || [];

  // 模拟搜索过滤
  if (keyword) {
    data = data.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword.toLowerCase()) ||
        item.value.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 模拟依赖过滤（仓库根据地区）
  if (url === '/api/warehouses' && deps?.regionFilter) {
    const region = Array.isArray(deps.regionFilter)
      ? deps.regionFilter[0]
      : deps.regionFilter;
    if (region === 'beijing') {
      data = [{ label: '北京仓', value: 'wh-beijing' }];
    } else if (region === 'shanghai') {
      data = [{ label: '上海仓', value: 'wh-shanghai' }];
    } else if (region === 'guangzhou') {
      data = [
        { label: '广州仓', value: 'wh-guangzhou' },
        { label: '深圳仓', value: 'wh-shenzhen' },
      ];
    }
  }

  console.log('[Mock Request]', { url, keyword, deps, result: data });

  return { data };
};

