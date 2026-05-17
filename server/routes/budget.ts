import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../utils/auth";
import { endOfMonth, startOfMonth, getDate, getDaysInMonth, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";

const router = Router();

// Helper to calculate total spent in a period (including shared expenses)
async function calculateSpendForPeriod(userId: string, startDate: Date, endDate: Date) {
  const personalExpenses = await prisma.personal_expenses.findMany({
    where: {
      user_id: userId,
      date: { gte: startDate, lte: endDate }
    }
  });

  const totalPersonalSpent = personalExpenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

  // Group expenses paid by me
  const groupExpensesPaidByMe = await prisma.expenses.findMany({
    where: {
      paid_by: userId,
      created_at: { gte: startDate, lte: endDate }
    }
  });

  const totalGroupSpent = groupExpensesPaidByMe.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

  // Splits paid TO ME (recovers my budget)
  const splitsPaidToMe = await prisma.expense_splits.findMany({
    where: {
      expense: { paid_by: userId },
      user_id: { not: userId },
      is_settled: true,
      settled_at: { gte: startDate, lte: endDate }
    }
  });

  const totalRecovered = splitsPaidToMe.reduce((sum, s) => sum + parseFloat(s.amount_owed.toString()), 0);

  // Splits I paid TO OTHERS (reduces my budget)
  const splitsPaidByMe = await prisma.expense_splits.findMany({
    where: {
      user_id: userId,
      expense: { paid_by: { not: userId } },
      is_settled: true,
      settled_at: { gte: startDate, lte: endDate }
    }
  });

  const totalPaidToOthers = splitsPaidByMe.reduce((sum, s) => sum + parseFloat(s.amount_owed.toString()), 0);
  const sharedTotal = totalGroupSpent + totalPaidToOthers - totalRecovered;

  return {
    totalPersonalSpent,
    sharedTotal,
    totalSpent: totalPersonalSpent + sharedTotal,
    personalExpenses
  };
}

// Helper to calculate forecast
async function calculateForecast(userId: string, targetDate: Date = new Date()) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { monthly_allowance: true }
  });

  if (!user) throw new Error("User not found");

  const allowance = parseFloat(user.monthly_allowance.toString());

  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  
  const { totalSpent } = await calculateSpendForPeriod(userId, monthStart, monthEnd);

  const daysElapsed = getDate(targetDate);
  const totalDaysInMonth = getDaysInMonth(targetDate);
  const remainingDays = totalDaysInMonth - daysElapsed;
  const remainingBalance = allowance - totalSpent;
  
  let result = {
    monthly_allowance: allowance,
    total_spent: totalSpent,
    remaining_balance: remainingBalance,
    percentage_used: allowance > 0 ? (totalSpent / allowance) * 100 : 0,
    forecast: {
      days_until_broke: 0,
      projected_runout_date: null as string | null
    },
    warning: false,
    daily_spend_rate: 0,
    remaining_days: remainingDays,
    not_enough_data: false
  };

  if (daysElapsed === 0 || daysElapsed === 1 && totalSpent === 0) {
    result.not_enough_data = true;
    return result;
  }

  const dailySpendRate = totalSpent / daysElapsed;
  result.daily_spend_rate = dailySpendRate;

  if (dailySpendRate > 0) {
     const daysUntilBroke = remainingBalance / dailySpendRate;
     result.forecast.days_until_broke = daysUntilBroke;
     
     if (daysUntilBroke < remainingDays) {
       const runout = new Date(targetDate);
       runout.setDate(runout.getDate() + Math.floor(daysUntilBroke));
       result.forecast.projected_runout_date = runout.toISOString();
     } else {
       result.forecast.projected_runout_date = null; // won't run out this month
     }

     if (daysUntilBroke < (remainingDays - 10)) {
       result.warning = true;
     }
  } else {
    // If daily spend limit is 0, we are good
    result.forecast.days_until_broke = 999;
  }

  return result;
}

// GET /api/budget/:userId -> current budget status
router.get("/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    if (userId !== req.user!.id) {
       res.status(403).json({ error: "Unauthorized" });
       return;
    }

    const forecast = await calculateForecast(userId);
    res.json(forecast);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const addExpenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(["Food", "Transport", "Entertainment", "Supplies", "Other"]),
  date: z.string().datetime()
});

// POST /api/budget/expense/add -> log a personal expense
router.post("/expense/add", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = addExpenseSchema.parse(req.body);
    const newExpense = await prisma.personal_expenses.create({
      data: {
        user_id: req.user!.id,
        title: data.title,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date)
      }
    });
    res.status(201).json({ expense: newExpense });
  } catch (error) {
     if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/budget/forecast/:userId -> spending forecast
router.get("/forecast/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
    const userId = req.params.userId;
    if (userId !== req.user!.id) {
       res.status(403).json({ error: "Unauthorized" });
       return;
    }
    const forecast = await calculateForecast(userId);
    res.json(forecast);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/budget/can-i-afford/:userId?amount=X
router.get("/can-i-afford/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    const amountStr = req.query.amount as string;
    
    if (userId !== req.user!.id) {
       res.status(403).json({ error: "Unauthorized" });
       return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const current = await calculateForecast(userId);
    
    // logic:
    // if (remaining_balance - requested_amount) / remaining_days < (daily_spend_rate * 0.8):
    // return { canAfford: false, message: "Risky — this will strain your remaining budget" }
    
    if (current.not_enough_data) {
       res.json({ canAfford: true, message: "Not enough data yet to tell, but proceed with caution." });
       return;
    }

    const { remaining_balance, remaining_days, daily_spend_rate } = current;
    
    if (remaining_balance < amount) {
       res.json({ canAfford: false, message: "Risky — this will strain your remaining budget" });
       return;
    }

    const checkValue = (remaining_balance - amount) / (remaining_days === 0 ? 1 : remaining_days);
    if (checkValue < (daily_spend_rate * 0.8)) {
       res.json({ canAfford: false, message: "Risky — this will strain your remaining budget" });
    } else {
       res.json({ canAfford: true, message: "You can afford this" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/budget/breakdown/:userId -> spending by category
router.get("/breakdown/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    if (userId !== req.user!.id) {
       res.status(403).json({ error: "Unauthorized" });
       return;
    }
    
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const { personalExpenses, sharedTotal } = await calculateSpendForPeriod(userId, monthStart, monthEnd);

    const categories = ["Food", "Transport", "Entertainment", "Supplies", "Other"];
    const breakdown = categories.map(cat => {
      const total = personalExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      return { category: cat, total };
    }).filter(b => b.total > 0);

    if (sharedTotal > 0) {
      breakdown.push({ category: "Shared Expenses", total: sharedTotal });
    } else if (sharedTotal < 0) {
      // If they somehow recovered more than spent this month, we just leave it out to keep pie chart happy
      // Or we can subtract from "Other"? Typically we just don't graph negative values.
    }

    // Also let's send weekly stuff for the "this week vs last week" chart
    const now = new Date();
    const currWeekStart = startOfWeek(now);
    const currWeekEnd = endOfWeek(now);
    const lastWeekStart = startOfWeek(subWeeks(now, 1));
    const lastWeekEnd = endOfWeek(subWeeks(now, 1));

    const { totalSpent: currWeekTotal } = await calculateSpendForPeriod(userId, currWeekStart, currWeekEnd);
    const { totalSpent: lastWeekTotal } = await calculateSpendForPeriod(userId, lastWeekStart, lastWeekEnd);

    res.json({
      breakdown,
      weeklyComparison: [
        { name: "Last Week", spent: lastWeekTotal },
        { name: "This Week", spent: currWeekTotal }
      ]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/budget/expenses/:userId -> list of past expenses (bonus, needed for log)
router.get("/expenses/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
    const userId = req.params.userId;
    if (userId !== req.user!.id) {
       res.status(403).json({ error: "Unauthorized" });
       return;
    }
    const expenses = await prisma.personal_expenses.findMany({
      where: { user_id: userId },
      orderBy: { date: "desc" }
    });
    res.json({ expenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
