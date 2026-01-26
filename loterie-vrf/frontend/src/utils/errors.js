export function isRateLimitErr(e) {
  const msg = String(e?.shortMessage || e?.reason || e?.message || "").toLowerCase();
  const code = e?.code;
  const status = e?.info?.error?.code || e?.status || e?.info?.status;

  return (
    code === -32005 ||
    status === 429 ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("missing response for request") ||
    msg.includes("could not coalesce")
  );
}

export function errMsg(e, fallback = "A eșuat") {
  return e?.shortMessage || e?.reason || e?.message || fallback;
}
