import { redirect } from 'next/navigation';

// /admin no longer renders a standalone dashboard (spec 13): the welcome and
// "how Neriva fits together" content it used to show now lives as ordinary
// seeded page/block data on the default site's home page itself (see
// DEMO_PAGE_TREE in apps/api/src/db/demo-seed.service.ts). This route stays
// only so bookmarks and the auth guard keep working; it always sends the
// visitor back to the real front door.
export default function AdminHomePage(): never {
  redirect('/');
}
