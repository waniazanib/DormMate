import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import cron from "node-cron";
import { prisma } from "./db";

export function setupFeedSocketAndCron(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
       origin: "*",
    }
  });

  io.on("connection", (socket) => {
     console.log("Client connected:", socket.id);

     socket.on("join_university", (university: string) => {
        socket.join(university);
        console.log(`Socket ${socket.id} joined room: ${university}`);
     });

     // Client emits new_activity_post with university and post object
     socket.on("new_activity_post", (data: { university: string, post: any }) => {
        io.to(data.university).emit("feed_updated", data.post);
     });

     // Client emits join_activity
     socket.on("join_activity", (data: { university: string, postId: string, count: number }) => {
        io.to(data.university).emit("join_count_updated", { postId: data.postId, count: data.count });
     });

     socket.on("join_user", (userId: string) => {
        socket.join(`user_${userId}`);
     });

     socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
     });
  });

  // Cron job: run every minute
  // Finds posts where expires_at < now, deletes them, and emits event
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      
      // Find expired
      const expiredPosts = await prisma.activity_posts.findMany({
        where: {
          expires_at: { lt: now }
        }
      });

      if (expiredPosts.length === 0) return;

      // Group by university so we can emit to the right rooms
      const byUniversity: Record<string, string[]> = {};
      expiredPosts.forEach(p => {
         if (!byUniversity[p.university]) {
            byUniversity[p.university] = [];
         }
         byUniversity[p.university].push(p.id);
      });

      // Delete joins first
      const expiredIds = expiredPosts.map(p => p.id);
      await prisma.activity_joins.deleteMany({
        where: {
          post_id: { in: expiredIds }
        }
      });

      // Delete posts
      await prisma.activity_posts.deleteMany({
         where: {
           id: { in: expiredIds }
         }
      });

      // Emit events to room
      for (const [uni, ids] of Object.entries(byUniversity)) {
        for (const id of ids) {
          io.to(uni).emit("activity_expired", id);
        }
      }
      
      console.log(`Deleted ${expiredPosts.length} expired posts.`);
    } catch (error) {
       console.error("Cron Error:", error);
    }
  });

  return io;
}
