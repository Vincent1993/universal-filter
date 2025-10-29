import type { FilterFieldConfig } from '@dfx/dynamic-filter';

/**
 * 示例：全局筛选器配置列表
 * 这些配置通常来自服务端或预定义的配置文件
 */
export const FILTER_CONFIGS: FilterFieldConfig[] = [
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
        { label: '图书', value: 'books' },
        { label: '电影', value: 'movies' },
        { label: '音乐', value: 'music' },
        { label: '游戏', value: 'games' },
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
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ],
    },
    defaultValue: 'medium',
    metadata: {
      description: '任务优先级',
      icon: 'FlagOutlined',
      tags: ['优先级'],
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
  },
};

