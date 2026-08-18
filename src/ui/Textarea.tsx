import type { TextareaHTMLAttributes } from 'react';

/** Token-styled multiline input (the DS ships no textarea). Matches Input's shell. */
export function Textarea({ style, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="ix-input"
      {...rest}
      style={{
        width: '100%',
        minHeight: 64,
        padding: '8px 10px',
        border: '1px solid var(--color-border-control)',
        borderRadius: 'var(--radius-sm)',
        font: 'inherit',
        fontSize: 'var(--type-input-size)',
        color: 'var(--color-foreground)',
        background: 'var(--color-background)',
        resize: 'vertical',
        ...style,
      }}
    />
  );
}
