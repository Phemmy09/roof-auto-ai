# Standard Operating Procedure & User Manual
## Roof Auto AI — Automated Job Estimation & Material Calculations

This document is the Standard Operating Procedure (SOP) and User Manual for **Roof Auto AI**. It is written in simple, non-technical language to help Project Managers, Office Staff, and Operations Managers process roofing jobs, review AI-extracted details, adjust ordering formulas, and troubleshoot common issues.

---

## Table of Contents
1. [Overview & Core Benefits](#1-overview--core-benefits)
2. [System Pages & Access](#2-system-pages--access)
3. [Step-by-Step Guide: Running a Job](#3-step-by-step-guide-running-a-job)
4. [Document Upload & Preparation Guide](#4-document-upload--preparation-guide)
5. [Understanding Your Results](#5-understanding-your-results)
6. [Managing Formulas (The Formula Engine)](#6-managing-formulas-the-formula-engine)
7. [Quality Control Checklist](#7-quality-control-checklist)
8. [Troubleshooting & Common Errors](#8-troubleshooting--common-errors)
9. [Escalation Protocols](#9-escalation-protocols)

---

## 1. Overview & Core Benefits

**Roof Auto AI** is an intelligent assistant designed for **Reliable Exteriors Group** to automate document reading and materials ordering. 

### Why we use this system:
* **Saves Time:** What used to require reading multiple PDFs, manual math, and typing up notes is done in under 2 minutes.
* **Eliminates Math Errors:** The system uses standard, pre-approved formulas to calculate materials, ensuring consistent order sizes.
* **Smart Information Capture:** The AI reads building codes, signed contracts, insurance papers, and EagleView reports all at the same time to create a single instruction list.

---

## 2. System Pages & Access

You can open the system in any modern web browser (such as Google Chrome or Microsoft Edge). There is no username or password required. The system is kept private by keeping its web address (URL) confidential.

There are two primary pages in the system:
1. **Job Dashboard (The Homepage):** Used daily by all staff to input new jobs, upload documents, and generate calculations.
2. **Formula Engine (`/formula-engine`):** Used only by the Operations Manager to tweak material coverage values and toggle products on or off.

---

## 3. Step-by-Step Guide: Running a Job

Processing a job takes 3 simple steps on the dashboard:

### Step 1: Create the Job
Enter the basic details on the starting screen:
* **Customer Name:** Enter the client's full name as it appears on their contract (e.g., *Ann Scarritt*).
* **Address:** The full street address, city, state, and ZIP.
* **Recipient Email:** This is pre-filled automatically with `cheryl@therelexgroup.com`. **Do not change this** unless you are explicitly instructed to send the PDF to a different address.
* **Job Notes:** Any extra details, special crew warnings, or custom site directions.

Click **Next Step** to continue. *(Note: The button will be grayed out until the customer name and email are filled in.)*

### Step 2: Upload Your Files
Drag and drop your job files into the upload box, or click the box to browse your computer. You can upload multiple files at once.
* **Required Files:** You must upload the **EagleView PDF** and the **Signed Contract PDF**.
* **Optional Files:** You may upload insurance scope PDFs, regional code documents, or job site photos.
* When all files have successfully uploaded, click **Process with AI**.
* **Do not close the browser tab or hit the back button** while the loading spinner is active. Processing usually takes between **70 and 120 seconds**.

### Step 3: View & Download the Results
Once the AI finishes reading the files, the results page will display:
* **Material Order Form:** The exact quantities needed for the crew order.
* **Crew Instructions:** A step-by-step checklist for the roofers (tearing off, deck preparation, specialized installation, etc.).
* **Labor Items:** A list of items to bill (e.g., steep slope charges, number of stories, skylight details).

The system automatically emails this completed report as a PDF to `cheryl@therelexgroup.com`. 
* To save a copy to your computer, click **Download PDF**.
* To start a new job, click **Start New Job**.

> [!WARNING]
> **Data Auto-Deletion:** To protect customer privacy, all job records and uploaded documents are permanently deleted from the secure database **10 minutes** after you finish. Always download the PDF immediately if you need a local copy. (The copy sent to Cheryl's email will remain in her inbox forever.)

---

## 4. Document Upload & Preparation Guide

To get accurate results from the AI, please follow these rules when preparing your files:

### Required Files
1. **EagleView Report (PDF):** The primary source of measurements. The AI reads this to get the roof area (squares), slopes (pitch), and roof edge lengths (ridge, hip, valley, eave, rake).
2. **Signed Contract (PDF):** The AI reads this to find the chosen shingle brand, product line, and color, along with any special agreement details.

### Optional Files
3. **Insurance Scope / Xactimate (PDF):** Reads approved items if the job is funded by insurance.
4. **City / County Building Codes (PDF):** Reads regional code guides (like permit details or mid-roof inspection requirements).
5. **Job Site Photos:** You can upload photos. The system is smart enough to identify photo files by their names (e.g., containing *photo, before, after, drone, pic*) and will exclude them from the AI text-reading process to save time, while still attaching them to the job.

### File Constraints
* **Max Size:** 10 MB per file (the system will reject files larger than this).
* **PDF Limit:** For best performance, compress large PDF files to **under 4 MB** before uploading. 
* **How to compress a PDF:** Use free tools like Adobe Acrobat ("Reduce File Size") or online services like [Smallpdf.com](https://smallpdf.com) or [ilovepdf.com](https://ilovepdf.com).

---

## 5. Understanding Your Results

### Material Order Calculations
The system calculates 12 core materials using standard rules:

| Material | How it is Calculated |
| :--- | :--- |
| **Field Shingles** | Roof Squares × 1.10 (adds 10% waste), rounded up to the nearest whole square. |
| **Hip & Ridge Caps** | (Ridges + Hips) × 1.30 (adds 30% waste) divided by the feet per bundle, rounded up. |
| **Starter Strip** | (Eaves + Rakes) divided by feet per bundle. **Minimum order of 3 bundles** is always enforced. |
| **Synthetic Underlayment** | Total Squares × 1.05 (adds 5% waste) divided by coverage per roll (defaults to 10 squares), rounded up. |
| **Ice & Water Shield** | (Eaves + Valleys) × 1.05 (adds 5% waste) divided by feet per roll (usually 75 LF), rounded up. |
| **Drip Edge — Rakes** | Rake length × 1.30 (adds 30% waste) divided by 10-foot sticks, rounded up. |
| **Drip Edge — Eaves** | Eave length × 1.30 (adds 30% waste) divided by 10-foot sticks, rounded up. |
| **Pipe Boots (Jacks)** | Matches the exact count of pipe boots extracted from the EagleView report. |
| **Ridge Vent** | Ridge length divided by 4 feet per section, rounded up. |
| **Coil Nails** | Squares divided by squares covered per box (usually 1 box per 15-20 SQ), rounded up. |
| **Cap Nails** | 1 box if the job is 25 squares or less; 2 boxes if the job is over 25 squares. |
| **Geocel 2300 Sealant** | Calculated based on valley and ridge lengths. **Minimum of 3 tubes** is always ordered. |

### Crew Instructions & Special Items
The AI tailors the instructions based on what it reads in the contract and code documents:
* **Inspections:** If the city requires a mid-roof inspection, a warning will appear in the crew checklist.
* **Special Items:** If the roof has skylights, solar panels, or a chimney, specific steps for flashing or protecting those elements are added.
* **Ventilation:** Instructs the crew to install ridge vents, box vents, or keep the existing configuration based on contract scope.

### Material Notes (Blue Text Box)
This area contains important details that do not fit in a quantity table:
* Exact shingle product and color name.
* Colors for metal parts (drip edge, valley metal).
* **Supplement Flags:** Warnings about items required by code (like drip edge) that were not approved in the insurance scope. This flags that the office needs to request more money from the insurance company.

---

## 6. Managing Formulas (The Formula Engine)

If you change suppliers or start using different products (for example, switching from GAF to Owens Corning shingles), you can update the math formulas without writing any code.

> [!IMPORTANT]
> **Operations Manager Only:** Only authorized managers should adjust these values. Small mistakes here will result in incorrect materials being ordered for all future jobs.

### How to Adjust Formulas:
1. Type `/formula-engine` at the end of the website address in your browser.
2. You will see cards for each material type showing its current coverage number.
3. Click in the box and enter the new value:
   * **Underlayment:** If using standard felt rolls, set felt coverage to `4`. If using synthetic rolls that cover more area, set it to `10`.
   * **Ridge Cap:** If using a brand with 31 feet per bundle, set it to `31`. If using GAF (33 feet), set it to `33`.
4. **Turning Off a Material:** If you do not want the system to calculate a specific material (for example, if you order nails separately), uncheck the **Enable Calculation** box on that card. The quantity will default to `0` on all future orders.
5. Click **Save Changes** in the top right. A green confirmation banner will appear. The changes are immediately live.

---

## 7. Quality Control Checklist

Before sending any order to the supplier or handing instructions to the crew, take 60 seconds to double-check the results:

* [ ] **Customer Name & Address:** Do they match the contract exactly?
* [ ] **Roof Area (Squares):** Does the total square count match the EagleView report?
* [ ] **Shingle Product & Color:** Does the color match the customer's signed contract?
* [ ] **No Zero Quantities:** Are any material quantities showing as `0` unexpectedly? (If yes, the EagleView may not have been read).
* [ ] **Starter & Sealant Minimums:** Do starter strip and sealant show at least 3 units?
* [ ] **Mid-Roof Inspection Flag:** Is this flagged if the local city code requires it?
* [ ] **Supplement Flags:** Have you checked the blue notes box for any items we need to request insurance supplements for?

---

## 8. Troubleshooting & Common Errors

### ❌ Problem: All material quantities show as 0
* **Cause:** The AI could not read the EagleView report.
* **Fix:** 
  1. Check the EagleView filename. If it contains words like `photo`, `before`, `after`, `pic`, or `image`, the system skipped it. Rename the file to something simple (e.g., `EagleView_Scarritt.pdf`) and upload it again.
  2. Check the file size. If the PDF is over 4 MB, compress it to a smaller size using an online compressor, then upload again.

### ❌ Problem: "Server Error" or blank screen during processing
* **Cause:** The system timed out or the AI service encountered an issue.
* **Fix:** Wait 1 minute, refresh your browser page, and try running the job again. If you have many large photos uploaded, try running the job with just the PDFs first (EagleView, Contract, Scope).

### ❌ Problem: Cheryl did not receive the email
* **Cause:** The automated email service failed or the email went to a spam folder.
* **Fix:** 
  1. Check if the screen says "Email sent" or "Email failed" in the corner.
  2. If it failed, click the **Download PDF** button on your screen to save it locally, then email it to Cheryl manually.
  3. Ask Cheryl to check her "Spam" or "Junk" folder for emails from `izzy.marketing.hub@gmail.com`.

### ❌ Problem: Shingle color or brand is incorrect
* **Cause:** The contract scan was too blurry or the handwriting was hard to read.
* **Fix:** Re-scan the contract at a higher resolution (300 DPI) and run the job again, or manually correct the color on your final PDF.

---

## 9. Escalation Protocols

If you encounter an issue that you cannot solve using this guide, use the table below to determine who to contact:

| Issue | First Step | Escalate To |
| :--- | :--- | :--- |
| **Website won't open or load** | Check internet connection. | Contact your internal IT Administrator. |
| **Quantities calculate incorrectly on all new jobs** | Open `/formula-engine` and verify the values match this manual. | Operations Manager to review recent changes. |
| **AI fails to extract contract information repeatedly** | Check scan quality. | IT Administrator (to review AI engine logs). |
| **SMTP / Email sending fails permanently** | Download PDFs manually. | IT Administrator (to check Google App Passwords). |
