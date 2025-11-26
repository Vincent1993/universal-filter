import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { createFilter, FilterProvider } from '@dfx/universal-filter';
import {
  DynamicFilterProvider,
  useDynamicFilters,
  useFilterRegistry,
  useSchemaField,
  useAssembledSchema,
  withOptions,
} from '@dfx/dynamic-filter';
import {
  FormItem,
  Input as FormilyInput,
  DatePicker,
  Select as FormilySelect,
  Cascader,
} from '@formily/antd-v5';
import { FilterStateViewer } from '@/components/filter-state-viewer';
import {
  FILTER_DEFINITIONS,
  SERVER_SCHEMA,
} from '../examples/dynamic-filter/filter-configs';
import { PriceRangeInput } from '../examples/dynamic-filter/components/PriceRangeInput';
import { RemoteSelect } from '../examples/dynamic-filter/components/RemoteSelect';
import { PlusCircle, X, Search } from 'lucide-react';
import { FormConsumer } from '@formily/react';


// 配置查看组件
function ConfigViewer({ title, config }: { title: string; config: any }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{title}</h4>
      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-[300px]">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
}

// 筛选器分组和搜索组件
function FilterSelector({
  onSelect,
  availableFilters,
}: {
  onSelect: (filterId: string) => void;
  availableFilters: any[];
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // 分组筛选器
  const groupedFilters = useMemo(() => {
    const groups = {
      search: { label: '🔍 搜索', items: [] as any[] },
      enum: { label: '📋 选择', items: [] as any[] },
      date: { label: '📅 时间', items: [] as any[] },
      number: { label: '🔢 数值', items: [] as any[] },
      location: { label: '📍 位置', items: [] as any[] },
    };

    availableFilters.forEach((f) => {
      const group =
        groups[f.category as keyof typeof groups] || groups.enum;
      group.items.push(f);
    });

    return Object.entries(groups).filter(
      ([_, group]) => group.items.length > 0
    );
  }, [availableFilters]);

  // 搜索过滤
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedFilters;

    return groupedFilters
      .map(([key, group]) => [
        key,
        {
          ...group,
          items: group.items.filter(
            (item) =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.metadata?.description
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              item.metadata?.tags?.some((tag: string) =>
                tag.toLowerCase().includes(searchQuery.toLowerCase())
              )
          ),
        },
      ])
      .filter(([_, group]: any) => group.items.length > 0);
  }, [groupedFilters, searchQuery]);

  return (
    <div className="space-y-3">
      {/* 分组选择器 */}
      <Select onValueChange={onSelect}>
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            <SelectValue placeholder="添加筛选条件" />
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索筛选器..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {filteredGroups.map(([key, group]: any) => (
            <SelectGroup key={key}>
              <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label} ({group.items.length})
              </SelectLabel>
              {group.items.map((field: any) => (
                <SelectItem key={field.id} value={field.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {field.category}
                    </Badge>
                  </div>
                  {field.metadata?.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {field.metadata.description}
                    </div>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 动态筛选器内容组件
function DynamicFilterContent() {
  // 1. 创建 filter 实例
  const filter = useMemo(() => createFilter(), []);
  const [selectedFieldForConfig, setSelectedFieldForConfig] = useState<
    string | null
  >(null);

  // 2. 获取组装后的 Schema
  const assembledSchema = useAssembledSchema();

  // 3. 使用动态筛选器管理
  const {
    activeFilters,
    activeSchema,
    availableFilters,
    addFilter,
    removeFilter,
    resetFilters,
  } = useDynamicFilters({
    filter,
    assembledSchema: assembledSchema!,
    defaultFilters: ['filter:keyword', 'filter:status', 'filter:category'], // 默认显示关键词、状态和分类
  });

  // 4. 获取注册表和 SchemaField
  const registry = useFilterRegistry();
  const SchemaField = useSchemaField();

  // 获取选中筛选器的配置信息
  const getFilterConfigs = (filterId: string) => {
    const definition = registry.getById(filterId);
    if (!definition) return null;

    // 找到对应的服务端 Schema 字段
    const serverFieldEntry = Object.entries(
      SERVER_SCHEMA.properties || {}
    ).find(
      ([_, schema]: [string, any]) => (schema as any)['x-filter-id'] === filterId
    );

    if (!serverFieldEntry) return null;

    const [fieldKey, serverFieldSchema] = serverFieldEntry;

    // 1. 全局定义
    const globalSchema = definition;

    // 2. 服务端配置
    const serverSchema = serverFieldSchema;

    // 3. 合并后的配置（从 activeSchema 中提取筛选器的所有字段）
    const filterFields: Record<string, any> = {};
    if (activeSchema.properties) {
      Object.keys(activeSchema.properties).forEach(key => {
        const field = (activeSchema.properties as any)[key];
        if (field['x-filter-id'] === filterId) {
          filterFields[key] = field;
        }
      });
    }

    const mergedSchema = {
      type: 'object',
      properties: filterFields,
    };

    // 提取纯粹的覆盖部分
    const serverOverride = { ...serverFieldSchema };
    delete (serverOverride as any)['x-filter-id'];

    return {
      fieldKey,
      global: globalSchema,
      server: serverSchema,
      serverOverride:
        Object.keys(serverOverride).length > 0 ? serverOverride : null,
      merged: mergedSchema,
    };
  };

  // 获取所有筛选器的配置概览
  const getAllFiltersConfig = () => {
    const allFilters = [...activeFilters, ...availableFilters.map((f) => f.id)];
    return allFilters
      .map((filterId) => {
        const definition = registry.getById(filterId);
        const isActive = activeFilters.includes(filterId);

        if (!definition) return null;

        return {
          filterId,
          name: definition.name,
          category: definition.category,
          isActive,
          definition,
        };
      })
      .filter(Boolean);
  };

  return (
    <FilterProvider instance={filter}>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <div className="col-span-2 space-y-4">
          {/* 筛选器表单卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>筛选条件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 筛选器字段 - 自适应布局 */}
                <div className="flex flex-wrap gap-4">
                  {/* 渲染已激活的筛选器 */}
                  {activeFilters.map((filterId) => {
                    const definition = registry.getById(filterId);
                    if (!definition) return null;

                    // 渲染筛选器的所有字段
                    const filterFields = Object.keys(activeSchema.properties || {}).filter(
                      key => (activeSchema.properties as any)[key]['x-filter-id'] === filterId
                    );

                    return (
                      <div key={filterId} className="inline-flex relative items-center gap-2 p-3 border rounded-lg">
                        {/* 筛选器名称 */}
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          {definition.name}
                        </div>

                        {/* 渲染筛选器的所有字段 */}
                        <SchemaField
                          schema={{
                            type: 'object',
                            properties: filterFields.reduce((acc, key) => {
                              acc[key] = {
                                ...(activeSchema.properties as any)[key],
                                'x-decorator-props': {
                                  layout: 'vertical',
                                  ...((activeSchema.properties as any)[key])?.['x-decorator-props'],
                                },
                              };
                              return acc;
                            }, {} as Record<string, any>)
                          }}
                        />

                        {/* 移除筛选器按钮 */}
                        <button
                          className="absolute top-1 right-1 rounded-full hover:bg-destructive/10 text-destructive px-1.5 py-0.5 text-sm"
                          onClick={() => removeFilter(filterId)}
                          aria-label="移除筛选器"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                  {/* 筛选器选择器 */}
                  {availableFilters.length > 0 && (
                    <div className="rounded-lg p-3 flex items-center justify-center min-h-[64px] min-w-[200px]">
                      <FilterSelector
                        onSelect={addFilter}
                        availableFilters={availableFilters}
                      />
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 justify-between pt-4 border-t">
                  <Button variant="outline" onClick={resetFilters}>
                    重置筛选器
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => filter.reset()}>
                      重置值
                    </Button>
                    <Button onClick={() => filter.apply()}>应用筛选</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 配置合并详情卡片 */}
          {selectedFieldForConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>配置合并详情</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFieldForConfig(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const configs = getFilterConfigs(selectedFieldForConfig);
                  const definition = registry.getById(selectedFieldForConfig);

                  if (!configs)
                    return (
                      <p className="text-sm text-muted-foreground">
                        未找到配置
                      </p>
                    );

                  return (
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Badge>{definition?.name}</Badge>
                        <Badge variant="outline">
                          {selectedFieldForConfig}
                        </Badge>
                        {definition?.category && (
                          <Badge variant="secondary">{definition.category}</Badge>
                        )}
                      </div>

                      <Tabs defaultValue="merged" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="global">全局配置</TabsTrigger>
                          <TabsTrigger value="server">
                            服务端配置
                            {!configs.serverOverride && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                无覆盖
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="merged">合并结果</TabsTrigger>
                        </TabsList>

                        <TabsContent value="global" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">
                                字段名: {configs.fieldKey}
                              </Badge>
                              <span className="text-muted-foreground">
                                来自 FILTER_CONFIGS 的全局配置
                              </span>
                            </div>
                            <ConfigViewer
                              title="完整 Schema 结构"
                              config={configs.global}
                            />
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded text-xs">
                              <p className="font-medium mb-1">说明:</p>
                              <p className="text-muted-foreground">
                                这是注册在{' '}
                                <code className="bg-muted px-1 py-0.5 rounded">
                                  FILTER_CONFIGS
                                </code>{' '}
                                中的基础配置。
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="server" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">
                                字段名: {configs.fieldKey}
                              </Badge>
                              <span className="text-muted-foreground">
                                来自 SERVER_SCHEMA 的配置
                              </span>
                            </div>
                            <ConfigViewer
                              title="完整 Schema 结构（包含 x-component-id 引用）"
                              config={configs.server}
                            />
                            {configs.serverOverride && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">
                                  纯覆盖部分（已去除 x-component-id）
                                </h4>
                                <pre className="bg-amber-50 dark:bg-amber-950 p-3 rounded text-xs overflow-auto max-h-[200px] border border-amber-200 dark:border-amber-800">
                                  {JSON.stringify(
                                    configs.serverOverride,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="merged" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">
                                字段名: {configs.fieldKey}
                              </Badge>
                              <Badge className="bg-green-600">最终配置</Badge>
                            </div>
                            <ConfigViewer
                              title="Assembly 合并后的完整配置"
                              config={configs.merged}
                            />
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm border border-blue-200 dark:border-blue-800">
                              <p className="font-medium mb-2">合并过程 (新架构):</p>
                              <div className="space-y-2 text-xs">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                                    1.
                                  </span>
                                  <span>
                                    Provider 调用 Processor.assemble()
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                                    2.
                                  </span>
                                  <span>遍历 SERVER_SCHEMA，发现 x-component-id</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                                    3.
                                  </span>
                                  <span>
                                    从 Registry 获取全局定义，进行深度合并
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                                    4.
                                  </span>
                                  <span>
                                    返回完整 Schema，Hook 使用 Processor.project() 过滤
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧配置面板 */}
        <div className="col-span-1 space-y-4">
          {/* 表单状态查看器 */}
          <FilterStateViewer />

          {/* 配置总览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">配置总览</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                查看所有字段的配置状态和合并结果
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {getAllFiltersConfig().map((filterConfig: any) => (
                <div
                  key={filterConfig.filterId}
                  className={`p-3 rounded-lg border transition-all ${
                    filterConfig.isActive
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* 筛选器头部 */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {filterConfig.name}
                        </span>
                        {filterConfig.isActive && (
                          <Badge
                            variant="default"
                            className="text-xs bg-green-600"
                          >
                            已激活
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {filterConfig.filterId}
                        </Badge>
                        {filterConfig.category && (
                          <Badge variant="outline" className="text-xs">
                            {filterConfig.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 快速操作 */}
                  {filterConfig.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => removeFilter(filterConfig.filterId)}
                    >
                      移除筛选器
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => addFilter(filterConfig.filterId)}
                    >
                      添加到筛选器
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 最终配置预览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">最终 Schema 配置</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                当前激活字段的完整 Schema
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Badge variant="outline">{activeFilters.length} 个筛选器</Badge>
                  <span className="text-xs text-muted-foreground">
                    已合并完成
                  </span>
                </div>
                <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[400px] font-mono">
                  {JSON.stringify(activeSchema, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FilterProvider>
  );
}

// 主页面组件
function DynamicFilterPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">动态筛选器示例 (新架构)</h1>
        <p className="text-muted-foreground mt-2">
          基于 Schema Assembly & Projection 的 Headless 动态筛选器系统
        </p>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">支持远程数据源</Badge>
          <Badge variant="outline">支持搜索</Badge>
          <Badge variant="outline">支持依赖刷新</Badge>
        </div>
      </div>

      <DynamicFilterProvider
        schema={SERVER_SCHEMA}
        definitions={FILTER_DEFINITIONS}
        components={{
          FormItem,
          Input: FormilyInput,
          // 使用 withOptions 包装 Select，使其自动支持 x-data-source
          Select: withOptions(FormilySelect),
          DatePicker,
          // Cascader 也支持 options，所以也包装一下
          Cascader: withOptions(Cascader),
          PriceRangeInput,
          RemoteSelect,
        }}
        scope={{}}
      >
        <DynamicFilterContent />
      </DynamicFilterProvider>
    </>
  );
}

export const Route = createFileRoute('/dynamic-filter')({
  component: DynamicFilterPage,
});
