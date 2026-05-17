import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./db";
import { authenticate, AuthRequest, JWT_SECRET } from "./utils/auth";
import expensesRouter from "./routes/expenses";
import assignmentsRouter from "./routes/assignments";
import budgetRouter from "./routes/budget";
import feedRouter from "./routes/feed";
import studyRouter from "./routes/study";

const router = Router();

router.use("/expenses", expensesRouter);
router.use("/assignments", assignmentsRouter);
router.use("/budget", budgetRouter);
router.use("/feed", feedRouter);
router.use("/study", studyRouter);


// ==== AUTH ROUTES ====

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  university: z.string().min(1),
  monthly_allowance: z.number().positive(),
});

router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);
    
    const existingUser = await prisma.users.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(400).json({ error: "Email already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    const user = await prisma.users.create({
      data: {
        name: data.name,
        email: data.email,
        university: data.university,
        monthly_allowance: data.monthly_allowance,
        password_hash,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, dorm_group_id: user.dorm_group_id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.users.findUnique({ where: { email: data.email } });
    if (!user) {
       res.status(401).json({ error: "Invalid credentials" });
       return;
    }

    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, dorm_group_id: user.dorm_group_id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({ error: error.issues });
    } else {
       console.error(error);
       res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.post("/auth/logout", authenticate, (req: AuthRequest, res: Response): void => {
  // Client handles token deletion, here we just return success
  res.json({ success: true });
});

router.patch("/auth/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      monthly_allowance: z.number().positive().optional(),
    });
    
    const data = updateSchema.parse(req.body);
    
    const user = await prisma.users.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, name: true, monthly_allowance: true }
    });
    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      const passwordSchema = z.object({
         currentPassword: z.string().min(1),
         newPassword: z.string().min(6),
      });
      const data = passwordSchema.parse(req.body);
      const user = await prisma.users.findUnique({ where: { id: req.user!.id } });
      if (!user) {
         res.status(404).json({ error: "User not found" });
         return;
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.password_hash);
      if (!isValid) {
         res.status(400).json({ error: "Invalid password" });
         return;
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(data.newPassword, salt);
      await prisma.users.update({
         where: { id: user.id },
         data: { password_hash }
      });
      res.json({ message: "Password updated successfully" });
   } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
   }
});

router.post("/groups/leave", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      await prisma.users.update({
         where: { id: req.user!.id },
         data: { dorm_group_id: null }
      });
      res.json({ message: "Left group successfully" });
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        monthly_allowance: true,
        dorm_group_id: true,
        dorm_group: { select: { id: true, name: true, invite_code: true } }
      }
    });
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==== DORM GROUP ROUTES ====

// Generate 6 character alphanumeric invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const createGroupSchema = z.object({
  name: z.string().min(1),
  university: z.string().min(1),
});

router.post("/groups/create", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createGroupSchema.parse(req.body);
    const userId = req.user!.id;

    // Make sure user doesn't already have a dorm group
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (user?.dorm_group_id) {
       res.status(400).json({ error: "User already belongs to a dorm group" });
       return;
    }

    let inviteCode = generateInviteCode();
    // Ensure unique invite code
    while (await prisma.dorm_groups.findUnique({ where: { invite_code: inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    // Use transaction to create group and update user
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.dorm_groups.create({
        data: {
          name: data.name,
          university: data.university,
          invite_code: inviteCode,
          created_by: userId,
        }
      });
      await tx.users.update({
        where: { id: userId },
        data: { dorm_group_id: newGroup.id }
      });
      return newGroup;
    });

    res.status(201).json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const joinGroupSchema = z.object({
  invite_code: z.string().length(6),
});

router.get("/groups/:id/members", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const members = await prisma.users.findMany({
      where: { dorm_group_id: groupId },
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    res.json({ members });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/groups/join", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = joinGroupSchema.parse(req.body);
    const userId = req.user!.id;
    
    // Check if user already in group
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (user?.dorm_group_id) {
      res.status(400).json({ error: "User already belongs to a dorm group" });
      return;
    }

    const group = await prisma.dorm_groups.findUnique({
      where: { invite_code: data.invite_code.toUpperCase() }
    });

    if (!group) {
      res.status(404).json({ error: "Invalid invite code" });
      return;
    }

    await prisma.users.update({
      where: { id: userId },
      data: { dorm_group_id: group.id }
    });

    res.json({ message: "Joined successfully", group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
