import { Router } from "express";
import { scorePost } from "../services/intentScorer";
import type { XPost } from "../data/mockPosts";

const router = Router();

router.post("/", async (req, res) => {
  const post = req.body as XPost;
  if (!post?.text) {
    res.status(400).json({ error: "post.text is required" });
    return;
  }
  res.json(await scorePost(post));
});

export default router;
