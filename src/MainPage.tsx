import { useState, ChangeEvent } from "react";
import * as XLSX from "xlsx";

type ParticipantData = {
  Time: number;
  Rating: number;
};

type ProcessedData = {
  Participant: string;
  Data: ParticipantData[];
};

export default function MainPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<ProcessedData[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setFile(file);
  };

  const handleFileProcess = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const buffer = e.target?.result as ArrayBuffer;
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      const processedData = preprocessData(data);
      setJsonData(processedData);
      saveProcessedData(processedData);
    };
    reader.readAsArrayBuffer(file);
  };

  function preprocessData(data: any[]): ProcessedData[] {
    const groupedData: { [key: string]: ParticipantData[] } = {};

    data.forEach((row) => {
      const participant = row.Participant as string;
      if (!groupedData[participant]) {
        groupedData[participant] = [];
      }
      groupedData[participant].push({ Time: row.Time, Rating: row.Rating });
    });

    return Object.entries(groupedData).map(([participant, values]) => {
      return { Participant: participant, Data: values };
    });
  }

  function saveProcessedData(data: ProcessedData[]): void {
    // Determine the maximum number of time-rating pairs
    const maxPairs = Math.max(...data.map((item) => item.Data.length));

    // Create headers
    const headers = ["Participant"];
    for (let i = 0; i < maxPairs; i++) {
      headers.push(`Time${i + 1}`, `Rating${i + 1}`);
    }

    // Transform data to match headers
    const transformedData = data.map((item) => {
      const rowData: { [key: string]: string | number } = {
        Participant: item.Participant,
      };
      item.Data.forEach((pair, index) => {
        rowData[`Time${index + 1}`] = pair.Time;
        rowData[`Rating${index + 1}`] = pair.Rating;
      });
      return rowData;
    });

    const newWorksheet = XLSX.utils.json_to_sheet(transformedData, {
      header: headers,
      skipHeader: false,
    });
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "ProcessedData");

    // Create a temporary anchor element to trigger download
    const tempDownloadUrl = window.URL.createObjectURL(
      new Blob([XLSX.write(newWorkbook, { type: "array", bookType: "xlsx" })], {
        type: "application/octet-stream",
      })
    );

    const anchor = document.createElement("a");
    anchor.href = tempDownloadUrl;
    anchor.download = "ProcessedData.xlsx";
    document.body.appendChild(anchor);
    anchor.click();

    window.URL.revokeObjectURL(tempDownloadUrl);
    anchor.remove();
  }

  return (
    <div style={{ height: "100%" }}>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
      <button onClick={handleFileProcess} disabled={!file}>
        Process and Download File
      </button>

      {jsonData.length > 0 && (
        <div>
          {jsonData.map((item, index) => (
            <div key={index}>
              Participant {item.Participant}:{" "}
              {item.Data.map(
                (d) => `Time: ${d.Time}, Rating: ${d.Rating}`
              ).join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
