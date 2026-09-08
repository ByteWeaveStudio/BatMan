import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { Progress } from '../../components/primitives';

export function NodeRow({
  name,
  progress,
  selected,
  completed,
  onSelect,
  checkbox,
  accent,
  trailing,
}: {
  name: string;
  progress?: number;
  selected?: boolean;
  completed?: boolean;
  onSelect: () => void;
  checkbox?: { checked: boolean; onChange: (next: boolean) => void; label: string };
  accent: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`node${selected ? ' is-selected' : ''}${completed ? ' is-done' : ''}`}
      style={{ ['--node-accent' as string]: accent }}
    >
      {checkbox ? (
        <input
          type="checkbox"
          className="check node__check"
          checked={checkbox.checked}
          onChange={(e) => checkbox.onChange(e.target.checked)}
          aria-label={checkbox.label}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      <button type="button" className="node__main" onClick={onSelect}>
        <span className="node__row">
          <span className="node__title truncate">{name}</span>
          {progress !== undefined ? <span className="node__meta">{Math.round(progress)}%</span> : null}
        </span>
        {progress !== undefined ? <Progress value={progress} color={accent} thin /> : null}
      </button>
      {trailing}
    </div>
  );
}

export function AddRow({
  placeholder,
  onAdd,
  onCancel,
  autoFocus = true,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (!clean) return onCancel();
    onAdd(clean);
    setValue('');
  }

  return (
    <form className="add-row" onSubmit={submit}>
      <input
        ref={ref}
        className="input input--sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <button type="submit" className="btn btn--primary btn--sm btn--icon" disabled={!value.trim()} aria-label="Add">
        <Icon name="check" />
      </button>
      <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onCancel} aria-label="Cancel">
        <Icon name="close" />
      </button>
    </form>
  );
}

export function EditableTitle({
  value,
  editing,
  onEditingChange,
  onCommit,
  className = 'panel__title',
}: {
  value: string;
  editing: boolean;
  onEditingChange: (next: boolean) => void;
  onCommit: (next: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  if (!editing) {
    return (
      <h2 className={`${className} truncate`} onDoubleClick={() => onEditingChange(true)}>
        {value}
      </h2>
    );
  }

  return (
    <input
      ref={ref}
      className="input input--sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onEditingChange(false);
        const clean = draft.trim();
        if (clean && clean !== value) onCommit(clean);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          onEditingChange(false);
        }
      }}
      aria-label="Rename"
    />
  );
}

/** Textarea that saves on blur, so typing never fights the live subscription. */
export function DescriptionField({
  value,
  onCommit,
  id,
}: {
  value: string;
  onCommit: (next: string) => void;
  id: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return (
    <textarea
      id={id}
      className="textarea description"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.blur();
      }}
      placeholder="Add details, context, or the steps for this task…"
    />
  );
}
