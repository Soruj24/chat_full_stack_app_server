import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import * as fs from "fs";
import * as path from "path";
import os from "os";

export const processFileBuffer = async (
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  // Create a temporary file to use with LangChain loaders
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${fileName}`);
  
  try {
    fs.writeFileSync(tempFilePath, buffer);
    
    let loader;
    const extension = path.extname(fileName).toLowerCase();

    if (extension === ".pdf" || mimeType === "application/pdf") {
      loader = new PDFLoader(tempFilePath, { splitPages: false });
    } else if (extension === ".docx") {
      loader = new DocxLoader(tempFilePath);
    } else {
      // Default to text loader for .txt, .md, etc.
      loader = new TextLoader(tempFilePath);
    }

    const docs = await loader.load();
    
    // Combine all pages/parts into one text
    const fullText = docs.map((doc: Document) => doc.pageContent).join("\n\n");
    
    return fullText;
  } catch (error) {
    console.error("Error processing document with LangChain:", error);
    throw new Error(`Failed to extract text from ${fileName}`);
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};

export const splitTextIntoChunks = async (text: string): Promise<Document[]> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  return await splitter.createDocuments([text]);
};
