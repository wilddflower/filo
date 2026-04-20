import { Router } from "express";
import { scorePost } from "../services/intentScorer";
import type { XPost } from "../data/mockPosts";

const router = Router();

// Score an arbitrary post body (for future X API integration)
router.post("/", (req, res) => {
  const post = req.body as XPost;
  if (!post?.text) {
    res.status(400).json({ error: "post.text is required" });
    return;
  }
  res.json(scorePost(post));
});

export default router;
