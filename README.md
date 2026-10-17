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
│   ├── aiController.js  # staff-only AI review (doc authenticity + recommendation)
│   └── bootstrapController.js
├── routes/              # Express API route declarations
│   ├── authRoutes.js
│   ├── leaveRoutes.js
│   ├── userRoutes.js
│   ├── departmentRoutes.js
│   ├── hostelRoutes.js
│   ├── fileRoutes.js
│   ├── aiRoutes.js
│   └── index.js
├── middleware/          # Request logging & error handling
│   ├── logger.js
│   └── errorHandler.js
├── utils/               # Seeders, hashing, helpers, migration & AI review
│   ├── helpers.js
│   ├── seeder.js
│   ├── migrate-to-atlas.js
│   ├── docForensics.js   # offline AI-image heuristic (+ optional vision API hook)
│   ├── duplicateCheck.js # cross-student document-reuse detection (content hash)
│   └── aiRecommendation.js # rule-based score + optional LLM narrative
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
- **AI insights (staff only)**: when a staff member opens a leave request, they can run an AI review that:
  - Scans attached **image** documents for signs of being AI-generated/fabricated (metadata fingerprints for Stable Diffusion/Midjourney/etc., plus a weak EXIF-presence check) — a free, offline heuristic by default, with an optional second opinion from a vision-capable Gemini model if `GEMINI_API_KEY` is set.
  - Checks whether the **exact same document** (any file type, by content hash) was also submitted on a *different* student's request — a common fraud pattern a per-image check alone would miss. See `utils/duplicateCheck.js`.
  - Scores the request on **attendance, last-semester %, leave duration, request frequency and document reuse**, and (with the same API key) writes a short recommendation addressing whether a hackathon / SSB / medical / family reason looks worth granting given the student's standing — labelled `APPROVE` / `APPROVE_WITH_CAUTION` / `NEEDS_REVIEW`.
  - This result (`aiReview` on the leave record) is only ever rendered for non-student roles in `app.js`, and the API endpoints (`/api/ai/leaves/:id/*`) reject any viewer that isn't staff — students never see it, even for their own request.
  - Everything here is a **suggestion for a human to weigh, not a decision** — the UI says so explicitly. See `utils/docForensics.js` and `utils/aiRecommendation.js` for the implementation and its limitations.

## Deployment on Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect the GitHub repository: `yaswanth-thota-07/Leave-Management`.
3. Set **Runtime** to `Node`.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add the following **Environment Variables**:
   - `MONGODB_URI`: `mongodb+srv://janmejaysingh1201_db_user:Janmejay037@cluster0.lokcdse.mongodb.net`
   - `DATABASE_NAME`: `sehatsure`
   - `GEMINI_API_KEY` *(optional)*: enables the AI insights feature described above. Leave unset to keep that feature on its free offline heuristic only.
7. Click **Deploy Web Service**.

> **Note:** the `MONGODB_URI` above is a real, working credential committed to this public repo. Treat it as already compromised — rotate the database password (or recreate the user) in MongoDB Atlas before relying on this deployment for real data.
