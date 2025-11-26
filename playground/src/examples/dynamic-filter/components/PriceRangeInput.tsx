import { InputNumber } from 'antd';
import { useMemo } from 'react';

export interface PriceRangeValue extends Array<number | undefined> {
  0: number | undefined;
  1: number | undefined;
}

export interface PriceRangeInputProps {
  value?: PriceRangeValue;
  onChange?: (value?: PriceRangeValue) => void;
  placeholder?: [string?, string?];
  precision?: number;
  min?: number;
  max?: number;
}

export function PriceRangeInput(props: PriceRangeInputProps) {
  const {
    value,
    onChange,
    placeholder = ['最低值', '最高值'],
    precision = 2,
    min,
    max,
  } = props;

  const [start, end] = useMemo<PriceRangeValue>(
    () => (Array.isArray(value) ? value : [undefined, undefined]),
    [value]
  );

  const handleStartChange = (next?: number | null) => {
    const normalized: PriceRangeValue = [next ?? undefined, end];
    onChange?.(normalized);
  };

  const handleEndChange = (next?: number | null) => {
    const normalized: PriceRangeValue = [start, next ?? undefined];
    onChange?.(normalized);
  };

  return (
    <div className="flex items-center gap-2">
      <InputNumber
        className="w-full"
        value={start}
        min={min}
        max={max}
        precision={precision}
        placeholder={placeholder?.[0]}
        onChange={handleStartChange}
      />
      <span className="text-muted-foreground">~</span>
      <InputNumber
        className="w-full"
        value={end}
        min={min}
        max={max}
        precision={precision}
        placeholder={placeholder?.[1]}
        onChange={handleEndChange}
      />
    </div>
  );
}




