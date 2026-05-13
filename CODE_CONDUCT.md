# Code Conduct

## Component Guidelines

### Component Size
- **Ideal**: < 200 lines (most components should be here)
- **Good**: 200-300 lines (acceptable for complex features)
- **Warning**: 300-500 lines (consider refactoring)
- **Error**: > 500 lines (must refactor)

Components should be broken down into smaller, more focused components when approaching these limits.

### Component Exports
- All components must use named exports with the `export function` syntax
- **No default exports for components**

```tsx
// ✅ Correct
export function MyComponent(props: Props) {
  // ...
}

// ❌ Incorrect
export default function MyComponent(props: Props) {
  // ...
}
```

### Props Interface
- Props must be defined as an `interface` (not a `type`)
- If there is only one component in the file, the interface should be named `Props`
- If there are multiple components in the file, use descriptive names like `MyComponentProps`

```tsx
// ✅ Correct - Single component in file
interface Props {
  className?: string;
}

export function Navbar(props: Props) {
  const className = props.className;
  // ...
}
```

```tsx
// ✅ Correct - Multiple components in file
interface HeaderProps {
  title: string;
}

interface FooterProps {
  year: number;
}

export function Header(props: HeaderProps) {
  // ...
}

export function Footer(props: FooterProps) {
  // ...
}
```

### Standard Props
- All components should accept an optional `className` prop for styling flexibility

```tsx
interface Props {
  className?: string;
  // other props...
}
```

### Props Destructuring
- Always destructure props at the beginning of the component
- Do not use `props.x` notation throughout the component

```tsx
// ✅ Correct
export function Button({ className, onClick, children }: Props) {
  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}

// ❌ Incorrect
export function Button(props: Props) {
  return (
    <button className={props.className} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
```

### Event Handler Naming
- Use `handle` prefix for event handler functions: `handleClick`, `handleSubmit`, `handleChange`
- Use `on` prefix for event handler props: `onClick`, `onSubmit`, `onChange`

```tsx
interface Props {
  onSubmit: (value: string) => void;
}

export function Form({ onSubmit }: Props) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formValue);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormValue(e.target.value);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Import Ordering
- Organize imports in the following order, with blank lines between groups:
  1. React imports
  2. External library imports (alphabetically)
  3. Internal/project imports (alphabetically)
  4. Style imports

```tsx
// ✅ Correct
import { useState, useEffect } from 'react';

import { clsx } from 'clsx';
import { motion } from 'framer-motion';

import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/date';

import './styles.css';

// ❌ Incorrect - mixed order
import { Button } from '@/components/Button';
import { useState } from 'react';
import { clsx } from 'clsx';
import './styles.css';
import { useAuth } from '@/hooks/useAuth';
```

### Console Logging
- **No `console.log` statements** are allowed in the codebase
- Use `console.warn` for warnings
- Use `console.error` for errors
- For debugging during development, remove `console.log` statements before committing

```tsx
// ✅ Correct
console.error('Failed to fetch data:', error);
console.warn('Deprecated API usage detected');

// ❌ Incorrect
console.log('Debug info:', data);
console.log('Component rendered');
```

## Enforcement

Most of these guidelines are automatically enforced via ESLint:

- **Component size limits**: `max-lines` (500 line hard limit) and `max-lines-per-function` (200 line warning)
- **No default exports**: `import/no-default-export` (enforced in `src/components/**`)
- **Interface over type**: `@typescript-eslint/consistent-type-definitions`
- **Props destructuring**: `react/destructuring-assignment`
- **Import ordering**: `import/order` with automatic grouping
- **No console.log**: `no-console` (allows `console.warn` and `console.error` only)

Run `pnpm lint` to check for violations or `pnpm lint:fix` to automatically fix many issues.

## Summary

These guidelines ensure consistency, maintainability, and better developer experience across the codebase. Following these patterns makes it easier to:
- Navigate and understand component files
- Refactor and maintain code
- Avoid naming conflicts
- Enable better tree-shaking and imports