import type { SyntaxNode } from '../types.ts';

interface PronouncedTerminal {
  surface: string;
  traversalIndex: number;
  surfaceIndex?: number;
}

const resolveSurfaceIndex = (node: SyntaxNode): number | undefined => {
  if (Number.isInteger(node.tokenIndex) && Number(node.tokenIndex) >= 0) {
    return Number(node.tokenIndex);
  }
  const spanStart = Array.isArray(node.surfaceSpan) ? node.surfaceSpan[0] : undefined;
  return Number.isInteger(spanStart) && Number(spanStart) >= 0
    ? Number(spanStart)
    : undefined;
};

export const collectPronouncedTerminalSequence = (
  root?: SyntaxNode | null
): string[] => {
  const terminals: PronouncedTerminal[] = [];

  const visit = (node?: SyntaxNode | null) => {
    if (!node || typeof node !== 'object') return;
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    if (node.silent === true) return;
    const surface = String(node.word || '').trim();
    if (!surface) return;
    terminals.push({
      surface,
      traversalIndex: terminals.length,
      surfaceIndex: resolveSurfaceIndex(node)
    });
  };

  visit(root);
  const hasCompleteSurfaceOrder = terminals.every(
    (terminal) => terminal.surfaceIndex !== undefined
  );
  const ordered = hasCompleteSurfaceOrder
    ? [...terminals].sort((left, right) => (
        Number(left.surfaceIndex) - Number(right.surfaceIndex)
        || left.traversalIndex - right.traversalIndex
      ))
    : terminals;
  return ordered.map((terminal) => terminal.surface);
};
