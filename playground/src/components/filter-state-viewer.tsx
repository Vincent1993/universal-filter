import { useFilter } from '@dfx/universal-filter';
import { JsonTreeView } from '@ark-ui/react/json-tree-view';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import './filter-state-view.css';

interface FilterStateViewerProps {
  title?: string;
  defaultExpandedDepth?: number;
}

export function FilterStateViewer({
  title = '状态监视器',
  defaultExpandedDepth = 2,
}: FilterStateViewerProps) {
  const filter = useFilter();

  // const [, forceRender] = useReducer((count: number) => count + 1, 0);

  // // 订阅表单变化
  // useMemo(() => {
  //   const subscriptionId = filter.form.subscribe(({ type }) => {
  //     if (
  //       type === 'onFormValuesChange' ||
  //       type === 'onFormSubmitSuccess' ||
  //       type === 'onFormReset'
  //     ) {
  //       forceRender();
  //     }
  //   });

  //   return () => filter.form.unsubscribe(subscriptionId);
  // }, [filter]);

  // const draft = filter.draft ?? {};
  // const applied = filter.applied ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={filter.getState().modified ? 'default' : 'secondary'}>
            {filter.getState().modified ? '已变更' : '未变更'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            草稿状态 (Draft)
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <JsonTreeView.Root
              key="filter-draft"
              data={filter.getDraft()}
              defaultExpandedDepth={defaultExpandedDepth}
            >
              <JsonTreeView.Tree arrow={<ChevronRight className="h-4 w-4" />} />
            </JsonTreeView.Root>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            已应用状态 (Applied)
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <JsonTreeView.Root
              key="filter-applied"
              data={filter.getApplied()}
              defaultExpandedDepth={defaultExpandedDepth}
            >
              <JsonTreeView.Tree arrow={<ChevronRight className="h-4 w-4" />} />
            </JsonTreeView.Root>
          </div>
        </div>

        {/* 完整的 filter 实例信息 */}
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold text-foreground hover:text-primary">
            完整 Filter 实例 (展开查看)
          </summary>
          <div className="mt-2 rounded-lg border bg-muted/30 p-4">
            <JsonTreeView.Root data={filter.getState()} defaultExpandedDepth={1}>
              <JsonTreeView.Tree arrow={<ChevronRight className="h-4 w-4" />} />
            </JsonTreeView.Root>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
