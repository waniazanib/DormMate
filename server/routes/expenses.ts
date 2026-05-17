import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../utils/auth";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /api/expenses/group/:groupId
router.get("/group/:groupId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId;
    const expenses = await prisma.expenses.findMany({
      where: { dorm_group_id: groupId },
      include: {
        payer: { select: { id: true, name: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { created_at: "desc" }
    });
    res.json({ expenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const addExpenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  paid_by: z.string().uuid(),
  split_between: z.array(z.string().uuid()).min(1),
  is_recurring: z.boolean().optional().default(false),
  recurrence_interval: z.string().nullable().optional()
});

// POST /api/expenses/add
router.post("/add", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = addExpenseSchema.parse(req.body);
    
    // Make sure user adding has a dorm group
    const user = await prisma.users.findUnique({ where: { id: req.user!.id } });
    if (!user?.dorm_group_id) {
      res.status(400).json({ error: "User is not in a dorm group" });
      return;
    }

    const splitAmount = data.amount / data.split_between.length;

    // Use transaction to create expense and splits
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expenses.create({
        data: {
          dorm_group_id: user.dorm_group_id!,
          title: data.title,
          amount: data.amount,
          paid_by: data.paid_by,
          is_recurring: data.is_recurring,
          recurrence_interval: data.recurrence_interval
        }
      });

      // Create splits
      const splitPromises = data.split_between.map(userId => {
        return tx.expense_splits.create({
          data: {
            expense_id: newExpense.id,
            user_id: userId,
            amount_owed: splitAmount,
            // Automatically settle if the person who paid is also in the split
            is_settled: userId === data.paid_by,
            settled_at: userId === data.paid_by ? new Date() : null
          }
        });
      });

      await Promise.all(splitPromises);

      return tx.expenses.findUnique({
        where: { id: newExpense.id },
        include: { splits: true }
      });
    });

    res.status(201).json({ expense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// PATCH /api/expenses/settle/:splitId
router.patch("/settle/:splitId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const splitId = req.params.splitId;
    
    // Find the split
    const split = await prisma.expense_splits.findUnique({
      where: { id: splitId },
      include: { expense: true }
    });

    if (!split) {
      res.status(404).json({ error: "Split not found" });
      return;
    }

    // Only allow settling if user is the one who owes or the one who is owed (paid_by)
    if (split.user_id !== req.user!.id && split.expense.paid_by !== req.user!.id) {
      res.status(403).json({ error: "Unauthorized to settle this split" });
      return;
    }

    const updatedSplit = await prisma.expense_splits.update({
      where: { id: splitId },
      data: { 
        is_settled: true,
        settled_at: new Date()
      }
    });

    res.json({ split: updatedSplit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/expenses/summary/:userId
router.get("/summary/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    
    // People who owe ME: I paid the expense, they are in splits, not settled
    const owedToMe = await prisma.expense_splits.findMany({
      where: {
        expense: { paid_by: userId },
        user_id: { not: userId },
        is_settled: false
      },
      include: {
        user: { select: { id: true, name: true } },
        expense: { select: { title: true } }
      }
    });

    // People I owe: Someone else paid, I am in splits, not settled
    const iOwe = await prisma.expense_splits.findMany({
      where: {
        user_id: userId,
        expense: { paid_by: { not: userId } },
        is_settled: false
      },
      include: {
        expense: { 
          select: { 
            title: true, 
            paid_by: true,
            payer: { select: { id: true, name: true } } 
          } 
        }
      }
    });

    res.json({ owedToMe, iOwe });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expenseId = req.params.id;
    
    const expense = await prisma.expenses.findUnique({ where: { id: expenseId } });
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    if (expense.paid_by !== req.user!.id) {
       res.status(403).json({ error: "Only the payer can delete this expense" });
       return;
    }

    // Delete splits first, then expense
    await prisma.$transaction([
      prisma.expense_splits.deleteMany({ where: { expense_id: expenseId } }),
      prisma.expenses.delete({ where: { id: expenseId } })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
