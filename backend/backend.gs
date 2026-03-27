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

const FOLDER_ID = "1cuU88rPBjtJQVzXSH-mg9uQaPjghDUF2";

function doGet(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error("Script not bound to a Sheet.");
    const sheet = spreadsheet.getSheetByName("Properties");
    if (!sheet) throw new Error("Sheet 'Properties' not found.");
    
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const properties = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
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
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error("Script not bound to a Sheet.");
    const sheet = spreadsheet.getSheetByName("Properties");
    if (!sheet) throw new Error("Sheet 'Properties' not found.");

    const params = JSON.parse(e.postData.contents);
    console.log("doPost received params:", Object.keys(params));
    
    let imageUrl = "";
    let videoUrl = "";

    if (params.image && params.image.startsWith("data:image")) {
      console.log("Uploading image...");
      imageUrl = uploadFile(params.image, params.title + "_img");
    }
    
    // Check for both 'video' and 'image' used as video key for backwards compatibility
    const videoData = params.video || (params.type === 'vid' ? params.image : null);
    if (videoData && videoData.startsWith("data:video")) {
      console.log("Uploading video...");
      videoUrl = uploadFile(videoData, params.title + "_vid");
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
      "pending"
    ]);

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Listing posted!",
      imageUrl: imageUrl,
      videoUrl: videoUrl
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadFile(base64Data, filename) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    if (!folder) throw new Error("Target folder not found.");
    
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, filename);
    const file = folder.createFile(blob);
    
    // Set explicit permissions
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return a direct embed link
    const fileId = file.getId();
    console.log("File created with ID:", fileId);
    return "https://drive.google.com/thumbnail?sz=w800&id=" + fileId;
  } catch (e) {
    console.error("Upload error in backend.gs:", e.toString());
    throw e;
  }
}
