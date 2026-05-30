import StreamChatOverlay from "@/components/StreamChatOverlay";

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StreamChatOverlay streamId={id} />;
}
