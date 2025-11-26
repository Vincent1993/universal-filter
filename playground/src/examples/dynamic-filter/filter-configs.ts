import type { FilterDefinition, OptionSourceConfig } from '@dfx/dynamic-filter';

/**
 * 示例：全局筛选器定义列表
 * 每个定义都是一个独立字段的 Formily Schema
 *
 * 数据源支持：
 * - static: 静态枚举（直接使用 enum）
 * - remote-once: 首次加载时请求一次
 * - remote-search: 关键字搜索
 * - remote-depend: 依赖字段变化时刷新
 */
export const FILTER_DEFINITIONS: FilterDefinition[] = [
  // ========== 搜索类筛选器 ==========
  {
    id: 'filter:keyword',
    name: '关键词搜索',
    category: 'search',
    type: 'string',
    title: '关键词',
    'x-component': 'Input',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '请输入关键词',
      allowClear: true,
    },
    metadata: {
      description: '支持模糊搜索',
      icon: 'SearchOutlined',
      tags: ['搜索', '常用'],
    },
  },

  // ========== 状态和类型筛选器 ==========
  {
    id: 'filter:status',
    name: '状态筛选',
    category: 'enum',
    type: 'string',
    title: '状态',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '请选择状态',
      allowClear: true,
    },
    enum: [
      { label: '全部', value: '' },
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'disabled' },
      { label: '待审核', value: 'pending' },
      { label: '已删除', value: 'deleted' },
    ],
    metadata: {
      description: '按状态筛选数据',
      icon: 'FilterOutlined',
      tags: ['状态', '常用'],
    },
  },

  {
    id: 'filter:category',
    name: '分类筛选',
    category: 'enum',
    type: 'array',
    title: '分类',
    default: ['tech'],
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '请选择分类',
      allowClear: true,
      mode: 'multiple',
      showSearch: true,
    },
    enum: [
      { label: '科技', value: 'tech' },
      { label: '生活', value: 'life' },
      { label: '娱乐', value: 'entertainment' },
      { label: '教育', value: 'education' },
      { label: '新闻', value: 'news' },
      { label: '体育', value: 'sports' },
    ],
    metadata: {
      description: '多选分类筛选（默认包含科技）',
      icon: 'AppstoreOutlined',
      tags: ['分类', '多选'],
    },
  },

  // ========== 时间日期筛选器 ==========
  {
    id: 'filter:date-range',
    name: '日期范围',
    category: 'date',
    type: 'array',
    title: '日期范围',
    'x-component': 'DatePicker.RangePicker',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: ['开始日期', '结束日期'],
      format: 'YYYY-MM-DD',
    },
    metadata: {
      description: '选择日期范围进行筛选',
      icon: 'CalendarOutlined',
      tags: ['时间', '范围'],
    },
  },

  // ========== 数值范围筛选器（自定义组件示例） ==========
  {
    id: 'filter:price-range',
    name: '价格范围',
    category: 'number',
    type: 'array',
    title: '价格范围',
    'x-component': 'PriceRangeInput',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: ['最低价', '最高价'],
      precision: 2,
    },
    metadata: {
      description: '通过自定义组件输入价格区间',
      icon: 'DollarOutlined',
      tags: ['数值', '范围', '自定义组件'],
    },
  },

  // ========== 标签筛选器 ==========
  {
    id: 'filter:tags',
    name: '标签筛选',
    category: 'enum',
    type: 'array',
    title: '标签',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '选择标签',
      allowClear: true,
      mode: 'tags',
    },
    enum: [
      { label: '热门', value: 'hot' },
      { label: '推荐', value: 'recommended' },
      { label: '新品', value: 'new' },
    ],
    metadata: {
      description: '按标签筛选，支持自定义标签',
      icon: 'TagsOutlined',
      tags: ['标签', '自定义'],
    },
  },

  // ========== 地区筛选器 (级联) ==========
  {
    id: 'filter:region',
    name: '地区筛选',
    category: 'location',
    type: 'array',
    title: '地区',
    'x-component': 'Cascader',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '选择地区',
      allowClear: true,
      options: [
        {
          label: '中国',
          value: 'china',
          children: [
            { label: '北京', value: 'beijing' },
            { label: '上海', value: 'shanghai' },
            { label: '广州', value: 'guangzhou' },
          ],
        },
        {
          label: '美国',
          value: 'usa',
          children: [
            { label: '纽约', value: 'newyork' },
            { label: '洛杉矶', value: 'losangeles' },
          ],
        },
      ],
    },
    metadata: {
      description: '按地区进行筛选',
      icon: 'EnvironmentOutlined',
      tags: ['地区', '位置', '级联'],
    },
  },

  // ========== 渠道筛选（带默认值） ==========
  {
    id: 'filter:channel-type',
    name: '渠道类型',
    category: 'enum',
    type: 'string',
    title: '渠道类型',
    default: 'all',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '选择渠道类型',
      allowClear: true,
    },
    enum: [
      { label: '全部渠道', value: 'all' },
      { label: '线上渠道', value: 'online' },
      { label: '线下渠道', value: 'offline' },
    ],
    metadata: {
      description: '包含默认值的渠道类型筛选',
      icon: 'Share2',
      tags: ['默认值', '渠道'],
    },
  },

  // ========== 渠道明细（联动示例） ==========
  {
    id: 'filter:channel-detail',
    name: '渠道明细',
    category: 'enum',
    type: 'string',
    title: '渠道明细',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '先选择渠道类型再选择明细',
      allowClear: true,
    },
    /**
     * 通过 x-reactions 监听 channelFilter 字段（布局中定义的字段 key）
     * 根据渠道类型动态切换 options，并在渠道重置时清空当前值
     */
    'x-reactions': [
      {
        dependencies: ['channelFilter'],
        fulfill: {
          state: {
            enum: `{{
              ($deps[0] ?? 'all') === 'offline'
                ? [
                    { label: '直营门店', value: 'store-direct' },
                    { label: '加盟门店', value: 'store-franchise' },
                    { label: '仓配中心', value: 'warehouse' }
                  ]
                : ($deps[0] ?? 'all') === 'online'
                ? [
                    { label: '官网', value: 'official-site' },
                    { label: '小程序', value: 'mini-program' },
                    { label: '电商平台', value: 'marketplace' }
                  ]
                : [
                    { label: '不限', value: 'all' }
                  ]
            }}`,
            value: `{{ $deps[0] === 'all' ? 'all' : $self.value }}`,
          },
        },
      },
    ],
    enum: [
      { label: '不限', value: 'all' },
    ],
    metadata: {
      description: '依赖渠道类型的级联联动示例',
      icon: 'Link2',
      tags: ['联动', '依赖'],
    },
  },

  // ========== 远程数据源筛选器（useOptions 示例） ==========
  {
    id: 'filter:brand',
    name: '品牌筛选',
    category: 'enum',
    type: 'string',
    title: '品牌',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '选择品牌',
      allowClear: true,
      showSearch: true,
    },
    /**
     * x-data-source 配置远程数据源
     * 使用 useOptions Hook 自动获取数据
     */
    'x-data-source': {
      strategy: 'remote-once',
      trigger: 'mount',
      queryKey: ['filters', 'brand-list'],
      request: {
        url: '/api/brands',
        method: 'GET',
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    } as OptionSourceConfig,
    metadata: {
      description: '首次加载时从服务端获取品牌列表',
      icon: 'Building2',
      tags: ['远程', '品牌'],
    },
  },

  // ========== 远程搜索筛选器 ==========
  {
    id: 'filter:sku',
    name: 'SKU搜索',
    category: 'search',
    type: 'string',
    title: 'SKU',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '搜索SKU',
      allowClear: true,
      showSearch: true,
      filterOption: false, // 关闭本地过滤，使用远程搜索
    },
    'x-data-source': {
      strategy: 'remote-search',
      trigger: 'focus',
      queryKey: ['filters', 'sku-search'],
      request: {
        url: '/api/skus/search',
        method: 'GET',
      },
      searchDebounce: 300,
      staleTime: 60 * 1000,
    } as OptionSourceConfig,
    metadata: {
      description: '支持关键字搜索的SKU筛选器',
      icon: 'Search',
      tags: ['远程', '搜索', 'SKU'],
    },
  },

  // ========== 依赖刷新筛选器 ==========
  {
    id: 'filter:warehouse',
    name: '仓库筛选',
    category: 'enum',
    type: 'string',
    title: '仓库',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '选择仓库',
      allowClear: true,
    },
    'x-data-source': {
      strategy: 'remote-depend',
      trigger: 'mount',
      queryKey: ['filters', 'warehouse-list'],
      request: {
        url: '/api/warehouses',
        method: 'GET',
      },
      dependencies: ['regionFilter'], // 依赖地区筛选器
      staleTime: 5 * 60 * 1000,
    } as OptionSourceConfig,
    metadata: {
      description: '根据地区自动刷新仓库列表',
      icon: 'Warehouse',
      tags: ['远程', '依赖', '仓库'],
    },
  },
];

/**
 * 模拟服务端返回的 Schema Layout
 * 使用 x-filter-id 引用全局定义，并可以覆盖部分配置
 */
export const SERVER_SCHEMA = {
  type: 'object',
  properties: {
    // 引用关键词筛选器
    keywordFilter: {
      'x-filter-id': 'filter:keyword',
    },
    // 引用状态筛选器
    statusFilter: {
      'x-filter-id': 'filter:status',
      'x-component-props': {
        placeholder: '选择用户状态1',
      },
    },
    // 引用日期范围筛选器
    dateRangeFilter: {
      'x-filter-id': 'filter:date-range',
    },
    // 引用分类筛选器
    categoryFilter: {
      'x-filter-id': 'filter:category',
    },
    // 引用价格范围筛选器（自定义组件）
    priceRangeFilter: {
      'x-filter-id': 'filter:price-range',
    },
    // 引用标签筛选器
    tagsFilter: {
      'x-filter-id': 'filter:tags',
    },
    // 引用地区筛选器
    regionFilter: {
      'x-filter-id': 'filter:region',
    },
    // 渠道类型筛选器（带默认值）
    channelFilter: {
      'x-filter-id': 'filter:channel-type',
    },
    // 渠道明细（依赖 channelFilter）
    channelDetailFilter: {
      'x-filter-id': 'filter:channel-detail',
      'x-component-props': {
        placeholder: '根据渠道类型自动更新',
      },
    },
    // 品牌筛选器（远程数据源示例）
    brandFilter: {
      'x-filter-id': 'filter:brand',
    },
    // SKU搜索（远程搜索示例）
    skuFilter: {
      'x-filter-id': 'filter:sku',
    },
    // 仓库筛选（依赖地区刷新）
    warehouseFilter: {
      'x-filter-id': 'filter:warehouse',
    },
  },
};
