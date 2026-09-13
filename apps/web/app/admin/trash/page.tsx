import { notFound } from 'next/navigation';

// Trash is intentionally unavailable until the spec 15 API is implemented.
// Keeping the route as a 404 prevents the admin UI from advertising a broken API.
export default function TrashPage(): never {
  notFound();
}
