import { google } from 'googleapis';
import OpenAI from 'openai';
import readline from 'readline';
import path from "path";
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
      const numA = parseInt(a.name.match(/\d+/)?.[0]) || 0; // Extract numbers from file names
      const numB = parseInt(b.name.match(/\d+/)?.[0]) || 0;
      return numA - numB; // Ascending order (1 → 58)
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


// Function to append data to Google Sheets
async function appendToSheet(values, sheetName) {
    if (!sheetName) {
        console.error('Sheet name is undefined. Please provide a valid sheet name.');
        return; // Exit the function if the sheet name is not defined
    }

    const rangeName = `${sheetName}!A1`; // Construct the range
    try {
        const sheet = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: rangeName, // Use the new sheet name for the range
        });

        const existingRows = sheet.data.values ? sheet.data.values.length : 0;

        // Find the next available row, ensuring it doesn't use row 1 or row 28
        let targetRow = existingRows + 1;

        // Ensure row 1 and row 28 are skipped
        while (targetRow === 1 || targetRow === 28) {
            targetRow++; // Move to the next available row
        }

        const targetRange = `${sheetName}!A${targetRow}`; // Define the cell to start inserting

        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'RAW',
            resource: { values },
        };

        const result = await sheets.spreadsheets.values.append(request);
        console.log(`✅ Data appended to row ${targetRow}, skipping rows 1 and 28.`);
    } catch (error) {
        console.error('❌ Error appending to Google Sheets:', error.message);
    }
}


// // Function to interact with GPT
// async function chatWithGPT(prompt) {
//     try {
//         const response = await openai.chat.completions.create({
//             model: 'gpt-4o', // Replace with your desired GPT model
//             messages: [
//                 {
//                     role: 'system',
//                     content: (
//                         "You are an AI that generates SAT-style multiple-choice questions strictly related to the topic provided by the user. " +
//                         "You are to encapsulate the question with HTML and make it <h2> </h2> " +
//                         "If I provide you with a passage and/or a question, you are to give me a question of the same difficulty that assesses the same skill (i.e., if the original question tests vocabulary, the question you output must also test vocabulary). " +
//                         "The question must align with the topic and be in this format: " +
//                         "<h2> Question: [question] </h2> " +
//                         "A) [choice A] B) [choice B] C) [choice C] D) [choice D] " +
//                         "Correct Answer: [correct choice letter]."
//                     ),
//                 },
//                 { role: 'user', content: prompt },
//             ],
//         });
//         return response.choices[0].message.content.trim();
//     } catch (error) {
//         console.error('Error interacting with GPT:', error);
//         return null;
//     }
// }

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

    if (files.length === 0) {
      console.log('No files found in the folder.');
      return res.status(404).json({
        success: false,
        message: 'No files found in the folder.',
      });
    }

    console.log(`Found ${files.length} file(s) in the folder.`);

    const responses = []; // To store results for all files
    let count = 0;
    for (const file of files) {
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
          count++;
          const valuesToAppend = [[count, parseMessage.passage, parseMessage.question, parseMessage.correct_answer]];

          await appendToSheet(valuesToAppend); // Append to Google Sheets

          console.log(`Response for ${file.name} appended to Google Sheets!`);

          console.log(`Cell: ${count}`);
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

const PDF_FILE_PATH = path.resolve("zample.pdf");
const OUTPUT_DIR = path.resolve("converted_images");

// Check if the PDF exists
if (!fs.existsSync(PDF_FILE_PATH)) {
  console.error("❌ PDF file not found at:", PDF_FILE_PATH);
  process.exit(1);
} else {
  console.log("✅ PDF file exists at:", PDF_FILE_PATH);
}

async function clearProcessingQueue() {
  try {
    console.log("🛑 Clearing previous processing queue...");

    // 1️⃣ 🗑 Clear local `converted_images/` folder
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

    // 2️⃣ 🗑 Clear uploaded images from Google Drive
    await clearOldDriveFiles(FOLDER_PDF);

    // 3️⃣ (Optional) If there's an async queue system, reset it here
    // Reset any variables tracking ongoing tasks
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
    const images = fs.readdirSync(outputDir).filter((file) => file.endsWith(".png"));
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

async function createDefaultSheet(spreadsheetId) {
  try {
    const request = {
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [{ addSheet: {} }], // No title → Google Sheets auto-generates one
      },
    };

    const response = await sheets.spreadsheets.batchUpdate(request);
    const newSheet = response.data.replies[0].addSheet.properties;
    console.log(`✅ New sheet created: ${newSheet.title}`);
    return newSheet.title; // Returns the generated name (e.g., Sheet11, Sheet12)
  } catch (error) {
    console.error('❌ Error creating sheet:', error.message);
    throw error;
  }
}

// Function to download a PDF file from Google Drive
async function downloadPdfFromDrive(fileId) {
  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'stream' }
    );

    const filePath = path.join(OUTPUT_DIR, `${fileId}.pdf`);
    const dest = fs.createWriteStream(filePath);
    response.data.pipe(dest);

    return new Promise((resolve, reject) => {
      dest.on('finish', () => resolve(filePath));
      dest.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading PDF from Google Drive:', error.message);
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

// Update the processPdfAndUpload function to use Google Drive
async function processPdfAndUpload() {
  try {
    await clearProcessingQueue(); // 🚀 Ensure everything is clean before processing

    // List PDF files in the specified Google Drive folder
    const pdfFiles = await listPdfFilesInFolder(FOLDER_PDF);

    // Sort PDF files in ascending order based on their names
    pdfFiles.sort((a, b) => a.name.localeCompare(b.name));

    // 🔄 Start processing each PDF file
    for (const pdfFile of pdfFiles) {
      console.log(`Processing PDF file: ${pdfFile.name} (${pdfFile.id})`);

      // Create a new sheet for each PDF
      const newSheetName = await createDefaultSheet(SPREADSHEET_ID);

      // Download the PDF file
      const pdfFilePath = await downloadPdfFromDrive(pdfFile.id);

      // Convert the downloaded PDF to images
      const images = await convertPdfToImages(pdfFilePath, OUTPUT_DIR);

      for (const image of images) {
        await uploadFileToDrive(image);
      }

      console.log(`✅ All images from ${pdfFile.name} uploaded to Google Drive.`);

      // Transcribe images after uploading
      await transcribeImages(images, newSheetName);
    }

    // List uploaded files
    await listFilesInFolder(FOLDER_PDF);
  } catch (error) {
    console.error("❌ Error processing PDF:", error);
  } finally {
    // No need to delete the first image here, as it's handled in transcribeImages
  }
}

// Function to transcribe images
async function transcribeImages(images, sheetName) {
  const responses = []; // To store results for all files
  let count = 0;
  deleteFileByName("page-1.png");
  for (const image of images) {
    console.log(`Transcribing image: ${image}`);

    try {
      // Fetch the file content as Base64
      const base64Image = fs.readFileSync(image, { encoding: 'base64' });

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
        count++;
        const valuesToAppend = [[count, parseMessage.passage, parseMessage.question, parseMessage.correct_answer]];

        await appendToSheet(valuesToAppend, sheetName); // Append to Google Sheets

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
      } finally {
        // Delete the image file from Google Drive after processing
        try {
          const fileId = await getFileIdFromDrive(image); // Function to get the file ID
          await drive.files.delete({ fileId });
          console.log(`🗑️ Deleted image file from Google Drive: ${image}`);
        } catch (error) {
          console.error(`❌ Error deleting image from Google Drive:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Error processing image:`, error.message);
      responses.push({
        image: image,
        error: error.message,
      });
    }
  }

  return responses;
}

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
    console.error('Error processing PDFs:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process PDFs.',
      error: error.message,
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




const PORT = 3000; 

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});