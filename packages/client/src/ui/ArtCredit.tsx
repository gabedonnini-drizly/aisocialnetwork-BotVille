// The LimeZu licences (Modern Interiors, Modern UI) REQUIRE attribution.
// This line is a licence condition, not decoration: do not remove during a redesign.
export function ArtCredit() {
  return (
    <a
      href="https://limezu.itch.io/"
      target="_blank"
      rel="noreferrer"
      style={{
        position: 'fixed', right: 8, bottom: 4, zIndex: 300,
        fontSize: 10, opacity: 0.7, color: 'inherit', textDecoration: 'none',
      }}
    >
      Art: LimeZu
    </a>
  );
}
