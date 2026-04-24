"use client";

import { useState } from "react";
import FeedLeftSidebar from "./FeedLeftSidebar";
import FeedRightSidebar from "./FeedRightSidebar";
import ChatPopup from "./ChatPopup";

type Sub = { id: string; name: string; initials: string; color: string; image?: string | null };
type CommunityPost = {
  id: string; title: string; content: string; isPremium: boolean; createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

interface Props {
  subs: Sub[];
  communityPosts: CommunityPost[];
  isLoggedIn: boolean;
  children: React.ReactNode;
}

export default function SidebarShell({ subs, communityPosts, isLoggedIn, children }: Props) {
  const [chatOpen, setChatOpen]         = useState(false);
  const [chatClosing, setChatClosing]   = useState(false);
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [showRight, setShowRight]       = useState(false);

  const leftW = leftExpanded ? 130 : 52;

  function closeChat() {
    setChatClosing(true);
    setTimeout(() => { setChatOpen(false); setChatClosing(false); }, 180);
  }

  return (
    <>
      {/*
        Один контейнер — children рендерится ОДИН РАЗ.
        На мобайле: block (1 колонка), сайдбары спрятаны через max-lg:hidden.
        На десктопе: grid (3 колонки), сайдбары видны.
      */}
      <div
        className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-6 py-6 lg:grid"
        style={{
          gridTemplateColumns: `${leftW}px 1fr ${showRight ? "270px" : "36px"}`,
          gap: "1.5rem",
          transition: "grid-template-columns 0.3s ease",
        }}
      >
        {/* Левый сайдбар — только десктоп */}
        <div className="max-lg:hidden">
          <FeedLeftSidebar
            subs={subs}
            chatOpen={chatOpen}
            onChatToggle={() => setChatOpen((v) => !v)}
            onExpandedChange={setLeftExpanded}
          />
        </div>

        {/* Центр — всегда виден */}
        <div>{children}</div>

        {/* Правый сайдбар — только десктоп */}
        <div className="max-lg:hidden">
          <FeedRightSidebar
            communityPosts={communityPosts}
            isLoggedIn={isLoggedIn}
            visible={showRight}
            onToggle={() => setShowRight((v) => !v)}
          />
        </div>
      </div>

      {(chatOpen || chatClosing) && (
        <ChatPopup onClose={closeChat} isClosing={chatClosing} />
      )}
    </>
  );
}
