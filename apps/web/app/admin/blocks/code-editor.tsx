'use client';

import { IconCopy, IconSearch, IconTypography, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import classes from './code-editor.module.css';

export interface CodeEditorProps {
  language: 'html' | 'css' | 'javascript';
  value: string;
  placeholder?: string;
  fill?: boolean;
  onChange: (value: string) => void;
  onSave?: () => void;
  'aria-label'?: string;
}

function lineCount(value: string): number {
  return Math.max(1, value.split('\n').length);
}

function insertAtSelection(
  textarea: HTMLTextAreaElement,
  inserted: string,
  onChange: (value: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const nextValue = `${textarea.value.slice(0, start)}${inserted}${textarea.value.slice(end)}`;
  onChange(nextValue);
  requestAnimationFrame(() => {
    textarea.selectionStart = start + inserted.length;
    textarea.selectionEnd = start + inserted.length;
  });
}

function outdentAtSelection(textarea: HTMLTextAreaElement, onChange: (value: string) => void) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
  const selected = textarea.value.slice(lineStart, end);
  const outdented = selected.replace(/^( {1,2}|\t)/gm, '');
  const next = `${textarea.value.slice(0, lineStart)}${outdented}${textarea.value.slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart + outdented.length;
  });
}

function formatSource(source: string): string {
  // This is deliberately conservative. The API remains the authority for
  // source validity, and formatting must never rewrite an attribute value.
  return source
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function CodeEditor({
  language,
  value,
  placeholder,
  fill = false,
  onChange,
  onSave,
  'aria-label': ariaLabel,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        outdentAtSelection(event.currentTarget, onChange);
      } else {
        insertAtSelection(event.currentTarget, '  ', onChange);
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      onSave?.();
    }
  }

  function handleScroll() {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (textarea && lineNumbers) {
      lineNumbers.style.transform = `translateY(-${textarea.scrollTop}px)`;
    }
  }

  function copySource() {
    void navigator.clipboard?.writeText(value);
  }

  function replaceAll() {
    if (query === '') return;
    onChange(value.split(query).join(replacement));
  }

  return (
    <div
      className={`${classes.editor} ${fill ? classes.editorFill : ''} ${focused ? classes.editorFocused : ''}`}
    >
      <div className={classes.editorHeader}>
        <span
          className={`${classes.languageDot} ${language === 'html' ? classes.languageDotHtml : language === 'css' ? classes.languageDotCss : classes.languageDotJavaScript}`}
        />
        <span className={classes.languageName}>{language.toUpperCase()}</span>
        <span className={classes.editorHint}>Tab / Shift+Tab indent · Ctrl/Cmd+S save</span>
        <button
          type="button"
          className={classes.editorAction}
          onClick={() => setFindOpen((current) => !current)}
          aria-label="Find and replace"
        >
          <IconSearch size={14} />
        </button>
        <button
          type="button"
          className={classes.editorAction}
          onClick={() => onChange(formatSource(value))}
          aria-label="Format whitespace"
        >
          <IconTypography size={14} />
        </button>
        <button
          type="button"
          className={classes.editorAction}
          onClick={copySource}
          aria-label="Copy source"
        >
          <IconCopy size={14} />
        </button>
      </div>
      {findOpen ? (
        <div className={classes.findBar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Find"
            aria-label="Find in source"
          />
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.currentTarget.value)}
            placeholder="Replace with"
            aria-label="Replace in source"
          />
          <button type="button" onClick={replaceAll}>
            Replace all
          </button>
          <button
            type="button"
            onClick={() => setFindOpen(false)}
            aria-label="Close find and replace"
          >
            <IconX size={14} />
          </button>
        </div>
      ) : null}
      <div className={classes.editorBody}>
        <div ref={lineNumbersRef} className={classes.lineNumbers} aria-hidden="true">
          {Array.from({ length: lineCount(value) }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className={classes.textarea}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          wrap="off"
          aria-label={ariaLabel ?? `${language.toUpperCase()} code`}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      <div className={classes.editorFooter}>
        <span>{lineCount(value)} lines</span>
        <span>{value.length} characters</span>
        <span className={classes.footerSpacer} />
        <span>
          {language === 'html'
            ? 'Template markup'
            : language === 'css'
              ? 'Scoped stylesheet'
              : 'Sandboxed runtime'}
        </span>
      </div>
    </div>
  );
}
