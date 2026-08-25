/**
 * 模型切换器的纯逻辑部分。
 *
 * 拆出来是为了能被 node:test 直接导入——组件文件带 "use client" 和 JSX，
 * 测试环境跑不起来，而分组和键盘移动的边界恰好是最容易出错的地方。
 */

export type PickerModel = {
  id: string;
  label: string;
  providerLabel: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
};

export type ModelGroup = { provider: string; models: PickerModel[] };

/**
 * 按供应商分组。
 *
 * 刻意不排序：模型池的顺序是后台配置好的优先级，重排会让「第一个」不再是默认模型。
 * 同一供应商的模型即使在池里不连续，也会被归到它第一次出现的位置。
 */
export function groupModelsByProvider(models: PickerModel[]): ModelGroup[] {
  const ordered: ModelGroup[] = [];
  for (const model of models) {
    const group = ordered.find((item) => item.provider === model.providerLabel);
    if (group) group.models.push(model);
    else ordered.push({ provider: model.providerLabel, models: [model] });
  }
  return ordered;
}

/** 分组只影响渲染层级，键盘上下移动要走这份拍平后的顺序 */
export function flattenGroups(groups: ModelGroup[]): PickerModel[] {
  return groups.flatMap((group) => group.models);
}

/**
 * 计算键盘移动后的高亮下标，到头则回绕。
 *
 * 回绕而不是停在两端：列表通常很短，回绕能让「按住上键找最后一个」这种操作立刻到位。
 * 当前下标为 -1（没有选中项）时，向下从头开始、向上从末尾开始。
 */
export function moveActiveIndex(current: number, step: number, total: number) {
  if (total <= 0) return -1;
  if (current < 0) return step > 0 ? 0 : total - 1;
  const next = current + step;
  if (next < 0) return total - 1;
  if (next >= total) return 0;
  return next;
}
