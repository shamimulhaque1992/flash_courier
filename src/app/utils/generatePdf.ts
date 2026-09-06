import PDFDocument from "pdfkit";

type PdfBuilder = (doc: InstanceType<typeof PDFDocument>) => void;

export const generatePdf = (builder: PdfBuilder): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 50 });
		const chunks: Buffer[] = [];

		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		builder(doc);
		doc.end();
	});
};
