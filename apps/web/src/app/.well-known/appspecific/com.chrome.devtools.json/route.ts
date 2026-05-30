/** Chrome DevTools probes this URL when open; not part of the app. */
export function GET() {
  return Response.json({}, { status: 200 });
}
