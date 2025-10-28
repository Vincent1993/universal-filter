import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {  Button } from 'antd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { createSchemaField } from '@formily/react';
import {
  FormItem,
  Input,
  Select,
  Switch,
  FormButtonGroup,
} from '@formily/antd-v5';
import { ISchema } from '@formily/json-schema';
import { createFilter, FilterProvider, useFilter, createUrlSyncPlugin } from '@dfx/universal-filter';
import { FilterStateViewer } from '@/components/filter-state-viewer';
import {  JsonEditor } from '@/components/json-config-editor';


type DemoDraft = {
  keyword?: string;
  category?: string;
  status?: string;
  [key: string]: unknown;
};

// 创建 Schema Field 组件
const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input,
    Select,
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
      },
      'x-decorator-props': {
        tooltip: '选择内容分类',
      },
      enum: [
        { label: '📚 图书', value: 'books' },
        { label: '🎬 电影', value: 'movies' },
        { label: '🎵 音乐', value: 'music' },
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
      },
      enum: [
        { label: '✅ 已发布', value: 'published' },
        { label: '📝 草稿', value: 'draft' },
        { label: '🗄️ 归档', value: 'archived' },
      ],
    },
  },
};

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
          筛选控制器
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SchemaField schema={filterSchema} key={JSON.stringify(filterSchema)}/>
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
        <JsonEditor
          value={JSON.stringify(filterSchema, null, 2)}
          onChange={handleSchemaChange}
          schema={filterSchema}
          height="400px"
          className="mt-4"
        />
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
                console.log('Demo plugin initialized with filter:', root.id);
              },
            };
          },
        ],
        defaultValues: {
          keyword: '',
          category: 'books',
          status: 'published',
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
