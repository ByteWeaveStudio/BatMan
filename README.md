# BatMan - Personal Productivity & Expense Tracker

A year-scoped productivity and expense tracking web application built with vanilla JavaScript, Bootstrap 5, and Firebase.

## Features

- **Year-Scoped Data**: All data is organized by year with easy year switching
- **Goals Management**: Yearly, Quarterly, and Monthly goals with automatic archiving
- **Daily Task Tracker**: Month-based task tracking with day-by-day completion matrix
- **Analytics**: Visual charts showing completion percentages and trends
- **Expense Tracking**: Track expenses with analytics and filtering

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Email/Password Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"
4. Set up **Realtime Database**:
   - Go to Realtime Database
   - Create database (start in test mode for development)
   - Copy your database URL
5. Get your Firebase config:
   - Go to Project Settings → General
   - Scroll down to "Your apps" section
   - Click the web icon (`</>`) to add a web app
   - Copy the Firebase configuration object

### 2. Update Firebase Config

Open `firebase.js` and replace the placeholder values with your Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Run the Application

1. Serve the files using a local web server (Firebase requires HTTPS or localhost)
   - You can use Python's HTTP server: `python -m http.server 8000`
   - Or use VS Code's Live Server extension
   - Or use Firebase Hosting for production

2. Open `login.html` in your browser

3. Register a new account or login

## Usage

### Goals
- Add goals by clicking "+ Add" on any goal card
- Check off completed goals (they remain visible but faded)
- View history to see archived goals from previous periods
- Monthly goals reset automatically at month change
- Quarterly goals reset automatically at quarter change

### Tasks
- Add tasks by typing in the input at the bottom of the task table
- Check off tasks for each day of the month
- Use month selector to view different months
- Copy tasks from previous month to quickly set up a new month

### Analytics
- View daily completion percentages for the selected month
- See monthly averages across the year
- Check task-wise completion rates

### Expenses
- Add expenses with name, amount, date, place, and description
- View daily or monthly expense charts
- Filter expenses by month
- Edit or delete expenses

## Technologies Used

- HTML5
- Bootstrap 5.3.0
- Vanilla JavaScript (ES6+)
- Firebase 9.23.0 (Auth + Realtime Database)
- Chart.js 4.4.0

## License

This project is for personal use.

