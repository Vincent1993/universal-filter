import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createFilter, FilterProvider } from '@dfx/universal-filter';
import {
  DynamicFilterProvider,
  useDynamicFields,
  useFilterRegistry,
  useSchemaField
} from '@dfx/dynamic-filter';
import { FormItem, Input, DatePicker, FormGrid } from '@formily/antd-v5';
import { FormilySelect } from '@/components/formily-select';
import { FilterStateViewer } from '@/components/filter-state-viewer';
import { FILTER_CONFIGS, SERVER_SCHEMA } from '../examples/dynamic-filter/filter-configs';
import { PlusCircle, X } from 'lucide-react';

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

// 动态筛选器内容组件
function DynamicFilterContent() {
  // 1. 创建 filter 实例
  const filter = useMemo(() => createFilter(), []);
  const [selectedFieldForConfig, setSelectedFieldForConfig] = useState<string | null>(null);

  // 2. 使用动态字段管理
  const {
    activeFields,
    activeSchema,
    availableFields,
    addField,
    removeField,
    resetFields
  } = useDynamicFields({
    filter,
    serverSchema: SERVER_SCHEMA,
    defaultFields: ['filter:keyword', 'filter:status'] // 默认显示关键词和状态
  });

  // 3. 获取注册表和 SchemaField
  const registry = useFilterRegistry();
  const SchemaField = useSchemaField();

  // 获取选中字段的配置信息
  const getFieldConfigs = (fieldId: string) => {
    const globalConfig = registry.getById(fieldId);
    if (!globalConfig) return null;

    // 找到对应的服务端 Schema 字段
    const serverFieldEntry = Object.entries(SERVER_SCHEMA.properties || {}).find(
      ([_, schema]: [string, any]) => schema['x-component-id'] === fieldId
    );

    if (!serverFieldEntry) return null;

    const [fieldKey, serverFieldSchema] = serverFieldEntry;

    // 1. 全局配置（完整的 schema）
    const globalSchema = {
      type: 'object',
      properties: {
        [fieldKey]: globalConfig.schema
      }
    };

    // 2. 服务端配置（完整的 schema，包含 x-component-id）
    const serverSchema = {
      type: 'object',
      properties: {
        [fieldKey]: { ...serverFieldSchema }
      }
    };

    // 3. 合并后的配置（从 activeSchema 中提取）
    const mergedSchema = {
      type: 'object',
      properties: {
        [fieldKey]: activeSchema.properties?.[fieldKey]
      }
    };

    // 提取纯粹的覆盖部分（去除 x-component-id 和 x-field-name）
    const serverOverride = { ...serverFieldSchema };
    delete serverOverride['x-component-id'];
    delete serverOverride['x-field-name'];

    return {
      fieldKey,
      global: globalSchema,
      server: serverSchema,
      serverOverride: Object.keys(serverOverride).length > 0 ? serverOverride : null,
      merged: mergedSchema
    };
  };

  // 获取所有字段的配置概览
  const getAllFieldsConfig = () => {
    const allFields = [...activeFields, ...availableFields.map(f => f.id)];
    return allFields.map(fieldId => {
      const config = registry.getById(fieldId);
      const isActive = activeFields.includes(fieldId);

      if (!config) return null;

      const serverFieldEntry = Object.entries(SERVER_SCHEMA.properties || {}).find(
        ([_, schema]: [string, any]) => schema['x-component-id'] === fieldId
      );

      return {
        fieldId,
        fieldKey: serverFieldEntry?.[0],
        name: config.name,
        category: config.category,
        isActive,
        hasServerOverride: serverFieldEntry ? Object.keys(serverFieldEntry[1]).filter(k => k !== 'x-component-id' && k !== 'x-field-name').length > 0 : false,
        globalSchema: config.schema,
        serverSchema: serverFieldEntry?.[1],
        mergedSchema: isActive && serverFieldEntry ? activeSchema.properties?.[serverFieldEntry[0]] : null
      };
    }).filter(Boolean);
  };

  return (
    <FilterProvider instance={filter}>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* 筛选器表单卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>筛选条件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 网格布局的筛选器字段 + 字段选择器 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 渲染已激活的字段 */}
                  {activeFields.map(fieldId => {
                    const config = registry.getById(fieldId);
                    const fieldKey = Object.entries(SERVER_SCHEMA.properties || {}).find(
                      ([_, schema]: [string, any]) => schema['x-component-id'] === fieldId
                    )?.[0];

                    if (!fieldKey) return null;

                    return (
                      <div key={fieldId} className="relative group">
                        {/* 删除按钮 */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={() => removeField(fieldId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>


                        <SchemaField
                            schema={{
                              type: 'object',
                              properties: {
                                [fieldKey]: activeSchema.properties?.[fieldKey]
                              }
                            }}
                          />
                      </div>
                    );
                  })}

                  {/* 字段选择器（放在最后） */}
                  {availableFields.length > 0 && (
                    <div className="border-2 border-dashed rounded-lg p-3 flex items-center justify-center min-h-[80px]">
                      <Select
                        onValueChange={(value) => {
                          addField(value);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            <SelectValue placeholder="添加筛选条件" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map(field => (
                            <SelectItem key={field.id} value={field.id}>
                              <div className="flex items-center gap-2">
                                {field.name}
                                {field.category && (
                                  <Badge variant="outline" className="ml-auto">
                                    {field.category}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={resetFields}
                  >
                    重置字段
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => filter.reset()}
                    >
                      重置值
                    </Button>
                    <Button
                      onClick={() => filter.apply()}
                    >
                      应用筛选
                    </Button>
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
                  const configs = getFieldConfigs(selectedFieldForConfig);
                  const config = registry.getById(selectedFieldForConfig);

                  if (!configs) return <p className="text-sm text-muted-foreground">未找到配置</p>;

                  return (
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Badge>{config?.name}</Badge>
                        <Badge variant="outline">{selectedFieldForConfig}</Badge>
                        {config?.category && (
                          <Badge variant="secondary">{config.category}</Badge>
                        )}
                      </div>

                      <Tabs defaultValue="merged" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="global">全局配置</TabsTrigger>
                          <TabsTrigger value="server">
                            服务端配置
                            {!configs.serverOverride && <Badge variant="outline" className="ml-2 text-xs">无覆盖</Badge>}
                          </TabsTrigger>
                          <TabsTrigger value="merged">合并结果</TabsTrigger>
                        </TabsList>

                        <TabsContent value="global" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">字段名: {configs.fieldKey}</Badge>
                              <span className="text-muted-foreground">来自 FILTER_CONFIGS 的全局配置</span>
                            </div>
                            <ConfigViewer
                              title="完整 Schema 结构"
                              config={configs.global}
                            />
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded text-xs">
                              <p className="font-medium mb-1">说明:</p>
                              <p className="text-muted-foreground">
                                这是注册在 <code className="bg-muted px-1 py-0.5 rounded">FILTER_CONFIGS</code> 中的基础配置，
                                包含了字段的默认 Schema 定义（组件类型、装饰器、验证规则等）。
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="server" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">字段名: {configs.fieldKey}</Badge>
                              <span className="text-muted-foreground">来自 SERVER_SCHEMA 的配置</span>
                            </div>
                            <ConfigViewer
                              title="完整 Schema 结构（包含 x-component-id 引用）"
                              config={configs.server}
                            />
                            {configs.serverOverride && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">纯覆盖部分（已去除 x-component-id）</h4>
                                <pre className="bg-amber-50 dark:bg-amber-950 p-3 rounded text-xs overflow-auto max-h-[200px] border border-amber-200 dark:border-amber-800">
                                  {JSON.stringify(configs.serverOverride, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded text-xs">
                              <p className="font-medium mb-1">说明:</p>
                              <p className="text-muted-foreground">
                                这是服务端配置，通过 <code className="bg-muted px-1 py-0.5 rounded">x-component-id</code> 引用全局配置，
                                {configs.serverOverride
                                  ? "并提供了额外的覆盖配置（如修改 label、placeholder、验证规则等）。"
                                  : "没有提供额外的覆盖配置，Schema Patch 会直接使用全局配置。"}
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="merged" className="mt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">字段名: {configs.fieldKey}</Badge>
                              <Badge className="bg-green-600">最终配置</Badge>
                            </div>
                            <ConfigViewer
                              title="Schema Patch 合并后的完整配置"
                              config={configs.merged}
                            />
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm border border-blue-200 dark:border-blue-800">
                              <p className="font-medium mb-2">合并过程:</p>
                              <div className="space-y-2 text-xs">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">1.</span>
                                  <span>Schema Patch 拦截到 <code className="bg-muted px-1 py-0.5 rounded">x-component-id</code></span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">2.</span>
                                  <span>从注册表获取全局配置作为基础</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">3.</span>
                                  <span>深度合并服务端提供的覆盖配置（对象深度合并，数组替换）</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">4.</span>
                                  <span>删除 <code className="bg-muted px-1 py-0.5 rounded">x-component-id</code> 标记，返回最终配置</span>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                                <p className="font-medium mb-1">合并规则:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li>对象属性: 深度合并（使用 es-toolkit）</li>
                                  <li>数组属性: 后者完全替换前者</li>
                                  <li>优先级: 全局配置 {"<"} 服务端配置</li>
                                </ul>
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

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>本示例演示了动态筛选器的核心功能：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>✅ 动态添加/删除筛选字段（hover 字段卡片可看到删除和配置按钮）</li>
                  <li>✅ 网格布局自动排列筛选器</li>
                  <li>✅ Schema Patch 自动配置合并（点击"配置"按钮查看详情）</li>
                  <li>✅ 自动清理被删除字段的表单值</li>
                  <li>✅ 完全 Headless，UI 自由组装</li>
                </ul>
              </div>
            </CardContent>
          </Card>
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
              {getAllFieldsConfig().map((fieldConfig: any) => (
                <div
                  key={fieldConfig.fieldId}
                  className={`p-3 rounded-lg border transition-all ${
                    fieldConfig.isActive
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  } ${
                    selectedFieldForConfig === fieldConfig.fieldId
                      ? 'ring-2 ring-blue-500'
                      : ''
                  }`}
                >
                  {/* 字段头部 */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{fieldConfig.name}</span>
                        {fieldConfig.isActive && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            已激活
                          </Badge>
                        )}
                        {!fieldConfig.isActive && (
                          <Badge variant="outline" className="text-xs">
                            未使用
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {fieldConfig.fieldId}
                        </Badge>
                        {fieldConfig.category && (
                          <Badge variant="outline" className="text-xs">
                            {fieldConfig.category}
                          </Badge>
                        )}
                        {fieldConfig.fieldKey && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {fieldConfig.fieldKey}
                          </code>
                        )}
                      </div>
                    </div>
                    {fieldConfig.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedFieldForConfig(
                          selectedFieldForConfig === fieldConfig.fieldId ? null : fieldConfig.fieldId
                        )}
                      >
                        {selectedFieldForConfig === fieldConfig.fieldId ? '收起' : '详情'}
                      </Button>
                    )}
                  </div>

                  {/* 配置状态指示器 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-muted-foreground">全局配置</span>
                      </div>
                      <span className="text-green-600 dark:text-green-400">✓</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          fieldConfig.hasServerOverride
                            ? 'bg-amber-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}></div>
                        <span className="text-muted-foreground">服务端覆盖</span>
                      </div>
                      {fieldConfig.hasServerOverride ? (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>

                    {fieldConfig.isActive && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-muted-foreground">已合并渲染</span>
                        </div>
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      </div>
                    )}
                  </div>

                  {/* 快速操作 */}
                  {fieldConfig.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => removeField(fieldConfig.fieldId)}
                    >
                      移除字段
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => addField(fieldConfig.fieldId)}
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
                  <Badge variant="outline">
                    {activeFields.length} 个字段
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    已合并完成
                  </span>
                </div>
                <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[400px] font-mono">
                  {JSON.stringify(activeSchema, null, 2)}
                </pre>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  这是传递给 <code className="bg-muted px-1 py-0.5 rounded">SchemaField</code> 组件的最终配置，
                  所有 <code className="bg-muted px-1 py-0.5 rounded">x-component-id</code> 都已被 Schema Patch 处理。
                </div>
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">动态筛选器示例</h1>
        <p className="text-muted-foreground mt-2">
          基于 Formily Schema Patch 的 Headless 动态筛选器系统
        </p>
      </div>

      <DynamicFilterProvider
        filterConfigs={FILTER_CONFIGS}
        components={{
          FormItem,
          Input,
          Select: FormilySelect,
          DatePicker,
        }}
        scope={{
          // 可以在这里添加自定义作用域
        }}
      >
        <DynamicFilterContent />
      </DynamicFilterProvider>
    </div>
  );
}

export const Route = createFileRoute('/dynamic-filter')({
  component: DynamicFilterPage,
});

