const TITLES: Record<string, string> = {
  sites: 'Sites',
  pages: 'Pages',
  content: 'Content',
  objects: 'Objects',
  'style-book': 'Style Book',
  users: 'Users',
  settings: 'Settings',
};

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = TITLES[section] ?? section;
  return (
    <>
      <h1>{title}</h1>
      <p>This section is not available yet.</p>
    </>
  );
}
