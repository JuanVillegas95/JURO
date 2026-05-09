import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type FormSelectOption<T extends string> = {
  disabled?: boolean;
  label: string;
  value: T;
};

type FormSelectProps<T extends string> = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: T) => void;
  options: readonly FormSelectOption<T>[];
  value: T;
};

export function FormSelect<T extends string>({
  ariaLabel,
  className = "",
  disabled = false,
  onValueChange,
  options,
  value,
}: FormSelectProps<T>) {
  return (
    <Select.Root disabled={disabled} value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
      <Select.Trigger aria-label={ariaLabel} className={`form-select-trigger ${className}`} disabled={disabled}>
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown size={14} strokeWidth={2.35} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="form-select-content" collisionPadding={12} position="popper" sideOffset={6}>
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                className="form-select-item"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="form-select-item__indicator">
                  <Check size={13} strokeWidth={2.5} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
