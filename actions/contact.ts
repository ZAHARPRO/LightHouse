"use server";

import { prisma } from "@/lib/prisma";

export async function sendContactMessage(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !subject || !message) {
    return { error: "All fields are required" };
  }

  if (message.length < 10) {
    return { error: "Message too short" };
  }

  await prisma.contactMessage.create({
    data: { name, email, subject, message },
  });

  return { success: true };
}
