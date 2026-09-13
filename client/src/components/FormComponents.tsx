import { type ReactNode, forwardRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md shadow-xl relative">
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Fechar">&times;</button>
          </Dialog.Close>
          <Dialog.Title className="text-xl font-semibold mb-4">{title}</Dialog.Title>
          <div className="space-y-3">{children}</div>
          {footer && <div className="flex gap-2 justify-end mt-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface SelectInputProps {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export const SelectInput = forwardRef<HTMLButtonElement, SelectInputProps>(
  ({ value, onValueChange, placeholder, options }, ref) => (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger ref={ref} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm flex items-center justify-between bg-white">
        <Select.Value placeholder={placeholder || 'Selecione...'} />
        <Select.Icon className="text-slate-400">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="bg-white border border-slate-200 rounded-lg shadow-lg z-[100]">
          <Select.Viewport className="p-1">
            {options.map((o) => (
              <Select.Item key={o.value} value={o.value} className="px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100">
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
);
SelectInput.displayName = 'SelectInput';
