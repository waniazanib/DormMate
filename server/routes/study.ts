import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../utils/auth";
import { parse, isValid, isBefore, isAfter, areIntervalsOverlapping } from "date-fns";

const router = Router();

// Define schema for availability
const setAvailabilitySchema = z.object({
  subject: z.string().min(1),
  days: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format")
});

router.post("/availability/set", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = setAvailabilitySchema.parse(req.body);
    const userId = req.user!.id;

    // Delete existing availability for this subject and user
    await prisma.study_availability.deleteMany({
      where: {
        user_id: userId,
        subject: data.subject
      }
    });

    // Create new availability records, one per day
    const newAvails = await prisma.$transaction(
      data.days.map((day) => 
        prisma.study_availability.create({
          data: {
            user_id: userId,
            subject: data.subject,
            day_of_week: day,
            start_time: data.startTime,
            end_time: data.endTime
          }
        })
      )
    );

    res.json({ message: "Availability set successfully", availability: newAvails });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.delete("/availability/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const availability = await prisma.study_availability.findUnique({
      where: { id }
    });

    if (!availability) {
      res.status(404).json({ error: "Availability not found" });
      return;
    }

    if (availability.user_id !== req.user!.id) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    await prisma.study_availability.delete({
      where: { id }
    });

    res.json({ message: "Availability deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to check if two time ranges overlap
function checkOverlap(startA: string, endA: string, startB: string, endB: string): string | null {
  const tA_s = new Date(`1970-01-01T${startA}:00`);
  const tA_e = new Date(`1970-01-01T${endA}:00`);
  const tB_s = new Date(`1970-01-01T${startB}:00`);
  const tB_e = new Date(`1970-01-01T${endB}:00`);

  if (areIntervalsOverlapping(
    { start: tA_s, end: tA_e },
    { start: tB_s, end: tB_e }
  )) {
     const maxStart = tA_s > tB_s ? tA_s : tB_s;
     const minEnd = tA_e < tB_e ? tA_e : tB_e;
     
     // Format output nicely
     const s = maxStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
     const e = minEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
     return `${s} - ${e}`;
  }
  return null;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

router.get("/matches/:userId/:subject", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, subject } = req.params;
    
    // Ensure the caller is the user
    if (req.user!.id !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    const myAvails = await prisma.study_availability.findMany({
      where: { user_id: userId, subject }
    });

    if (myAvails.length === 0) {
      res.json({ matches: [] }); // No availability set
      return;
    }

    // Get my university
    const me = await prisma.users.findUnique({ where: { id: userId } });
    if (!me) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    // Get all others with at least one overlap
    const others = await prisma.study_availability.findMany({
      where: {
        subject,
        user_id: { not: userId },
        user: { university: me.university }
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const userMap: Record<string, any> = {};

    others.forEach((otherAvail) => {
       // Look for an overlap with my availability
       myAvails.forEach(myAvail => {
          if (myAvail.day_of_week === otherAvail.day_of_week) {
             const overlap = checkOverlap(myAvail.start_time, myAvail.end_time, otherAvail.start_time, otherAvail.end_time);
             if (overlap) {
                if (!userMap[otherAvail.user_id]) {
                   userMap[otherAvail.user_id] = {
                      id: otherAvail.user_id,
                      name: otherAvail.user.name,
                      subject,
                      score: 0,
                      overlappingSlots: []
                   };
                }
                userMap[otherAvail.user_id].score += 1;
                userMap[otherAvail.user_id].overlappingSlots.push(`${dayNames[otherAvail.day_of_week]}: ${overlap}`);
             }
          }
       });
    });

    const matches = Object.values(userMap).sort((a: any, b: any) => b.score - a.score);

    res.json({ matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const sendRequestSchema = z.object({
   receiverId: z.string().min(1),
   subject: z.string().min(1),
   proposedTime: z.string().datetime(), // ISO string
   location: z.string().min(1)
});

router.post("/request/send", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
     const data = sendRequestSchema.parse(req.body);
     const senderId = req.user!.id;

     // Check if pending request already exists
     const existing = await prisma.study_sessions.findFirst({
        where: {
           requester_id: senderId,
           receiver_id: data.receiverId,
           subject: data.subject,
           status: "pending"
        }
     });

     if (existing) {
        res.status(400).json({ error: "A pending request to this user for this subject already exists" });
        return;
     }

     const session = await prisma.study_sessions.create({
        data: {
           requester_id: senderId,
           receiver_id: data.receiverId,
           subject: data.subject,
           proposed_time: new Date(data.proposedTime),
           location: data.location,
           status: "pending"
        },
        include: {
           requester: { select: { name: true } },
           receiver: { select: { name: true } }
        }
     });

     const io = req.app.get("io");
     if (io) {
        io.to(`user_${data.receiverId}`).emit("new_study_request", session);
     }

     res.status(201).json({ session });
   } catch (error) {
     if (error instanceof z.ZodError) {
       res.status(400).json({ error: error.issues });
     } else {
       console.error(error);
       res.status(500).json({ error: "Internal server error" });
     }
   }
});

const rescheduleSchema = z.object({
  proposedTime: z.string().datetime(), // ISO string
  location: z.string().min(1)
});

router.patch("/request/:id/reschedule", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      const { id } = req.params;
      const data = rescheduleSchema.parse(req.body);

      const session = await prisma.study_sessions.findUnique({ where: { id } });
      if (!session) {
         res.status(404).json({ error: "Session not found" });
         return;
      }

      if (session.requester_id !== req.user!.id && session.receiver_id !== req.user!.id) {
         res.status(403).json({ error: "Unauthorized" });
         return;
      }

      // The person who reschedules becomes the new requester
      const isReceiver = session.receiver_id === req.user!.id;
      const newRequesterId = req.user!.id;
      const newReceiverId = isReceiver ? session.requester_id : session.receiver_id;

      const updated = await prisma.study_sessions.update({
         where: { id },
         data: {
            status: "pending",
            proposed_time: new Date(data.proposedTime),
            location: data.location,
            requester_id: newRequesterId,
            receiver_id: newReceiverId
         },
         include: {
            requester: { select: { name: true } },
            receiver: { select: { name: true } }
         }
      });

      const io = req.app.get("io");
      if (io) {
         io.to(`user_${newReceiverId}`).emit("new_study_request", updated);
      }

      res.json({ session: updated });
   } catch (error) {
     if (error instanceof z.ZodError) {
       res.status(400).json({ error: error.issues });
     } else {
       console.error(error);
       res.status(500).json({ error: "Internal server error" });
     }
   }
});

router.patch("/request/:id/respond", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      const { id } = req.params;
      const { status } = req.body; // "accepted" | "declined" | "cancelled"

      if (!["accepted", "declined", "cancelled"].includes(status)) {
         res.status(400).json({ error: "Invalid status" });
         return;
      }

      const session = await prisma.study_sessions.findUnique({ where: { id } });
      if (!session) {
         res.status(404).json({ error: "Session not found" });
         return;
      }

      // If accepting or declining, must be receiver
      if ((status === "accepted" || status === "declined") && session.receiver_id !== req.user!.id) {
         res.status(403).json({ error: "Unauthorized" });
         return;
      }

      // If cancelling, must be either sender or receiver
      if (status === "cancelled" && session.requester_id !== req.user!.id && session.receiver_id !== req.user!.id) {
         res.status(403).json({ error: "Unauthorized" });
         return;
      }

      const updated = await prisma.study_sessions.update({
         where: { id },
         data: { status }
      });

      // Emit event to the other party
      const io = req.app.get("io");
      if (io) {
         if (status === "accepted" || status === "declined") {
            io.to(`user_${session.requester_id}`).emit("study_request_responded", updated);
         } else if (status === "cancelled") {
            const otherPartyId = session.requester_id === req.user!.id ? session.receiver_id : session.requester_id;
            io.to(`user_${otherPartyId}`).emit("study_request_cancelled", updated);
         }
      }

      res.json({ session: updated });
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

router.get("/sessions/:userId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
   try {
      if (req.user!.id !== req.params.userId) {
         res.status(403).json({ error: "Unauthorized" });
         return;
      }

      const userId = req.params.userId;

      const requests = await prisma.study_sessions.findMany({
         where: {
            OR: [
               { requester_id: userId },
               { receiver_id: userId }
            ]
         },
         include: {
            requester: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } }
         },
         orderBy: { created_at: "desc" }
      });

      const availability = await prisma.study_availability.findMany({
         where: { user_id: userId }
      });

      res.json({ requests, availability });
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

export default router;
