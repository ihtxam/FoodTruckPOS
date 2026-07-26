import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { arrayMove } from '@/lib/reorder';

type SortableRowProps = {
  id: string;
  children: (handleProps: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    isDragging: boolean;
  }) => ReactNode;
  className?: string;
  disabled?: boolean;
  as?: 'div' | 'li' | 'tr';
};

export function SortableRow({ id, children, className, disabled, as = 'div' }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
    touchAction: 'none',
  };

  const content = children({ attributes, listeners, isDragging });

  if (as === 'tr') {
    return (
      <tr ref={setNodeRef} style={style} className={className}>
        {content}
      </tr>
    );
  }
  if (as === 'li') {
    return (
      <li ref={setNodeRef} style={style} className={className}>
        {content}
      </li>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {content}
    </div>
  );
}

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  className?: string;
  label?: string;
};

export function DragHandle({
  attributes,
  listeners,
  className,
  label = 'Drag to reorder',
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={
        className ||
        'inline-flex min-h-11 min-w-11 items-center justify-center cursor-grab touch-none rounded-md text-[var(--text-muted,#64748b)] hover:bg-[var(--bg-muted,#eef0f3)] active:cursor-grabbing'
      }
      style={{ touchAction: 'none' }}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={18} />
    </button>
  );
}

function useReorderSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

type SortableContainerProps<T extends { id: string }> = {
  items: T[];
  onReorder: (next: T[]) => void;
  children: ReactNode;
  disabled?: boolean;
  as?: 'div' | 'tbody' | 'ul' | 'fragment';
  className?: string;
};

export function SortableContainer<T extends { id: string }>({
  items,
  onReorder,
  children,
  disabled,
  as = 'fragment',
  className,
}: SortableContainerProps<T>) {
  const sensors = useReorderSensors();

  const onDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };

  const sorted = (
    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
      {as === 'tbody' ? (
        <tbody className={className}>{children}</tbody>
      ) : as === 'ul' ? (
        <ul className={className}>{children}</ul>
      ) : as === 'div' ? (
        <div className={className}>{children}</div>
      ) : (
        children
      )}
    </SortableContext>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {sorted}
    </DndContext>
  );
}
