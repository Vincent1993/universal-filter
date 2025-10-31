import type { FilterFieldConfig } from '@dfx/dynamic-filter';

/**
 * 示例：全局筛选器配置列表
 * 这些配置通常来自服务端或预定义的配置文件
 */
export const FILTER_CONFIGS: FilterFieldConfig[] = [
  // 搜索类筛选器
  {
    id: 'filter:keyword',
    name: '关键词搜索',
    category: 'search',
    schema: {
      type: 'string',
      title: '关键词',
      'x-component': 'Input',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '请输入关键词',
        allowClear: true,
      },
    },
    defaultValue: '',
    metadata: {
      description: '支持模糊搜索',
      icon: 'SearchOutlined',
      tags: ['搜索', '常用'],
    },
  },
  {
    id: 'filter:advanced-search',
    name: '高级搜索',
    category: 'search',
    schema: {
      type: 'object',
      title: '高级搜索',
      'x-component': 'FormGrid',
      'x-component-props': {
        minColumns: 2,
        maxColumns: 2,
      },
      properties: {
        field: {
          type: 'string',
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': {
            placeholder: '搜索字段',
          },
          enum: [
            { label: '标题', value: 'title' },
            { label: '内容', value: 'content' },
            { label: '作者', value: 'author' },
            { label: '标签', value: 'tags' },
          ],
        },
        value: {
          type: 'string',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '搜索内容',
            allowClear: true,
          },
        },
      },
    },
    defaultValue: { field: '', value: '' },
    metadata: {
      description: '指定字段的高级搜索',
      icon: 'SearchOutlined',
      tags: ['搜索', '高级'],
    },
  },

  // 状态和类型筛选器
  {
    id: 'filter:status',
    name: '状态筛选',
    category: 'enum',
    schema: {
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
    },
    defaultValue: '',
    metadata: {
      description: '按状态筛选数据',
      icon: 'FilterOutlined',
      tags: ['状态', '常用'],
    },
  },
  {
    id: 'filter:type',
    name: '类型筛选',
    category: 'enum',
    schema: {
      type: 'string',
      title: '类型',
      'x-component': 'Select',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '请选择类型',
        allowClear: true,
      },
      enum: [
        { label: '全部', value: '' },
        { label: '文章', value: 'article' },
        { label: '视频', value: 'video' },
        { label: '图片', value: 'image' },
        { label: '文档', value: 'document' },
        { label: '链接', value: 'link' },
      ],
    },
    defaultValue: '',
    metadata: {
      description: '按内容类型筛选',
      icon: 'FileTextOutlined',
      tags: ['类型', '内容'],
    },
  },
  {
    id: 'filter:category',
    name: '分类筛选',
    category: 'enum',
    schema: {
      type: 'array',
      title: '分类',
      'x-component': 'Select',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '请选择分类',
        allowClear: true,
        mode: 'multiple',
      },
      enum: [
        { label: '科技', value: 'tech' },
        { label: '生活', value: 'life' },
        { label: '娱乐', value: 'entertainment' },
        { label: '教育', value: 'education' },
        { label: '新闻', value: 'news' },
        { label: '体育', value: 'sports' },
      ],
    },
    defaultValue: [],
    metadata: {
      description: '多选分类筛选',
      icon: 'AppstoreOutlined',
      tags: ['分类', '多选'],
    },
  },
  {
    id: 'filter:priority',
    name: '优先级',
    category: 'enum',
    schema: {
      type: 'string',
      title: '优先级',
      'x-component': 'Select',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '选择优先级',
        allowClear: false,
      },
      enum: [
        { label: '紧急', value: 'urgent' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ],
    },
    defaultValue: 'medium',
    metadata: {
      description: '任务或内容的优先级',
      icon: 'FlagOutlined',
      tags: ['优先级'],
    },
  },

  // 时间日期筛选器
  {
    id: 'filter:date-range',
    name: '日期范围',
    category: 'date',
    schema: {
      type: 'array',
      title: '日期范围',
      'x-component': 'DatePicker.RangePicker',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: ['开始日期', '结束日期'],
        format: 'YYYY-MM-DD',
      },
    },
    defaultValue: null,
    metadata: {
      description: '选择日期范围进行筛选',
      icon: 'CalendarOutlined',
      tags: ['时间', '范围'],
    },
  },
  {
    id: 'filter:create-time',
    name: '创建时间',
    category: 'date',
    schema: {
      type: 'string',
      title: '创建时间',
      'x-component': 'DatePicker',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '选择创建日期',
        format: 'YYYY-MM-DD',
      },
    },
    defaultValue: null,
    metadata: {
      description: '按创建时间筛选',
      icon: 'CalendarOutlined',
      tags: ['时间', '创建'],
    },
  },
  {
    id: 'filter:update-time',
    name: '更新时间',
    category: 'date',
    schema: {
      type: 'array',
      title: '更新时间范围',
      'x-component': 'DatePicker.RangePicker',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: ['更新开始', '更新结束'],
        format: 'YYYY-MM-DD HH:mm:ss',
        showTime: true,
      },
    },
    defaultValue: null,
    metadata: {
      description: '按最后更新时间筛选',
      icon: 'ClockCircleOutlined',
      tags: ['时间', '更新'],
    },
  },

  // 数值范围筛选器
  {
    id: 'filter:price-range',
    name: '价格范围',
    category: 'number',
    schema: {
      type: 'object',
      title: '价格范围',
      'x-component': 'FormGrid',
      'x-component-props': {
        minColumns: 2,
        maxColumns: 2,
      },
      properties: {
        min: {
          type: 'number',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
          'x-component-props': {
            placeholder: '最低价',
            min: 0,
            precision: 2,
            style: { width: '100%' },
          },
        },
        max: {
          type: 'number',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
          'x-component-props': {
            placeholder: '最高价',
            min: 0,
            precision: 2,
            style: { width: '100%' },
          },
        },
      },
    },
    defaultValue: { min: null, max: null },
    metadata: {
      description: '设置价格范围',
      icon: 'DollarOutlined',
      tags: ['数值', '范围'],
    },
  },
  {
    id: 'filter:score-range',
    name: '评分范围',
    category: 'number',
    schema: {
      type: 'array',
      title: '评分范围',
      'x-component': 'Slider',
      'x-decorator': 'FormItem',
      'x-component-props': {
        range: true,
        min: 0,
        max: 10,
        step: 0.5,
        marks: {
          0: '0',
          2.5: '2.5',
          5: '5',
          7.5: '7.5',
          10: '10',
        },
      },
    },
    defaultValue: [0, 10],
    metadata: {
      description: '按评分范围筛选',
      icon: 'StarOutlined',
      tags: ['数值', '评分'],
    },
  },
  {
    id: 'filter:count-range',
    name: '数量范围',
    category: 'number',
    schema: {
      type: 'object',
      title: '数量范围',
      'x-component': 'FormGrid',
      'x-component-props': {
        minColumns: 2,
        maxColumns: 2,
      },
      properties: {
        min: {
          type: 'number',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
          'x-component-props': {
            placeholder: '最小数量',
            min: 0,
            style: { width: '100%' },
          },
        },
        max: {
          type: 'number',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
          'x-component-props': {
            placeholder: '最大数量',
            min: 0,
            style: { width: '100%' },
          },
        },
      },
    },
    defaultValue: { min: null, max: null },
    metadata: {
      description: '按数量范围筛选',
      icon: 'NumberOutlined',
      tags: ['数值', '数量'],
    },
  },

  // 其他筛选器
  {
    id: 'filter:tags',
    name: '标签筛选',
    category: 'enum',
    schema: {
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
        { label: '限时', value: 'limited' },
        { label: '促销', value: 'promotion' },
      ],
    },
    defaultValue: [],
    metadata: {
      description: '按标签筛选，支持自定义标签',
      icon: 'TagsOutlined',
      tags: ['标签', '自定义'],
    },
  },
  {
    id: 'filter:region',
    name: '地区筛选',
    category: 'location',
    schema: {
      type: 'object',
      title: '地区',
      'x-component': 'Cascader',
      'x-decorator': 'FormItem',
      'x-component-props': {
        placeholder: '选择地区',
        allowClear: true,
      },
      enum: [
        {
          label: '中国',
          value: 'china',
          children: [
            { label: '北京', value: 'beijing' },
            { label: '上海', value: 'shanghai' },
            { label: '广州', value: 'guangzhou' },
            { label: '深圳', value: 'shenzhen' },
          ],
        },
        {
          label: '美国',
          value: 'usa',
          children: [
            { label: '纽约', value: 'newyork' },
            { label: '洛杉矶', value: 'losangeles' },
            { label: '旧金山', value: 'sanfrancisco' },
          ],
        },
      ],
    },
    defaultValue: null,
    metadata: {
      description: '按地区进行筛选',
      icon: 'EnvironmentOutlined',
      tags: ['地区', '位置'],
    },
  },
];

/**
 * 模拟服务端返回的 Schema
 * 只包含字段标识和可能的覆盖配置
 */
export const SERVER_SCHEMA = {
  type: 'object',
  properties: {
    keyword: {
      'x-component-id': 'filter:keyword',
    },
    status: {
      'x-component-id': 'filter:status',
      // 可以在这里覆盖全局配置
      'x-component-props': {
        placeholder: '选择用户状态',
      },
    },
    dateRange: {
      'x-component-id': 'filter:date-range',
    },
    category: {
      'x-component-id': 'filter:category',
    },
    priority: {
      'x-component-id': 'filter:priority',
    },
    type: {
      'x-component-id': 'filter:type',
    },
    createTime: {
      'x-component-id': 'filter:create-time',
    },
    tags: {
      'x-component-id': 'filter:tags',
    },
    priceRange: {
      'x-component-id': 'filter:price-range',
    },
    region: {
      'x-component-id': 'filter:region',
    },
  },
};

