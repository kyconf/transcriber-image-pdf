import { google } from 'googleapis';
import OpenAI from 'openai';
import readline from 'readline';
import path from "path";
import * as XLSX from 'xlsx';
import fs from 'fs';
import pdfPoppler from "pdf-poppler";
import dotenv from 'dotenv';
import express, { response } from 'express';
import cors from 'cors';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
  }

const app = express();
app.use(cors()); // Enables CORS for all origins
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true}));

const range = 'Question!A1';

// OpenAI API setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Google Sheets API setup
const SERVICE_ACCOUNT_FILE = 'credentials.json'; // Path to your service account key file
const SPREADSHEET_ID = '1-GMTSImDqWFahWiWU44iV108cfAN6UZc_QxaT08sTlE'; // Replace with your spreadsheet ID

const EXPORT_FOLDER_ID = '1Cc4KiS3UGI53K0BjJfNlY-ds94szvD3p'; // Replace with your folder ID

// Authenticate with Google Sheets
const auth = new google.auth.GoogleAuth({   
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const SERVICE2_ACCOUNT_FILE = 'drivecreds.json'; // Path to your service account key file

const driveAuth = new google.auth.GoogleAuth({
  keyFile: SERVICE2_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth: driveAuth });

const FOLDER_ID = '1rmujeT7-8jVtJlT7mnU9RmDnG-588MF9'; // Replace with your folder ID
const FOLDER_PDF = '1dpViJ_Fw2Y_wrFXEKaWWolhn-WcGeg9T'; // Replace with your folder ID

// Define a persistent output directory
const isPackaged = process.env.ELECTRON_IS_PACKAGED === 'true';
const OUTPUT_DIR = isPackaged
  ? path.join(process.env.APPDATA || process.env.HOME, "pdf-transcriber", "converted_images")
  : path.resolve("converted_images");

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Created output directory at: ${OUTPUT_DIR}`);
}

async function listFilesInFolder(folderId) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
      fields: 'files(id, name)',
    });

    if (!response.data || !response.data.files) {
      throw new Error('No data returned from Google Drive API.');
    }

    let files = response.data.files;

    if (files.length === 0) {
      console.log('No files found in the folder.');
      return []; // Return an empty array to indicate no files
    }

    // 🔹 Sort files numerically based on their name (Handles names like "page-001.png", "page-58.png")
    files.sort((a, b) => {
      const numA = parseInt(a.name.match(/Q(\d+)/)[1]);
      const numB = parseInt(b.name.match(/Q(\d+)/)[1]);
      return numA - numB;
    });

    console.log('Files in folder (sorted numerically):');
    files.forEach(file => {
      console.log(`- ${file.name} (ID: ${file.id})`);
    });

    return files; // Return the sorted list of files
  } catch (error) {
    console.error('Error listing files in folder:', error.message);
    throw error; // Re-throw the error to handle it in the calling function
  }
}

// Call the function
// listFilesInFolder(FOLDER_ID);

async function fetchImageFromGoogleDrive(fileId) {
  try {
    const response = await drive.files.get(
      {
        fileId, // The ID of the file to fetch
        alt: 'media', // Indicates we want the file's content, not metadata
      },
      { responseType: 'arraybuffer' } // Fetch the file as binary data
    );

    const imageBuffer = Buffer.from(response.data, 'binary'); // Convert binary data to a Buffer
    return imageBuffer.toString('base64'); // Convert the Buffer to a Base64 string
  } catch (error) {
    console.error('Error fetching file from Google Drive:', error.message);
    throw error; // Re-throw the error so it can be caught elsewhere
  }
}

let lastResponse = [];
app.post('/chat', async (req, res) => {

  try {

    const { prompt } = req.body; // Get user input (prompt) from the request body
    console.log('Extracted prompt:', prompt);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Always respond in valid JSON format with no extra text or explanations. You are a helpful assistant that can create text-based Reading and Writing Exams. 

If I provide you with a passage and/or a question, generate a question of the same difficulty that assesses the same skill (e.g., if the original question tests vocabulary, your question should also test vocabulary). 

The question and options can include bold, italics, and underlines using the following formatting:
- Bold: **text** (use double asterisks)
- Italics: *text* (use single asterisks)
- Underline: __text__ (use double underscores)

Use \\n\\n for double line breaks and \\n for single line breaks. The output must strictly follow this format:

{
  "response": "[question]\\n\\nA) [Option A]\\n**B) [Option B]\\nC) [Option C]\\nD) [Option D]\\n\\n**Correct Answer: [Letter]**",
  "correct_answer": "[Letter]"
}`
        },
        { role: "user", content: prompt }
      ]
    });
  
  
    
    let message = response.choices[0]?.message?.content || 'No message returned';
    console.log(message);


    let parsedMessage;
    try {
      if (typeof message === 'string') {
        parsedMessage = JSON.parse(message);
      }
      console.log("Parsed Message:", message);
    } catch (error) {
      console.error("JSON Parsing Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to parse JSON response from OpenAI.",
        rawResponse: message,
      });
    }


    
    const combinedResponse = {
      user_prompt: prompt,
      response: parsedMessage.response,
      correct_answer: parsedMessage.correct_answer
    };


    const valuesToAppend = [[combinedResponse.response, combinedResponse.correct_answer]];
    const sheetName = 'Question'; // Ensure this is defined correctly
    console.log('Appending to sheet:', sheetName);
    console.log('Values to append:', valuesToAppend);
    await appendToSheet(valuesToAppend, sheetName); // Call the append function with the sheet name
    console.log("Response appended to Google Sheets!");


    // Append the new response to the existing array
    if (Array.isArray(message)) {
      lastResponse = lastResponse.concat(combinedResponse); // Merge arrays  
    } else {
      lastResponse.push(combinedResponse); // Add single object
    }

    res.status(200).json({
      success: true,
      message: "Response generated successfully.",
      data: combinedResponse
    });
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process the request.',
      error: error.response?.data || error.message,
    });
  }

  
});

app.get('/chat/response', async (req, res) =>  { //gets the info

  
    if (lastResponse) {
      res.status(200).json(lastResponse); // Send the stored JSON response
    } else {
      res.status(404).json({
        success: false,
        message: "No response available.",
      });
    }
  });

  let counting = 0;
// Add this at the module level (outside of any function)
let currentSheetRow = 0;
let currentPageRow = 0;

async function createDefaultSheet(spreadsheetId, sheetName) {
  try {
    const request = {
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }],
      },
    };

    const response = await sheets.spreadsheets.batchUpdate(request);
    const newSheet = response.data.replies[0].addSheet.properties;
    console.log(`✅ New sheet created: ${newSheet.title}`);
    currentSheetRow = 0;
    currentPageRow = 0;

    return newSheet.title;
  } catch (error) {
    console.error('❌ Error creating sheet:', error.message);
    throw error;
  }
}

async function createDefault(spreadsheetId) {
  try {
    const request = {
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [{ 
          addSheet: {} 
        }],
      },
    };

    const response = await sheets.spreadsheets.batchUpdate(request);
    const newSheet = response.data.replies[0].addSheet.properties;
    console.log(`✅ New sheet created: ${newSheet.title}`);
    currentSheetRow = 0;
    currentPageRow = 0;

    return newSheet.title;
  } catch (error) {
    console.error('❌ Error creating sheet:', error.message);
    throw error;
  }
}

async function appendToSheet(values, sheetName) {
  if (!sheetName) {
    console.error('Sheet name is undefined. Please provide a valid sheet name.');
    return;
  }

  try {
    currentSheetRow++; // Increment the counter
    if (currentSheetRow === 1) currentSheetRow = 2; // Start from row 2

    // Check if the current row has data
    const checkRange = `${sheetName}!B${currentSheetRow}`;
    const checkResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: checkRange,
    });

    // If the row has data, skip to the next row
    if (checkResult.data.values && checkResult.data.values.length > 0) {
      currentSheetRow++;
    }
    
    const targetRange = `${sheetName}!B${currentSheetRow}`;

    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: targetRange,
      valueInputOption: 'RAW',
      resource: { values },
    };

    await sheets.spreadsheets.values.append(request);
    console.log(`✅ Data appended to row ${currentSheetRow}.`);
  } catch (error) {
    console.error('❌ Error appending to Google Sheets:', error.message);
  }
}

async function TwiceToSheet(values, sheetName) {
  if (!sheetName) {
    console.error('Sheet name is undefined. Please provide a valid sheet name.');
    return;
  }

  try {
    currentPageRow++; // Increment the counter
    if (currentPageRow === 1) currentPageRow = 2; // Start from row 2

    // Check if the current row has data
    const checkRange = `${sheetName}!E${currentPageRow}`;
    const checkResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: checkRange,
    });

    // If the row has data, skip to the next row
    if (checkResult.data.values && checkResult.data.values.length > 0) {
      currentPageRow++;
    }
    
    const targetRange = `${sheetName}!E${currentPageRow}`;

    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: targetRange,
      valueInputOption: 'RAW',
      resource: { values },
    };

    await sheets.spreadsheets.values.append(request);
    console.log(`✅ Data appended to row ${currentPageRow}.`);
  } catch (error) {
    console.error('❌ Error appending to Google Sheets:', error.message);
  }
}

// Function to parse GPT's response
function parseGPTResponse(response) {
    const questionStart = response.indexOf('Question:') + 'Question:'.length;
    const questionEnd = response.indexOf('A)');
    const question = response.slice(questionStart, questionEnd).trim();

    const choicesStart = response.indexOf('A)');
    const choicesEnd = response.indexOf('Correct Answer:');
    const choicesAndAnswer = response.slice(choicesStart, choicesEnd).trim();

    const correctAnswerStart = response.indexOf('Correct Answer:') + 'Correct Answer:'.length;
    const correctAnswer = response.slice(correctAnswerStart).trim();

    return { question, choicesAndAnswer, correctAnswer };
}

// Readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Main script logic
console.log("Welcome to the GPT-Sheets bot! Type 'exit' to quit.");

rl.on('line', async (userInput) => {
    if (userInput.toLowerCase() === 'exit') {
        console.log('Goodbye!');
        rl.close();
        return;
    }

    // Get GPT's response
    const gptResponse = await chatWithGPT(userInput);
    if (!gptResponse) {
        console.log('Error getting response from GPT.');
        return;
    }
    console.log(`GPT Response:\n${gptResponse}`);

    // Parse the response
    const { question, choicesAndAnswer, correctAnswer } = parseGPTResponse(gptResponse);

    // Display parsed data
    console.log("\nParsed Data:");
    console.log(`Question: ${question}`);
    console.log(`Choices and Answer: ${choicesAndAnswer}`);
    console.log(`Correct Answer: ${correctAnswer}`);

    // Ask user if they want to append the response to Google Sheets
    rl.question("Do you want to save this response to the Google Sheet? (yes/no): ", async (confirm) => {
        if (confirm.toLowerCase() === 'yes') {
            await appendToSheet([[userInput, question, choicesAndAnswer, correctAnswer]]);
            console.log("Response saved to Google Sheet!");
        } else {
            console.log("Response not saved.");
        }
    });
});

////////////////////////////////////////////////////////////////////
// Transcriber area

// function encodeImageToBase64(imagePath) {
//   const imageBuffer = fs.readFileSync(imagePath); // Read image as binary
//   return imageBuffer.toString("base64"); // Convert binary to Base64 string
// }

app.post('/transcribe', async (req, res) => {
  try {
    const files = await listFilesInFolder(FOLDER_ID);
    files.sort((a, b) => a.name.localeCompare(b.name));
    console.log(files);
    const newSheet = await createDefault(SPREADSHEET_ID);

    if (files.length === 0) {
      console.log('No files found in the folder.');
      return res.status(404).json({
        success: false,
        message: 'No files found in the folder.',
      });
    }

    console.log(`Found ${files.length} file(s) in the folder.`);

    const responses = []; // To store results for all files
  
    for (const file of files) {

      counting = 0;
      // Check if the file is a PDF
      if (file.name.toLowerCase().endsWith('.pdf')) {
        console.log(`Processing PDF file: ${file.name}`);
        // Add your PDF processing logic here
        // For example, convert the PDF to images and then process those images
        continue; // Skip to the next file after processing
      }

      // Check if the file is an image
      if (!file.name.toLowerCase().endsWith('.png') && 
          !file.name.toLowerCase().endsWith('.jpg') && 
          !file.name.toLowerCase().endsWith('.jpeg')) {
        console.log(`Skipping unsupported file type: ${file.name}`);
        continue; // Skip unsupported file types
      }

      console.log(`Processing image file: ${file.name} (${file.id})`);

      try {
        // Fetch the file content as Base64
        const base64Image = await fetchImageFromGoogleDrive(file.id);

        // Pass the Base64 image to OpenAI API
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are an assistant that transcribes passages and questions from a given image. You must be clear and concise. Do not give any introduction messages like 'Sure, here are the questions'. 
                    You are to return it in valid JSON format like the following. Carefully analyze the photo and encapsulate accordingly. Do not confuse "  with each other. There can be multiple in one question. If there are any line breaks, use 
                    \\n for single line breaks and \\n\\n for double line breaks. If there are any italics, use *text*. If there are any quotes, use "text". STRICTLY FOLLOW: If there are any underlines, use _text_ 
                    {
                    "passage": "[passage]",
                    "question": "[question]\\n\\nA) [Option A]\\nB) [Option B]\\nC) [Option C]\\nD) [Option D]\\n\\n",
                    "correct_answer": "[Letter]"
                    }
                  `,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          store: true,
        });

        let newMessage = response.choices[0]?.message?.content || 'No message returned';
        console.log(newMessage);

        let parseMessage;
        try {
          if (typeof newMessage === 'string') {
            newMessage = newMessage.replace(/```json|```/g, "").trim();
            parseMessage = JSON.parse(newMessage);
          }

          console.log("Parsed Message:", newMessage);
       
          const valuesToAppend = [[parseMessage.passage, parseMessage.question, parseMessage.correct_answer]];

          await appendToSheet(valuesToAppend, newSheet); // Append to Google Sheets

          console.log(`Response for ${file.name} appended to Google Sheets!`);

    
          responses.push({
            file: file.name,
            response: parseMessage,
          });
        } catch (error) {
          console.error(`Error parsing response for ${file.name}:`, error.message);
          responses.push({
            file: file.name,
            error: "Failed to parse OpenAI response",
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error.message);
        responses.push({
          file: file.name,
          error: error.message,
        });
      }
    }

     
  // Generate unique filename
  const uniqueFileName = generateUniqueFileName(newSheet);
  
  await exportSheetToXLSX(SPREADSHEET_ID, newSheet, uniqueFileName);
  await uploadXLSXToDrive(uniqueFileName, EXPORT_FOLDER_ID);
  
  await processExcelFile(uniqueFileName, newSheet)
    .then(result => console.log('Final JSON result:', JSON.stringify(result, null, 2)))
    .catch(error => console.error('Processing failed:', error.message));

  // Optionally, clean up the local file after processing
  try {
    fs.unlinkSync(uniqueFileName);
    console.log(`✅ Cleaned up temporary file: ${uniqueFileName}`);
  } catch (error) {
    console.error(`❌ Error cleaning up file: ${error.message}`);
  }


    return res.status(200).json({
      success: true,
      message: 'Processed all files in the folder.',
      data: responses,
    });
  } catch (error) {
    console.error('Error processing files from folder:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process files from folder.',
      error: error.message,
    });
  }
});

////////////////////////////////////////////////////////////////////
// PDF AREA
////////////////////////////////////////////////////////////////////

async function clearProcessingQueue() {
  try {
    console.log("🛑 Clearing previous processing queue...");

    if (fs.existsSync(OUTPUT_DIR)) {
      fs.readdirSync(OUTPUT_DIR).forEach(file => {
        if (file.endsWith(".png")) {
          fs.unlinkSync(path.join(OUTPUT_DIR, file));
        }
      });
      console.log("✅ Local queue cleared: Deleted old converted images.");
    } else {
      console.log("📂 No local images to clear.");
    }

    await clearOldDriveFiles(FOLDER_PDF);

    console.log("🚀 Processing queue cleared. Ready for new tasks.");
  } catch (error) {
    console.error("❌ Error clearing processing queue:", error.message);
  }
}

// Convert PDF to Images
async function convertPdfToImages(pdfPath, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const options = {
    format: "png",
    out_dir: outputDir,
    out_prefix: "page",
    dpi: 150,
  };

  try {
    console.log(`Converting PDF: ${pdfPath} to images...`);
    await pdfPoppler.convert(pdfPath, options);
    let images = fs.readdirSync(outputDir).filter((file) => file.endsWith(".png"));
    
    // Limit to a maximum of 55 images
    images = images.slice(0, 55);

    console.log(`✅ Converted ${images.length} pages to images.`);
    return images.map((img) => path.join(outputDir, img));
  } catch (error) {
    console.error("❌ Error converting PDF:", error);
    throw error;
  }
}

// Upload Images to Google Drive
async function uploadFileToDrive(filePath) {
  try {
    const fileMetadata = {
      name: path.basename(filePath),
      parents: [FOLDER_PDF],
    };

    const media = {
      mimeType: "image/png",
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log(`✅ Uploaded ${filePath} to Google Drive with ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("❌ Error uploading file to Google Drive:", error);
    throw error;
  }
}

async function downloadPdfFromDrive(fileId) {
  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'stream' }
    );

    // Use the OUTPUT_DIR for saving files
    const filePath = path.join(OUTPUT_DIR, `${fileId}.pdf`);
    const dest = fs.createWriteStream(filePath);
    response.data.pipe(dest);

    return new Promise((resolve, reject) => {
      dest.on('finish', () => {
        console.log(`✅ Downloaded PDF to: ${filePath}`);
        resolve(filePath);
      });
      dest.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error downloading PDF from Google Drive:', error.message);
    throw error;
  }
}

// Function to list PDF files in a Google Drive folder
async function listPdfFilesInFolder(folderId) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: 'files(id, name)',
    });

    if (!response.data || !response.data.files) {
      throw new Error('No data returned from Google Drive API.');
    }

    return response.data.files;
  } catch (error) {
    console.error('Error listing PDF files in folder:', error.message);
    throw error;
  }
}

async function processPdfAndUpload() {
  try {
    await clearProcessingQueue();

    const pdfFiles = await listPdfFilesInFolder(FOLDER_PDF);
    pdfFiles.sort((a, b) => a.name.localeCompare(b.name));

    for (const pdfFile of pdfFiles) {
      console.log(`Processing PDF file: ${pdfFile.name} (${pdfFile.id})`);

      // Get the filename without the .pdf extension
      const sheetName = pdfFile.name.replace('.pdf', '');
      const newSheetName = await createDefaultSheet(SPREADSHEET_ID, sheetName);

      const pdfFilePath = await downloadPdfFromDrive(pdfFile.id);
      const images = await convertPdfToImages(pdfFilePath, OUTPUT_DIR);

      for (const image of images) {
        await uploadFileToDrive(image);
      }

      console.log(`✅ All images from ${pdfFile.name} uploaded to Google Drive.`);

      await transcribeImages(images, newSheetName);
    }

    await listFilesInFolder(FOLDER_PDF);
  } catch (error) {
    // Throw the error to be caught by the endpoint
    throw error;
  }
}

// Function to transcribe images
async function transcribeImages(images, sheetName) {
  const responses = [];

  for (const image of images) {
    console.log(`Transcribing image: ${image}`);

    try {
      const base64Image = fs.readFileSync(image, { encoding: 'base64' });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an assistant that transcribes passages and questions from a given image. You must be clear and concise. Do not give any introduction messages like 'Sure, here are the questions'. 
                  You are to return it in valid JSON format like the following. Carefully analyze the photo and encapsulate accordingly. Do not confuse "  with each other. There can be multiple in one question. If there are any line breaks, use 
                  \\n for single line breaks and \\n\\n for double line breaks. If there are any italics, use *text*. If there are any quotes, use "text". STRICTLY FOLLOW: If there are any underlines, use _text_ 
                  {
                  "passage": "[passage]",
                  "question": "[question]\\n\\nA) [Option A]\\nB) [Option B]\\nC) [Option C]\\nD) [Option D]\\n\\n",
                  "correct_answer": "[Letter]"
                  }
                `,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        store: true,
      });

      let newMessage = response.choices[0]?.message?.content || 'No message returned';
      console.log(newMessage);

      let parseMessage;
      try {
        if (typeof newMessage === 'string') {
          newMessage = newMessage.replace(/```json|```/g, "").trim();
          parseMessage = JSON.parse(newMessage);
        }

        console.log("Parsed Message:", newMessage);
        const valuesToAppend = [[parseMessage.passage, parseMessage.question, parseMessage.correct_answer]];

        await appendToSheet(valuesToAppend, sheetName);

        console.log(`Response for image appended to Google Sheets!`);
        responses.push({
          image: image,
          response: parseMessage,
        });
      } catch (error) {
        console.error(`Error parsing response for image:`, error.message);
        responses.push({
          image: image,
          error: "Failed to parse OpenAI response",
        });
      }
    } catch (error) {
      console.error(`Error processing image:`, error.message);
      responses.push({
        image: image,
        error: error.message,
      });
    }
  }
 
  // Generate unique filename
  const uniqueFileName = generateUniqueFileName(sheetName);
  
  await exportSheetToXLSX(SPREADSHEET_ID, sheetName, uniqueFileName);
  await uploadXLSXToDrive(uniqueFileName, EXPORT_FOLDER_ID);
  
  await processExcelFile(uniqueFileName, sheetName)
    .then(result => console.log('Final JSON result:', JSON.stringify(result, null, 2)))
    .catch(error => console.error('Processing failed:', error.message));

  // Optionally, clean up the local file after processing
  try {
    fs.unlinkSync(uniqueFileName);
    console.log(`✅ Cleaned up temporary file: ${uniqueFileName}`);
  } catch (error) {
    console.error(`❌ Error cleaning up file: ${error.message}`);
  }

  return responses;
}

// Example usage
const filePath = 'output.xlsx'; // Replace with the actual file path

// Function to get the file ID from Google Drive
async function getFileIdFromDrive(fileName) {
  try {
    const response = await drive.files.list({
      q: `name = '${path.basename(fileName)}' and trashed = false`,
      fields: 'files(id, name)',
    });

    const files = response.data.files;
    if (files.length > 0) {
      return files[0].id;
    } else {
      throw new Error(`File not found: ${fileName}`);
    }
  } catch (error) {
    console.error('❌ Error retrieving file ID from Google Drive:', error.message);
    throw error;
  }
}

app.post('/process-pdf', async (req, res) => {
  try {
    await processPdfAndUpload();
    res.status(200).json({
      success: true,
      message: 'All PDFs have been processed successfully.',
    });
  } catch (error) {
    console.error('Error processing PDFs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process PDFs.',
    });
  }
});

async function deleteFileByName(fileName) {
  try {
    // Step 1: Search for the file by name
    const response = await drive.files.list({
      q: `name = '${fileName}' and trashed = false`,
      fields: 'files(id, name)',
    });

    const files = response.data.files;

    if (!files.length) {
      console.log(`No file found with name: ${fileName}`);
      return;
    }

    // Step 2: Delete each matching file (if multiple exist with the same name)
    for (const file of files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`✅ Deleted file: ${file.name} (${file.id})`);
    }
  } catch (error) {
    console.error('❌ Error deleting file:', error.message);
  }
}

async function clearOldDriveFiles(folderId) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    const files = response.data.files;

    if (!files.length) {
      console.log(`No files found in folder: ${folderId}`);
      return;
    }

    for (const file of files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`✅ Deleted file: ${file.name} (${file.id})`);
    }
  } catch (error) {
    console.error('❌ Error clearing files from Google Drive:', error.message);
  }
}

async function exportSheetToXLSX(spreadsheetId, sheetName, destinationPath) {
  try {
      const auth = new google.auth.GoogleAuth({
          keyFile: SERVICE_ACCOUNT_FILE, // Use the credentials file
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Fetch data from the specified sheet tab
      const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1000`, // Adjust range as needed
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
          throw new Error(`No data found in sheet "${sheetName}".`);
      }

      // Convert the data to an XLSX format
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Save to an XLSX file
      XLSX.writeFile(workbook, destinationPath);
      console.log(`✅ Sheet "${sheetName}" exported to ${destinationPath}`);
  } catch (error) {
      console.error('❌ Error exporting sheet to XLSX:', error.message);
  }
}

// Function to upload a file (XLSX, PNG, or any type) to Google Drive
async function uploadXLSXToDrive(filePath, folderId) {
  try {
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();


    // Set MIME type based on file extension
    let mimeType;
    if (fileExtension === '.xlsx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileExtension === '.png') {
      mimeType = 'image/png';
    } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      mimeType = 'image/jpeg';
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    const fileMetadata = {
      name: fileName,
      parents: [folderId], // Upload to the specified Google Drive folder
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log(`✅ Uploaded ${fileName} to Google Drive with ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("❌ Error uploading file to Google Drive:", error.message);
    throw error;
  }
}

async function processExcelFile(filePath, sheetName) {
  try {
    const data = fs.readFileSync(filePath);
    const workbook = XLSX.read(data, {
      type: 'buffer',
      cellStyles: true,
      cellNF: true,
      cellFormula: true,
      cellHTML: true,
      raw: false
    });

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false
    });

    if (jsonData.length < 2) {
      throw new Error('No valid data found in Excel file.');
    }

    const results = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row) continue;

      if (!row[1] && !row[2] && !row[3]) continue; // Skip if B, C, D are all empty

      const question = [row[1], row[2], row[3]]
        .filter(part => part) // Remove empty/undefined parts
        .join(' ')
        .trim();

      try {
        const response = await fetch('http://localhost:5000/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Classification result:', data);

        if (!data.success) {
          throw new Error(data.error || 'Classification failed');
        }

        results.push({
          question,
          classification: data.classification
        });

      } catch (error) {
        console.error('Error processing row:', error);
        results.push({
          question,
          classification: 'Error'
        });
      }
    }

    // Extract and format classifications for appending to sheet
    const classificationsToAppend = results.map(result => [result.classification]);

    // Append classifications to sheet
    await TwiceToSheet(classificationsToAppend, sheetName);


    return results;

  } catch (error) {
    console.error('Error processing file:', error.message);
    return { error: error.message };
  }
}

// Example usage:
// await exportSheetToXLSX('Sheet1', 'your_folder_id');

app.post('/export-sheet', async (req, res) => {
  try {
    const { sheetName } = req.body;
    const exportFolderId = 'YOUR_EXPORT_FOLDER_ID'; // Replace with your folder ID
    
    const fileId = await exportSheetToXLSX(sheetName, exportFolderId);
    
    res.status(200).json({
      success: true,
      message: `Sheet "${sheetName}" exported successfully`,
      fileId: fileId
    });
  } catch (error) {
    console.error('Error exporting sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export sheet',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying ${PORT + 1}...`);
    app.listen(PORT + 1);
  } else {
    console.error('Server error:', err);
  }
});

// Add this function to generate a unique filename
function generateUniqueFileName(sheetName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sheetName}_${timestamp}.xlsx`;
}