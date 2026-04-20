import { Router } from "express";
import { SAMPLE_POSTS } from "../data/mockPosts";
import { scoreAll } from "../services/intentScorer";

const router = Router();

router.get("/", (_req, res) => {
  const scored = scoreAll(SAMPLE_POSTS);
  res.json({ leads: scored, total: scored.length, updatedAt: new Date().toISOString() });
});

router.get("/:id", (req, res) => {
  const post = SAMPLE_POSTS.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const { scorePost } = require("../services/intentScorer");
  res.json(scorePost(post));
});

export default router;
