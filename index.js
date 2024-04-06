import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import { PdfReader } from "pdfreader";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SET STORAGE
const upload = multer({ dest: "upload/" });

app.listen(3900, () => {
  console.log(`Start app listening on port ${3900}`);
});

app.post("/chunk-file-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.send("Invalid. File is required");
  }

  fs.readFile(req.file.path, async (err, data) => {
    if (err) {
      console.error("Error reading PDF file:", err);
      return;
    }

    try {
      // Create folder
      const folderName = `pdf-slice-${new Date().getTime()}`;
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }

      const trackingCodes = [];

      // Load the PDF document
      const pdfDoc = await PDFDocument.load(data);

      // Slice the PDF document into multiple parts
      const numberOfPages = pdfDoc.getPageCount();

      console.log(`Total files PDF: ${numberOfPages}`);

      for (let i = 0; i < numberOfPages; i++) {
        const slicedPdf = await PDFDocument.create();
        const [slice] = await slicedPdf.copyPages(pdfDoc, [i]);

        // Write the sliced PDF to a new file
        slicedPdf.addPage(slice);

        const slicedPdfBytes = await slicedPdf.save();

        // Read file PDF and write file
        await new Promise((res) => {
          new PdfReader().parseBuffer(slicedPdfBytes, (err, item) => {
            if (err) {
              console.log(` [INFO]: Read file PDF error: file number ${i + 1}`);
              res(false);
              return;
            }

            const regex = /^[0-9]+$/;

            // Checking field Tracking code
            if (
              item &&
              item.text &&
              item.text.startsWith("94") &&
              regex.test(String(item.text).replace(/\s+/g, ""))
            ) {
              console.log(`👉 Start create file PDF number ${i + 1}...`);

              const trackingCode = String(item.text).replace(/\s+/g, "").trim();
              trackingCodes.push(trackingCode);

              fs.writeFileSync(
                `${folderName}/${trackingCode}}.pdf`,
                slicedPdfBytes
              );

              res(true);
            }
          });
        });
      }

      console.log("✅ Successfully slice pdf");
      // Response
      res.send(trackingCodes);
    } catch (error) {
      console.error("Error slicing PDF:", error);

      // Response
      res.send("Error slicing PDF", error);
    }
  });
});
