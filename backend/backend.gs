/**
 * DOMAAF BACKEND - GOOGLE APPS SCRIPT
 * Paste this into Extensions > Apps Script in your Google Sheet.
 * 
 * Setup:
 * 1. Create a Google Sheet.
 * 2. Create 2 tabs: "Properties" and "Users".
 * 3. Create a folder in Google Drive named "Domaaf_Media".
 * 4. Paste this code.
 * 5. Replace FOLDER_ID with your Google Drive folder ID.
 * 6. Deploy as "Web App" -> "Anyone" has access.
 */

const FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE";

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Properties");
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const properties = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
    // Sort by Tier (Diamond > Platinum > Gold > Silver > Free)
    const tierOrder = { "Diamond": 5, "Platinum": 4, "Gold": 3, "Silver": 2, "Free": 1 };
    properties.sort((a,b) => (tierOrder[b.plan] || 0) - (tierOrder[a.plan] || 0));

    return ContentService.createTextOutput(JSON.stringify(properties))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const rawContent = e.postData.contents;
    console.log("Raw Post Data:", rawContent.substring(0, 100)); // Log for debugging
    
    const params = JSON.parse(rawContent);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Properties");
    
    let imageUrl = "";
    let videoUrl = "";

    // Handle Image Upload
    if (params.image && params.image.startsWith("data:image")) {
      imageUrl = uploadFile(params.image, params.title + "_img");
    }

    // Handle Video Upload
    if (params.video && params.video.startsWith("data:video")) {
      videoUrl = uploadFile(params.video, params.title + "_vid");
    }

    sheet.appendRow([
      new Date(),
      params.id || Utilities.getUuid(),
      params.title,
      params.description,
      params.price,
      params.type,
      params.plan,
      imageUrl,
      videoUrl,
      params.userEmail || "anonymous",
      "pending" // Status
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Listing posted!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error("POST Error:", err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadFile(base64Data, filename) {
  if (typeof base64Data !== 'string' || !base64Data.includes(',')) {
    console.error("Invalid base64 data passed to uploadFile");
    return "";
  }
  
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}
