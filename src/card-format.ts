export type TagKind = 'status' | 'type' | 'domain' | 'other';

/** Mirror of the marioverse tag namespaces so chips can be styled by kind. */
export function classifyTag(tag: string): TagKind {
  if (tag.startsWith('status/')) return 'status';
  if (tag.startsWith('type/')) return 'type';
  if (tag.startsWith('domain/')) return 'domain';
  return 'other';
}

export function formatRelativeDate(timestamp: number, now: number): string {
  const delta = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (delta < minute) return 'just now';
  if (delta < hour) return `${Math.floor(delta / minute)} min ago`;
  if (delta < day) return `${Math.floor(delta / hour)} hr ago`;
  if (delta < day * 7) return `${Math.floor(delta / day)} days ago`;

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}

/** Parent folder of a vault path ('' for a root-level file). */
export function folderOf(filePath: string | null): string {
  if (!filePath) return '';
  const slash = filePath.lastIndexOf('/');
  return slash > 0 ? filePath.slice(0, slash) : '';
}
