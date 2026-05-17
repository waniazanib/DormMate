import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../utils/auth";

const router = Router();

// GET /api/feed/:university → fetch all active posts
router.get("/:university", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
     const university = req.params.university;
     const now = new Date();
     const posts = await prisma.activity_posts.findMany({
        where: {
          university,
          expires_at: { gt: now }
        },
        include: {
          user: {
            select: { name: true, id: true }
          },
          joins: true
        },
        orderBy: {
          created_at: "desc"
        }
     });

     res.json({ posts });
  } catch (error) {
     console.error(error);
     res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/feed/active/:university → same as GET but filter active only
router.get("/active/:university", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   // Already handles it in the previous route, but for explicit requirement:
   try {
     const university = req.params.university;
     const now = new Date();
     const posts = await prisma.activity_posts.findMany({
        where: {
          university,
          expires_at: { gt: now }
        },
        include: {
           user: { select: { name: true, id: true } },
           joins: true
        },
        orderBy: { created_at: "desc" }
     });
     res.json({ posts });
  } catch (error) {
     console.error(error);
     res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/feed/post → create entry
const createPostSchema = z.object({
  university: z.string().min(1),
  content: z.string().max(140),
  category: z.enum(["Study", "Food", "Sports", "Chill", "Other"]),
  durationMinutes: z.number().int().positive()
});

router.post("/post", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
     const data = createPostSchema.parse(req.body);
     
     const now = new Date();
     const expiresAt = new Date(now.getTime() + data.durationMinutes * 60000);

     const newPost = await prisma.activity_posts.create({
        data: {
          user_id: req.user!.id,
          university: data.university,
          content: data.content,
          category: data.category,
          expires_at: expiresAt,
          created_at: now
        },
        include: {
           user: { select: { name: true, id: true } },
           joins: true
        }
     });

     res.status(201).json({ post: newPost });
   } catch (error) {
     if (error instanceof z.ZodError) {
       res.status(400).json({ error: error.issues });
     } else {
       console.error(error);
       res.status(500).json({ error: "Internal server error" });
     }
   }
});

// POST /api/feed/join/:postId → join an activity
router.post("/join/:postId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      const postId = req.params.postId;
      const userId = req.user!.id;

      // Check if already joined
      const existing = await prisma.activity_joins.findFirst({
         where: { post_id: postId, user_id: userId }
      });

      if (existing) {
         res.status(400).json({ error: "Already joined" });
         return;
      }

      await prisma.activity_joins.create({
         data: {
           post_id: postId,
           user_id: userId
         }
      });

      const count = await prisma.activity_joins.count({
         where: { post_id: postId }
      });

      res.json({ message: "Joined successfully", count });
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

// DELETE /api/feed/:postId → delete own post
router.delete("/:postId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      const postId = req.params.postId;
      const post = await prisma.activity_posts.findUnique({ where: { id: postId } });

      if (!post) {
         res.status(404).json({ error: "Not found" });
         return;
      }

      if (post.user_id !== req.user!.id) {
         res.status(403).json({ error: "Unauthorized" });
         return;
      }

      // Delete joins
      await prisma.activity_joins.deleteMany({ where: { post_id: postId } });
      
      // Delete post
      await prisma.activity_posts.delete({ where: { id: postId } });

      // get io and emit expired
      const io = req.app.get("io");
      if (io) {
         io.to(post.university).emit("activity_expired", postId);
      }

      res.json({ message: "Deleted successfully" });
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

export default router;
