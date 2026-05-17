import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.users.findFirst({
    where: { email: 'dhoomachaly@gmail.com' } // Using the user from metadata
  });
  if (!user) {
    const backupUser = await prisma.users.findFirst();
    if (!backupUser) {
      console.log('No user found to seed costs');
      return;
    }
    await seedExpenses(backupUser.id);
  } else {
    await seedExpenses(user.id);
  }
}

async function seedExpenses(userId: string) {
  const d = new Date();
  
  await prisma.personal_expenses.createMany({
    data: [
      { user_id: userId, title: 'Groceries', amount: 50.0, category: 'Food', date: new Date(d.getFullYear(), d.getMonth(), 2) },
      { user_id: userId, title: 'Uber', amount: 15.5, category: 'Transport', date: new Date(d.getFullYear(), d.getMonth(), 4) },
      { user_id: userId, title: 'Movie', amount: 20.0, category: 'Entertainment', date: new Date(d.getFullYear(), d.getMonth(), 5) },
      { user_id: userId, title: 'Textbooks', amount: 80.0, category: 'Supplies', date: new Date(d.getFullYear(), d.getMonth(), 8) },
      { user_id: userId, title: 'Coffee', amount: 5.5, category: 'Food', date: new Date() },
    ]
  });
  console.log('Test expenses added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
