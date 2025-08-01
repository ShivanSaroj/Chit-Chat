
# 📝 Chit-Chat Blog Application

A full-stack blog platform where users can write blogs, upload images, comment, like posts, and chat with other users in real-time.

### 🌐 [Live Demo](https://chit-chat-92w8.onrender.com/)

---

## 📌 Features

* ✨ User registration and secure login with JWT
* 🧑 Role-based access (Admin/User)
* 🖼️ Blog creation with image uploads
* 💬 Commenting and Liking system
* 📥 Password reset via email link
* 🔁 Real-time chat using WebSockets
* 📃 Pagination for blog listing
* ⚡ Fast performance with optimized MongoDB queries

---

## 🔧 Tech Stack

| Frontend | Backend | Database | Others                              |
| -------- | ------- | -------- | ----------------------------------- |
| EJS      | Node.js | MongoDB  | JWT, Multer, Nodemailer, WebSockets |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ShivanSaroj/chit-chat-blog.git
cd chit-chat-blog
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a `.env` file in the root and add:

```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

### 4. Start the server

```bash
npm start
```

Visit `http://localhost:5000` in your browser.

---

## 📁 Folder Structure

```
├── controllers     # Route logic
├── models          # Mongoose schemas
├── routes          # API endpoints
├── public          # Static files
├── views           # EJS templates
├── utils           # Helper functions (email, token, etc.)
├── uploads         # Uploaded images
├── .env            # Environment variables
├── server.js       # Entry point
```

---


Let me know if you'd like a version with badges, dark mode preview, GIFs, or interactive screenshots.
