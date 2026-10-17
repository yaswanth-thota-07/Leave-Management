# Digital Leave Management System (DLMS) - MERN Stack

A modern, full-stack Digital Leave Management System built with **Node.js, Express, MongoDB (Atlas/Local), and Vanilla JS**.

## Architecture (MVC)
```
├── config/              # MongoDB connection & DNS resolver
│   └── db.js
├── models/              # Mongoose schemas
│   ├── User.js
│   ├── Leave.js
│   ├── Department.js
│   ├── Hostel.js
│   ├── Audit.js
│   └── FileDoc.js
├── controllers/         # Business logic & request handling
│   ├── authController.js
│   ├── leaveController.js
│   ├── userController.js
│   ├── departmentController.js
│   ├── hostelController.js
│   ├── fileController.js
│   └── bootstrapController.js
├── routes/              # Express API route declarations
│   ├── authRoutes.js
│   ├── leaveRoutes.js
│   ├── userRoutes.js
│   ├── departmentRoutes.js
│   ├── hostelRoutes.js
│   ├── fileRoutes.js
│   └── index.js
├── middleware/          # Request logging & error handling
│   ├── logger.js
│   └── errorHandler.js
├── utils/               # Seeders, hashing, helpers & migration
│   ├── helpers.js
│   ├── seeder.js
│   └── migrate-to-atlas.js
├── index.html           # Frontend interface
├── styles.css           # Styling
├── app.js              # Client-side SPA application
└── server.js            # Express server entry point
```

## Features
- **Multi-Role Support**: Student, Class Teacher, Warden, HOD, Joint Director, Director, Gate Security, and Main Admin.
- **Workflow Approvals**: Real-time stage-by-stage leave review pipeline.
- **Direct Student Verification**: Automated verification badge.
- **Class Teacher View**: Completed status view for approved student leaves.
- **Admin Management**: Custom password provisioning for authority accounts.
- **Flexible Reg Numbers**: Supports numeric formats (e.g. `250361`, `240362`).

## Deployment on Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect the GitHub repository: `yaswanth-thota-07/Leave-Management`.
3. Set **Runtime** to `Node`.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add the following **Environment Variables**:
   - `MONGODB_URI`: `mongodb+srv://janmejaysingh1201_db_user:Janmejay037@cluster0.lokcdse.mongodb.net`
   - `DATABASE_NAME`: `sehatsure`
7. Click **Deploy Web Service**.
