import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import {  Button } from 'antd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { createSchemaField, useForm } from '@formily/react';
import {
  FormItem,
  Input,
  Switch,
  FormButtonGroup,
} from '@formily/antd-v5';
import { ISchema } from '@formily/json-schema';
import { createFilter, FilterProvider, useFilter, createUrlSyncPlugin, useField } from '@dfx/universal-filter';
import { FilterStateViewer } from '@/components/filter-state-viewer';
import {  JsonEditor } from '@/components/json-config-editor';
import { FormilySelect } from '@/components/formily-select';

type DemoDraft = {
  keyword?: string;
  category?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  [key: string]: unknown;
};

// 创建 Schema Field 组件
const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input,
    Select: FormilySelect,
    Switch,
  },
});

// 定义 JSON Schema
const json: ISchema = {
  type: 'object',
  properties: {
    keyword: {
      type: 'string',
      title: '关键词',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '输入搜索关键词',
        allowClear: true,
        prefix: '🔍',
      },
      'x-decorator-props': {
        tooltip: '输入关键词进行搜索',
      },
    },
    category: {
      type: 'string',
      title: '分类',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '选择分类',
        allowClear: true,
        size: 'default',
      },
      'x-decorator-props': {
        tooltip: '选择内容分类',
      },
      enum: [
        { label: '📚 图书', value: 'books' },
        { label: '🎬 电影', value: 'movies' },
        { label: '🎵 音乐', value: 'music' },
        { label: '🎮 游戏', value: 'games' },
        { label: '📱 应用', value: 'apps' },
      ],
    },
    status: {
      type: 'string',
      title: '状态',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '选择状态',
        allowClear: true,
        size: 'sm',
      },
      enum: [
        { label: '✅ 已发布', value: 'published' },
        { label: '📝 草稿', value: 'draft' },
        { label: '🗄️ 归档', value: 'archived' },
        { label: '⏸️ 暂停', value: 'paused', disabled: true },
      ],
    },
    priority: {
      type: 'string',
      title: '优先级',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '选择优先级',
        allowClear: false,
        size: 'default',
      },
      enum: [
        { label: '🔴 高', value: 'high' },
        { label: '🟡 中', value: 'medium' },
        { label: '🟢 低', value: 'low' },
      ],
    },
    tags: {
      type: 'array',
      title: '标签',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '选择标签',
        allowClear: true,
        mode: 'multiple',
        size: 'default',
      },
      enum: [
        { label: '🏷️ 热门', value: 'hot' },
        { label: '⭐ 推荐', value: 'recommended' },
        { label: '🆕 新品', value: 'new' },
        { label: '💰 特价', value: 'sale' },
        { label: '🎯 精选', value: 'featured' },
      ],
    },
  },
};

const TextComponent = () => {
  const field = useField('category')
  console.log('Category field:', field);

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-md">
      <h4 className="text-sm font-medium mb-2">字段状态监控</h4>
      <div className="text-xs text-gray-600">
        <p>Category 字段已加载</p>
        <p>字段状态: 正常</p>
        <p>是否禁用: {field.disabled ? '是' : '否'}</p>
      </div>
    </div>
  )
}

const FilterControls = () => {
  const filter = useFilter<DemoDraft>();
  const [filterSchema, setFilterSchema] = useState(json);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await filter.apply();
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    filter.reset();
  };

  const handleSchemaChange = useCallback((value: string) => {
    filter.form.clearFormGraph('*');
    setFilterSchema(JSON.parse(value))
  }, [filterSchema]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          筛选控制器 - 自定义 Select 组件演示
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>本示例展示了基于 shadcn/ui 的自定义 Formily Select 组件，支持：</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>✅ 枚举选项支持 (enum)</li>
              <li>✅ 不同尺寸 (size: sm, default)</li>
              <li>✅ 禁用状态</li>
              <li>✅ 清除功能</li>
              <li>✅ 多选模式</li>
              <li>✅ 只读模式</li>
            </ul>
          </div>

          <SchemaField schema={filterSchema} />

          <FormButtonGroup align="right">
            <Button onClick={handleReset} icon={<ReloadOutlined />}>
              重置
            </Button>
            <Button
              type="primary"
              onClick={handleApply}
              loading={isApplying}
              icon={<CheckCircleOutlined />}
            >
              应用筛选
            </Button>
          </FormButtonGroup>

          <TextComponent />

          <JsonEditor
            value={JSON.stringify(filterSchema, null, 2)}
            onChange={handleSchemaChange}
            schema={filterSchema}
            height="400px"
            className="mt-4"
          />
        </div>
      </CardContent>
    </Card>
  );
};

function BasicPage() {
  const filter = useMemo(
    () =>
      createFilter<DemoDraft>({
        plugins: [
          // 1. 简单插件对象
          createUrlSyncPlugin({ syncToInitialValues: true }),

          // 2. 工厂函数示例：可以访问 root 和使用 push/shift/remove 辅助函数
          ({ root, push, shift, remove }) => {
            // 可以根据条件动态添加插件
            if (typeof window !== 'undefined' && window.localStorage) {
              // 使用 push 在末尾添加插件
              push({
                name: 'console-logger',
                onInit: ({ bus }) => {
                  bus.on('draft:change', ({ draft }) => {
                    console.log('Draft changed:', draft);
                  });
                },
              });
            }

            // 返回主插件
            return {
              name: 'demo-plugin',
              onInit: () => {
                console.log('Demo plugin initialized with filter:', root);
              },
            };
          },
        ],
        defaultValues: {
          keyword: '',
          category: 'books',
          status: 'published',
          priority: 'medium',
          tags: ['hot'],
        },
      }),
    []
  );

  return (
    <FilterProvider instance={filter}>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <FilterControls />
        </div>
        <div className="col-span-1">
          <FilterStateViewer />
        </div>
      </div>
    </FilterProvider>
  );
}

export const Route = createFileRoute('/basic')({
  component: BasicPage,
});