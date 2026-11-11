export const PAGE_SIZE = 200;

interface PageResult { data: unknown[] | null; error: unknown; count: number | null }

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  parse: (row: unknown) => T,
): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error, count } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []).map(parse);
    items.push(...rows);
    if (count !== null && items.length >= count) return items;
    // Do not silently truncate if the server's response cap is below PAGE_SIZE.
    if (rows.length === 0) {
      if (count !== null && items.length < count) throw new Error('Incomplete inventory');
      return items;
    }
    if (count === null && rows.length < PAGE_SIZE) return items;
    if (rows.length < PAGE_SIZE) throw new Error('Server row limit is below page size');
  }
}
