// Pure helper turning a flat page list into a hierarchy keyed by path:
// "/" is the parent of "/about", "/about" the parent of "/about/team".
// Intermediate paths without a real page get synthetic nodes so the tree
// never has orphans. No React in here.

import type { Page } from './types';

export interface HierarchyNode {
  path: string;
  // null marks a synthetic node: the path exists only as a prefix of others.
  page: Page | null;
  children: HierarchyNode[];
}

function parentPath(path: string): string | null {
  if (path === '/') {
    return null;
  }
  const cut = path.lastIndexOf('/');
  return cut <= 0 ? '/' : path.slice(0, cut);
}

// Last path segment, used as the display name of synthetic nodes.
export function pathSegment(path: string): string {
  if (path === '/') {
    return '/';
  }
  return path.slice(path.lastIndexOf('/') + 1);
}

export function buildHierarchy(pages: Page[]): HierarchyNode[] {
  if (pages.length === 0) {
    return [];
  }
  const byPath = new Map<string, HierarchyNode>();

  function ensure(path: string): HierarchyNode {
    const existing = byPath.get(path);
    if (existing) {
      return existing;
    }
    const node: HierarchyNode = { path, page: null, children: [] };
    byPath.set(path, node);
    const parent = parentPath(path);
    if (parent !== null) {
      ensure(parent).children.push(node);
    }
    return node;
  }

  for (const page of pages) {
    // Guard against malformed paths; the API enforces the pattern anyway.
    const path = page.path.startsWith('/') ? page.path : `/${page.path}`;
    ensure(path).page = page;
  }

  for (const node of byPath.values()) {
    node.children.sort((a, b) => a.path.localeCompare(b.path));
  }

  const root = byPath.get('/');
  return root ? [root] : [];
}
