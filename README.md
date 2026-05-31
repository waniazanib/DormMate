# DormMate

A comprehensive dorm management platform that helps roommates organize their finances, schedules, and academic life with real-time collaboration features.

## Overview

DormMate is a full-stack web application designed for university students living in dormitories. It provides a centralized hub for managing shared expenses, tracking assignments with stress metrics, coordinating study sessions, budgeting personal allowances, and maintaining group feeds. Built with modern web technologies and real-time Socket.IO communication, DormMate streamlines dormitory life coordination.

## Features

- **Expense Splitting**: Track and split shared expenses among dorm members with automatic balance calculations
- **Assignment Tracking**: Manage coursework with due dates, estimated hours, stress scoring by subject
- **Study Matcher**: Find study partners by subject and availability with booking system
- **Budget Tracking**: Monitor personal allowance spending by category with visual breakdown
- **Real-time Feed**: Live updates on group activities via Socket.IO integration
- **Dorm Groups**: Create or join dorm groups with unique invite codes
- **User Authentication**: Secure JWT-based authentication with password hashing
- **Responsive Design**: Mobile-first interface with desktop optimization
- **Interactive Features**: Animated UI with interactive dorm pet companion

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS 4 for styling
- React Router v7 for navigation
- Socket.IO Client for real-time updates
- Recharts for data visualization
- Motion/Framer Motion for animations

**Backend:**
- Express.js for API server
- TypeScript for type safety
- Prisma ORM for database management
- JWT for authentication
- Socket.IO for real-time communication
- node-cron for scheduled tasks
- Google GenAI integration

**Database:**
- Prisma with relational database support

## Installation

### Prerequisites

- Node.js 18+ and npm
- A SQL database (PostgreSQL, MySQL, etc.)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/waniazanib/DormMate.git
   cd DormMate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see Environment Variables section)

4. Initialize the database:
   ```bash
   npx prisma migrate dev
   ```

5. Seed sample data (optional):
   ```bash
   npx tsx seed-expenses.ts
   ```

## Usage

### Development

Start the development server with hot reload:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Folder Structure

```
DormMate/
├── src/                          # Frontend source code
│   ├── pages/                    # React page components
│   │   ├── Auth.tsx             # Authentication page
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── Expenses.tsx         # Expense management
│   │   ├── Assignments.tsx      # Assignment tracking
│   │   ├── Budget.tsx           # Budget tracking
│   │   ├── Study.tsx            # Study partner matching
│   │   ├── Feed.tsx             # Group activity feed
│   │   ├── Settings.tsx         # User settings
│   │   └── JoinGroup.tsx        # Join dorm group
│   ├── components/              # Reusable React components
│   ├── context/                 # React context for state management
│   ├── lib/                     # Utility functions and API client
│   └── App.tsx                  # Main app component
├── server/                       # Backend source code
│   ├── routes.ts                # API routes and handlers
│   └── feed.ts                  # Socket.IO and cron setup
├── prisma/                       # Database schema and migrations
├── index.html                    # HTML entry point
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Project dependencies
```

## Future Improvements

- Push notifications for assignment deadlines and expense updates
- Integration with university calendar systems
- AI-powered study recommendations using GenAI
- Photo/file sharing in group feed
- Expense categorization with recurring bills
- Study session recordings and notes sharing
- Integration with payment apps for easy splitting
- Dark mode theme support
- Mobile app using React Native
- Analytics dashboard for spending patterns
- Room maintenance task coordination
- Grocery shopping list management
- Event planning and coordination tools

## License

This project is open source and available for educational purposes.

## Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests for bug fixes or new features.

---

**Author**: [waniazanib](https://github.com/waniazanib)
