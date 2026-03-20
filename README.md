# Voice-Based Billing System for Restaurants

A modern, web-based single-page application (SPA) that revolutionizes restaurant billing by allowing staff to use voice commands to process orders. Built with a Node.js/Express backend and a Vanilla JavaScript frontend, it features robust billing functionalities, performance dashboards, and enhanced security.

## Features

- **Voice-Controlled Order Management**: Use Natural Language Processing (via Web Speech API) to interact with the system.
  - Add items: e.g., "Add two burgers", "one pizza".
  - Remove items: e.g., "Remove cola", "Cancel fries".
  - Navigation: e.g., "Go home", "Show dashboard", "Open transactions".
  - Actions: e.g., "Submit order", "Clear bill", "Print bill", "Apply GST".

- **Interactive Billing**: 
  - Dynamic cart management with real-time subtotal, GST (18%), and discount calculations.
  - Support for both percentage (%) and fixed amount (₹) discounts.
  - Receipt generation: Print directly or download as PDF using jsPDF.

- **Sales Dashboard & Analytics**:
  - Live statistics: Today's Total Sales, Order Count, and Average Order Value.
  - Visual analytics: 7-day sales bar chart (powered by Chart.js).
  - Trending items: View top-selling items and combinations.

- **Transaction History**:
  - Keep track of all past orders.
  - Client-side filtering across Date, Search (Order ID / Item names), and Sorting options (Price, Date).

- **Robust Security**:
  - **Helmet**: Secures HTTP headers.
  - **CORS**: Restricted cross-origin resource sharing.
  - **Rate Limiting**: Prevents abuse by limiting requests (e.g., 100 requests / 15 mins per IP).
  - **XSS Protection**: Sanitizes string inputs to prevent cross-site scripting vulnerabilities.
  - **Input Validation**: Backend validation middleware for order security.

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS (`index.css`), Vanilla JavaScript (`app.js`)
  - APIs/Libraries: Web Speech Recognition API, jsPDF, Chart.js, Lucide Icons.
- **Backend**: Node.js, Express.js (`server.js`)
- **Storage**: File-based persistence using a local JSON file (`orders.json`).

## Project Structure

```text
.
├── app.js               # Main Frontend logic (SPA routing, Speech Recognition, API calls)
├── index.html           # Main UI template
├── index.css            # Stylesheets
├── server.js            # Node.js/Express backend entry point
├── package.json         # Project metadata and dependencies
├── orders.json          # Local database for storing transactions
├── middleware/          # Security and error-handling middleware
├── routes/              # Express API route handlers (orders, dashboard)
└── validators/          # Input schema validations
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- A modern web browser with Microphone access and Web Speech API support (Google Chrome recommended).

### Installation

1. Clone or download the repository to your local machine.
2. Open a terminal and navigate to the project directory:
   ```bash
   cd "path/to/Voice-Based Billing System for Restaurants 1"
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

### Running the App

1. Start the server:
   ```bash
   npm start
   ```
2. Open your web browser and navigate to:
   ```text
   http://localhost:3001
   ```
3. Grant microphone permissions when prompted to enable voice commands.

## Typical Voice Commands

- **Adding to cart:** "One burger and two colas", "Add pizza"
- **Removing from cart:** "Remove one cola", "Cancel pizza"
- **Discounts/Taxes:** "Apply GST", "Apply discount ten percent"
- **Checkout:** "Submit order", "Print invoice", "Download PDF"
- **Navigation:** "Go to dashboard", "Open transactions"

## Note

Ensure your application is served over `localhost` or a secure `https://` connection to permit the browser's Microphone access under strict browser security policies.
