## Product Requirements Document (PRD): Roof Auto

### 1. Product Overview
* **Product Name:** Roof Auto.
* **Description:** An AI-powered roofing automation platform built as a custom web application.
* **Target Audience:** Exclusively built for Reliable Exteriors Group.
* **Primary Objective:** To automate document processing, materials calculation, and crew order generation using Artificial Intelligence.

### 2. Problem Statement & Solution

**The Problem:**
* Previously, the process required manually reading multiple PDFs per job, hand-calculating material quantities, and writing crew summaries from scratch.
* This led to a risk of human error in calculations and significant time wasted on repetitive paperwork.

**The Solution:**
* Users upload files, and the AI reads them instantly. 
* Materials are calculated automatically, and a crew order is generated in seconds.
* Consistent, formula-driven accuracy allows the team to focus on the actual job. 
* What used to take significant manual effort per job now takes seconds.

### 3. User Flow
* **Step 1: Create a Job:** Enter the customer name, address, the recipient's email address, and any notes.
* **Step 2: Upload Documents:** Upload multiple job site photos and required documentation in PDF or Word formats. **Constraint:** Each individual file must not exceed 10MB.
* **Step 3: Process with AI:** Click one button — Claude AI reads all documents simultaneously.
* **Step 4: Review Results & Automated Delivery:** The materials order and crew summary are generated instantly. The system automatically compiles these results into a printable PDF and emails it to the collected email address.
* **Step 5: Auto Cleanup:** Job data is automatically deleted after 10 minutes.

### 4. Functional Requirements

**4.1 Document Ingestion & Extraction**
The system must support multiple file uploads (Photos, PDFs, and Word documents), strictly enforcing a **10MB maximum file size per upload**. It must extract specific data from the following document types:
* **Eagle View Report (Required):** Extracts squares, pitch, ridges, hips, valleys, rakes, eaves, pipe boots, and vents. **Smart Priority:** Eagle View data always takes priority as it is the most precise source.
* **Insurance / Scope (Optional):** Extracts the insurance company, claim number, approved amount, deductible, and line items.
* **Signed Contract (Optional):** Extracts customer details, agreed scope, and special requirements.
* **City Code / Permit (Optional):** Extracts local building code requirements and permit conditions.
* **Job Site Photos (Optional):** Extracts visual damage notes and roof condition observations (multiple files allowed).

**4.2 Automated Material Calculations**
The platform must automatically calculate the following materials:
* **Shingles:** Calculated in squares from the roof area.
* **Felt Underlayment:** Calculated in rolls based on total squares.
* **Ice & Water Shield:** Calculated in rolls for valleys and eaves.
* **Ridge Cap Shingles:** Calculated in bundles from ridge and hip length.
* **Drip Edge:** Calculated in pieces for rakes and eaves.
* **Pipe Boots & Roof Vents:** Calculated individually from the extracted count.
* **Coil Nails:** Calculated in boxes by square count.
* **Cap Nails & Starter:** Calculated in boxes and bundles from measurements.

**4.3 Formula Engine**
* All material calculations must be driven by a Formula Engine — a dedicated page where every formula can be viewed, edited, or toggled on/off without touching any code.
* Updates to formulas apply automatically to every future job, giving Reliable Exteriors Group full ownership over ordering standards without developer dependency.

**4.4 Document Generation & Email Delivery**
* The system must dynamically generate a printable PDF containing the final materials order and crew summary.
* Upon successful AI processing, the system must automatically email this generated PDF to the email address collected during Step 1.

### 5. Technical & Non-Functional Requirements

**5.1 Technology Stack**
* **Frontend & Backend:** Next.js (TypeScript).
* **Database:** MongoDB Atlas.
* **File Storage:** Vercel Blob (to handle large files securely in the cloud).
* **Artificial Intelligence:** Anthropic Claude (claude-opus-4-6).
* **Styling:** Tailwind CSS.
* **Hosting:** Vercel.

**5.2 Security & Data Privacy**
* All uploaded files are stored in Vercel Blob secure cloud storage, not on any local machine.
* Jobs and all associated data are automatically deleted after 10 minutes to protect customer privacy.
* All API keys and database credentials are stored securely in Vercel's environment.
* The app is served over HTTPS to ensure all data in transit is encrypted.
* The application is private, accessible only to Reliable Exteriors Group via the deployed URL.

### 6. Future Roadmap
* **User Login / Authentication:** Restrict app access to authorised team members only with secure login.
* **ABC Supply Price Integration:** Pull live pricing to auto-calculate the total job material cost.
* **Permanent Job Storage:** Extend job retention beyond 10 minutes for record-keeping.
* **Mobile App:** Develop a native iOS/Android app for field use on job sites.
