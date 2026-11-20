type PublicCardPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Permanent public profile route.
 * The database lookup and published-only visibility rules will be added
 * when the Prisma schema and public profile service are implemented.
 */
export default async function PublicCardPage({
  params,
}: PublicCardPageProps) {
  const { slug } = await params;

  return (
    <main
      style={{
        display: "grid",
        minHeight: "100svh",
        placeItems: "center",
        padding: 24,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h1>Digital business card</h1>
        <p>
          The public profile <strong>/{slug}</strong> will be available once
          profile publishing is implemented.
        </p>
      </div>
    </main>
  );
}
