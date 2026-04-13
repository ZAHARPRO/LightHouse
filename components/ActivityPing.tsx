"use client";

import { useEffect } from "react";
import { pingStaffPresence } from "@/actions/support";

/**
 * Drop this into any page a staff/admin member visits.
 * It pings their presence + sets the current activity label every 2 minutes.
 * On unmount it clears the activity (but keeps lastActiveAt).
 */
export default function ActivityPing({ activity }: { activity: string }) {
  useEffect(() => {
    pingStaffPresence(activity);
    const interval = setInterval(() => pingStaffPresence(activity), 2 * 60 * 1000);
    return () => {
      clearInterval(interval);
      pingStaffPresence(""); // clear activity when navigating away
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
