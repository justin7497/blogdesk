export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { produceSocialQueue } = await import("./lib/instagram-produce");
  const { syncAndTickComments } = await import("./lib/social-inbox");
  const { publishDueSocialPosts } = await import("./lib/social-publish");
  const produce = () => {
    void produceSocialQueue().catch((error) => {
      console.error("[social-produce]", error);
    });
  };
  const comments = () => {
    void syncAndTickComments().catch((error) => {
      console.error("[social-comments]", error);
    });
    void publishDueSocialPosts().catch((error) => {
      console.error("[social-publish]", error);
    });
  };
  produce();
  comments();
  setInterval(produce, 3 * 60 * 60 * 1000);
  setInterval(comments, 5 * 60 * 1000);
}
