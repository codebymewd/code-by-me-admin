// CBM notification bridge.
// The Worker URL is public by design.
// It never contains a Resend API key or Firebase service-account credential.

import { WORKER_URL } from "./notification-config.js";

export async function notifyCBM(events) {
  if (!WORKER_URL || WORKER_URL.includes("PASTE_YOUR")) {
    console.error("CBM notification: WORKER_URL is missing or not configured.");
    return false;
  }

  const list = Array.isArray(events) ? events : [events];

  try {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(
      `${WORKER_URL.replace(/\/$/, "")}/notify`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          events: list
        }),
        signal: controller.signal,
        keepalive: true
      }
    );

    clearTimeout(timer);

    const responseText = await response.text();

    console.log("CBM notification Worker response:", {
      status: response.status,
      ok: response.ok,
      body: responseText
    });

    if (!response.ok) {
      console.error(
        "CBM notification Worker returned an error:",
        response.status,
        responseText
      );

      return false;
    }

    return true;

  } catch (err) {
    console.error("CBM notification bridge failed:", err);
    return false;
  }
}